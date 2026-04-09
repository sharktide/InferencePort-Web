import { loadAuth, getTempId, isAuthenticated, onAuthChange } from './auth.js';
import {
  openModal,
  closeModal,
  openImageModal,
  openConfirmModal,
  openTextPromptModal,
} from './modals.js';
import { escHtml, showContextMenu, showNotification, sanitizeEditableHtml } from './ui.js';
import { on } from './ws.js';

const mediaUrlCache = new Map();
const DEFAULT_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_TEXT_UPLOAD_BYTES = 100 * 1024;

const state = {
  parentId: null,
  items: [],
  breadcrumbs: [],
  selectedIds: new Set(),
  editor: null,
  usage: null,
  trash: {
    items: [],
    selectedIds: new Set(),
  },
};

function menuDotsIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>`;
}

function canModifyMediaLibrary() {
  return isAuthenticated();
}

function showMediaSignInRequired(message = 'Sign in to upload files.') {
  showNotification({ type: 'info', message, duration: 2600 });
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const auth = loadAuth();
  if (auth?.access_token) headers.Authorization = `Bearer ${auth.access_token}`;
  else headers['X-Temp-ID'] = getTempId();
  return headers;
}

async function apiFetch(url, options = {}, expectJson = true) {
  const headers = authHeaders(options.headers || {});
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.message || data?.error || `Request failed (${res.status})`);
    err.code = data?.error || 'request_failed';
    err.status = res.status;
    err.usage = data?.usage || null;
    throw err;
  }
  return expectJson ? res.json() : res;
}

function bytesLabel(size = 0) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function kindLabel(item) {
  if (item?.type === 'folder') return 'Folder';
  if (item?.kind === 'rich_text') return 'Rich text';
  if (item?.kind === 'text') return 'Plain text';
  if (item?.kind === 'image') return 'Image';
  if (item?.kind === 'video') return 'Video';
  if (item?.kind === 'audio') return 'Audio';
  return 'File';
}

function kindIcon(item) {
  if (item.type === 'folder') return '&#128193;';
  if (item.kind === 'image') return '&#128444;';
  if (item.kind === 'video') return '&#127909;';
  if (item.kind === 'audio') return '&#127925;';
  if (item.kind === 'rich_text') return '&#128221;';
  if (item.kind === 'text') return '&#128196;';
  return '&#128230;';
}

function isTextLikeFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const mime = String(file?.type || '').toLowerCase();
  return mime.startsWith('text/')
    || mime === 'application/json'
    || mime === 'application/javascript'
    || mime === 'application/xml'
    || /\.(txt|md|json|js|ts|css|py|html?|xml|csv|rtf)$/i.test(name);
}

function exceedsTextFileLimit(file) {
  return isTextLikeFile(file) && Number(file?.size || 0) > MAX_TEXT_UPLOAD_BYTES;
}

function isTextLike(item) {
  return item.kind === 'text' || item.kind === 'rich_text';
}

function isAttachable(item) {
  return item.kind === 'image' || item.kind === 'text' || item.kind === 'rich_text';
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function plainTextFromHtml(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return doc.body?.textContent?.trim() || '';
}

function getOverlay() {
  return document.getElementById('sidebar-trash-overlay');
}

function getOverlayList() {
  return document.getElementById('sidebar-trash-list');
}

function getOverlayBar() {
  return document.getElementById('sidebar-trash-selection-bar');
}

function isMediaPaneVisible() {
  return !document.getElementById('sidebar-media-pane')?.classList.contains('hidden');
}

function isMediaTrashOverlayOpen() {
  const overlay = getOverlay();
  const host = document.getElementById('sidebar-sessions');
  return !!overlay && !!host && host.classList.contains('trash-open') && overlay.dataset.context === 'media';
}

function updateUsage(usage) {
  if (!usage) return;
  state.usage = {
    quotaBytes: usage.quotaBytes || DEFAULT_QUOTA_BYTES,
    totalBytes: usage.totalBytes || 0,
    activeBytes: usage.activeBytes || 0,
    trashBytes: usage.trashBytes || 0,
    remainingBytes: usage.remainingBytes ?? Math.max(0, (usage.quotaBytes || DEFAULT_QUOTA_BYTES) - (usage.totalBytes || 0)),
    percentUsed: usage.percentUsed || 0,
    fileCount: usage.fileCount || 0,
    trashFileCount: usage.trashFileCount || 0,
  };
  renderUsagePanel();
}

function usageTone(usage) {
  const percent = usage?.percentUsed || 0;
  if (percent >= 92) return 'danger';
  if (percent >= 75) return 'warning';
  return 'normal';
}

function renderUsagePanel() {
  const panel = document.getElementById('media-usage-panel');
  if (!panel) return;
  const usage = state.usage || {
    quotaBytes: DEFAULT_QUOTA_BYTES,
    totalBytes: 0,
    activeBytes: 0,
    trashBytes: 0,
    remainingBytes: DEFAULT_QUOTA_BYTES,
    percentUsed: 0,
  };
  const tone = usageTone(usage);
  const percent = Math.max(0, Math.min(100, usage.percentUsed || 0));
  panel.className = `media-usage-panel ${tone}`;
  panel.innerHTML = `
    <div class="media-usage-copy">
      <div>
        <div class="media-usage-label">Cloud Storage</div>
        <div class="media-usage-values">${bytesLabel(usage.totalBytes)} of ${bytesLabel(usage.quotaBytes)} used</div>
      </div>
      <div class="media-usage-percent">${percent.toFixed(percent >= 10 ? 0 : 1)}%</div>
    </div>
    <div class="media-usage-track">
      <div class="media-usage-fill" style="width:${percent}%"></div>
    </div>
    <div class="media-usage-meta">
      <span>${bytesLabel(usage.remainingBytes)} free</span>
      <span>${usage.trashBytes ? `${bytesLabel(usage.trashBytes)} in trash` : 'Trash clears after 30 days'}</span>
    </div>
  `;
}

function handleMediaError(err, fallbackMessage) {
  if (err?.usage) updateUsage(err.usage);
  showNotification({
    type: err?.code === 'media:quota_exceeded' ? 'warning' : 'error',
    message: err?.message || fallbackMessage,
    duration: 3200,
  });
}

async function refreshAllMediaViews() {
  const tasks = [];
  if (isMediaPaneVisible()) tasks.push(refreshMediaList());
  if (isMediaTrashOverlayOpen()) tasks.push(refreshMediaTrashView());
  await Promise.all(tasks);
}

async function getCurrentSessionId() {
  const sessions = await import('./sessions.js');
  return sessions.currentSessionId || null;
}

export async function uploadFileToLibrary(file, { parentId = null, sessionId = null, kind = null } = {}) {
  if (!canModifyMediaLibrary()) {
    const err = new Error('Sign in to upload files.');
    err.code = 'media:auth_required';
    throw err;
  }
  const body = await file.arrayBuffer();
  const res = await apiFetch('/api/media/upload', {
    method: 'POST',
    headers: {
      'X-File-Name': encodeURIComponent(file.name),
      'X-Mime-Type': file.type || 'application/octet-stream',
      ...(parentId ? { 'X-Parent-Id': parentId } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...(kind ? { 'X-File-Kind': kind } : {}),
    },
    body,
  });
  updateUsage(res.usage);
  await refreshMediaList();
  return res.item;
}

export async function uploadTextToLibrary(name, content, { parentId = null, sessionId = null, richText = false } = {}) {
  if (!canModifyMediaLibrary()) {
    const err = new Error('Sign in to upload files.');
    err.code = 'media:auth_required';
    throw err;
  }
  const body = new TextEncoder().encode(content);
  const res = await apiFetch('/api/media/upload', {
    method: 'POST',
    headers: {
      'X-File-Name': encodeURIComponent(name),
      'X-Mime-Type': richText ? 'text/html' : 'text/plain',
      ...(parentId ? { 'X-Parent-Id': parentId } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      'X-File-Kind': richText ? 'rich_text' : 'text',
    },
    body,
  });
  updateUsage(res.usage);
  await refreshMediaList();
  return res.item;
}

export async function fetchMediaBlob(id, { download = false } = {}) {
  const res = await apiFetch(`/api/media/${encodeURIComponent(id)}/content${download ? '?download=1' : ''}`, {}, false);
  return res.blob();
}

export async function getMediaObjectUrl(id) {
  if (mediaUrlCache.has(id)) return mediaUrlCache.get(id);
  const blob = await fetchMediaBlob(id);
  const url = URL.createObjectURL(blob);
  mediaUrlCache.set(id, url);
  return url;
}

export async function downloadMediaItem(item) {
  const blob = await fetchMediaBlob(item.id, { download: true });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = item.name || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function loadMediaText(id) {
  return apiFetch(`/api/media/${encodeURIComponent(id)}/text`);
}

export async function saveMediaText(id, payload) {
  if (!canModifyMediaLibrary()) {
    const err = new Error('Sign in to edit files.');
    err.code = 'media:auth_required';
    throw err;
  }
  const nextPayload = { ...payload };
  if (typeof nextPayload.content === 'string' && state.editor?.mode === 'rich') {
    nextPayload.content = sanitizeEditableHtml(nextPayload.content);
  }
  const res = await apiFetch(`/api/media/${encodeURIComponent(id)}/text`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nextPayload),
  });
  updateUsage(res.usage);
  await refreshMediaList();
  return res.item;
}

async function renameMediaItem(id, name) {
  if (!canModifyMediaLibrary()) {
    const err = new Error('Sign in to rename files.');
    err.code = 'media:auth_required';
    throw err;
  }
  const res = await apiFetch(`/api/media/${encodeURIComponent(id)}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  updateUsage(res.usage);
  await refreshAllMediaViews();
  return res.item;
}

