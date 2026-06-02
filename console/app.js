import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let cfg = null;
let supabase = null;
let session = null;
const FALLBACK_API_BASE_URL = "https://sharktide-lightning.hf.space";

const el = {
  appName: document.getElementById("app-name"),
  homeLink: document.getElementById("home-link"),
  authState: document.getElementById("auth-state"),
  emailAuthForm: document.getElementById("email-auth-form"),
  emailInput: document.getElementById("email-input"),
  passwordInput: document.getElementById("password-input"),
  signupBtn: document.getElementById("signup-btn"),
  googleBtn: document.getElementById("google-btn"),
  githubBtn: document.getElementById("github-btn"),
  forgotBtn: document.getElementById("forgot-btn"),
  deleteBtn: document.getElementById("delete-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  // auth view toggles
  signedOutView: document.getElementById("signed-out-view"),
  signedInView: document.getElementById("signed-in-view"),
  userAvatar: document.getElementById("user-avatar"),
  userEmailDisplay: document.getElementById("user-email-display"),
  // wallet toggle
  walletContent: document.getElementById("wallet-content"),
  walletLocked: document.getElementById("wallet-locked"),
  // notices
  noticeList: document.getElementById("notice-list"),
  packGrid: document.getElementById("pack-grid"),
  modelsGrid: document.getElementById("models-grid"),
  rateList: document.getElementById("rate-list"),
  creditsRemaining: document.getElementById("credits-remaining"),
  creditsTotal: document.getElementById("credits-total"),
  creditsUsed: document.getElementById("credits-used"),
  ledgerTable: document.getElementById("ledger-table"),
  apiKeyCard: document.getElementById("api-keys-card"),
  apiKeyName: document.getElementById("api-key-name"),
  apiKeyExpiry: document.getElementById("api-key-expiry"),
  apiKeyStatus: document.getElementById("api-key-status"),
  apiKeyList: document.getElementById("api-key-list"),
  apiKeyReveal: document.getElementById("api-key-reveal"),
  apiKeySecret: document.getElementById("api-key-secret"),
  createApiKeyBtn: document.getElementById("create-api-key-btn"),
  refreshApiKeysBtn: document.getElementById("refresh-api-keys-btn"),
  copyApiKeyBtn: document.getElementById("copy-api-key-btn"),
  closeApiKeyRevealBtn: document.getElementById("close-api-key-reveal-btn"),
  runText: document.getElementById("run-text"),
  textPrompt: document.getElementById("text-prompt"),
  textOutput: document.getElementById("text-output"),
  runImage: document.getElementById("run-image"),
  imagePrompt: document.getElementById("image-prompt"),
  imageOutput: document.getElementById("image-output"),
  runVideo: document.getElementById("run-video"),
  videoPrompt: document.getElementById("video-prompt"),
  videoDuration: document.getElementById("video-duration"),
  videoOutput: document.getElementById("video-output"),
  runAudio: document.getElementById("run-audio"),
  audioPrompt: document.getElementById("audio-prompt"),
  audioDuration: document.getElementById("audio-duration"),
  audioOutput: document.getElementById("audio-output")
};

// Cards that require sign-in
const PROTECTED_CARDS = [
  "wallet-card", "notices-card", "pricing-card",
  "models-card", "playground-card", "ledger-card", "api-keys-card"
];

let currentRawApiKey = "";
let currentApiKeyName = "";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[match] || match));
}

function formatDateTime(value) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function getApiKeyStatus(apiKey) {
  if (apiKey.isRevoked) {
    return { label: "Revoked", className: "is-revoked" };
  }
  if (apiKey.isExpired) {
    return { label: "Expired", className: "is-expired" };
  }
  return { label: "Active", className: "is-active" };
}

function setApiKeyStatus(message) {
  if (el.apiKeyStatus) {
    el.apiKeyStatus.textContent = message;
  }
}

function hideApiKeyReveal() {
  currentRawApiKey = "";
  currentApiKeyName = "";
  if (el.apiKeyReveal) {
    el.apiKeyReveal.style.display = "none";
  }
  if (el.apiKeySecret) {
    el.apiKeySecret.textContent = "";
  }
}

function showApiKeyReveal(rawKey, name) {
  currentRawApiKey = rawKey;
  currentApiKeyName = name;
  if (el.apiKeySecret) {
    el.apiKeySecret.textContent = rawKey;
  }
  if (el.apiKeyReveal) {
    el.apiKeyReveal.style.display = "";
  }
}

