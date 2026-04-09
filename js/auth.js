// auth.js - Authentication state and Supabase integration
import { send, on } from './ws.js';

const SUPABASE_URL      = 'https://dpixehhdbtzsbckfektd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaXhlaGhkYnR6c2Jja2Zla3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNDI0MjcsImV4cCI6MjA3NjcxODQyN30.nR1KCSRQj1E_evQWnE2VaZzg7PgLp2kqt4eDKP2PkpE';

const AUTH_KEY      = 'ipai_auth_v1';
const TEMP_ID_KEY   = 'ipai_temp_id';
const CLIENT_ID_KEY = 'ipai_client_id';
// Key written by oauth-callback.html so the main tab can pick it up
const OAUTH_PENDING_KEY = 'ipai_oauth_pending';

export let currentUser      = null;
export let userProfile      = null;
export let userSettings     = null;
export let subscriptionInfo = null;

const authListeners = new Set();

export function onAuthChange(fn) { authListeners.add(fn); return () => authListeners.delete(fn); }
export function isAuthenticated() { return !!currentUser; }

function notifyListeners() {
  authListeners.forEach(fn => fn({ currentUser, userProfile, userSettings }));
}

export function getClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) { id = `web-${crypto.randomUUID()}`; localStorage.setItem(CLIENT_ID_KEY, id); }
  return id;
}
export function getTempId() {
  let id = localStorage.getItem(TEMP_ID_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(TEMP_ID_KEY, id); }
  return id;
}
export function saveAuth(data)  { localStorage.setItem(AUTH_KEY, JSON.stringify(data)); }
export function loadAuth()      { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } }
export function clearAuth()     { localStorage.removeItem(AUTH_KEY); }

// ── Supabase REST helpers ─────────────────────────────────────────────────

async function supabaseFetch(path, options = {}) {
  const token = options._useToken || SUPABASE_ANON_KEY;
  delete options._useToken;
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  return res.json();
}