async function createFolder(name, parentId) {
  if (!canModifyMediaLibrary()) {
    const err = new Error('Sign in to create folders.');
    err.code = 'media:auth_required';
    throw err;
  }
  const res = await apiFetch('/api/media/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId }),
  });
  updateUsage(res.usage);
  await refreshMediaList();
  return res.item;
}

async function createDocument({ name, richText, parentId, sessionId = null }) {
  if (!canModifyMediaLibrary()) {
    const err = new Error('Sign in to create documents.');
    err.code = 'media:auth_required';
    throw err;
  }
  const res = await apiFetch('/api/media/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, richText, parentId, sessionId }),
  });
  updateUsage(res.usage);
  await refreshMediaList();
  return res.item;
}

async function trashItems(ids) {
  const res = await apiFetch('/api/media/trash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  state.selectedIds.clear();
  state.trash.selectedIds.clear();
  updateUsage(res.usage);
  await refreshAllMediaViews();
}

async function restoreItems(ids) {
  if (!canModifyMediaLibrary()) {
    const err = new Error('Sign in to restore files.');
    err.code = 'media:auth_required';
    throw err;
  }
  const res = await apiFetch('/api/media/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  state.selectedIds.clear();
  state.trash.selectedIds.clear();
  updateUsage(res.usage);
  await refreshAllMediaViews();
}

async function deleteItemsForever(ids) {
  const res = await apiFetch('/api/media/deleteForever', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  state.selectedIds.clear();
  state.trash.selectedIds.clear();
  updateUsage(res.usage);
  await refreshAllMediaViews();
}

async function moveItems(ids, parentId = null) {
  if (!canModifyMediaLibrary()) {
    const err = new Error('Sign in to move files.');
    err.code = 'media:auth_required';
    throw err;
  }
  const res = await apiFetch('/api/media/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, parentId }),
  });
  state.selectedIds.clear();
  updateUsage(res.usage);
  await refreshMediaList();
}

async function loadActiveList() {
  const res = await apiFetch(`/api/media?view=active${state.parentId ? `&parentId=${encodeURIComponent(state.parentId)}` : ''}`);
  state.items = res.items || [];
  const visibleIds = new Set(state.items.map((item) => item.id));
  state.selectedIds = new Set([...state.selectedIds].filter((id) => visibleIds.has(id)));
  state.breadcrumbs = res.breadcrumbs || [];
  updateUsage(res.usage);
  renderMediaList();
}

async function loadTrashList() {
  const res = await apiFetch('/api/media?view=trash');
  state.trash.items = res.items || [];
  const visibleIds = new Set(state.trash.items.map((item) => item.id));
  state.trash.selectedIds = new Set([...state.trash.selectedIds].filter((id) => visibleIds.has(id)));
  updateUsage(res.usage);
  renderMediaTrashOverlay();
}

export async function refreshMediaList() {
  if (!document.getElementById('media-list')) return;
  await loadActiveList().catch((err) => handleMediaError(err, 'Failed to load media'));
}

async function refreshMediaTrashView() {
  await loadTrashList().catch((err) => handleMediaError(err, 'Failed to load trash'));
}

function setEditorStatus(message = '', type = 'info') {
  const el = document.getElementById('media-editor-status');
  if (!el) return;
  if (!message) {
    el.classList.add('hidden');
    el.textContent = '';
    el.dataset.kind = '';
    return;
  }
  el.classList.remove('hidden');
  el.textContent = message;
  el.dataset.kind = type;
}

function closeEditor() {
  state.editor = null;
  document.getElementById('media-editor-panel')?.classList.add('hidden');
  document.getElementById('media-editor-content')?.replaceChildren();
  document.getElementById('media-editor-toolbar')?.classList.add('hidden');
  setEditorStatus('');
}

function renderRichTextToolbar(toolbar, contentEl) {
  const actions = [
    ['Bold', 'bold'],
    ['Italic', 'italic'],
    ['Underline', 'underline'],
    ['Bullets', 'insertUnorderedList'],
    ['Quote', 'formatBlock'],
    ['Link', 'createLink'],
  ];
  toolbar.innerHTML = '';
  actions.forEach(([label, command]) => {
    const btn = document.createElement('button');
    btn.className = 'media-editor-tool';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      contentEl.focus();
      if (command === 'createLink') {
        openTextPromptModal({
          title: 'Insert Link',
          label: 'URL',
          placeholder: 'https://example.com',
          confirmLabel: 'Insert',
          onSubmit: (url) => {
            const value = url.trim();
            if (!value) return false;
            contentEl.focus();
            document.execCommand(command, false, value);
            return true;
          },
        });
        return;
      }
      if (command === 'formatBlock') {
        document.execCommand(command, false, 'blockquote');
        return;
      }
      document.execCommand(command, false, null);
    });
    toolbar.appendChild(btn);
  });
}

