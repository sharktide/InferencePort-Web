// app.js — bootstrap, input handling, sidebar, attach, paste
import { send, on } from './ws.js';
import { isAuthenticated, logout } from './auth.js';
import {
  createNewSession, showWelcomeScreen,
  switchSession, currentSessionId, onSessionChange, deleteAllSessions, openChatTrashView,
} from './sessions.js';
import { submitMessage, renderSession, setActiveSession, getIsStreaming } from './chat.js';
import { openAuthModal } from './modals.js';
import { openSettings } from './settings.js';
import { showContextMenu, showNotification, autoResize, escHtml } from './ui.js';
import {
  initMediaSidebar, openMediaPicker, uploadFileToLibrary,
  uploadTextToLibrary, mediaItemToAttachment, openMediaTrashView, refreshMediaList, closeMediaEditor,
} from './media.js';

const MAX_TEXT_UPLOAD_BYTES = 100 * 1024;

// ── Apply theme immediately from localStorage (no flash) ──────────────────
(function earlyTheme() {
  try {
    const t = localStorage.getItem('ipai_theme');
    if (t) document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  } catch {}
})();

// ── Keep mobile viewport height aligned with keyboard/open-close changes ────
(function syncViewportHeight() {
  let rafId = 0;

  const applyViewportSize = () => {
    rafId = 0;
    const viewport = window.visualViewport;
    const height = Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
    const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    document.documentElement.style.setProperty('--viewport-offset-top', `${offsetTop}px`);
  };

  const requestViewportSync = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(applyViewportSize);
  };

  applyViewportSize();
  window.addEventListener('resize', requestViewportSync, { passive: true });
  window.addEventListener('orientationchange', requestViewportSync, { passive: true });
  window.visualViewport?.addEventListener('resize', requestViewportSync, { passive: true });
  window.visualViewport?.addEventListener('scroll', requestViewportSync, { passive: true });
})();

// ── TOS banner — push content up so input isn't obscured ─────────────────

(function fixTosBanner() {
  const banner = document.getElementById('tos-banner');
  if (!banner) return;

  // Make TOS links open in new tab
  banner.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  const applyPadding = () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const h = banner.offsetHeight || 28;
      const welcomeView = document.getElementById('welcome-view');
      if (welcomeView) welcomeView.style.paddingBottom = `${h + 8}px`;
    } else {
      const h = banner.offsetHeight || 30;
      document.getElementById('bottom-input-bar')?.style.setProperty('padding-bottom', `${h + 4}px`);
      const welcomeView = document.getElementById('welcome-view');
      if (welcomeView) welcomeView.style.paddingBottom = `${h + 10}px`;
    }
  };
  requestAnimationFrame(() => { applyPadding(); });
  window.addEventListener('resize', applyPadding);
  window.visualViewport?.addEventListener('resize', applyPadding, { passive: true });
})();

// ── Sidebar ───────────────────────────────────────────────────────────────

const sidebar   = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-sidebar-btn');
const sidebarChatPane = document.getElementById('sidebar-chat-pane');
const sidebarMediaPane = document.getElementById('sidebar-media-pane');
const sidebarSessionsHost = document.getElementById('sidebar-sessions');
const sidebarTrashOverlay = document.getElementById('sidebar-trash-overlay');
const sidebarTrashBtn = document.getElementById('sidebar-trash-btn');
const sidebarTrashBackBtn = document.getElementById('sidebar-trash-back');

let sidebarMode = 'chats';

function expandSidebar()  { sidebar?.classList.remove('collapsed'); sidebar?.classList.add('expanded'); }
function collapseSidebar(){ sidebar?.classList.remove('expanded'); sidebar?.classList.add('collapsed'); }
function toggleSidebar()  { sidebar?.classList.contains('expanded') ? collapseSidebar() : expandSidebar(); }

toggleBtn?.addEventListener('click', toggleSidebar);

function closeTrashOverlay() {
  sidebarSessionsHost?.classList.remove('trash-open');
  sidebarTrashOverlay?.setAttribute('aria-hidden', 'true');
}