function renderApiKeys(items) {
  if (!el.apiKeyList) return;

  if (!Array.isArray(items) || items.length === 0) {
    el.apiKeyList.innerHTML = `
      <div class="locked-overlay" style="margin-top:1rem;">
        No API keys yet. Generate one to authenticate Lightning requests without a Supabase session JWT.
      </div>
    `;
    return;
  }

  el.apiKeyList.innerHTML = items.map((apiKey) => {
    const status = getApiKeyStatus(apiKey);
    return `
      <article class="api-key-row">
        <div class="api-key-row-head">
          <div class="api-key-row-title">
            <div class="api-key-name">${escapeHtml(apiKey.name)}</div>
            <div class="api-key-prefix">${escapeHtml(apiKey.keyPrefix)}...</div>
          </div>
          <div class="api-key-badge ${status.className}">${escapeHtml(status.label)}</div>
        </div>
        <div class="api-key-meta">
          <span>Created: ${escapeHtml(formatDateTime(apiKey.createdAt))}</span>
          <span>Last used: ${escapeHtml(formatDateTime(apiKey.lastUsedAt))}</span>
          <span>Expires: ${escapeHtml(apiKey.expiresAt ? formatDateTime(apiKey.expiresAt) : "Never")}</span>
        </div>
        <div class="api-key-actions">
          <button
            type="button"
            class="ghost"
            data-api-key-action="revoke"
            data-api-key-id="${escapeHtml(apiKey.id)}"
            ${apiKey.isRevoked ? "disabled" : ""}
          >
            ${apiKey.isRevoked ? "Revoked" : "Revoke Key"}
          </button>
        </div>
      </article>
    `;
  }).join("");

  el.apiKeyList.querySelectorAll('[data-api-key-action="revoke"]').forEach((button) => {
    button.addEventListener("click", () => {
      const keyId = button.dataset.apiKeyId;
      if (!keyId) return;
      void revokeApiKey(keyId);
    });
  });
}

async function refreshApiKeys() {
  if (!session?.access_token) {
    if (el.apiKeyList) {
      el.apiKeyList.innerHTML = `
        <div class="locked-overlay" style="margin-top:1rem;">
          Sign in to create and manage Lightning API keys.
        </div>
      `;
    }
    setApiKeyStatus("Sign in to create and manage Lightning API keys.");
    return;
  }

  try {
    const response = await fetchJson("/v1/lightning-api-keys", { headers: authHeaders() });
    renderApiKeys(response.items || []);
    setApiKeyStatus("Use a generated key as Authorization: Bearer <your-api-key> when calling Lightning.");
  } catch (error) {
    if (el.apiKeyList) {
      el.apiKeyList.innerHTML = `
        <div class="locked-overlay" style="margin-top:1rem;">
          Could not load API keys.
        </div>
      `;
    }
    setApiKeyStatus(`Could not load API keys: ${error.message || String(error)}`);
  }
}

async function createApiKey() {
  if (!session?.access_token) {
    showToast("Sign in first, then create an API key.");
    return;
  }

  const name = el.apiKeyName?.value.trim() || "";
  const expiresAt = el.apiKeyExpiry?.value.trim() || null;
  if (!name) {
    setApiKeyStatus("Please enter a name for this key.");
    return;
  }

  setBusy(el.createApiKeyBtn, true, "Creating…");
  setApiKeyStatus("Creating API key...");

  try {
    const result = await fetchJson("/v1/lightning-api-keys", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name, expiresAt })
    });

    if (!result?.apiKey || !result?.rawKey) {
      throw new Error("Could not create API key");
    }

    if (el.apiKeyName) el.apiKeyName.value = "";
    if (el.apiKeyExpiry) el.apiKeyExpiry.value = "";
    showApiKeyReveal(result.rawKey, result.apiKey.name);
    setApiKeyStatus("New key created. Copy it now before closing the reveal panel.");
    await refreshApiKeys();
  } catch (error) {
    setApiKeyStatus(`Error: ${error.message || String(error)}`);
  } finally {
    setBusy(el.createApiKeyBtn, false);
  }
}