async function openEditor(item) {
  const panel = document.getElementById('media-editor-panel');
  const titleEl = document.getElementById('media-editor-title');
  const metaEl = document.getElementById('media-editor-meta');
  const contentWrap = document.getElementById('media-editor-content');
  const toolbar = document.getElementById('media-editor-toolbar');
  if (!panel || !contentWrap || !toolbar || !titleEl || !metaEl) return;

  const { content } = await loadMediaText(item.id);
  state.editor = {
    item,
    mode: item.kind === 'rich_text' ? 'rich' : 'text',
  };

  titleEl.textContent = item.name;
  metaEl.textContent = `${item.kind === 'rich_text' ? 'Rich text' : 'Text'} / ${bytesLabel(item.size || content.length)}`;
  contentWrap.innerHTML = '';

  if (state.editor.mode === 'rich') {
    const editor = document.createElement('div');
    editor.className = 'media-rich-editor';
    editor.contentEditable = 'true';
    editor.innerHTML = sanitizeEditableHtml(content || '<p></p>');
    contentWrap.appendChild(editor);
    toolbar.classList.remove('hidden');
    renderRichTextToolbar(toolbar, editor);
    state.editor.getValue = () => sanitizeEditableHtml(editor.innerHTML);
  } else {
    const textarea = document.createElement('textarea');
    textarea.className = 'media-text-editor';
    textarea.value = content || '';
    contentWrap.appendChild(textarea);
    toolbar.classList.add('hidden');
    toolbar.innerHTML = '';
    state.editor.getValue = () => textarea.value;
  }

  panel.classList.remove('hidden');
  setEditorStatus('');
}

async function handleMediaItemClick(item) {
  if (item.type === 'folder') {
    state.parentId = item.id;
    await refreshMediaList();
    return;
  }
  if (isTextLike(item)) {
    if (!canModifyMediaLibrary()) {
      await downloadMediaItem(item);
      return;
    }
    await openEditor(item);
    return;
  }
  if (item.kind === 'image') {
    const url = await getMediaObjectUrl(item.id);
    openImageModal(url);
    return;
  }
  await downloadMediaItem(item);
}