function openTrashOverlay() {
  sidebarSessionsHost?.classList.add('trash-open');
  sidebarTrashOverlay?.setAttribute('aria-hidden', 'false');
  if (sidebarMode === 'media') openMediaTrashView();
  else openChatTrashView();
}

function setSidebarMode(mode = 'chats') {
  sidebarMode = mode === 'media' ? 'media' : 'chats';
  closeTrashOverlay();
  const mediaMode = sidebarMode === 'media';
  document.querySelectorAll('[data-sidebar-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sidebarMode === sidebarMode);
  });
  sidebarChatPane?.classList.toggle('hidden', mediaMode);
  sidebarMediaPane?.classList.toggle('hidden', !mediaMode);
  if (mediaMode) {
    refreshMediaList();
  }
}

document.querySelectorAll('[data-sidebar-mode]').forEach((btn) => {
  btn.addEventListener('click', () => setSidebarMode(btn.dataset.sidebarMode));
});

sidebarTrashBtn?.addEventListener('click', openTrashOverlay);
sidebarTrashBackBtn?.addEventListener('click', closeTrashOverlay);

setSidebarMode('chats');

function clearComposerInputs() {
  if (centerInput) {
    centerInput.value = '';
    autoResize(centerInput, 6);
  }
  if (bottomInput) {
    bottomInput.value = '';
    autoResize(bottomInput, 6);
  }
  clearFilePreviewRow();
}

function clearChatPanel() {
  const box = document.getElementById('chat-messages');
  if (box) {
    box.innerHTML = '';
    box.scrollTop = 0;
  }
}

export function resetToNewChatView({ focusInput = false } = {}) {
  closeTrashOverlay();
  setSidebarMode('chats');
  closeMediaEditor();
  showWelcomeScreen();
  clearComposerInputs();
  clearChatPanel();
  if (focusInput) {
    requestAnimationFrame(() => centerInput?.focus());
  }
}

// ── Mobile top bar + sidebar logic ───────────────────────────────────────

(function setupMobile() {
  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'sidebar-backdrop';
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  function resetMobileBackdropState() {
    backdrop.classList.remove('visible');
    document.body.classList.remove('mobile-sidebar-open');
    sidebar?.classList.remove('mobile-closing');
  }

  function openSidebar()  {
    sidebar?.classList.remove('collapsed'); sidebar?.classList.add('expanded');
    document.body.classList.add('mobile-sidebar-open');
    backdrop.classList.add('visible');
  }
  function closeSidebar() {
    document.activeElement?.blur?.();
    sidebar?.classList.add('mobile-closing');
    sidebar?.classList.remove('expanded'); sidebar?.classList.add('collapsed');
    closeTrashOverlay();
    resetMobileBackdropState();
    requestAnimationFrame(() => {
      document.body.classList.remove('mobile-sidebar-open');
      sidebar?.classList.remove('mobile-closing');
      void backdrop.offsetHeight;
    });
  }

  backdrop.addEventListener('click', closeSidebar);

  // Wire mobile top bar buttons
  document.getElementById('mobile-sidebar-btn')?.addEventListener('click', () => {
    sidebar?.classList.contains('expanded') ? closeSidebar() : openSidebar();
  });
  document.getElementById('mobile-newchat-btn')?.addEventListener('click', () => {
    resetToNewChatView({ focusInput: false });
    closeSidebar();
  });

  // Auto-close drawer when a session is switched on mobile
  onSessionChange((event) => {
    if ((event === 'switched' || event === 'created') && window.innerWidth <= 768) {
      closeSidebar();
    }
  });

  // ── Hide/show top bar on scroll ─────────────────────────────────────────
  let lastScrollY = 0;
  let ticking = false;
  const topBar = document.getElementById('mobile-top-bar');

  function handleChatScroll(e) {
    if (window.innerWidth > 768) return;
    const el = e.target;
    const currentY = el.scrollTop;
    if (!ticking) {
      requestAnimationFrame(() => {
        if (currentY > lastScrollY && currentY > 60) {
          topBar?.classList.add('hidden-bar');
        } else {
          topBar?.classList.remove('hidden-bar');
        }
        lastScrollY = currentY <= 0 ? 0 : currentY;
        ticking = false;
      });
      ticking = true;
    }
  }

  document.getElementById('chat-view')?.addEventListener('scroll', handleChatScroll, { passive: true });

  onSessionChange((event, data) => {
    if (event === 'switched' && !data) {
      topBar?.classList.remove('hidden-bar');
      lastScrollY = 0;
    }
  });

  if (window.innerWidth > 768) {
    resetMobileBackdropState();
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      resetMobileBackdropState();
      sidebar?.classList.remove('mobile-closing');
    }
  }, { passive: true });
})();

