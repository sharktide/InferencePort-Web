// modals.js — All modal dialogs
import { send, on } from './ws.js';
import { escHtml } from './ui.js';
import { isAuthenticated, loginWithEmail, signUpWithEmail, loginWithOAuth, logout, currentUser, userProfile, userSettings } from './auth.js';

// ── Modal stack support ───────────────────────────────────────────────────
// Primary modal uses #modal-overlay / #modal-box.
// Secondary (stacked) modal creates its own overlay on top.

let overlay, box;
function getOverlay() { return overlay || (overlay = document.getElementById('modal-overlay')); }
function getBox()     { return box     || (box     = document.getElementById('modal-box')); }

let secondaryOverlay = null;
let modalCleanup = null;

export function openModal(html, opts = {}) {
  const o = getOverlay(), b = getBox();
  modalCleanup?.();
  modalCleanup = null;
  b.className = 'modal-box' + (opts.wide ? ' wide' : '');
  b.innerHTML = html;
  o.classList.remove('hidden');
  const cleanup = opts.onOpen?.(b);
  if (typeof cleanup === 'function') modalCleanup = cleanup;
  else if (typeof opts.onClose === 'function') modalCleanup = opts.onClose;
  o.onclick = (e) => { if (e.target === o) closeModal(); };
  document.addEventListener('keydown', escHandler);
}

const escHandler = (e) => { if (e.key === 'Escape') { if (secondaryOverlay) closeSecondaryModal(); else closeModal(); } };

export function closeModal() {
  if (secondaryOverlay) closeSecondaryModal();
  modalCleanup?.();
  modalCleanup = null;
  getOverlay().classList.add('hidden');
  getBox().innerHTML = '';
  document.removeEventListener('keydown', escHandler);
}

/** Open a secondary (stacked) modal on top of the primary one */
export function openSecondaryModal(html, opts = {}) {
  // Remove existing secondary if any
  closeSecondaryModal();

  secondaryOverlay = document.createElement('div');
  secondaryOverlay.className = 'modal-overlay';
  secondaryOverlay.style.zIndex = 'calc(var(--z-modal) + 50)';
  secondaryOverlay.style.animation = 'fadeIn 0.16s ease';

  const secBox = document.createElement('div');
  secBox.className = 'modal-box' + (opts.wide ? ' wide' : '');
  secBox.innerHTML = html;
  secondaryOverlay.appendChild(secBox);
  document.body.appendChild(secondaryOverlay);

  if (opts.onOpen) opts.onOpen(secBox);

  secondaryOverlay.onclick = (e) => {
    if (e.target === secondaryOverlay) closeSecondaryModal();
  };
}

export function closeSecondaryModal() {
  if (secondaryOverlay) {
    secondaryOverlay.remove();
    secondaryOverlay = null;
  }
}

function hasPrimaryModalOpen() {
  const o = getOverlay();
  return !!o && !o.classList.contains('hidden');
}

function openLayeredModal(html, opts = {}) {
  if (hasPrimaryModalOpen()) {
    openSecondaryModal(html, opts);
    return 'secondary';
  }
  openModal(html, opts);
  return 'primary';
}

function closeLayeredModal(kind) {
  if (kind === 'secondary') closeSecondaryModal();
  else closeModal();
}

export function openConfirmModal({
  title = 'Confirm Action',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
}) {
  const layer = openLayeredModal(`
    <div class="modal-header">
      <span class="modal-title">${escHtml(title)}</span>
      <button class="modal-close" id="confirm-close-btn">×</button>
    </div>
    <div class="modal-body">
      <div class="confirm-copy">${message}</div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="confirm-cancel-btn">${escHtml(cancelLabel)}</button>
      <button class="${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-submit-btn">${escHtml(confirmLabel)}</button>
    </div>
  `, {
    onOpen(b) {
      const close = () => closeLayeredModal(layer);
      b.querySelector('#confirm-close-btn')?.addEventListener('click', close);
      b.querySelector('#confirm-cancel-btn')?.addEventListener('click', close);
      b.querySelector('#confirm-submit-btn')?.addEventListener('click', async () => {
        await onConfirm?.();
        close();
      });
    }
  });
}