export async function loginWithEmail(email, password) {
  const data = await supabaseFetch('/auth/v1/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
  if (data.error) throw new Error(data.error_description || data.error);
  await handleSupabaseSession(data, { showWelcome: true });
  return data;
}

export async function signUpWithEmail(email, password) {
  const data = await supabaseFetch('/auth/v1/signup', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
  if (data.error) throw new Error(data.error_description || data.error);
  if (data.access_token) await handleSupabaseSession(data, { showWelcome: true });
  return data;
}

/**
 * OAuth login via popup.
 * The popup writes the tokens to localStorage under OAUTH_PENDING_KEY,
 * then closes itself.  This tab listens for the storage event and picks
 * them up — no postMessage needed (works even when opener is null, e.g.
 * on some mobile browsers or strict sandboxes).
 */
export async function loginWithOAuth(provider) {
  const redirectTo = encodeURIComponent(`${location.origin}/oauth-callback.html`);
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${redirectTo}`;
  window.open(url, '_blank', 'width=520,height=640,noopener,noreferrer');
  // The storage listener below (window.addEventListener('storage', ...))
  // will fire when the popup writes OAUTH_PENDING_KEY and complete the login.
}

export async function logout() {
  const auth = loadAuth();
  if (auth?.access_token) {
    try {
      await supabaseFetch('/auth/v1/logout', {
        method: 'POST', _useToken: auth.access_token,
      });
    } catch {}
  }
  send({ type: 'auth:logout' });
  clearAuth();
  currentUser = null; userProfile = null; userSettings = null; subscriptionInfo = null;
  notifyListeners();
  updateSidebarProfile();
  initAsGuest();
  import('./app.js').then((m) => m.resetToNewChatView()).catch(() => {});
}

// ── Session handling ──────────────────────────────────────────────────────

async function handleSupabaseSession(data, { showWelcome = false } = {}) {
  console.log('[Frontend Auth] handleSupabaseSession called with token:', data.access_token?.slice(0, 20) + '...');
  if (!data.access_token) throw new Error('No access token');
  const existingAuth = loadAuth() || {};
  saveAuth({ ...existingAuth, access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });

  return new Promise((resolve, reject) => {
    const tempId   = getTempId();
    const clientId = getClientId();
    console.log('[Frontend Auth] Sending auth:login to backend with token:', data.access_token?.slice(0, 20) + '...');
    send({ type: 'auth:login', accessToken: data.access_token, refreshToken: data.refresh_token,
      tempId, clientId, deviceToken: existingAuth.deviceToken || null });

    const unsubOk  = on('auth:ok',    (msg) => {
      console.log('[Frontend Auth] Received auth:ok response');
      unsubOk();
      unsubErr();
      applyAuthOk(msg);
      if (showWelcome) {
        import('./app.js').then((m) => m.resetToNewChatView()).catch(() => {});
      }
      resolve(msg);
    });
    const unsubErr = on('auth:error', (msg) => { 
      console.error('[Frontend Auth] Received auth:error:', msg.message);
      unsubOk(); unsubErr(); reject(new Error(msg.message));
    });

    setTimeout(() => { unsubOk(); unsubErr(); reject(new Error('Auth timeout')); }, 12000);
  });
}

function applyAuthOk(msg) {
  console.log('[Frontend Auth] applyAuthOk called with msg:', msg);
  currentUser  = { id: msg.userId, email: msg.email };
  userProfile  = msg.profile;
  userSettings = msg.settings;
  subscriptionInfo = msg.subscription || null;
  console.log('[Frontend Auth] Subscription info set to:', subscriptionInfo);
  console.log('[Frontend Auth] subscriptionInfo?.planKey:', subscriptionInfo?.planKey);
  console.log('[Frontend Auth] subscriptionInfo?.planName:', subscriptionInfo?.planName);
  const auth = loadAuth() || {};
  saveAuth({ ...auth, userId: msg.userId, deviceToken: msg.deviceToken });
  notifyListeners();
  console.log('[Frontend Auth] Calling updateSidebarProfile...');
  updateSidebarProfile();
  // Apply saved theme
  if (msg.settings?.theme) {
    import('./settings.js').then(m => m.applyTheme(msg.settings.theme));
  }
}

function initAsGuest() {
  send({ type: 'auth:guest', tempId: getTempId() });
}

// ── WS events ─────────────────────────────────────────────────────────────

on('auth:newLogin', (msg) => {
  import('./ui.js').then(({ showNotification }) => {
    showNotification({
      type: 'warning',
      message: `New login detected from ${msg.ip || 'unknown location'}`,
      action: { label: 'View', onClick: () => import('./settings.js').then(m => m.openSettings('account')) },
      duration: 8000,
    });
  });
});

on('auth:forcedLogout', (msg) => {
  import('./ui.js').then(({ showNotification }) => {
    showNotification({ type: 'error', message: msg.reason || 'Session revoked', duration: 5000 });
  });
  setTimeout(() => logout(), 1500);
});

on('settings:updated', (msg) => {
  if (msg.settings) {
    userSettings = msg.settings;
    import('./settings.js').then(m => m.applyTheme(msg.settings.theme));
  }
});

// ── Reconnect on WS connect ────────────────────────────────────────────────

on('ws:connected', async () => {
  console.log('[Frontend Auth] WS connected event');
  const auth = loadAuth();
  console.log('[Frontend Auth] Loaded auth:', auth ? 'exists' : 'null');
  if (auth?.access_token) {
    try {
      console.log('[Frontend Auth] Attempting to resume session with existing token');
      await handleSupabaseSession(auth, { showWelcome: false });
    }
    catch (err) {
      console.error('[Frontend Auth] Failed to resume session:', err);
      clearAuth();
      initAsGuest();
    }
  } else {
    console.log('[Frontend Auth] No stored auth, initializing as guest');
    initAsGuest();
  }
});

// ── OAuth: localStorage-based token pickup ────────────────────────────────
// Works for both popup and redirect flows.
// The oauth-callback.html page writes { access_token, refresh_token } to
// localStorage[OAUTH_PENDING_KEY] then closes/redirects.  The storage event
// fires in all other tabs from the same origin.

window.addEventListener('storage', async (e) => {
  if (e.key !== OAUTH_PENDING_KEY || !e.newValue) return;
  console.log('[Frontend Auth] OAuth pending key detected in localStorage');
  // Consume immediately so other tabs don't also try to log in
  localStorage.removeItem(OAUTH_PENDING_KEY);
  let tokens;
  try { tokens = JSON.parse(e.newValue); } catch { 
    console.error('[Frontend Auth] Failed to parse OAuth tokens');
    return;
  }
  if (!tokens?.access_token) {
    console.warn('[Frontend Auth] No access token in OAuth response');
    return;
  }
  console.log('[Frontend Auth] Processing OAuth tokens:', tokens.access_token?.slice(0, 20) + '...');
  try {
    await handleSupabaseSession(tokens, { showWelcome: true });
    import('./ui.js').then(({ showNotification }) =>
      showNotification({ type: 'success', message: 'Signed in!', duration: 2500 }));
  } catch (err) {
    console.error('[Frontend Auth] OAuth sign-in error:', err);
    import('./ui.js').then(({ showNotification }) =>
      showNotification({ type: 'error', message: `Sign-in failed: ${err.message}`, duration: 4000 }));
  }
});

// Also handle same-tab redirect flow (no popup) — ?oauth=1&t=TOKEN&r=REFRESH
(function checkOAuthRedirect() {
  const params = new URLSearchParams(location.search);
  const t = params.get('t'), r = params.get('r');
  console.log('[Frontend Auth] Checking for OAuth redirect params:', t ? 'found token' : 'no token');
  if (params.get('oauth') === '1' && t) {
    console.log('[Frontend Auth] Processing OAuth redirect with token:', t.slice(0, 20) + '...');
    history.replaceState({}, '', '/');
    handleSupabaseSession({ access_token: t, refresh_token: r || '' }, { showWelcome: true }).catch((err) => {
      console.error('[Frontend Auth] OAuth redirect failed:', err);
    });
  }
})();

// Legacy postMessage support (kept for backwards compat with old callback pages)
window.addEventListener('message', async (e) => {
  if (e.origin !== location.origin) return;
  if (e.data?.type !== 'oauth:callback') return;
  console.log('[Frontend Auth] postMessage oauth:callback received');
  const { access_token, refresh_token } = e.data;
  if (!access_token) {
    console.warn('[Frontend Auth] No access_token in postMessage oauth:callback');
    return;
  }
  console.log('[Frontend Auth] Processing postMessage tokens:', access_token?.slice(0, 20) + '...');
  try { await handleSupabaseSession({ access_token, refresh_token }, { showWelcome: true }); }
  catch (err) {
    console.error('[Frontend Auth] postMessage sign-in error:', err);
    import('./ui.js').then(({ showNotification }) =>
      showNotification({ type: 'error', message: `Sign-in failed: ${err.message}`, duration: 4000 }));
  }
});

// ── Sidebar profile ───────────────────────────────────────────────────────

export function updateSidebarProfile() {
  console.log('[Frontend Auth] updateSidebarProfile called - currentUser:', currentUser);
  const guestEl = document.getElementById('guest-section');
  const userEl  = document.getElementById('user-section');
  const nameEl  = document.getElementById('user-name-display');
  const planEl  = document.getElementById('user-plan-display');
  const avatarEl= document.getElementById('user-avatar');

  if (!currentUser) {
    console.log('[Frontend Auth] Not logged in, showing guest section');
    guestEl?.classList.remove('hidden');
    userEl?.classList.add('hidden');
    return;
  }
  guestEl?.classList.add('hidden');
  userEl?.classList.remove('hidden');

  const username = userProfile?.username || currentUser.email?.split('@')[0] || '?';
  if (nameEl)   nameEl.textContent = username;
  if (avatarEl) avatarEl.textContent = username[0].toUpperCase();

  const plan     = subscriptionInfo?.planKey || 'free';
  const planName = subscriptionInfo?.planName || 'Free';
  console.log('[Frontend Auth] Setting plan display - plan:', plan, 'planName:', planName, 'subscriptionInfo:', subscriptionInfo);
  if (planEl) { planEl.textContent = planName; planEl.setAttribute('data-plan', plan); }
  if (avatarEl) { avatarEl.setAttribute('data-plan', plan); }
}

on('auth:ok', updateSidebarProfile);
on('auth:loggedOut', updateSidebarProfile);