// ── New chat — just show the welcome screen ───────────────────────────────

document.getElementById('new-chat-btn')?.addEventListener('click', () => {
  resetToNewChatView({ focusInput: window.innerWidth > 768 });
});

// ── Session switching ─────────────────────────────────────────────────────

onSessionChange((event, data) => {
  if (event === 'switched') {
    setActiveSession(data);
    if (!data) {
      const box = document.getElementById('chat-messages');
      if (box) box.innerHTML = '';
      document.getElementById('welcome-view')?.classList.remove('hidden');
      document.getElementById('chat-view')?.classList.add('hidden');
      document.getElementById('bottom-input-bar')?.classList.add('hidden');
    }
  }
  if (event === 'data') {
    if (data.id === currentSessionId) renderSession(data);
  }
  if (event === 'created') {
    setActiveSession(data.id);
    switchSession(data.id);
  }
});

// Show welcome screen on login/auth

// ── Center input (welcome view) ───────────────────────────────────────────

const centerInput   = document.getElementById('center-input');
const centerSendBtn = document.getElementById('center-send-btn');

centerInput?.addEventListener('input', () => autoResize(centerInput, 6));
centerInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); triggerCenterSend(); }
});
centerSendBtn?.addEventListener('click', triggerCenterSend);

// Center tool buttons
document.querySelectorAll('#center-tool-search, #center-tool-image, #center-tool-video, #center-tool-audio')
  .forEach(btn => btn.addEventListener('click', () => btn.classList.toggle('active')));

function triggerCenterSend() {
  const text = centerInput?.value.trim();
  const attachments = pendingAttachments.splice(0);
  if (!text && attachments.length === 0) return;
  if (centerInput) { centerInput.value = ''; autoResize(centerInput, 6); }
  clearFilePreviewRow();

  const pendingText = text, pendingAttach = attachments;
  const unsub = onSessionChange((ev, s) => {
    if (ev !== 'switched' || !s) return;
    unsub();
    doSend(pendingText, pendingAttach);
  });
  createNewSession();
}

// ── Bottom input (active chat) ────────────────────────────────────────────

const bottomInput   = document.getElementById('bottom-input');
const bottomSendBtn = document.getElementById('bottom-send-btn');

bottomInput?.addEventListener('input', () => autoResize(bottomInput, 6));
bottomInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); triggerBottomSend(); }
});
bottomSendBtn?.addEventListener('click', () => {
  if (getIsStreaming()) { send({ type: 'chat:stop', sessionId: currentSessionId }); return; }
  triggerBottomSend();
});

function triggerBottomSend() {
  const text = bottomInput?.value.trim();
  const attachments = pendingAttachments.splice(0);
  if (!text && attachments.length === 0) return;
  if (bottomInput) { bottomInput.value = ''; autoResize(bottomInput, 6); }
  clearFilePreviewRow();
  doSend(text || '', attachments);
}

document.querySelectorAll('.tool-btn-sm').forEach(btn =>
  btn.addEventListener('click', () => btn.classList.toggle('active')));

// ── Core send ─────────────────────────────────────────────────────────────

function doSend(text, attachments = []) {
  submitMessage(text, attachments);
}

// ── Attachments ───────────────────────────────────────────────────────────

let pendingAttachments = [];
const LARGE_PASTE_THRESHOLD = 10000;