export function openTextPromptModal({
  title = 'Enter Value',
  label = 'Value',
  placeholder = '',
  value = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  multiline = false,
  onSubmit,
}) {
  const fieldHtml = multiline
    ? `<textarea class="form-input prompt-textarea" id="prompt-input" placeholder="${escHtml(placeholder)}">${escHtml(value)}</textarea>`
    : `<input class="form-input" id="prompt-input" value="${escHtml(value)}" placeholder="${escHtml(placeholder)}" />`;

  const layer = openLayeredModal(`
    <div class="modal-header">
      <span class="modal-title">${escHtml(title)}</span>
      <button class="modal-close" id="prompt-close-btn">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" for="prompt-input">${escHtml(label)}</label>
        ${fieldHtml}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="prompt-cancel-btn">${escHtml(cancelLabel)}</button>
      <button class="btn-primary" id="prompt-submit-btn">${escHtml(confirmLabel)}</button>
    </div>
  `, {
    onOpen(b) {
      const close = () => closeLayeredModal(layer);
      const input = b.querySelector('#prompt-input');
      const submit = async () => {
        const nextValue = input?.value ?? '';
        const shouldClose = await onSubmit?.(nextValue);
        if (shouldClose !== false) close();
      };
      b.querySelector('#prompt-close-btn')?.addEventListener('click', close);
      b.querySelector('#prompt-cancel-btn')?.addEventListener('click', close);
      b.querySelector('#prompt-submit-btn')?.addEventListener('click', submit);
      input?.addEventListener('keydown', (event) => {
        if (!multiline && event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      });
      setTimeout(() => {
        input?.focus();
        if (typeof input?.setSelectionRange === 'function') {
          const end = input.value?.length || 0;
          input.setSelectionRange(end, end);
        }
      }, 0);
    }
  });
}

// ── Auth modal ────────────────────────────────────────────────────────────

export function openAuthModal(initialTab = 'signin') {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Sign in to InferencePort AI</span>
      <button class="modal-close" id="auth-close-btn">×</button>
    </div>
    <div class="modal-body">
      <div class="auth-tabs">
        <button class="auth-tab ${initialTab==='signin'?'active':''}" data-tab="signin">Sign In</button>
        <button class="auth-tab ${initialTab==='signup'?'active':''}" data-tab="signup">Create Account</button>
      </div>

      <div id="auth-signin" style="${initialTab!=='signin'?'display:none':''}">
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
          <button class="social-btn" id="github-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.7 7.7 0 012.01-.27c.68 0 1.36.09 2.01.27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            Continue with GitHub
          </button>
          <button class="social-btn" id="google-btn">
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.02 1.53 7.4 2.8l5.4-5.4C33.52 3.7 29.1 1.5 24 1.5 14.64 1.5 6.58 6.88 2.66 14.7l6.64 5.15C11.2 13.6 17.08 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24c0-1.64-.15-3.22-.43-4.74H24v9h12.7c-.55 2.95-2.21 5.45-4.7 7.12l7.23 5.6C43.38 36.9 46.5 31.1 46.5 24z"/><path fill="#FBBC05" d="M9.3 28.85A14.4 14.4 0 0 1 8.5 24c0-1.68.3-3.3.8-4.85l-6.64-5.15A23.96 23.96 0 0 0 1.5 24c0 3.9.94 7.58 2.66 10.7l6.64-5.15z"/><path fill="#34A853" d="M24 46.5c6.48 0 11.92-2.14 15.9-5.82l-7.23-5.6c-2.01 1.35-4.58 2.15-8.67 2.15-6.92 0-12.8-4.1-14.7-10.05l-6.64 5.15C6.58 41.12 14.64 46.5 24 46.5z"/></svg>
            Continue with Google
          </button>
        </div>
        <div class="auth-divider">or</div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="signin-email" type="email" placeholder="you@example.com" />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" id="signin-password" type="password" placeholder="••••••••" />
        </div>
        <div id="signin-error" class="form-error" style="display:none;margin-bottom:8px;"></div>
        <button class="btn-primary" id="signin-submit" style="width:100%;">Sign In</button>
        <div style="margin-top:10px;text-align:center;">
          <button style="font-size:13px;color:var(--blue-bright);" id="forgot-pw">Forgot password?</button>
        </div>
      </div>

      <div id="auth-signup" style="${initialTab!=='signup'?'display:none':''}">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="signup-email" type="email" placeholder="you@example.com" />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" id="signup-password" type="password" placeholder="Min 6 characters" />
        </div>
        <div id="signup-error" class="form-error" style="display:none;margin-bottom:8px;"></div>
        <button class="btn-primary" id="signup-submit" style="width:100%;">Create Account</button>
      </div>
    </div>
  `, {
    onOpen(b) {
      b.querySelector('#auth-close-btn')?.addEventListener('click', closeModal);

      // Tab switching
      b.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          b.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const name = tab.dataset.tab;
          b.querySelector('#auth-signin').style.display = name === 'signin' ? '' : 'none';
          b.querySelector('#auth-signup').style.display = name === 'signup' ? '' : 'none';
        });
      });

      // Sign in
      b.querySelector('#signin-submit').addEventListener('click', async () => {
        const email = b.querySelector('#signin-email').value.trim();
        const pass  = b.querySelector('#signin-password').value;
        const errEl = b.querySelector('#signin-error');
        errEl.style.display = 'none';
        try {
          await loginWithEmail(email, pass);
          closeModal();
        } catch (e) {
          errEl.textContent = e.message; errEl.style.display = '';
        }
      });

      // Sign up
      b.querySelector('#signup-submit').addEventListener('click', async () => {
        const email = b.querySelector('#signup-email').value.trim();
        const pass  = b.querySelector('#signup-password').value;
        const errEl = b.querySelector('#signup-error');
        errEl.style.display = 'none';
        try {
          const result = await signUpWithEmail(email, pass);
          if (result.access_token) {
            closeModal();
          } else {
            errEl.textContent = 'Check your email to confirm your account.'; errEl.style.display = '';
          }
        } catch (e) {
          errEl.textContent = e.message; errEl.style.display = '';
        }
      });

      b.querySelector('#github-btn').addEventListener('click', () => { loginWithOAuth('github'); closeModal(); });
      b.querySelector('#google-btn').addEventListener('click', () => { loginWithOAuth('google'); closeModal(); });
      b.querySelector('#forgot-pw').addEventListener('click', () => openForgotPasswordModal());

      // Enter key
      [['#signin-email','#signin-password','#signin-submit'],
       ['#signup-email','#signup-password','#signup-submit']].forEach(([e, p, s]) => {
        [e, p].forEach(sel => {
          b.querySelector(sel)?.addEventListener('keydown', ev => {
            if (ev.key === 'Enter') b.querySelector(s)?.click();
          });
        });
      });
    }
  });
}

function openForgotPasswordModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Reset Password</span>
      <button class="modal-close" id="forgot-close-btn">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="reset-email" type="email" placeholder="you@example.com" />
      </div>
      <div id="reset-msg" style="font-size:13px;margin-bottom:8px;display:none;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="forgot-cancel-btn">Cancel</button>
      <button class="btn-primary" id="reset-submit">Send Reset Link</button>
    </div>
  `, {
    onOpen(b) {
      b.querySelector('#forgot-close-btn')?.addEventListener('click', closeModal);
      b.querySelector('#forgot-cancel-btn')?.addEventListener('click', closeModal);
      b.querySelector('#reset-submit').addEventListener('click', async () => {
        const email = b.querySelector('#reset-email').value.trim();
        const msgEl = b.querySelector('#reset-msg');
        const SUPABASE_URL = 'https://dpixehhdbtzsbckfektd.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaXhlaGhkYnR6c2Jja2Zla3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNDI0MjcsImV4cCI6MjA3NjcxODQyN30.nR1KCSRQj1E_evQWnE2VaZzg7PgLp2kqt4eDKP2PkpE';
        try {
          await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
            method: 'POST', headers: { 'Content-Type':'application/json','apikey':SUPABASE_KEY },
            body: JSON.stringify({ email }),
          });
          msgEl.textContent = 'Reset link sent. Check your email.';
          msgEl.style.color = 'var(--plan-core)'; msgEl.style.display = '';
        } catch { msgEl.textContent = 'Error. Try again.'; msgEl.style.display = ''; }
      });
    }
  });
}