function renderSelectionBar() {
  const bar = document.getElementById('media-selection-bar');
  if (!bar) return;
  const selected = state.items.filter((item) => state.selectedIds.has(item.id));
  if (!selected.length) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  const downloadable = selected.filter((item) => item.type === 'file');
  const canModify = canModifyMediaLibrary();
  bar.innerHTML = `
    <span>${selected.length} selected</span>
    <div class="sidebar-selection-actions">
      ${downloadable.length ? '<button class="sidebar-action-btn" id="media-bulk-download">Download</button>' : ''}
      ${canModify ? '<button class="sidebar-action-btn" id="media-bulk-move">Move</button>' : ''}
      <button class="sidebar-action-btn danger" id="media-bulk-trash">Move to Trash</button>
    </div>
  `;
  bar.classList.remove('hidden');
  bar.querySelector('#media-bulk-download')?.addEventListener('click', async () => {
    for (const item of downloadable) await downloadMediaItem(item);
  });
  bar.querySelector('#media-bulk-move')?.addEventListener('click', () => {
    openFolderPicker({
      title: 'Move Selected Items',
      confirmLabel: 'Move Here',
      startParentId: state.parentId,
      onSelect: (parentId) => moveItems(selected.map((item) => item.id), parentId),
    });
  });
  bar.querySelector('#media-bulk-trash')?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Move Items To Trash',
      message: `Move ${selected.length} selected item${selected.length === 1 ? '' : 's'} to trash?`,
      confirmLabel: 'Move to Trash',
      danger: true,
      onConfirm: () => trashItems(selected.map((item) => item.id)).catch((err) => handleMediaError(err, 'Unable to move items to trash')),
    });
  });
}

function renderBreadcrumbs() {
  const el = document.getElementById('media-breadcrumbs');
  if (!el) return;
  const inFolder = !!state.parentId || state.breadcrumbs.length > 0;
  if (!inFolder) {
    el.innerHTML = '';
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = `
    <button class="media-breadcrumb media-breadcrumb-root" data-id="">
      Media
    </button>
    ${state.breadcrumbs.map((crumb, index) => `
      <span class="media-breadcrumb-sep">/</span>
      <button class="media-breadcrumb${index === state.breadcrumbs.length - 1 ? ' active' : ''}" data-id="${crumb.id}">
        ${escHtml(crumb.name)}
      </button>
    `).join('')}
  `;
  el.querySelectorAll('.media-breadcrumb').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.parentId = btn.dataset.id || null;
      await refreshMediaList();
    });
  });
}

function openMediaActionMenu(event, item) {
  event.preventDefault();
  event.stopPropagation();
  const rect = event.currentTarget.getBoundingClientRect();
  const items = [];
  const canModify = canModifyMediaLibrary();

  if (item.type === 'file') {
    items.push({
      label: 'Download',
      icon: 'DL',
      onClick: () => downloadMediaItem(item),
    });
  }

  if (canModify) {
    items.push({
      label: 'Rename',
      icon: 'RN',
      onClick: () => {
        openNamePromptModal({
          title: 'Rename Item',
          label: 'Name',
          placeholder: item.name,
          value: item.name,
          confirmLabel: 'Rename',
          onSubmit: async (name) => {
            try {
              await renameMediaItem(item.id, name);
            } catch (err) {
              handleMediaError(err, 'Unable to rename item');
              return false;
            }
            return true;
          },
        });
      },
    });

    items.push({
      label: 'Move',
      icon: 'MV',
      onClick: () => {
        openFolderPicker({
          title: `Move ${item.name}`,
          confirmLabel: 'Move Here',
          startParentId: state.parentId,
          onSelect: (parentId) => moveItems([item.id], parentId),
        });
      },
    });
  }

  items.push({
    label: 'Move to Trash',
    icon: 'TR',
    danger: true,
    onClick: () => {
      openConfirmModal({
        title: 'Move To Trash',
        message: 'Move this item to trash?',
        confirmLabel: 'Move to Trash',
        danger: true,
        onConfirm: () => trashItems([item.id]).catch((err) => handleMediaError(err, 'Unable to move item to trash')),
      });
    },
  });

  showContextMenu(rect.right - 12, rect.bottom + 8, items, {
    compact: true,
    menuId: 'attach-context-menu',
    triggerEl: event.currentTarget,
  });
}

function openTrashItemMenu(event, item) {
  event.preventDefault();
  event.stopPropagation();
  const rect = event.currentTarget.getBoundingClientRect();
  const items = [];
  if (canModifyMediaLibrary()) {
    items.push({
      label: 'Restore',
      icon: 'RE',
      onClick: () => restoreItems([item.id]).catch((err) => handleMediaError(err, 'Unable to restore media')),
    });
  }
  items.push({
    label: 'Delete Forever',
    icon: 'DEL',
    danger: true,
    onClick: () => {
      openConfirmModal({
        title: 'Delete Permanently',
        message: 'Delete this item permanently? This cannot be undone.',
        confirmLabel: 'Delete Forever',
        danger: true,
        onConfirm: () => deleteItemsForever([item.id]).catch((err) => handleMediaError(err, 'Unable to delete media permanently')),
      });
    },
  });
  showContextMenu(rect.right - 12, rect.bottom + 8, items, {
    compact: true,
    menuId: 'attach-context-menu',
    triggerEl: event.currentTarget,
  });
}