async function addTextAttachment(name, content) {
  const attachment = { type: 'text', name, content, mediaId: null };
  pendingAttachments.push(attachment);
  renderFilePreviewRow();
  try {
    const item = await uploadTextToLibrary(name, content, {
      sessionId: currentSessionId || null,
      richText: /\.html?$/i.test(name),
    });
    attachment.mediaId = item.id;
    renderFilePreviewRow();
  } catch (err) {
    showNotification({ type: 'warning', message: `Stored only in this draft: ${name}`, duration: 2500 });
  }
}

async function addImageAttachmentFromFile(file) {
  const dataUrl = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(',');
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
  const base64   = dataUrl.slice(comma + 1);
  const attachment = { type: 'image', name: file.name, base64, mimeType, mediaId: null };
  pendingAttachments.push(attachment);
  renderFilePreviewRow();
  try {
    const item = await uploadFileToLibrary(file, {
      sessionId: currentSessionId || null,
      kind: 'image',
    });
    attachment.mediaId = item.id;
    renderFilePreviewRow();
  } catch {
    showNotification({ type: 'warning', message: `Stored only in this draft: ${file.name}`, duration: 2500 });
  }
}

async function addLibraryItemsToDraft(items) {
  for (const item of items) {
    const attachment = await mediaItemToAttachment(item);
    if (attachment) pendingAttachments.push(attachment);
  }
  renderFilePreviewRow();
}

function openAttachMenu(e, triggerEl) {
  e.preventDefault(); e.stopPropagation();
  const rect = triggerEl.getBoundingClientRect();
  showContextMenu(rect.left, rect.top - 8, [
    {
      label: 'Upload file',
      description: 'Attach a text file from your device.',
      icon: 'UP',
      onClick: () => document.getElementById('file-input')?.click(),
    },
    {
      label: 'Upload image',
      description: 'Attach an image from your device.',
      icon: 'IMG',
      onClick: () => document.getElementById('image-input')?.click(),
    },
    {
      label: 'Add from media library',
      description: 'Reuse files and images already saved in cloud storage.',
      icon: 'LIB',
      onClick: () => openMediaPicker({ onSelect: addLibraryItemsToDraft }),
    },
  ], {
    menuId: 'attach-context-menu',
    triggerEl,
  });
}

document.getElementById('center-attach-btn')?.addEventListener('click', e =>
  openAttachMenu(e, document.getElementById('center-attach-btn')));
document.getElementById('bottom-attach-btn')?.addEventListener('click', e =>
  openAttachMenu(e, document.getElementById('bottom-attach-btn')));

function isTextLikeFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const mime = String(file?.type || '').toLowerCase();
  return mime.startsWith('text/')
    || mime === 'application/json'
    || mime === 'application/javascript'
    || mime === 'application/xml'
    || /\.(txt|md|json|js|ts|css|py|html?|xml|csv|rtf)$/i.test(name);
}

function showTextFileLimitNotice(name) {
  showNotification({
    type: 'warning',
    message: `${name} is over the 100 KB text-file limit.`,
    duration: 3200,
  });
}

document.getElementById('file-input')?.addEventListener('change', async function() {
  for (const file of this.files) {
    if (isTextLikeFile(file) && Number(file.size || 0) > MAX_TEXT_UPLOAD_BYTES) {
      showTextFileLimitNotice(file.name);
      continue;
    }
    const text = await file.text();
    await addTextAttachment(file.name, text);
  }
  this.value = '';
});

document.getElementById('image-input')?.addEventListener('change', async function() {
  for (const file of this.files) await addImageAttachmentFromFile(file);
  this.value = '';
});