// ── Share modal ───────────────────────────────────────────────────────────

export function showShareModal(sessionId) {
  if (!isAuthenticated()) return openAuthModal('signin');

  openModal(`
    <div class="modal-header">
      <span class="modal-title">Share Chat</span>
      <button class="modal-close" id="share-close-btn">×</button>
    </div>
    <div class="modal-body">
      <div class="share-warning">
        <span style="font-size:18px">⚠️</span>
        <span>You are about to share this whole session. Anyone with the link can import it into their account.</span>
      </div>
      <div id="share-url-wrap" style="display:none;">
        <div class="form-label" style="margin-bottom:6px;">Share link</div>
        <div style="display:flex;gap:8px;">
          <input class="form-input" id="share-url-input" readonly style="flex:1;" />
          <button class="btn-ghost" id="share-copy-btn">Copy</button>
        </div>
      </div>
      <div id="share-loading" style="font-size:13px;color:var(--text-muted);display:none;">Generating link…</div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="share-close-footer">Close</button>
      <button class="btn-primary" id="share-generate-btn">Generate Link</button>
    </div>
  `, {
    onOpen(b) {
      b.querySelector('#share-close-btn')?.addEventListener('click', closeModal);
      b.querySelector('#share-close-footer')?.addEventListener('click', closeModal);
      b.querySelector('#share-generate-btn').addEventListener('click', () => {
        b.querySelector('#share-loading').style.display = '';
        b.querySelector('#share-generate-btn').disabled = true;
        send({ type: 'sessions:share', sessionId });

        on('sessions:shareUrl', function handler(msg) {
          if (msg.sessionId !== sessionId) return;
          import('./ws.js').then(({ off }) => off('sessions:shareUrl', handler));
          b.querySelector('#share-loading').style.display = 'none';
          b.querySelector('#share-url-wrap').style.display = '';
          const input = b.querySelector('#share-url-input');
          input.value = msg.url;

          b.querySelector('#share-copy-btn').addEventListener('click', async () => {
            await navigator.clipboard.writeText(msg.url).catch(() => {});
            b.querySelector('#share-copy-btn').textContent = 'Copied!';
          });
        });
      });
    }
  });
}