function buildMediaRows(items, { trash = false } = {}) {
  return items.map((item) => `
    <div class="media-list-item${trash ? ' trash-item' : ''}" data-id="${escHtml(item.id)}">
      <label class="media-item-check">
        <input type="checkbox" ${trash ? (state.trash.selectedIds.has(item.id) ? 'checked' : '') : (state.selectedIds.has(item.id) ? 'checked' : '')} data-media-check="${escHtml(item.id)}" />
        <span class="selection-checkmark" aria-hidden="true"></span>
      </label>
      <button class="media-item-main" data-media-open="${escHtml(item.id)}">
        <span class="media-item-icon">${kindIcon(item)}</span>
        <span class="media-item-copy">
          <span class="media-item-name">${escHtml(item.name)}</span>
          <span class="media-item-meta">${item.type === 'folder' ? 'Folder' : `${escHtml(kindLabel(item))} • ${bytesLabel(item.size)}`}</span>
        </span>
      </button>
      <div class="media-item-actions">
        ${trash
          ? `<button class="media-item-action" data-media-restore="${escHtml(item.id)}">Restore</button>
             <button class="media-item-action danger" data-media-delete="${escHtml(item.id)}">Delete</button>`
          : `${item.type === 'file' ? `<button class="media-item-action" data-media-download="${escHtml(item.id)}">Download</button>` : ''}
             <button class="media-item-action danger" data-media-trash="${escHtml(item.id)}">Trash</button>`}
      </div>
    </div>
  `).join('');
}

function buildCompactMediaRows(items, { trash = false } = {}) {
  return items.map((item) => `
    <div class="media-list-item${trash ? ' trash-item' : ''}" data-id="${escHtml(item.id)}">
      <label class="media-item-check">
        <input type="checkbox" ${trash ? (state.trash.selectedIds.has(item.id) ? 'checked' : '') : (state.selectedIds.has(item.id) ? 'checked' : '')} data-media-check="${escHtml(item.id)}" />
        <span class="selection-checkmark" aria-hidden="true"></span>
      </label>
      <button class="media-item-main" data-media-open="${escHtml(item.id)}">
        <span class="media-item-icon">${kindIcon(item)}</span>
        <span class="media-item-copy">
          <span class="media-item-name">${escHtml(item.name)}</span>
          <span class="media-item-kind">${escHtml(kindLabel(item))}</span>
          ${item.type === 'folder' ? '' : `<span class="media-item-size">${bytesLabel(item.size)}</span>`}
        </span>
      </button>
      <button class="media-item-menu" data-media-menu="${escHtml(item.id)}" aria-label="Media options" title="Media options">
        <span class="media-item-menu-dots" aria-hidden="true">${menuDotsIcon()}</span>
      </button>
    </div>
  `).join('');
}

function updateMediaCreateAccess() {
  const btn = document.getElementById('media-create-btn');
  if (!btn) return;
  const locked = !canModifyMediaLibrary();
  btn.classList.toggle('is-disabled', locked);
  btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
  btn.title = locked ? 'Sign in to upload files' : 'Create or upload media';
}

function renderMediaList() {
  renderBreadcrumbs();
  renderSelectionBar();
  renderUsagePanel();
  updateMediaCreateAccess();

  const list = document.getElementById('media-list');
  if (!list) return;
  if (!state.items.length) {
    list.innerHTML = `
      <div class="sidebar-empty-state rich-empty-state">
        <strong>No files here yet</strong>
        <span>${canModifyMediaLibrary()
          ? 'Use the <b>+</b> menu to upload files, write notes, or create folders.'
          : 'Sign in to upload files, write notes, or create folders.'}</span>
      </div>
    `;
    return;
  }

  list.innerHTML = buildCompactMediaRows(state.items);

  list.querySelectorAll('[data-media-check]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) state.selectedIds.add(input.dataset.mediaCheck);
      else state.selectedIds.delete(input.dataset.mediaCheck);
      renderSelectionBar();
    });
  });

  list.querySelectorAll('[data-media-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = state.items.find((entry) => entry.id === btn.dataset.mediaOpen);
      if (item) handleMediaItemClick(item).catch((err) => handleMediaError(err, 'Unable to open media item'));
    });
  });

  list.querySelectorAll('[data-media-menu]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const item = state.items.find((entry) => entry.id === btn.dataset.mediaMenu);
      if (item) openMediaActionMenu(event, item);
    });
  });
}

function renderTrashSelectionBar() {
  const bar = getOverlayBar();
  if (!bar || !isMediaTrashOverlayOpen()) return;
  const ids = [...state.trash.selectedIds];
  if (!ids.length) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  bar.innerHTML = `
    <span>${ids.length} selected</span>
    <div class="sidebar-selection-actions">
      ${canModifyMediaLibrary() ? '<button class="sidebar-action-btn" id="media-trash-restore-selected">Restore</button>' : ''}
      <button class="sidebar-action-btn danger" id="media-trash-delete-selected">Delete Forever</button>
    </div>
  `;
  bar.classList.remove('hidden');
  bar.querySelector('#media-trash-restore-selected')?.addEventListener('click', () => {
    restoreItems(ids).catch((err) => handleMediaError(err, 'Unable to restore media'));
  });
  bar.querySelector('#media-trash-delete-selected')?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Delete Permanently',
      message: `Delete ${ids.length} selected item${ids.length === 1 ? '' : 's'} permanently? This cannot be undone.`,
      confirmLabel: 'Delete Forever',
      danger: true,
      onConfirm: () => deleteItemsForever(ids).catch((err) => handleMediaError(err, 'Unable to delete media permanently')),
    });
  });
}