function buildAttachmentItem(a, i) {
  const wrap = document.createElement('div');
  wrap.className = 'attach-preview-item';

  if (a.type === 'image') {
    const img = document.createElement('img');
    img.src = `data:${a.mimeType};base64,${a.base64}`;
    img.alt = a.name;
    wrap.appendChild(img);
  } else {
    // File chip — styled container
    const chip = document.createElement('div');
    chip.className = 'file-attachment-chip';
    chip.title = a.name;
    const lineCount = (a.content.match(/\n/g) || []).length + 1;
    chip.innerHTML = `
      <span class="chip-icon">📄</span>
      <div style="display:flex;flex-direction:column;min-width:0;">
        <span class="chip-name">${escHtml(a.name)}</span>
        <span class="chip-meta">${lineCount} line${lineCount !== 1 ? 's' : ''}</span>
      </div>`;
    chip.addEventListener('click', () => {
      import('./modals.js').then(m => m.openFileViewerModal({
        name: a.name,
        content: a.content,
        editable: true,
        onSave: (nc) => { pendingAttachments[i].content = nc; }
      }));
    });
    wrap.appendChild(chip);
  }

  const rm = document.createElement('button');
  rm.className = 'attach-preview-remove';
  rm.textContent = '×';
  rm.addEventListener('click', e => { e.stopPropagation(); pendingAttachments.splice(i, 1); renderFilePreviewRow(); });
  wrap.appendChild(rm);
  return wrap;
}

export function renderFilePreviewRow() {
  const centerRow = document.getElementById('center-file-preview-row');
  const bottomRow = document.getElementById('file-preview-row');

  [centerRow, bottomRow].forEach(row => {
    if (!row) return;
    row.innerHTML = '';
    if (pendingAttachments.length === 0) { row.style.display = 'none'; return; }
    row.style.display = 'flex';
    pendingAttachments.forEach((a, i) => row.appendChild(buildAttachmentItem(a, i)));
  });
}

export function clearFilePreviewRow() {
  pendingAttachments = [];
  ['center-file-preview-row', 'file-preview-row'].forEach(id => {
    const row = document.getElementById(id);
    if (row) { row.innerHTML = ''; row.style.display = 'none'; }
  });
}

// ── Paste & drag-drop ─────────────────────────────────────────────────────

function handlePaste(e) {
  const clipboardData = e.clipboardData || window.clipboardData;
  const items = Array.from(clipboardData?.items || []);

  // 1. Check for Images (Works synchronously)
  const imgItem = items.find(i => i.kind === 'file' && i.type.startsWith('image/'));
  if (imgItem) { 
    e.preventDefault(); 
    addImageAttachmentFromFile(imgItem.getAsFile()); 
    return; 
  }

  // 2. Check for Large Text (Must check synchronously to prevent default)
  const text = clipboardData.getData('text/plain');
  if (text.length > LARGE_PASTE_THRESHOLD) {
    e.preventDefault(); // This NOW works because it's called immediately
    addTextAttachment('Pasted Content.txt', text);
  }
}

// ── Bullet point auto-convert feature ────────────────────────────────────
// When "- " is typed at the start of a line, convert to "• " (bullet marker)
// and render it visually as a bullet. Backspace after bullet reverts to "- ".

function setupBulletAutoConvertLegacy(textarea) {
  if (!textarea) return;

  // Track bullet positions: Map<lineIndex, true>
  // We use a marker character in the actual value: '\u2022 ' (bullet)
  const BULLET = '\u2022';

  textarea.addEventListener('keydown', (e) => {
    const val = textarea.value;
    const pos = textarea.selectionStart;

    if (e.key === ' ') {
      // Check if the character before cursor is '-' at start of a line
      const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
      const beforeCursor = val.slice(lineStart, pos);
      if (beforeCursor === '-') {
        e.preventDefault();
        // Replace the '-' with a bullet
        const newVal = val.slice(0, lineStart) + BULLET + ' ' + val.slice(pos);
        textarea.value = newVal;
        const newPos = lineStart + 2;
        textarea.setSelectionRange(newPos, newPos);
        autoResize(textarea, 6);
        return;
      }
    }

    if (e.key === 'Backspace') {
      const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
      const beforeCursor = val.slice(lineStart, pos);
      // If cursor is right after "• " (bullet + space), revert to "- "
      if (beforeCursor === BULLET + ' ') {
        e.preventDefault();
        const newVal = val.slice(0, lineStart) + '- ' + val.slice(pos);
        textarea.value = newVal;
        const newPos = lineStart + 2;
        textarea.setSelectionRange(newPos, newPos);
        autoResize(textarea, 6);
        return;
      }
      // If cursor is right after just the bullet (no space), revert to "-"
      if (beforeCursor === BULLET) {
        e.preventDefault();
        const newVal = val.slice(0, lineStart) + '-' + val.slice(pos);
        textarea.value = newVal;
        const newPos = lineStart + 1;
        textarea.setSelectionRange(newPos, newPos);
        autoResize(textarea, 6);
      }
    }
  });
}