// ── Tool call modal ───────────────────────────────────────────────────────

export function showToolCallModal(call) {
  const names = {
    ollama_search: 'Web Search', read_web_page: 'Read Web Page',
    generate_image: 'Image Generation', generate_video: 'Video Generation', generate_audio: 'Audio Generation',
    save_memory: 'Save Memory', delete_memory: 'Delete Memory', list_memories: 'List Memories',
    edit_response_draft: 'Revise Draft',
  };
  const displayName = names[call.name] || call.name;

  let argsDisplay = call.args || call.arguments || '{}';
  if (typeof argsDisplay !== 'string') argsDisplay = JSON.stringify(argsDisplay, null, 2);

  let resultDisplay = call.result || '—';
  if (typeof resultDisplay !== 'string') resultDisplay = JSON.stringify(resultDisplay, null, 2);

  openModal(`
    <div class="modal-header">
      <span class="modal-title">🔧 ${escHtml(displayName)}</span>
      <button class="modal-close" id="tool-close-btn">×</button>
    </div>
    <div class="modal-body">
      <div class="tool-detail-section">
        <div class="tool-detail-label">Tool</div>
        <div class="tool-detail-content" style="font-family:var(--font-sans);">${escHtml(call.name)}</div>
      </div>
      <div class="tool-detail-section">
        <div class="tool-detail-label">Request</div>
        <div class="tool-detail-content">${escHtml(argsDisplay)}</div>
      </div>
      <div class="tool-detail-section">
        <div class="tool-detail-label">Response</div>
        <div class="tool-detail-content">${escHtml(resultDisplay.slice(0, 4000))}</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="tool-close-footer">Close</button>
    </div>
  `, {
    onOpen(b) {
      b.querySelector('#tool-close-btn')?.addEventListener('click', closeModal);
      b.querySelector('#tool-close-footer')?.addEventListener('click', closeModal);
    }
  });
}