async function revokeApiKey(keyId) {
  const target = prompt("Type REVOKE to confirm this API key should be revoked.");
  if (target !== "REVOKE") return;

  try {
    const result = await fetchJson(`/v1/lightning-api-keys/${encodeURIComponent(keyId)}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (!result?.success) {
      throw new Error("Could not revoke API key");
    }
    setApiKeyStatus(`Revoked API key "${result.apiKey?.name || keyId}".`);
    await refreshApiKeys();
  } catch (error) {
    setApiKeyStatus(`Could not revoke API key: ${error.message || String(error)}`);
  }
}

function showToast(message) {
  console.log(message);
  alert(message);
}

function apiBase() {
  const configured = String(cfg?.dashboard?.apiBaseUrl || "").trim();
  if (configured.startsWith("https://")) {
    return configured.replace(/\/$/, "");
  }
  return FALLBACK_API_BASE_URL;
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${apiBase()}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || `HTTP ${response.status}`);
  }
  return data;
}

function authHeaders() {
  if (!session?.access_token) throw new Error("Sign in required");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`
  };
}

function renderConfig() {
  document.title = `${cfg.dashboard.appName} Developer Console`;
  el.appName.textContent = `${cfg.dashboard.appName} Developer Console`;
  el.homeLink.href = cfg.dashboard.homeUrl;

  el.noticeList.innerHTML = "";
  (cfg.notices || []).forEach((notice) => {
    const node = document.createElement("article");
    node.className = `notice ${notice.level || "info"}`;
    node.innerHTML = `<strong>${(notice.level || "info").toUpperCase()}</strong><p>${notice.message}</p>`;
    el.noticeList.appendChild(node);
  });

  el.packGrid.innerHTML = "";
  (cfg.billing?.packs || []).forEach((pack) => {
    const card = document.createElement("article");
    card.className = "pack";
    const link = pack.stripePaymentLink || "";
    const disabled = !link;
    card.innerHTML = `
      <strong>${pack.label}</strong>
      <div class="credit-amount">${Number(pack.credits).toFixed(4)} credits</div>
      <div class="muted">$${Number(pack.amountUsd).toFixed(2)} USD</div>
      <button ${disabled ? "disabled" : ""}>${disabled ? "Link pending" : "Add credits"}</button>
    `;
    card.querySelector("button")?.addEventListener("click", () => {
      if (!session?.user?.email) {
        showToast("Sign in first, then purchase credits.");
        return;
      }
      const url = new URL(link);
      if (!url.searchParams.has("prefilled_email")) {
        url.searchParams.set("prefilled_email", session.user.email);
      }
      window.location.href = url.toString();
    });
    el.packGrid.appendChild(card);
  });

  const p = cfg.pricing || {};
  el.rateList.innerHTML = `
    <li>${p.textCreditPerMillionTokens} credits per 1,000,000 text tokens (including multimodal text payloads)</li>
    <li>${p.imageCreditPerImage} credits per image</li>
    <li>${p.videoCreditPerSecond} credits per second of video</li>
    <li>${p.audioCreditPerSecond} credits per second of audio (music/sfx)</li>
  `;

  el.modelsGrid.innerHTML = "";
  (cfg.models || []).forEach((model) => {
    const card = document.createElement("article");
    card.className = "model-card";
    card.innerHTML = `
      <img src="./assets/logo.png" alt="logo" />
      <div>
        <strong>${model.name}</strong>
        <p>${String(model.type || "model").toUpperCase()}</p>
      </div>
    `;
    el.modelsGrid.appendChild(card);
  });
}

async function refreshAccount() {
  if (!session) return;
  const data = await fetchJson("/v1/me", { headers: authHeaders() });
  const wallet = data.wallet || {};
  const usage = data.usage_summary || {};

  el.creditsRemaining.textContent = Number(wallet.balance_credits || 0).toFixed(4);
  el.creditsTotal.textContent = Number(wallet.lifetime_credits_purchased || 0).toFixed(4);
  el.creditsUsed.textContent = Number(usage.totalCreditsUsed || 0).toFixed(4);

  const ledger = await fetchJson("/v1/credits/ledger?limit=30", { headers: authHeaders() });
  renderLedger(ledger.entries || []);
}

function renderLedger(entries) {
  el.ledgerTable.innerHTML = "";
  if (!entries.length) {
    el.ledgerTable.innerHTML = `<div class="locked-overlay" style="min-height:60px;">No ledger entries yet.</div>`;
    return;
  }

  // Header row
  const header = document.createElement("div");
  header.className = "ledger-header";
  header.innerHTML = `
    <span>Type</span>
    <span>Credits</span>
    <span>Units</span>
    <span>Date</span>
  `;
  el.ledgerTable.appendChild(header);

  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "ledger-row";
    row.innerHTML = `
      <div><strong>${entry.entry_type}</strong><div class="muted tiny">${entry.usage_kind || "—"}</div></div>
      <div style="font-family:var(--mono);font-size:0.8rem;">${Number(entry.delta_credits || 0).toFixed(4)}</div>
      <div style="font-family:var(--mono);font-size:0.8rem;">${entry.units != null ? entry.units : "—"} ${entry.unit_label || ""}</div>
      <div class="muted tiny">${entry.created_at || ""}</div>
    `;
    el.ledgerTable.appendChild(row);
  });
}