function getBulletLineInfo(textarea) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const line = value.slice(lineStart, lineEnd);
  return { value, start, end, lineStart, lineEnd, line };
}

function replaceBulletTextarea(textarea, from, to, nextText, cursorOffset = nextText.length) {
  textarea.value = textarea.value.slice(0, from) + nextText + textarea.value.slice(to);
  const nextPos = from + cursorOffset;
  textarea.setSelectionRange(nextPos, nextPos);
  autoResize(textarea, 6);
}

function setupBulletAutoConvert(textarea) {
  if (!textarea) return;
  const BULLET = '\u2022';

  textarea.addEventListener('keydown', (e) => {
    const { value, start, end, lineStart, lineEnd, line } = getBulletLineInfo(textarea);
    const trimmed = line.trim();
    const beforeCursor = value.slice(lineStart, start);

    if (e.key === ' ' && beforeCursor === '-') {
      e.preventDefault();
      replaceBulletTextarea(textarea, lineStart, start, `${BULLET} `);
      return;
    }

    if (e.key === 'Enter' && e.shiftKey && line.startsWith(`${BULLET} `)) {
      e.preventDefault();
      const nextLine = trimmed === BULLET ? '\n' : `\n${BULLET} `;
      replaceBulletTextarea(textarea, start, end, nextLine);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && line === `${BULLET} ` && start === end) {
      e.preventDefault();
      replaceBulletTextarea(textarea, lineStart, lineEnd, '', 0);
      return;
    }

    if (e.key === 'Backspace' && start === end && line.startsWith(`${BULLET} `) && beforeCursor === `${BULLET} `) {
      e.preventDefault();
      replaceBulletTextarea(textarea, lineStart, lineStart + 2, '', 0);
    }
  });
}

function bindNearLeftCaretFocus(container, textarea) {
  if (!container || !textarea) return;
  container.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target === textarea || event.target.closest('button') || event.target.closest('.input-file-preview-row')) return;
    const rect = textarea.getBoundingClientRect();
    const withinLeftGutter = event.clientX >= rect.left - 10 && event.clientX < rect.left;
    const withinVerticalBounds = event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!withinLeftGutter || !withinVerticalBounds) return;
    event.preventDefault();
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(0, 0);
  });
}

[centerInput, bottomInput].forEach(input => {
  input?.addEventListener('paste', handlePaste);
  input?.addEventListener('dragover', e => e.preventDefault());
  input?.addEventListener('drop', async e => {
    e.preventDefault();
    for (const file of e.dataTransfer.files)
      if (file.type.startsWith('image/')) await addImageAttachmentFromFile(file);
  });
  setupBulletAutoConvert(input);
});

bindNearLeftCaretFocus(document.querySelector('.center-input-row'), centerInput);
bindNearLeftCaretFocus(document.querySelector('.bottom-textarea-wrap'), bottomInput);

// ── Auth/settings buttons ─────────────────────────────────────────────────

document.getElementById('signin-btn')?.addEventListener('click', () => openAuthModal('signin'));
document.getElementById('signin-icon-btn')?.addEventListener('click', () => openAuthModal('signin'));
document.getElementById('settings-btn')?.addEventListener('click', () => openSettings('chat'));
document.getElementById('settings-btn-guest')?.addEventListener('click', () => openSettings('chat'));