function renderMediaTrashOverlay() {
  if (!isMediaTrashOverlayOpen()) return;
  const list = getOverlayList();
  const bar = getOverlayBar();
  if (!list || !bar) return;

  if (!state.trash.items.length) {
    list.innerHTML = `
      <div class="sidebar-empty-state rich-empty-state">
        <strong>Trash is empty</strong>
        <span>Deleted files will appear here until they are restored or removed forever.</span>
      </div>
    `;
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  list.innerHTML = buildCompactMediaRows(state.trash.items, { trash: true });
  renderTrashSelectionBar();

  list.querySelectorAll('[data-media-check]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) state.trash.selectedIds.add(input.dataset.mediaCheck);
      else state.trash.selectedIds.delete(input.dataset.mediaCheck);
      renderTrashSelectionBar();
    });
  });

  list.querySelectorAll('[data-media-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = state.trash.items.find((entry) => entry.id === btn.dataset.mediaOpen);
      if (item?.kind === 'image') {
        getMediaObjectUrl(item.id).then((url) => openImageModal(url)).catch((err) => handleMediaError(err, 'Unable to preview media'));
      }
    });
  });

  list.querySelectorAll('[data-media-menu]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const item = state.trash.items.find((entry) => entry.id === btn.dataset.mediaMenu);
      if (item) openTrashItemMenu(event, item);
    });
  });
}

function openNamePromptModal({ title, label, placeholder, value = '', confirmLabel, onSubmit }) {
  openTextPromptModal({
    title,
    label,
    placeholder,
    value,
    confirmLabel,
    onSubmit: (nextValue) => {
      const trimmed = nextValue.trim();
      if (!trimmed) return false;
      return onSubmit(trimmed);
    },
  });
}

function promptForFolder() {
  if (!canModifyMediaLibrary()) {
    showMediaSignInRequired('Sign in to create folders.');
    return;
  }
  openNamePromptModal({
    title: 'New Folder',
    label: 'Folder name',
    placeholder: 'Folder name',
    confirmLabel: 'Create Folder',
    onSubmit: async (name) => {
      try {
        await createFolder(name, state.parentId);
      } catch (err) {
        handleMediaError(err, 'Unable to create folder');
        return false;
      }
      return true;
    },
  });
}

function promptForDocument({ richText = false }) {
  if (!canModifyMediaLibrary()) {
    showMediaSignInRequired('Sign in to create files.');
    return;
  }
  const extension = richText ? '.html' : '.txt';
  const defaultName = richText ? 'Untitled Document.html' : 'Untitled Note.txt';
  openNamePromptModal({
    title: richText ? 'New Rich Text File' : 'New Plain Text File',
    label: 'File name',
    placeholder: defaultName,
    value: defaultName,
    confirmLabel: 'Create File',
    onSubmit: async (name) => {
      const finalName = /\.[a-z0-9]+$/i.test(name) ? name : `${name}${extension}`;
      try {
        const item = await createDocument({
          name: finalName,
          richText,
          parentId: state.parentId,
          sessionId: await getCurrentSessionId(),
        });
        await openEditor(item);
      } catch (err) {
        handleMediaError(err, 'Unable to create document');
        return false;
      }
      return true;
    },
  });
}

function showTextUploadLimitNotice(file) {
  showNotification({
    type: 'warning',
    message: `${file.name} is a text file over 100 KB and cannot be uploaded.`,
    duration: 3200,
  });
}

function filterUploadableFiles(files = []) {
  const accepted = [];
  files.forEach((file) => {
    if (exceedsTextFileLimit(file)) {
      showTextUploadLimitNotice(file);
      return;
    }
    accepted.push(file);
  });
  return accepted;
}

function openCreateMenu(event) {
  event.preventDefault();
  event.stopPropagation();
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  if (!canModifyMediaLibrary()) {
    showContextMenu(rect.right - 10, rect.bottom + 10, [
      {
        label: 'Rich Text',
        description: 'Sign in to create formatted documents.',
        icon: 'RT',
        disabled: true,
      },
      {
        label: 'Plain Text',
        description: 'Sign in to create text notes and files.',
        icon: 'TXT',
        disabled: true,
      },
      {
        label: 'File Upload',
        description: 'Sign in to upload files.',
        icon: 'UP',
        disabled: true,
      },
      {
        label: 'Folder',
        description: 'Sign in to create folders.',
        icon: 'DIR',
        disabled: true,
      },
    ], {
      menuId: 'attach-context-menu',
      triggerEl: event.currentTarget,
    });
    return;
  }
  showContextMenu(rect.right - 10, rect.bottom + 10, [
    {
      label: 'Rich Text',
      description: 'Create a formatted document with headings, quotes, and links.',
      icon: 'RT',
      onClick: () => promptForDocument({ richText: true }),
    },
    {
      label: 'Plain Text',
      description: 'Start a lightweight note for prompts, code, or raw text.',
      icon: 'TXT',
      onClick: () => promptForDocument({ richText: false }),
    },
    {
      label: 'File Upload',
      description: 'Add files from your device into this folder.',
      icon: 'UP',
      onClick: () => document.getElementById('media-upload-input')?.click(),
    },
    {
      label: 'Folder',
      description: 'Create a folder to organize uploads and documents.',
      icon: 'DIR',
      onClick: () => promptForFolder(),
    },
  ], {
    menuId: 'attach-context-menu',
    triggerEl: event.currentTarget,
  });
}

export async function mediaItemToAttachment(item) {
  if (!item || item.type !== 'file' || !isAttachable(item)) return null;
  if (item.kind === 'image') {
    const blob = await fetchMediaBlob(item.id);
    const dataUrl = await blobToDataUrl(blob);
    const comma = dataUrl.indexOf(',');
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
    const base64 = dataUrl.slice(comma + 1);
    return { type: 'image', name: item.name, base64, mimeType, mediaId: item.id };
  }
  const payload = await loadMediaText(item.id);
  const content = item.kind === 'rich_text'
    ? plainTextFromHtml(payload.content)
    : (payload.content || '');
  return { type: 'text', name: item.name, content, mediaId: item.id };
}