// ── Image modal ───────────────────────────────────────────────────────────

export function openImageModal(src) {
  openModal(`
    <div class="modal-header" style="border-bottom:none;">
      <span></span>
      <button class="modal-close" id="img-close-btn">×</button>
    </div>
    <div class="modal-body" style="padding-top:0;text-align:center;">
      <img src="${escHtml(src)}" style="max-width:100%;max-height:70vh;border-radius:8px;" alt="Image" />
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="img-close-footer">Close</button>
      <button class="btn-primary" id="img-dl-btn">Download</button>
    </div>
  `, {
    onOpen(b) {
      b.querySelector('#img-close-btn')?.addEventListener('click', closeModal);
      b.querySelector('#img-close-footer')?.addEventListener('click', closeModal);
      b.querySelector('#img-dl-btn').addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = src; a.download = `image-${Date.now()}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      });
    }
  });
}

// ── File viewer modal ─────────────────────────────────────────────────────

/**
 * Opens a modal to view/edit a text file attachment.
 * @param {object} opts - { name, content, editable, onSave }
 */
export function openFileViewerModal({ name, content, editable = false, onSave }) {
  const title = editable ? `Edit: ${escHtml(name)}` : escHtml(name);
  openSecondaryModal(`
    <div class="modal-header">
      <span class="modal-title" style="font-size:15px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">📄</span>${title}
      </span>
      <button class="modal-close" id="fv-close-btn">×</button>
    </div>
    <div class="modal-body" style="padding-top:12px;">
      ${editable
        ? `<textarea id="fv-editor" style="width:100%;min-height:280px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:var(--radius-md);padding:10px 12px;color:var(--text);font-size:13px;font-family:var(--font-mono);resize:vertical;line-height:1.55;outline:none;">${escHtml(content)}</textarea>`
        : `<pre style="background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;font-size:12px;font-family:var(--font-mono);white-space:pre-wrap;word-break:break-all;max-height:400px;overflow-y:auto;color:var(--text-dim);">${escHtml(content)}</pre>`
      }
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="fv-cancel-btn">Cancel</button>
      ${editable ? `<button class="btn-primary" id="fv-save-btn">Save</button>` : ''}
    </div>
  `, {
    onOpen(b) {
      b.querySelector('#fv-close-btn')?.addEventListener('click', closeSecondaryModal);
      b.querySelector('#fv-cancel-btn')?.addEventListener('click', closeSecondaryModal);
      if (editable) {
        b.querySelector('#fv-save-btn')?.addEventListener('click', () => {
          const val = b.querySelector('#fv-editor')?.value ?? '';
          onSave?.(val);
          closeSecondaryModal();
        });
        // Focus and auto-resize
        const ta = b.querySelector('#fv-editor');
        if (ta) {
          ta.focus();
          ta.addEventListener('input', () => {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.6) + 'px';
          });
        }
      }
    }
  });
}

// ── Chat limit modal ──────────────────────────────────────────────────────

export function openLimitModal() {
  openModal(`
    <div class="modal-body" style="padding-top:28px;">
      <div class="limit-modal-inner">
        <div class="limit-icon">💬</div>
        <div class="limit-title">Daily limit reached</div>
        <div class="limit-desc">Sign in or create a free account to keep chatting.<br>Guest usage resets every 24 hours.</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button class="btn-primary" id="limit-signin">Sign In</button>
          <button class="btn-ghost" id="limit-signup">Create Account</button>
        </div>
      </div>
    </div>
  `, {
    onOpen(b) {
      b.querySelector('#limit-signin').addEventListener('click', () => { closeModal(); openAuthModal('signin'); });
      b.querySelector('#limit-signup').addEventListener('click', () => { closeModal(); openAuthModal('signup'); });
    }
  });
}

export function openGuestRateLimitModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Unusual request activity detected</span>
      <button class="modal-close" id="guest-rate-close-btn">×</button>
    </div>
    <div class="modal-body" style="padding-top:18px;">
      <div class="limit-modal-inner">
        <div class="limit-title">Please sign in to continue</div>
        <div class="limit-desc" style="margin-top:10px;line-height:1.5;">
          An unusual amount of signed out requests has come from your device. Please sign in, or if this is an error, contact <a href="mailto:incognito.email.mode@gmail.com" style="color:inherit;text-decoration:underline;">incognito.email.mode@gmail.com</a>.
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px;">
          <button class="btn-primary" id="guest-rate-limit-signin">Sign In</button>
          <button class="btn-ghost" id="guest-rate-limit-close">Close</button>
        </div>
      </div>
    </div>
  `, {
    onOpen(b) {
      b.querySelector('#guest-rate-close-btn')?.addEventListener('click', closeModal);
      b.querySelector('#guest-rate-limit-signin').addEventListener('click', () => { closeModal(); openAuthModal('signin'); });
      b.querySelector('#guest-rate-limit-close').addEventListener('click', () => { closeModal(); });
    }
  });
}

// ── Device session detail modal ───────────────────────────────────────────
// Now opens as a SECONDARY modal (stacked on top of settings)

export function openDeviceSessionModal(session, isCurrentSession) {
  openSecondaryModal(`
    <div class="modal-header">
      <span class="modal-title">Session Details</span>
      <button class="modal-close" id="dev-sess-close-btn">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <div class="form-label">IP Address</div>
        <div style="font-size:14px;">${escHtml(session.ip || 'Unknown')}</div>
      </div>
      <div class="form-group">
        <div class="form-label">Last seen</div>
        <div style="font-size:14px;">${escHtml(session.lastSeen ? new Date(session.lastSeen).toLocaleString() : '—')}</div>
      </div>
      <div class="form-group">
        <div class="form-label">First seen</div>
        <div style="font-size:14px;">${escHtml(session.createdAt ? new Date(session.createdAt).toLocaleString() : '—')}</div>
      </div>
      <div class="form-group">
        <div class="form-label">User Agent</div>
        <div style="font-size:12px;word-break:break-all;color:var(--text-dim);">${escHtml(session.userAgent || 'Unknown')}</div>
      </div>
      ${isCurrentSession ? '<div style="font-size:12px;color:var(--plan-core);margin-top:4px;">This is your current session.</div>' : ''}
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="dev-sess-cancel-btn">Close</button>
      ${!isCurrentSession ? `<button class="btn-danger" id="revoke-session-btn">Log Out This Session</button>` : ''}
    </div>
  `, {
    onOpen(b) {
      b.querySelector('#dev-sess-close-btn')?.addEventListener('click', closeSecondaryModal);
      b.querySelector('#dev-sess-cancel-btn')?.addEventListener('click', closeSecondaryModal);
      if (!isCurrentSession) {
        b.querySelector('#revoke-session-btn')?.addEventListener('click', () => {
          send({ type: 'account:revokeSession', token: session.token });
          closeSecondaryModal();
        });
      }
    }
  });
}

// ── Pasted content editor ─────────────────────────────────────────────────

export function openPasteEditor(content, onSave) {
  openFileViewerModal({ name: 'Edit Content', content, editable: true, onSave });
}

// Auto-handle limit events
on('chat:limitReached', () => openLimitModal());
on('guest:rateLimit', () => openGuestRateLimitModal());