document.getElementById('user-profile-btn')?.addEventListener('click', e => {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const icon = {
    settings: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.2a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-.4-1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.2a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.2a2 2 0 1 1 4 0V3a1.7 1.7 0 0 0 .4 1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.26.3.47.65.6 1 .09.32.14.66.14 1s-.05.68-.14 1c-.13.35-.34.7-.6 1z"/></svg>`,
    account: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>`,
    billing: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
    clear: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
    signout: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  };
  showContextMenu(rect.left, rect.top - 8, [
    { label: 'Settings', icon: icon.settings, onClick: () => openSettings('chat') },
    { label: 'Account', icon: icon.account, onClick: () => openSettings('account') },
    { label: 'Billing Portal', icon: icon.billing, onClick: () => window.open('https://sharktide-lightning.hf.space/portal', '_blank') },
    { separator: true },
    { label: 'Clear All Chats', icon: icon.clear, danger: true, onClick: () => deleteAllSessions() },
    { separator: true },
    { label: 'Sign Out', icon: icon.signout, danger: true, onClick: () => logout() },
  ], { menuId: 'user-context-menu', triggerEl: btn });
  return;
  const menu = document.getElementById('user-context-menu');
  if (!menu) return;

  const menuItems = [
    { label: '⚙️  Settings',       onClick: () => openSettings('chat') },
    { label: '👤  Account',         onClick: () => openSettings('account') },
    { label: '💳  Billing Portal',  onClick: () => window.open('https://sharktide-lightning.hf.space/portal', '_blank') },
    { sep: true },
    { label: '🗑️  Clear All Chats', danger: true,
      onClick: () => deleteAllSessions() },
    { sep: true },
    { label: '🚪  Sign Out',        danger: true, onClick: () => logout() },
  ];

  menu.innerHTML = '';
  for (const item of menuItems) {
    if (item.sep) {
      const s = document.createElement('div'); s.style.cssText = 'height:1px;background:var(--border);margin:3px 0;';
      menu.appendChild(s); continue;
    }
    const el = document.createElement('div');
    el.className = 'context-item' + (item.danger ? ' danger' : '');
    el.textContent = item.label;
    el.addEventListener('click', () => { menu.classList.add('hidden'); item.onClick(); });
    menu.appendChild(el);
  }

  menu.classList.remove('hidden');
  const mw = 200;
  let left = rect.left, top = rect.top;
  const mh = menu.scrollHeight || 200;
  top = rect.top - mh - 8;
  if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top  = `${Math.max(8, top)}px`;

  setTimeout(() => document.addEventListener('click', () => menu.classList.add('hidden'), { once: true }), 0);
});

// ── Share import from URL ?share=token ────────────────────────────────────

function checkShareParam() {
  const params = new URLSearchParams(location.search);
  const token  = params.get('share');
  if (!token) return;

  const banner    = document.getElementById('share-import-banner');
  const bannerText= document.getElementById('share-banner-text');
  const importBtn = document.getElementById('share-import-btn');
  const dismissBtn= document.getElementById('share-dismiss-btn');

  fetch(`/api/share/${encodeURIComponent(token)}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      if (bannerText) bannerText.textContent = `Import shared chat: "${data.name}"?`;
      banner?.classList.remove('hidden');
    })
    .catch(() => {});

  importBtn?.addEventListener('click', () => {
    if (!isAuthenticated()) { openAuthModal('signin'); return; }
    send({ type: 'sessions:import', token });
    banner?.classList.add('hidden');
    history.replaceState({}, '', '/');
  });
  dismissBtn?.addEventListener('click', () => {
    banner?.classList.add('hidden');
    history.replaceState({}, '', '/');
  });
}

// ── Connection notifications & reconnect handling ─────────────────────────

let wasDisconnected = false;
on('ws:disconnected', () => {
  wasDisconnected = true;
  showNotification({ type: 'warning', message: 'Connection lost — reconnecting…', duration: 3000 });
});
on('ws:connected', () => {
  if (wasDisconnected) {
    showNotification({ type: 'success', message: 'Reconnected', duration: 2000 });
  }
  wasDisconnected = false;
});

// ── Init ──────────────────────────────────────────────────────────────────

initMediaSidebar();

document.addEventListener('DOMContentLoaded', () => {
  checkShareParam();
  // Theme is already applied by earlyTheme() above; don't flash to dark
});