function buildPickerBreadcrumbs(parentId, breadcrumbs) {
  const parts = [
    `<button class="media-breadcrumb${!parentId ? ' active' : ''}" data-picker-root="1">Library</button>`,
    ...breadcrumbs.map((crumb, index) => `
      <span class="media-breadcrumb-sep">/</span>
      <button class="media-breadcrumb${index === breadcrumbs.length - 1 ? ' active' : ''}" data-picker-crumb="${escHtml(crumb.id)}">${escHtml(crumb.name)}</button>
    `),
  ];
  return `<div class="media-picker-breadcrumbs">${parts.join('')}</div>`;
}

async function loadPickerItems(parentId) {
  return apiFetch(`/api/media?view=active${parentId ? `&parentId=${encodeURIComponent(parentId)}` : ''}`);
}

export function openMediaPicker({ onSelect, title = 'Add From Media Library', confirmLabel = 'Attach Selected' } = {}) {
  const modalState = {
    parentId: null,
    items: [],
    breadcrumbs: [],
    selectedIds: new Set(),
  };

  function renderPicker(box) {
    const list = box.querySelector('#media-picker-list');
    const crumbWrap = box.querySelector('#media-picker-crumbs');
    const confirmBtn = box.querySelector('#media-picker-confirm');
    if (!list || !crumbWrap || !confirmBtn) return;

    crumbWrap.innerHTML = buildPickerBreadcrumbs(modalState.parentId, modalState.breadcrumbs);
    crumbWrap.querySelector('[data-picker-root]')?.addEventListener('click', () => {
      modalState.parentId = null;
      loadAndRender(box).catch((err) => handleMediaError(err, 'Unable to load media'));
    });
    crumbWrap.querySelectorAll('[data-picker-crumb]').forEach((btn) => {
      btn.addEventListener('click', () => {
        modalState.parentId = btn.dataset.pickerCrumb || null;
        loadAndRender(box).catch((err) => handleMediaError(err, 'Unable to load media'));
      });
    });

    confirmBtn.disabled = modalState.selectedIds.size === 0;
    if (!modalState.items.length) {
      list.innerHTML = `<div class="sidebar-empty-state">Nothing to show here</div>`;
      return;
    }

    list.innerHTML = modalState.items.map((item) => {
      const selectable = item.type === 'file' && isAttachable(item);
      return `
        <div class="media-picker-item">
          <button class="media-picker-open${item.type === 'folder' ? '' : (selectable ? '' : ' disabled')}" data-picker-open="${escHtml(item.id)}">
            <span class="media-item-icon">${kindIcon(item)}</span>
            <span class="media-item-copy">
              <span class="media-item-name">${escHtml(item.name)}</span>
              <span class="media-item-meta">${item.type === 'folder' ? 'Folder' : `${escHtml(kindLabel(item))} • ${bytesLabel(item.size)}`}</span>
            </span>
          </button>
          ${selectable ? `
            <label class="media-picker-select">
              <input type="checkbox" data-picker-select="${escHtml(item.id)}" ${modalState.selectedIds.has(item.id) ? 'checked' : ''} />
              <span class="selection-checkmark" aria-hidden="true"></span>
            </label>
          ` : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-picker-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = modalState.items.find((entry) => entry.id === btn.dataset.pickerOpen);
        if (!item) return;
        if (item.type === 'folder') {
          modalState.parentId = item.id;
          loadAndRender(box).catch((err) => handleMediaError(err, 'Unable to load folder'));
        } else if (item.kind === 'image') {
          getMediaObjectUrl(item.id).then((url) => openImageModal(url)).catch((err) => handleMediaError(err, 'Unable to preview image'));
        }
      });
    });

    list.querySelectorAll('[data-picker-select]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) modalState.selectedIds.add(input.dataset.pickerSelect);
        else modalState.selectedIds.delete(input.dataset.pickerSelect);
        confirmBtn.disabled = modalState.selectedIds.size === 0;
      });
    });
  }

  async function loadAndRender(box) {
    const res = await loadPickerItems(modalState.parentId);
    modalState.items = res.items || [];
    const visibleIds = new Set(modalState.items.map((item) => item.id));
    modalState.selectedIds = new Set([...modalState.selectedIds].filter((id) => visibleIds.has(id)));
    modalState.breadcrumbs = res.breadcrumbs || [];
    renderPicker(box);
  }

  openModal(`
    <div class="modal-header">
      <span class="modal-title">${escHtml(title)}</span>
      <button class="modal-close" id="media-picker-close">×</button>
    </div>
    <div class="modal-body">
      <div id="media-picker-crumbs"></div>
      <div id="media-picker-list" class="media-picker-list"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="media-picker-cancel">Cancel</button>
      <button class="btn-primary" id="media-picker-confirm" disabled>${escHtml(confirmLabel)}</button>
    </div>
  `, {
    onOpen(box) {
      box.querySelector('#media-picker-close')?.addEventListener('click', closeModal);
      box.querySelector('#media-picker-cancel')?.addEventListener('click', closeModal);
      box.querySelector('#media-picker-confirm')?.addEventListener('click', async () => {
        const items = modalState.items.filter((item) => modalState.selectedIds.has(item.id));
        if (!items.length) return;
        await onSelect?.(items);
        closeModal();
      });
      loadAndRender(box).catch((err) => handleMediaError(err, 'Unable to load media'));
    },
  });
}

function openFolderPicker({ title = 'Choose Folder', confirmLabel = 'Select', startParentId = null, onSelect } = {}) {
  const modalState = {
    parentId: startParentId,
    items: [],
    breadcrumbs: [],
  };

  function currentFolderLabel() {
    const currentCrumb = modalState.breadcrumbs.at(-1);
    return currentCrumb?.name || 'Library';
  }

  function renderPicker(box) {
    const list = box.querySelector('#folder-picker-list');
    const crumbs = box.querySelector('#folder-picker-crumbs');
    const confirm = box.querySelector('#folder-picker-confirm');
    if (!list || !crumbs || !confirm) return;

    crumbs.innerHTML = buildPickerBreadcrumbs(modalState.parentId, modalState.breadcrumbs);
    crumbs.querySelector('[data-picker-root]')?.addEventListener('click', () => {
      modalState.parentId = null;
      loadAndRender(box).catch((err) => handleMediaError(err, 'Unable to load folders'));
    });
    crumbs.querySelectorAll('[data-picker-crumb]').forEach((btn) => {
      btn.addEventListener('click', () => {
        modalState.parentId = btn.dataset.pickerCrumb || null;
        loadAndRender(box).catch((err) => handleMediaError(err, 'Unable to load folders'));
      });
    });

    confirm.textContent = modalState.parentId ? `${confirmLabel}: ${currentFolderLabel()}` : `${confirmLabel}: Library`;

    const folders = modalState.items.filter((item) => item.type === 'folder');
    if (!folders.length) {
      list.innerHTML = `<div class="sidebar-empty-state">No folders in this location</div>`;
      return;
    }

    list.innerHTML = folders.map((item) => `
      <button class="media-picker-open" data-folder-open="${escHtml(item.id)}">
        <span class="media-item-icon">${kindIcon(item)}</span>
        <span class="media-item-copy">
          <span class="media-item-name">${escHtml(item.name)}</span>
          <span class="media-item-meta">Folder</span>
        </span>
      </button>
    `).join('');

    list.querySelectorAll('[data-folder-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        modalState.parentId = btn.dataset.folderOpen || null;
        loadAndRender(box).catch((err) => handleMediaError(err, 'Unable to load folder'));
      });
    });
  }

  async function loadAndRender(box) {
    const res = await loadPickerItems(modalState.parentId);
    modalState.items = res.items || [];
    modalState.breadcrumbs = res.breadcrumbs || [];
    renderPicker(box);
  }

  openModal(`
    <div class="modal-header">
      <span class="modal-title">${escHtml(title)}</span>
      <button class="modal-close" id="folder-picker-close">×</button>
    </div>
    <div class="modal-body">
      <div id="folder-picker-crumbs"></div>
      <div id="folder-picker-list" class="media-picker-list"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="folder-picker-cancel">Cancel</button>
      <button class="btn-primary" id="folder-picker-confirm">${escHtml(confirmLabel)}</button>
    </div>
  `, {
    onOpen(box) {
      box.querySelector('#folder-picker-close')?.addEventListener('click', closeModal);
      box.querySelector('#folder-picker-cancel')?.addEventListener('click', closeModal);
      box.querySelector('#folder-picker-confirm')?.addEventListener('click', async () => {
        await onSelect?.(modalState.parentId);
        closeModal();
      });
      loadAndRender(box).catch((err) => handleMediaError(err, 'Unable to load folders'));
    },
  });
}

export function openMediaTrashView() {
  const overlay = document.getElementById('sidebar-trash-overlay');
  if (!overlay) return;
  overlay.dataset.context = 'media';
  document.getElementById('sidebar-trash-title').textContent = 'Media Trash';
  document.getElementById('sidebar-trash-subtitle').textContent = 'Recently deleted files and folders';
  renderMediaTrashOverlay();
  refreshMediaTrashView();
}

export function closeMediaEditor() {
  closeEditor();
}

export function initMediaSidebar() {
  document.getElementById('media-create-btn')?.addEventListener('click', openCreateMenu);
  document.getElementById('media-editor-close')?.addEventListener('click', closeEditor);
  document.getElementById('media-editor-cancel')?.addEventListener('click', closeEditor);
  document.getElementById('media-editor-save')?.addEventListener('click', async () => {
    if (!state.editor?.item?.id || !state.editor.getValue) return;
    try {
      setEditorStatus('Saving…');
      await saveMediaText(state.editor.item.id, { content: state.editor.getValue() });
      setEditorStatus('Saved', 'success');
    } catch (err) {
      setEditorStatus(err?.message || 'Unable to save', 'error');
      handleMediaError(err, 'Unable to save document');
    }
  });

  document.getElementById('media-upload-input')?.addEventListener('change', async function handleUploadInput() {
    if (!canModifyMediaLibrary()) {
      this.value = '';
      showMediaSignInRequired('Sign in to upload files.');
      return;
    }
    const files = filterUploadableFiles(Array.from(this.files || []));
    if (!files.length) {
      this.value = '';
      return;
    }
    try {
      const sessionId = await getCurrentSessionId();
      for (const file of files) {
        await uploadFileToLibrary(file, {
          parentId: state.parentId,
          sessionId,
          kind: file.type?.startsWith('image/') ? 'image' : null,
        });
      }
      showNotification({
        type: 'success',
        message: files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`,
        duration: 2400,
      });
    } catch (err) {
      handleMediaError(err, 'Unable to upload file');
    } finally {
      this.value = '';
    }
  });

  on('media:changed', () => {
    refreshAllMediaViews().catch(() => {});
  });

  onAuthChange(() => {
    updateMediaCreateAccess();
    renderMediaList();
  });

  updateMediaCreateAccess();
}