function setProtectedCardsVisible(visible) {
  PROTECTED_CARDS.forEach((id) => {
    const card = document.getElementById(id);
    if (card) card.style.display = visible ? "" : "none";
  });
}

function renderAuthState() {
  if (session?.user) {
    el.signedOutView.style.display = "none";
    el.signedInView.style.display = "flex";
    el.logoutBtn.style.display = "";

    const email = session.user.email || "";
    el.userEmailDisplay.textContent = email;
    el.userAvatar.textContent = email ? email[0].toUpperCase() : "?";

    setProtectedCardsVisible(true);

    el.walletContent.style.display = "";
    el.walletLocked.style.display = "none";
    if (el.apiKeyCard) el.apiKeyCard.style.display = "";
  } else {
    el.signedOutView.style.display = "";
    el.signedInView.style.display = "none";
    el.logoutBtn.style.display = "none";

    setProtectedCardsVisible(false);

    el.walletContent.style.display = "none";
    el.walletLocked.style.display = "";
    if (el.apiKeyCard) el.apiKeyCard.style.display = "none";
    hideApiKeyReveal();

    el.creditsRemaining.textContent = "—";
    el.creditsTotal.textContent = "—";
    el.creditsUsed.textContent = "—";
    el.ledgerTable.textContent = "";
    if (el.apiKeyList) {
      el.apiKeyList.textContent = "";
    }
  }
}

async function initSupabase() {
  const url = cfg.supabase?.url;
  const key = cfg.supabase?.publishableKey;
  if (!url || !key) {
    showToast("Supabase config is missing from /v1/config.");
    return;
  }

  supabase = createClient(url, key, { auth: { persistSession: true } });
  const { data } = await supabase.auth.getSession();
  session = data.session;
  renderAuthState();

  if (session) {
    await refreshAccount().catch((e) => showToast(e.message));
    await refreshApiKeys().catch((e) => showToast(e.message));
  }

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    session = nextSession;
    renderAuthState();
    if (session) {
      await refreshAccount().catch((e) => showToast(e.message));
      await refreshApiKeys().catch((e) => showToast(e.message));
    }
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const next = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === next);
      });
    });
  });
}

function setupAuthActions() {
  el.emailAuthForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: el.emailInput.value,
        password: el.passwordInput.value
      });
      if (error) throw error;
    } catch (error) {
      showToast(error.message || "Sign in failed");
    }
  });

  el.signupBtn.addEventListener("click", async () => {
    try {
      const { error } = await supabase.auth.signUp({
        email: el.emailInput.value,
        password: el.passwordInput.value
      });
      if (error) throw error;
      showToast("Sign-up complete. Check your email for confirmation if required.");
    } catch (error) {
      showToast(error.message || "Sign up failed");
    }
  });

  el.googleBtn.addEventListener("click", async () => {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
  });

  el.githubBtn.addEventListener("click", async () => {
    await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: window.location.href } });
  });

  el.forgotBtn.addEventListener("click", async () => {
    const email = el.emailInput.value?.trim();
    if (!email) {
      showToast("Enter your email first.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: cfg.supabase.resetRedirectUrl
      });
      if (error) throw error;
      showToast("Password reset email sent.");
    } catch (error) {
      showToast(error.message || "Failed to send password reset");
    }
  });

  el.deleteBtn.addEventListener("click", async () => {
    if (!session?.user) return;
    if (!confirm("Delete your account permanently? This immediately removes all credits.")) return;

    try {
      const provider = session.user.app_metadata?.provider;
      if (provider === "email") {
        const password = prompt("Confirm your password to delete account:");
        if (!password) return;

        const verifyResponse = await fetch(cfg.supabase.deletePasswordVerifyEndpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: session.user.email, password })
        });
        if (!verifyResponse.ok) {
          throw new Error("Password verification failed");
        }
      }

      const deleteResponse = await fetch(cfg.supabase.deleteAccountEndpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!deleteResponse.ok) {
        const payload = await deleteResponse.json().catch(() => ({}));
        throw new Error(payload.error || "Delete account failed");
      }

      await supabase.auth.signOut();
      showToast("Account deleted.");
    } catch (error) {
      showToast(error.message || "Delete account failed");
    }
  });

  el.logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });
}

function setupApiKeyActions() {
  el.createApiKeyBtn?.addEventListener("click", () => {
    void createApiKey();
  });

  el.refreshApiKeysBtn?.addEventListener("click", () => {
    void refreshApiKeys();
  });

  el.copyApiKeyBtn?.addEventListener("click", async () => {
    if (!currentRawApiKey) return;
    try {
      await navigator.clipboard.writeText(currentRawApiKey);
      setApiKeyStatus(`Copied API key for "${currentApiKeyName || "new key"}".`);
    } catch (error) {
      setApiKeyStatus(`Copy failed: ${error.message || String(error)}`);
    }
  });

  el.closeApiKeyRevealBtn?.addEventListener("click", () => {
    hideApiKeyReveal();
  });
}

function setBusy(button, isBusy, text = "Working…") {
  if (!button) return;
  if (isBusy) {
    button.dataset.originalText = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function setupPlayground() {
  el.runText.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runText, true);
    el.textOutput.textContent = "Generating…";
    try {
      const result = await fetchJson("/v1/chat/completions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          stream: false,
          messages: [{ role: "user", content: el.textPrompt.value || "Hello" }]
        })
      });
      el.textOutput.textContent = JSON.stringify(result, null, 2);
      await refreshAccount();
    } catch (error) {
      el.textOutput.textContent = error.message;
    } finally {
      setBusy(el.runText, false);
    }
  });

  el.runImage.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runImage, true);
    el.imageOutput.textContent = "Generating…";
    try {
      const result = await fetchJson("/v1/images/generations", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ prompt: el.imagePrompt.value || "A colorful neon city." })
      });
      const b64 = result?.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned");
      el.imageOutput.innerHTML = `<img src="data:image/jpeg;base64,${b64}" alt="Generated image" />`;
      await refreshAccount();
    } catch (error) {
      el.imageOutput.textContent = error.message;
    } finally {
      setBusy(el.runImage, false);
    }
  });

  el.runVideo.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runVideo, true);
    el.videoOutput.textContent = "Generating…";
    try {
      const response = await fetch(`${apiBase()}/v1/videos/generations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: el.videoPrompt.value || "A drifting cloudscape at sunset.",
          duration: Number(el.videoDuration.value || 5)
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || "Video generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      el.videoOutput.innerHTML = `<video controls src="${url}"></video>`;
      await refreshAccount();
    } catch (error) {
      el.videoOutput.textContent = error.message;
    } finally {
      setBusy(el.runVideo, false);
    }
  });

  el.runAudio.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runAudio, true);
    el.audioOutput.textContent = "Generating…";
    try {
      const response = await fetch(`${apiBase()}/v1/audio/generations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: el.audioPrompt.value || "Energetic electronic beat",
          duration_seconds: Number(el.audioDuration.value || 10)
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || "Audio generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      el.audioOutput.innerHTML = `<audio controls src="${url}"></audio>`;
      await refreshAccount();
    } catch (error) {
      el.audioOutput.textContent = error.message;
    } finally {
      setBusy(el.runAudio, false);
    }
  });
}

async function init() {
  cfg = await fetchJson("/v1/config");
  renderConfig();
  setupTabs();
  // Protected cards start hidden (set in HTML); ensure consistent state
  setProtectedCardsVisible(false);
  await initSupabase();
  setupAuthActions();
  setupApiKeyActions();
  setupPlayground();
  if (session?.access_token) {
    await refreshApiKeys();
  }
}

init().catch((error) => {
  console.error(error);
  showToast(error.message || "Failed to initialize dashboard");
});
