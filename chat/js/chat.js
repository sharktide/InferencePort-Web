// chat.js — Chat rendering, streaming, versioning, editing
import { send, on, off } from './ws.js';
import { currentSessionId } from './sessions.js';
import {
  renderMarkdown, attachCodeCopyListeners, attachSvgPanelListeners,
  hydrateHtmlSandboxPlaceholders, escHtml, showContextMenu, showNotification, autoResize,
} from './ui.js';
import { renderFilePreviewRow, clearFilePreviewRow } from './app.js';
import { getMediaObjectUrl, downloadMediaItem, openMediaPicker, mediaItemToAttachment } from './media.js';

let activeSessionId = null;
let isStreaming      = false;
let streamingBubble  = null;
let streamingText    = '';
let streamingSessionId = null; // track which session is streaming
let autoScroll       = true;
let pendingAssets    = [];
let streamingDraftEdits = [];
let currentHistory   = [];
let streamingSegments = [];
let streamingLiveTextSegmentIndex = -1;
let streamingToolSegmentIndexById = new Map();
let streamingStatusLabel = 'Thinking…';
let streamingStartMeta = null;
let streamingSourceHistory = [];

const lastSessionRequests = new Map();
const sessionErrorStates = new Map();

const BULLET = '\u2022';

export function setActiveSession(id) {
  activeSessionId = id;
  // Update send button state based on whether this session is streaming
  updateSendBtn(isStreaming && streamingSessionId === id);
}
export function getIsStreaming() { return isStreaming && streamingSessionId === activeSessionId; }

// ── WebSocket events ──────────────────────────────────────────────────────

on('sessions:data',         (msg) => { if (msg.session.id === activeSessionId) renderSession(msg.session); });
on('chat:start',            (msg) => { onChatStart(msg); });
on('chat:token',            (msg) => { if (msg.sessionId === activeSessionId) onToken(msg.token); });
on('chat:done',             (msg) => { onChatDone(msg); });
on('chat:aborted',          (msg) => { onChatAborted(msg); });
on('chat:error',            (msg) => { if (msg.sessionId === activeSessionId) onChatError(msg); });
on('chat:asset',            (msg) => { if (msg.sessionId === activeSessionId) appendAsset(msg.asset); });
on('chat:toolCall',         (msg) => { if (msg.sessionId === activeSessionId) handleLiveToolCall(msg.call); });
on('chat:draftEdited',      (msg) => { if (msg.sessionId === activeSessionId) onDraftEdited(msg); });
on('chat:messageEdited',    (msg) => { if (msg.sessionId === activeSessionId) renderHistory(msg.history); });
on('chat:versionSelected',  (msg) => { if (msg.sessionId === activeSessionId) renderHistory(msg.history); });

// Reconnect: reload current session instead of resetting to welcome
on('ws:connected', () => {
  if (activeSessionId) {
    send({ type: 'sessions:get', sessionId: activeSessionId });
  }
});

// ── Tree extraction (mirror of server logic) ──────────────────────────────

function extractFlatHistoryFromTree(rootMessage) {
  if (!rootMessage) return [];
  const history = [];
  const getActiveVersion = (message) => {
    if (!message) return null;
    const versions = Array.isArray(message.versions) ? message.versions : [];
    if (!versions.length) {
      message.versions = [{ content: message.content ?? '', tail: [], timestamp: Date.now() }];
      message.currentVersionIdx = 0;
      return message.versions[0];
    }
    const currentVersionIdx = Number.isInteger(message.currentVersionIdx)
      ? Math.max(0, Math.min(message.currentVersionIdx, versions.length - 1))
      : 0;
    message.currentVersionIdx = currentVersionIdx;
    if (!Array.isArray(message.versions[currentVersionIdx].tail)) {
      message.versions[currentVersionIdx].tail = [];
    }
    if (message.versions[currentVersionIdx].content === undefined || message.versions[currentVersionIdx].content === null) {
      message.versions[currentVersionIdx].content = message.content ?? '';
    }
    return message.versions[currentVersionIdx];
  };
  const cloneMetaValue = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  const ensureValidContent = (msg) => {
    if (!msg) return msg;
    const currentVersion = getActiveVersion(msg);
    msg.content = currentVersion?.content ?? msg.content ?? '';
    ['toolCalls', 'responseEdits', 'responseSegments', 'error'].forEach((key) => {
      if (currentVersion && key in currentVersion) msg[key] = cloneMetaValue(currentVersion[key]);
      else delete msg[key];
    });
    if (msg.content === undefined || msg.content === null) msg.content = '';
    return msg;
  };
  const extractBranch = (message) => {
    history.push(ensureValidContent(message));
    const currentVersionIdx = message.currentVersionIdx ?? 0;
    const versions = message.versions || [];
    if (currentVersionIdx >= versions.length) return;
    const currentVersion = versions[currentVersionIdx];
    if (!currentVersion) return;
    const tail = currentVersion.tail;
    if (!Array.isArray(tail) || tail.length === 0) return;
    for (let i = 0; i < tail.length; i++) {
      const tailMessage = tail[i];
      extractBranch(tailMessage);
      if (
        tailMessage?.role === 'user' &&
        Array.isArray(tailMessage.versions) &&
        tailMessage.versions.length > 1
      ) {
        break;
      }
    }
  };
  extractBranch(rootMessage);
  return history;
}

// ── Views ─────────────────────────────────────────────────────────────────

export function renderSession(session) {
  if (!session || !session.history?.length) { showWelcome(); return; }
  showChat();
  const flatHistory = session.history[0]?.versions
    ? extractFlatHistoryFromTree(session.history[0])
    : session.history;
  renderHistory(flatHistory);
}

function showWelcome() {
  document.getElementById('welcome-view')?.classList.remove('hidden');
  document.getElementById('chat-view')?.classList.add('hidden');
  document.getElementById('bottom-input-bar')?.classList.add('hidden');
}

function showChat() {
  document.getElementById('welcome-view')?.classList.add('hidden');
  document.getElementById('chat-view')?.classList.remove('hidden');
  document.getElementById('bottom-input-bar')?.classList.remove('hidden');
}

// ── Full history render ───────────────────────────────────────────────────

export function renderHistory(history) {
  showChat();
  currentHistory = Array.isArray(history) ? history : [];
  const box = document.getElementById('chat-messages');
  if (!box) return;
  box.innerHTML = '';

  for (let i = 0; i < currentHistory.length; i++) {
    const msg = currentHistory[i];
    const cleanMsg = { ...msg, content: stripSessionTag(msg.content) };
    if      (cleanMsg.role === 'user')      appendUserMsg(box, cleanMsg, i);
    else if (cleanMsg.role === 'assistant') appendAssistantMsg(box, cleanMsg, i, currentHistory);
    else if (cleanMsg.role === 'image')     appendMediaMsg(box, 'image', cleanMsg.content);
    else if (cleanMsg.role === 'video')     appendMediaMsg(box, 'video', cleanMsg.content);
    else if (cleanMsg.role === 'audio')     appendMediaMsg(box, 'audio', cleanMsg.content);
  }

  const sessionError = activeSessionId ? sessionErrorStates.get(activeSessionId) : null;
  if (sessionError) {
    box.appendChild(buildAssistantErrorGroup(sessionError));
  }

  if (typeof renderMathInElement !== 'undefined') {
    try {
      renderMathInElement(box, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$',  right: '$',  display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    } catch {}
  }

  if (autoScroll) box.scrollTop = box.scrollHeight;
}

function stripSessionTag(content) {
  if (typeof content !== 'string') return content;
  return content.replace(/<session_name>[\s\S]*?<\/session_name>/gi, '').trim();
}

// ── Message renderers ─────────────────────────────────────────────────────

function appendUserMsg(box, msg, index) {
  const wrap = makeWrap(index);
  const bubble = document.createElement('div');
  bubble.className = 'msg-user';

  const text = msgText(msg.content);
  const imgs = msgImages(msg.content);
  const files = msgFiles(msg.content);

  // Render text (convert bullet chars back for display)
  const displayText = textWithBullets(text);
  bubble.innerHTML = renderMarkdown(displayText);
  hydrateHtmlSandboxPlaceholders(bubble);
  attachCodeCopyListeners(bubble);
  attachSvgPanelListeners(bubble);

  // Image attachments
  imgs.forEach(src => {
    const img = document.createElement('img');
    img.src = src; img.alt = 'Attached image';
    img.style.cssText = 'max-width:100%;max-height:260px;border-radius:8px;margin-top:8px;display:block;cursor:pointer;';
    img.addEventListener('click', () => openImageModal(src));
    bubble.appendChild(img);
  });

  // File attachments — shown as chips
  if (files.length > 0) {
    const fileRow = document.createElement('div');
    fileRow.className = 'msg-file-attachments';
    files.forEach(f => {
      const chip = buildFileChipView(f.name, f.content, false);
      fileRow.appendChild(chip);
    });
    bubble.appendChild(fileRow);
  }

  wrap.appendChild(bubble);

  // Version navigator below the bubble (only on user messages)
  if (msg.versions?.length > 1) {
    wrap.appendChild(buildVersionNav(msg, index));
  }

  // Action buttons
  wrap.appendChild(buildActions([
    { icon: copyIcon(), title: 'Copy', fn: () => copyText(text) },
    { icon: editIcon(), title: 'Edit', fn: () => startUserEdit(wrap, index, msg, text, files) },
  ], 'right'));

  box.appendChild(wrap);
}

function appendAssistantMsg(box, msg, index, history = []) {
  const wrap = makeWrap(index);
  const bubble = document.createElement('div');
  bubble.className = 'msg-assistant';

  bubble.appendChild(buildAssistantTimeline(msg));

  if (msg.responseEdits?.length) {
    bubble.appendChild(buildResponseEditSummary(msg.responseEdits));
  }

  wrap.appendChild(bubble);

  if (msg.versions?.length > 1) {
    wrap.appendChild(buildVersionNav(msg, index, 'left'));
  }

  const actions = [
    { icon: copyIcon(), title: 'Copy', fn: () => copyText(msg.content || '') },
    { icon: editIcon(), title: 'Edit', fn: () => startAssistantEdit(wrap, index, msg) },
    { icon: regenerateIcon(), title: 'Regenerate', fn: () => sendAssistantAction(index, 'regenerate') },
  ];
  if (canContinueAssistant(history, index)) {
    actions.push({ icon: continueIcon(), title: 'Continue', fn: () => sendAssistantAction(index, 'continue') });
  }

  wrap.appendChild(buildActions(actions, 'left'));

  box.appendChild(wrap);
}

function canContinueAssistant(history = [], index = -1) {
  if (!Array.isArray(history) || index < 0) return false;
  for (let i = index + 1; i < history.length; i++) {
    const role = history[i]?.role;
    if (role === 'user' || role === 'assistant') return false;
  }
  return true;
}

function buildAssistantTimeline(msg = {}) {
  const timeline = document.createElement('div');
  timeline.className = 'assistant-timeline';

  const segments = Array.isArray(msg.responseSegments) && msg.responseSegments.length
    ? msg.responseSegments
    : [{ type: 'text', text: msg.content || '' }];

  segments.forEach((segment, index) => {
    if (index > 0) timeline.appendChild(buildAssistantFlowDivider(segment.type));
    if (segment.type === 'tool_call') timeline.appendChild(buildToolTimelineRow(segment, msg.toolCalls || []));
    else timeline.appendChild(buildAssistantTextSegment(segment.text || ''));
  });

  return timeline;
}

function buildAssistantTextSegment(text) {
  const segment = document.createElement('div');
  segment.className = 'assistant-timeline-segment assistant-timeline-text';
  const displayText = stripSessionTag(processDisplay(text || ''));
  segment.innerHTML = renderMarkdown(displayText);
  hydrateHtmlSandboxPlaceholders(segment);
  attachCodeCopyListeners(segment);
  attachSvgPanelListeners(segment);
  return segment;
}

function buildAssistantFlowDivider(nextType = 'text') {
  const divider = document.createElement('div');
  divider.className = 'assistant-flow-divider';
  divider.innerHTML = `
    <span class="assistant-flow-line" aria-hidden="true"></span>
    <span class="assistant-flow-label">${nextType === 'tool_call' ? 'Tool' : 'Reply'}</span>
    <span class="assistant-flow-line" aria-hidden="true"></span>
  `;
  return divider;
}

function buildToolTimelineRow(segment, calls = []) {
  const callId = segment?.callId;
  const call = calls.find((entry) => entry.id === callId) || segment.call || { id: callId, name: 'tool' };
  const row = document.createElement('div');
  row.className = 'assistant-timeline-segment assistant-timeline-tool';
  row.appendChild(buildToolChip(call));
  return row;
}

function buildAssistantErrorGroup(errorState = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-group';
  const bubble = document.createElement('div');
  bubble.className = 'msg-assistant msg-assistant-error';
  bubble.innerHTML = `
    <div class="assistant-error-copy">${escHtml(errorState.error || 'Something went wrong.')}</div>
    <button class="assistant-error-retry" type="button">
      ${retryIcon()}
      <span>Retry</span>
    </button>
  `;
  bubble.querySelector('.assistant-error-retry')?.addEventListener('click', () => retryLastSessionRequest(activeSessionId));
  wrap.appendChild(bubble);
  return wrap;
}

function appendMediaMsg(box, type, content) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-media';

  const contentRef = typeof content === 'string'
    ? { src: content, name: type === 'image' ? 'image.png' : type === 'video' ? 'video.mp4' : 'audio.mp3' }
    : { assetId: content.assetId, mimeType: content.mimeType, name: content.name || `${type}` };

  if (type === 'image') {
    const img = document.createElement('img');
    img.alt = 'Generated image';
    hydrateMediaElement(img, contentRef, 'src');
    img.addEventListener('click', async () => {
      const src = await resolveMediaUrl(contentRef);
      if (src) openImageModal(src);
    });
    wrap.appendChild(img);
    wrap.appendChild(dlBtn(() => downloadMedia(contentRef)));
  } else if (type === 'video') {
    const v = document.createElement('video');
    v.controls = true; v.preload = 'metadata';
    hydrateMediaElement(v, contentRef, 'src');
    wrap.appendChild(v);
    wrap.appendChild(dlBtn(() => downloadMedia(contentRef)));
  } else if (type === 'audio') {
    const a = document.createElement('audio');
    a.controls = true; a.preload = 'metadata'; a.style.width = '100%';
    hydrateMediaElement(a, contentRef, 'src');
    wrap.appendChild(a);
    const db = dlBtn(() => downloadMedia(contentRef));
    db.style.cssText += ';position:static;margin-top:6px;opacity:1;';
    wrap.appendChild(db);
  }
  box.appendChild(wrap);
}

// ── File content extraction from message ─────────────────────────────────

/**
 * Extract text file attachments embedded in the message content string.
 * They're stored as <details><summary>name</summary>\n```\ncontent\n```\n</details>
 */
function msgFiles(content) {
  if (typeof content !== 'string') return [];
  const files = [];
  const re = /<details><summary>([^<]+?)<\/summary>\s*```(?:\w*)\n([\s\S]*?)\n```\s*<\/details>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    files.push({ name: m[1].trim(), content: m[2] });
  }
  return files;
}

/**
 * Strip the embedded file details blocks from display text so we show
 * only the user's written text.
 */
function stripFileBlocks(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/<details><summary>Attached Files<\/summary>[\s\S]*?<\/details>/g, '')
    .replace(/<details><summary>[^<]+?<\/summary>[\s\S]*?<\/details>/g, '')
    .trim();
}

/**
 * Build a clickable chip for viewing a text file (read-only in sent messages).
 */
function buildFileChipView(name, content, editable = false, onSave) {
  const chip = document.createElement('div');
  chip.className = 'file-attachment-chip';
  chip.title = name;
  const lineCount = (content.match(/\n/g) || []).length + 1;
  chip.innerHTML = `
    <span class="chip-icon">📄</span>
    <div style="display:flex;flex-direction:column;min-width:0;">
      <span class="chip-name">${escHtml(name)}</span>
      <span class="chip-meta">${lineCount} line${lineCount !== 1 ? 's' : ''}</span>
    </div>`;
  chip.addEventListener('click', () => {
    import('./modals.js').then(m => m.openFileViewerModal({
      name,
      content,
      editable,
      onSave,
    }));
  });
  return chip;
}

// ── Builders ──────────────────────────────────────────────────────────────

function makeWrap(index) {
  const w = document.createElement('div');
  w.className = 'msg-group'; w.dataset.index = index;
  return w;
}

function buildActions(items, side = 'left') {
  const div = document.createElement('div');
  div.className = 'msg-actions' + (side === 'right' ? ' msg-actions-right' : ' msg-actions-left');
  items.forEach(({ icon, title, fn }) => {
    const btn = document.createElement('button');
    btn.className = 'msg-action-btn'; btn.title = title;
    btn.innerHTML = icon;
    btn.addEventListener('click', e => { e.stopPropagation(); fn(); });
    div.appendChild(btn);
  });
  return div;
}

function buildVersionNav(msg, index, side = 'right') {
  const nav     = document.createElement('div');
  nav.className = `msg-version-nav msg-version-nav-${side}`;
  const total   = msg.versions.length;
  const cur     = (msg.currentVersionIdx ?? 0) + 1;

  const prev = document.createElement('button');
  prev.innerHTML = chevronLeftIcon();
  prev.title = 'Previous version';
  prev.disabled = cur <= 1;
  prev.addEventListener('click', () => send({ type: 'chat:selectVersion',
    sessionId: activeSessionId, messageIndex: index, versionIdx: (msg.currentVersionIdx ?? 0) - 1 }));

  const lbl = document.createElement('span');
  lbl.textContent = `${cur} / ${total}`;
  lbl.style.cssText = 'min-width:36px;text-align:center;';

  const next = document.createElement('button');
  next.innerHTML = chevronRightIcon();
  next.title = 'Next version';
  next.disabled = cur >= total;
  next.addEventListener('click', () => send({ type: 'chat:selectVersion',
    sessionId: activeSessionId, messageIndex: index, versionIdx: (msg.currentVersionIdx ?? 0) + 1 }));

  nav.appendChild(prev); nav.appendChild(lbl); nav.appendChild(next);
  return nav;
}

function buildToolChip(call) {
  const names = { ollama_search: 'Web Search', read_web_page: 'Read Page',
    generate_image: 'Image Gen', generate_video: 'Video Gen', generate_audio: 'Audio Gen',
    save_memory: 'Save Memory', delete_memory: 'Delete Memory', list_memories: 'List Memories',
    edit_response_draft: 'Revise Draft' };
  const icons = { ollama_search: '🔍', read_web_page: '📄',
    generate_image: '🖼️', generate_video: '🎬', generate_audio: '🎵',
    save_memory: '🧠', delete_memory: '🧠', list_memories: '🧠', edit_response_draft: '✏️' };
  const chip = document.createElement('button');
  chip.className = 'msg-tool-call';
  chip.innerHTML = `<span>${icons[call.name] || '🔧'}</span><span>${escHtml(names[call.name] || call.name)}</span>`;
  chip.addEventListener('click', () => import('./modals.js').then(m => m.showToolCallModal(call)));
  return chip;
}

function dlBtn(fn) {
  const btn = document.createElement('button');
  btn.className = 'media-download-btn'; btn.textContent = 'Download';
  btn.addEventListener('click', fn);
  return btn;
}

function toolLabel(name) {
  const names = {
    ollama_search: 'Web Search',
    read_web_page: 'Read Page',
    generate_image: 'Image Gen',
    generate_video: 'Video Gen',
    generate_audio: 'Audio Gen',
    save_memory: 'Save Memory',
    delete_memory: 'Delete Memory',
    list_memories: 'List Memories',
    edit_response_draft: 'Revise Draft',
  };
  return names[name] || name || 'Tool';
}

function toolIcon(name) {
  switch (name) {
    case 'ollama_search':
      return searchIcon();
    case 'read_web_page':
      return fileIcon();
    case 'generate_image':
      return imageIcon();
    case 'generate_video':
      return videoIcon();
    case 'generate_audio':
      return audioIcon();
    case 'save_memory':
    case 'delete_memory':
    case 'list_memories':
      return memoryIcon();
    case 'edit_response_draft':
      return writeIcon();
    default:
      return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"/><path d="M2 12h20"/></svg>`;
  }
}

// function buildToolChip(call) {
//   const chip = document.createElement('button');
//   chip.className = 'msg-tool-call';
//   chip.dataset.state = call?.state || 'resolved';
//   chip.innerHTML = `
//     <span class="msg-tool-icon" aria-hidden="true">${toolIcon(call?.name)}</span>
//     <span>${escHtml(toolLabel(call?.name))}</span>
//   `;
//   chip.addEventListener('click', () => import('./modals.js').then(m => m.showToolCallModal(call)));
//   return chip;
// }

async function resolveMediaUrl(contentRef) {
  if (contentRef?.src) return contentRef.src;
  if (!contentRef?.assetId) return '';
  return getMediaObjectUrl(contentRef.assetId);
}

function hydrateMediaElement(el, contentRef, prop = 'src') {
  resolveMediaUrl(contentRef).then((url) => {
    if (url) el[prop] = url;
  }).catch(() => {
    el.classList.add('media-load-error');
  });
}

function downloadMedia(contentRef) {
  if (contentRef?.assetId) {
    return downloadMediaItem({ id: contentRef.assetId, name: contentRef.name || 'download' });
  }
  return dlMedia(contentRef.src, contentRef.name || 'download');
}

function formatDraftEditPreview(text, { tail = false, max = 260 } = {}) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '[empty]';
  if (normalized.length <= max) return normalized;
  return tail ? `...${normalized.slice(-max)}` : `${normalized.slice(0, max)}...`;
}

function buildResponseEditSummary(edits = []) {
  const details = document.createElement('details');
  details.className = 'response-edit-log';

  const summary = document.createElement('summary');
  summary.textContent = `Model revised this reply ${edits.length} time${edits.length === 1 ? '' : 's'}`;
  details.appendChild(summary);

  edits.forEach((edit, index) => {
    const item = document.createElement('div');
    item.className = 'response-edit-item';
    item.innerHTML = `
      <div class="response-edit-title">Revision ${index + 1}</div>
      <div class="response-edit-reason">${escHtml(edit.reason || 'Model revised its draft.')}</div>
      <div class="response-edit-compare">
        <div class="response-edit-pane">
          <div class="response-edit-label">Before</div>
          <pre>${escHtml(formatDraftEditPreview(edit.before, { tail: true }))}</pre>
        </div>
        <div class="response-edit-pane">
          <div class="response-edit-label">After</div>
          <pre>${escHtml(formatDraftEditPreview(edit.after, { tail: true }))}</pre>
        </div>
      </div>
    `;
    details.appendChild(item);
  });
  return details;
}

// ── SVG icons ─────────────────────────────────────────────────────────────

function copyIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
}

function editIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}

function searchIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
}
function imageIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
}
function videoIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`;
}
function audioIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
}
function attachIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}
function sendSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21L23 12 2 3v7l15 2-15 2v7z"/></svg>`;
}

function chevronLeftIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`;
}

function chevronRightIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
}

function regenerateIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15.55-6.36L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15.55 6.36L3 16"/></svg>`;
}

function continueIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4l14 8-14 8V4z"/></svg>`;
}

function retryIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15A9 9 0 1 1 23 10"/></svg>`;
}

function fileIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
}

function memoryIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.5 2A2.5 2.5 0 0 0 7 4.5V6H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1.2a6 6 0 0 0 11.6 0H19a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2V4.5A2.5 2.5 0 0 0 14.5 2h-5z"/><path d="M9 6V4.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V6"/></svg>`;
}

function writeIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;
}

// ── Inline editing ────────────────────────────────────────────────────────

function extractAttachmentsFromContent(content) {
  if (!content || typeof content === 'string') {
    // Extract from embedded file blocks in text
    const files = msgFiles(typeof content === 'string' ? content : '');
    return files.map(f => ({ type: 'text', name: f.name, content: f.content }));
  }
  if (!Array.isArray(content)) return [];
  const attachments = [];
  content.forEach(item => {
    if (item.type === 'image_url' && item.image_url?.url) {
      const dataUrl = item.image_url.url;
      if (dataUrl.startsWith('data:')) {
        const comma = dataUrl.indexOf(',');
        if (comma > 0) {
          const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
          const base64 = dataUrl.slice(comma + 1);
          const ext = mimeType.split('/')[1] || 'png';
          attachments.push({ type: 'image', name: `image.${ext}`, base64, mimeType });
        }
      }
    }
  });
  // Also extract text files from text part
  const textPart = content.find(p => p.type === 'text')?.text || '';
  msgFiles(textPart).forEach(f => {
    attachments.push({ type: 'text', name: f.name, content: f.content });
  });
  return attachments;
}

/**
 * startUserEdit now accepts existingFiles extracted from the rendered message.
 */
function startUserEdit(wrap, index, msg, originalText, existingFiles = []) {
  const bubble = wrap.querySelector('.msg-user'); if (!bubble) return;
  const originalHTML = bubble.innerHTML;

  // Get clean text without embedded file blocks
  const cleanText = stripFileBlocks(originalText);

  bubble.innerHTML = '';
  bubble.classList.add('editing-user');

  // Textarea — show bullet characters correctly
  const ta = makeUserEditTextarea(cleanText);

  // Set up bullet auto-convert in the edit textarea
  setupEditBulletConvert(ta);

  bubble.appendChild(ta);

  // File preview row
  const editAttachments = [];
  // Start with existing image attachments
  const existingImages = extractAttachmentsFromContent(msg.content).filter(a => a.type === 'image');
  editAttachments.push(...existingImages);
  // Add existing text file attachments
  existingFiles.forEach(f => editAttachments.push({ type: 'text', name: f.name, content: f.content }));

  const filePreviewRow = document.createElement('div');
  filePreviewRow.className = 'edit-file-preview-row';
  bubble.appendChild(filePreviewRow);

  if (editAttachments.length > 0) renderEditFilePreview(editAttachments, filePreviewRow);

  // Bottom toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'edit-toolbar';

  const toolRow = document.createElement('div');
  toolRow.className = 'edit-tool-row';

  const toolDefs = [
    { key: 'webSearch', label: 'Search', icon: searchIcon() },
    { key: 'imageGen',  label: 'Image',  icon: imageIcon() },
    { key: 'videoGen',  label: 'Video',  icon: videoIcon() },
    { key: 'audioGen',  label: 'Audio',  icon: audioIcon() },
  ];

  toolDefs.forEach(({ key, label, icon }) => {
    const btn = document.createElement('button');
    btn.className = 'tool-btn-sm edit-tool-btn';
    btn.dataset.tool = key;
    btn.title = label;
    btn.innerHTML = `${icon}<span>${label}</span>`;
    const mainBtn = document.querySelector(`#bottom-input-bar [data-tool="${key}"]`);
    if (mainBtn?.classList.contains('active')) btn.classList.add('active');
    btn.addEventListener('click', () => btn.classList.toggle('active'));
    toolRow.appendChild(btn);
  });

  // Paste image in edit textarea
  ta.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const dataUrl = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });
          const comma = dataUrl.indexOf(',');
          const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
          const base64 = dataUrl.slice(comma + 1);
          editAttachments.push({
            type: 'image',
            name: file.name || `image.${mimeType.split('/')[1] || 'png'}`,
            base64, mimeType,
          });
          renderEditFilePreview(editAttachments, filePreviewRow);
        }
      }
    }
  });

  // Attach button
  const attachBtn = document.createElement('button');
  attachBtn.className = 'edit-attach-btn';
  attachBtn.title = 'Attach file or image';
  attachBtn.innerHTML = attachIcon();
  attachBtn.addEventListener('click', e => {
    e.stopPropagation();
    openEditAttachMenu(e, attachBtn, editAttachments, filePreviewRow);
  });
  toolRow.appendChild(attachBtn);
  toolbar.appendChild(toolRow);

  // Cancel + Send
  const btnRow = document.createElement('div');
  btnRow.className = 'edit-btn-row';

  const cancelBtn = makeBtn('Cancel', 'btn-ghost');
  cancelBtn.addEventListener('click', () => {
    bubble.classList.remove('editing-user');
    bubble.innerHTML = originalHTML;
    attachCodeCopyListeners(bubble);
  });

  const sendBtn = document.createElement('button');
  sendBtn.className = 'btn-primary edit-send-btn';
  sendBtn.innerHTML = `${sendSvg()} Send`;
  sendBtn.addEventListener('click', () => {
    const newContent = ta.value.trim(); if (!newContent && editAttachments.length === 0) return;
    sendBtn.disabled = true;

    const tools = {};
    toolbar.querySelectorAll('[data-tool]').forEach(b => {
      tools[b.dataset.tool] = b.classList.contains('active');
    });

    send({
      type: 'chat:editMessage',
      sessionId: activeSessionId,
      messageIndex: index,
      newContent: buildEditContent(newContent, editAttachments),
      role: 'user',
    });

    const handler = (editMsg) => {
      if (editMsg.sessionId !== activeSessionId || editMsg.messageIndex !== index) return;
      off('chat:messageEdited', handler);
      sendTrackedRequest({
        type: 'chat:send',
        sessionId: activeSessionId,
        tools,
        clientId: localStorage.getItem('ipai_client_id') || '',
      });
    };
    on('chat:messageEdited', handler);
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(sendBtn);
  toolbar.appendChild(btnRow);

  bubble.appendChild(toolbar);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

// function setupEditBulletConvert(ta) {
//   ta.addEventListener('keydown', (e) => {
//     const val = ta.value;
//     const pos = ta.selectionStart;

//     if (e.key === ' ') {
//       const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
//       const beforeCursor = val.slice(lineStart, pos);
//       if (beforeCursor === '-') {
//         e.preventDefault();
//         const newVal = val.slice(0, lineStart) + BULLET + ' ' + val.slice(pos);
//         ta.value = newVal;
//         const newPos = lineStart + 2;
//         ta.setSelectionRange(newPos, newPos);
//         ta.style.height = 'auto';
//         ta.style.height = ta.scrollHeight + 'px';
//         return;
//       }
//     }

//     if (e.key === 'Backspace') {
//       const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
//       const beforeCursor = val.slice(lineStart, pos);
//       if (beforeCursor === BULLET + ' ') {
//         e.preventDefault();
//         const newVal = val.slice(0, lineStart) + '- ' + val.slice(pos);
//         ta.value = newVal;
//         const newPos = lineStart + 2;
//         ta.setSelectionRange(newPos, newPos);
//         ta.style.height = 'auto';
//         ta.style.height = ta.scrollHeight + 'px';
//         return;
//       }
//       if (beforeCursor === BULLET) {
//         e.preventDefault();
//         const newVal = val.slice(0, lineStart) + '-' + val.slice(pos);
//         ta.value = newVal;
//         const newPos = lineStart + 1;
//         ta.setSelectionRange(newPos, newPos);
//         ta.style.height = 'auto';
//         ta.style.height = ta.scrollHeight + 'px';
//       }
//     }
//   });
// }

function getTextareaLineInfo(ta) {
  const value = ta.value;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const line = value.slice(lineStart, lineEnd);
  return { value, start, end, lineStart, lineEnd, line };
}

function replaceTextareaContent(ta, from, to, nextText, cursorOffset = nextText.length) {
  ta.value = ta.value.slice(0, from) + nextText + ta.value.slice(to);
  const nextPos = from + cursorOffset;
  ta.setSelectionRange(nextPos, nextPos);
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function setupEditBulletConvert(ta) {
  ta.addEventListener('keydown', (e) => {
    const { value, start, end, lineStart, lineEnd, line } = getTextareaLineInfo(ta);
    const trimmed = line.trim();
    const beforeCursor = value.slice(lineStart, start);

    if (e.key === ' ' && beforeCursor === '-') {
      e.preventDefault();
      replaceTextareaContent(ta, lineStart, start, `${BULLET} `);
      return;
    }

    if (e.key === 'Enter' && e.shiftKey && line.startsWith(`${BULLET} `)) {
      e.preventDefault();
      const nextLine = trimmed === BULLET ? '\n' : `\n${BULLET} `;
      replaceTextareaContent(ta, start, end, nextLine);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && line === `${BULLET} ` && start === end) {
      e.preventDefault();
      replaceTextareaContent(ta, lineStart, lineEnd, '', 0);
      return;
    }

    if (e.key === 'Backspace' && start === end && line.startsWith(`${BULLET} `) && beforeCursor === `${BULLET} `) {
      e.preventDefault();
      replaceTextareaContent(ta, lineStart, lineStart + 2, '', 0);
    }
  });
}

function buildEditContent(text, attachments) {
  const images = attachments.filter(a => a.type === 'image');
  const files  = attachments.filter(a => a.type === 'text');
  let fullText = text;
  if (files.length > 0) {
    fullText += '\n\n<details><summary>Attached Files</summary>\n';
    for (const f of files)
      fullText += `\n<details><summary>${f.name}</summary>\n\n\`\`\`\n${f.content}\n\`\`\`\n\n</details>\n`;
    fullText += '</details>';
  }
  if (images.length > 0) {
    return [
      { type: 'text', text: fullText },
      ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })),
    ];
  }
  return fullText;
}

function openEditAttachMenuLegacy(e, triggerEl, editAttachments, filePreviewRow) {
  e.preventDefault();
  const fileInput  = document.getElementById('file-input');
  const imageInput = document.getElementById('image-input');
  if (!fileInput || !imageInput) return;

  const menu = document.getElementById('attach-context-menu');
  if (!menu) return;
  menu.innerHTML = '';

  for (const item of [
    {
      label: '📄 Upload file',
      onClick: () => {
        const handler = async function() {
          for (const file of fileInput.files) {
            const text = await file.text();
            editAttachments.push({ type: 'text', name: file.name, content: text });
          }
          fileInput.value = '';
          fileInput.removeEventListener('change', handler);
          renderEditFilePreview(editAttachments, filePreviewRow);
        };
        fileInput.addEventListener('change', handler);
        fileInput.click();
      },
    },
    {
      label: '🖼️ Upload image',
      onClick: () => {
        const handler = async function() {
          for (const file of imageInput.files) {
            const dataUrl = await new Promise((res, rej) => {
              const reader = new FileReader();
              reader.onload  = () => res(reader.result);
              reader.onerror = rej;
              reader.readAsDataURL(file);
            });
            const comma = dataUrl.indexOf(',');
            const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
            const base64   = dataUrl.slice(comma + 1);
            editAttachments.push({ type: 'image', name: file.name, base64, mimeType });
          }
          imageInput.value = '';
          imageInput.removeEventListener('change', handler);
          renderEditFilePreview(editAttachments, filePreviewRow);
        };
        imageInput.addEventListener('change', handler);
        imageInput.click();
      },
    },
  ]) {
    const el = document.createElement('div');
    el.className = 'context-item'; el.textContent = item.label;
    el.addEventListener('click', () => { menu.classList.add('hidden'); item.onClick(); });
    menu.appendChild(el);
  }

  menu.classList.remove('hidden');
  const rect = triggerEl.getBoundingClientRect();
  const mh   = 80;
  menu.style.left = `${Math.max(8, rect.left)}px`;
  menu.style.top  = `${rect.top - mh - 8}px`;
  setTimeout(() => document.addEventListener('click', () => menu.classList.add('hidden'), { once: true }), 0);
}

function openEditAttachMenu(e, triggerEl, editAttachments, filePreviewRow) {
  e.preventDefault();
  const fileInput = document.getElementById('file-input');
  const imageInput = document.getElementById('image-input');
  if (!fileInput || !imageInput) return;

  const rect = triggerEl.getBoundingClientRect();
  showContextMenu(rect.left, rect.top - 8, [
    {
      label: 'Upload file',
      description: 'Attach a text file from your device to this edit.',
      icon: 'UP',
      onClick: () => {
        const handler = async function() {
          for (const file of fileInput.files) {
            const text = await file.text();
            editAttachments.push({ type: 'text', name: file.name, content: text });
          }
          fileInput.value = '';
          fileInput.removeEventListener('change', handler);
          renderEditFilePreview(editAttachments, filePreviewRow);
        };
        fileInput.addEventListener('change', handler);
        fileInput.click();
      },
    },
    {
      label: 'Upload image',
      description: 'Add an image from your device to this edit.',
      icon: 'IMG',
      onClick: () => {
        const handler = async function() {
          for (const file of imageInput.files) {
            const dataUrl = await new Promise((res, rej) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result);
              reader.onerror = rej;
              reader.readAsDataURL(file);
            });
            const comma = dataUrl.indexOf(',');
            const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
            const base64 = dataUrl.slice(comma + 1);
            editAttachments.push({ type: 'image', name: file.name, base64, mimeType });
          }
          imageInput.value = '';
          imageInput.removeEventListener('change', handler);
          renderEditFilePreview(editAttachments, filePreviewRow);
        };
        imageInput.addEventListener('change', handler);
        imageInput.click();
      },
    },
    {
      label: 'Add from media library',
      description: 'Reuse files and images already saved in cloud storage.',
      icon: 'LIB',
      onClick: async () => {
        openMediaPicker({
          onSelect: async (items) => {
            for (const item of items) {
              const attachment = await mediaItemToAttachment(item);
              if (attachment) editAttachments.push(attachment);
            }
            renderEditFilePreview(editAttachments, filePreviewRow);
          },
        });
      },
    },
  ], { triggerEl });
}

function renderEditFilePreview(attachments, row) {
  row.innerHTML = '';
  if (attachments.length === 0) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.gap = '6px';
  attachments.forEach((a, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'attach-preview-item';
    if (a.type === 'image') {
      const img = document.createElement('img');
      img.src = `data:${a.mimeType};base64,${a.base64}`; img.alt = a.name;
      wrap.appendChild(img);
    } else {
      // Use the same nice chip for text files in edit mode
      const chip = buildFileChipView(a.name, a.content, true, (nc) => {
        attachments[i].content = nc;
      });
      wrap.appendChild(chip);
    }
    const rm = document.createElement('button');
    rm.className = 'attach-preview-remove'; rm.textContent = '×';
    rm.addEventListener('click', e => {
      e.stopPropagation();
      attachments.splice(i, 1);
      renderEditFilePreview(attachments, row);
    });
    wrap.appendChild(rm);
    row.appendChild(wrap);
  });
  renderFilePreviewRow();
}

function startAssistantEdit(wrap, index, msg) {
  const bubble = wrap.querySelector('.msg-assistant'); if (!bubble) return;
  const originalContent = msg.content || '';
  const originalHTML = bubble.innerHTML;

  bubble.classList.add('editing');
  bubble.innerHTML = '';

  const ta = makeAssistantEditTextarea(originalContent);
  bubble.appendChild(ta);

  const btns = document.createElement('div');
  btns.className = 'edit-actions';

  const cancelBtn = makeBtn('Cancel', 'btn-ghost');
  cancelBtn.addEventListener('click', () => {
    bubble.classList.remove('editing');
    bubble.innerHTML = originalHTML;
    attachCodeCopyListeners(bubble);
    attachSvgPanelListeners(bubble);
  });

  const saveBtn = makeBtn('Save', 'btn-primary');
  saveBtn.addEventListener('click', () => {
    const newContent = ta.value.trim(); if (!newContent) return;
    saveBtn.disabled = true;
    send({ type: 'chat:editMessage', sessionId: activeSessionId,
      messageIndex: index, newContent, role: 'assistant' });
  });

  btns.appendChild(cancelBtn); btns.appendChild(saveBtn);
  bubble.appendChild(btns);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

function makeUserEditTextarea(value) {
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.style.cssText = [
    'width:100%',
    'background:transparent',
    'border:none',
    'outline:none',
    'color:var(--text)',
    'font:inherit',
    'font-size:15px',
    'resize:none',
    'line-height:1.6',
    'min-height:26px',
    'overflow-y:hidden',
    'display:block',
  ].join(';');
  const resize = () => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  };
  ta.addEventListener('input', resize);
  requestAnimationFrame(resize);
  return ta;
}

function makeAssistantEditTextarea(value) {
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.style.cssText = [
    'width:100%',
    'background:transparent',
    'border:none',
    'outline:none',
    'color:var(--text)',
    'font:inherit',
    'font-size:14px',
    'resize:none',
    'line-height:1.6',
    'min-height:120px',
    'overflow-y:auto',
    'display:block',
    'padding-bottom:8px',
  ].join(';');
  const resize = () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.6) + 'px';
  };
  ta.addEventListener('input', resize);
  requestAnimationFrame(resize);
  return ta;
}

function makeBtn(label, cls) {
  const btn = document.createElement('button');
  btn.textContent = label; btn.className = cls;
  btn.style.cssText += ';font-size:12px;padding:5px 12px;';
  return btn;
}

// ── Streaming ─────────────────────────────────────────────────────────────

// function onChatStart(msg) {
//   const sessionId = msg.sessionId;
//   isStreaming = true;
//   streamingSessionId = sessionId;
//   streamingText = '';
//   pendingAssets = [];
//   streamingDraftEdits = [];

//   if (sessionId !== activeSessionId) {
//     // Streaming for a background session — just track state, no UI
//     return;
//   }

//   showChat();
//   const box = document.getElementById('chat-messages'); if (!box) return;
//   streamingBubble = document.createElement('div');
//   streamingBubble.className = 'msg-assistant msg-generating';

//   const thinking = document.createElement('div'); thinking.className = 'msg-thinking';
//   for (let i = 0; i < 3; i++) {
//     const d = document.createElement('div'); d.className = 'thinking-dot'; thinking.appendChild(d);
//   }
//   streamingBubble.appendChild(thinking);
//   box.appendChild(streamingBubble);
//   if (autoScroll) box.scrollTop = box.scrollHeight;
//   updateSendBtn(true);
// }

function onToken(token) {
  if (!streamingBubble) return;
  streamingText += token;
  streamingBubble.querySelector('.msg-thinking')?.remove();
  const displayText = stripSessionTag(processDisplay(streamingText));
  streamingBubble.innerHTML = renderMarkdown(displayText);
  attachCodeCopyListeners(streamingBubble);
  attachSvgPanelListeners(streamingBubble);
  if (autoScroll) {
    const box = document.getElementById('chat-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }
}

function onDraftEdited(msg) {
  if (!streamingBubble) return;
  streamingText = msg.text || streamingText;
  if (msg.edit) streamingDraftEdits.push(msg.edit);
  const displayText = stripSessionTag(processDisplay(streamingText));
  streamingBubble.innerHTML = renderMarkdown(displayText);
  attachCodeCopyListeners(streamingBubble);
  attachSvgPanelListeners(streamingBubble);
  if (streamingDraftEdits.length) {
    streamingBubble.appendChild(buildResponseEditSummary(streamingDraftEdits));
  }
}

function onChatDone(msg) {
  const sessionId = msg.sessionId;
  if (sessionId === streamingSessionId) {
    isStreaming = false;
    streamingSessionId = null;
  }

  if (sessionId === activeSessionId) {
    streamingBubble?.classList.remove('msg-generating');
    streamingBubble = null;
    streamingText = '';
    streamingDraftEdits = [];
    updateSendBtn(false);
    if (msg.history) {
      renderHistory(msg.history);
    }
    pendingAssets = [];
  }
}

function onChatAborted(msg) {
  const sessionId = msg.sessionId;
  if (sessionId === streamingSessionId) {
    isStreaming = false;
    streamingSessionId = null;
  }

  if (sessionId === activeSessionId) {
    if (streamingBubble) {
      streamingBubble.classList.remove('msg-generating');
      const note = document.createElement('div');
      note.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:6px;';
      note.textContent = '⚠ Interrupted';
      streamingBubble.appendChild(note);
      streamingBubble = null;
    }
    updateSendBtn(false);
    if (msg.history) {
      renderHistory(msg.history);
    }
    pendingAssets = [];
    streamingDraftEdits = [];
  }
}

// function onChatError(err) {
//   isStreaming = false;
//   streamingSessionId = null;
//   streamingDraftEdits = [];
//   if (streamingBubble) {
//     streamingBubble.classList.remove('msg-generating');
//     streamingBubble.querySelector('.msg-thinking')?.remove();
//     const note = document.createElement('div');
//     note.style.cssText = 'color:#f87171;font-size:13px;margin-top:6px;';
//     note.textContent = `⚠ Error: ${err}`;
//     streamingBubble.appendChild(note);
//     streamingBubble = null;
//   }
//   updateSendBtn(false);
// }

// function handleLiveToolCall(call) {
//   if (!streamingBubble) return;
//   const names = { ollama_search: 'Searching web…', read_web_page: 'Reading page…',
//     generate_image: 'Generating image…', generate_video: 'Generating video…', generate_audio: 'Generating audio…',
//     save_memory: 'Saving memory…', delete_memory: 'Deleting memory…', list_memories: 'Checking memories…',
//     edit_response_draft: 'Revising answer…' };

//   if (call.state === 'pending') {
//     streamingBubble.querySelector('.msg-thinking')?.remove();
//     if (!streamingBubble.querySelector(`[data-tcid="${call.id}"]`)) {
//       const badge = document.createElement('div'); badge.className = 'msg-tool-call';
//       badge.style.pointerEvents = 'none'; badge.setAttribute('data-tcid', call.id);
//       badge.innerHTML = `<span>🔧</span><span>${names[call.name] || call.name}</span>`;
//       streamingBubble.appendChild(badge);
//     }
//   } else if (call.state === 'resolved' || call.state === 'canceled') {
//     streamingBubble.querySelector(`[data-tcid="${call.id}"]`)?.remove();
//   }
// }

function appendAsset(asset) {
  const box = document.getElementById('chat-messages'); if (!box) return;
  pendingAssets.push(asset);
  appendMediaMsg(box, asset.role, asset.content);
  if (autoScroll) box.scrollTop = box.scrollHeight;
}

function cloneRequestPayload(payload) {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return payload ? { ...payload } : payload;
  }
}

function clearRenderedSessionError() {
  document.querySelectorAll('.msg-assistant-error').forEach((node) => {
    node.closest('.msg-group')?.remove();
  });
}

function rememberLastSessionRequest(sessionId, payload) {
  if (!sessionId || !payload) return;
  lastSessionRequests.set(sessionId, cloneRequestPayload(payload));
}

function sendTrackedRequest(payload, { remember = true } = {}) {
  if (!payload?.sessionId) return false;
  if (remember) rememberLastSessionRequest(payload.sessionId, payload);
  sessionErrorStates.delete(payload.sessionId);
  if (payload.sessionId === activeSessionId) clearRenderedSessionError();
  return send(payload);
}

function retryLastSessionRequest(sessionId) {
  const payload = lastSessionRequests.get(sessionId);
  if (!payload) {
    showNotification({ type: 'error', message: 'Nothing to retry yet.', duration: 2000 });
    return;
  }
  sessionErrorStates.delete(sessionId);
  if (sessionId === activeSessionId) clearRenderedSessionError();
  send(payload);
}

function sendAssistantAction(messageIndex, action) {
  if (!activeSessionId || isStreaming) return;
  sendTrackedRequest({
    type: 'chat:assistantAction',
    sessionId: activeSessionId,
    messageIndex,
    action,
    tools: getActiveTools(),
    clientId: localStorage.getItem('ipai_client_id') || '',
  });
}

function createGeneratedTextSegment(start = 0, end = null) {
  return { type: 'text', text: '', generated: true, start, end };
}

function ensureLiveTextSegment() {
  const segment = streamingSegments[streamingLiveTextSegmentIndex];
  if (segment?.type === 'text' && segment.generated && segment.end == null) return segment;
  const nextSegment = createGeneratedTextSegment(streamingText.length, null);
  streamingSegments.push(nextSegment);
  streamingLiveTextSegmentIndex = streamingSegments.length - 1;
  return nextSegment;
}

function syncStreamingTextSegments() {
  streamingSegments.forEach((segment) => {
    if (segment?.type !== 'text' || !segment.generated) return;
    const start = Math.max(0, segment.start || 0);
    const end = typeof segment.end === 'number' ? segment.end : streamingText.length;
    segment.text = streamingText.slice(start, Math.max(start, end));
  });
}

function visibleStreamingSegments() {
  syncStreamingTextSegments();
  return streamingSegments.filter((segment) => {
    if (!segment) return false;
    if (segment.type === 'tool_call') return true;
    return !!stripSessionTag(processDisplay(segment.text || '')).trim();
  });
}

function hasStreamingContent() {
  return visibleStreamingSegments().length > 0;
}

function streamingToolStatus(call = {}) {
  if (call.state === 'resolved') return 'Thinkingâ€¦';
  if (call.state === 'canceled') return `${toolLabel(call.name)} canceled`;
  const names = {
    ollama_search: 'Searching the webâ€¦',
    read_web_page: 'Reading the pageâ€¦',
    generate_image: 'Generating an imageâ€¦',
    generate_video: 'Generating a videoâ€¦',
    generate_audio: 'Generating audioâ€¦',
    save_memory: 'Saving memoryâ€¦',
    delete_memory: 'Deleting memoryâ€¦',
    list_memories: 'Checking memoriesâ€¦',
    edit_response_draft: 'Revising the draftâ€¦',
  };
  return names[call.name] || `${toolLabel(call.name)} runningâ€¦`;
}

function renderStreamingBubble() {
  if (!streamingBubble) return;
  streamingBubble.innerHTML = '';

  const segments = visibleStreamingSegments();
  if (segments.length) {
    const timeline = document.createElement('div');
    timeline.className = 'assistant-timeline assistant-timeline-live';
    segments.forEach((segment, index) => {
      if (index > 0) timeline.appendChild(buildAssistantFlowDivider(segment.type));
      if (segment.type === 'tool_call') {
        timeline.appendChild(buildToolTimelineRow(segment, segment.call ? [segment.call] : []));
      } else {
        timeline.appendChild(buildAssistantTextSegment(segment.text || ''));
      }
    });
    streamingBubble.appendChild(timeline);
  }

  if (streamingDraftEdits.length) {
    streamingBubble.appendChild(buildResponseEditSummary(streamingDraftEdits));
  }

  const status = document.createElement('div');
  status.className = 'assistant-stream-status';
  status.innerHTML = `
    <span class="assistant-stream-spinner" aria-hidden="true">
      <span class="assistant-stream-dot"></span>
      <span class="assistant-stream-dot"></span>
      <span class="assistant-stream-dot"></span>
    </span>
    <span class="assistant-stream-label">${escHtml(streamingStatusLabel || 'Thinkingâ€¦')}</span>
  `;
  streamingBubble.appendChild(status);
}

function clearStreamingState() {
  streamingBubble = null;
  streamingText = '';
  pendingAssets = [];
  streamingDraftEdits = [];
  streamingSegments = [];
  streamingLiveTextSegmentIndex = -1;
  streamingToolSegmentIndexById = new Map();
  streamingStatusLabel = 'Thinkingâ€¦';
  streamingStartMeta = null;
  streamingSourceHistory = [];
}

function onChatStart(msg) {
  const sessionId = msg.sessionId;
  isStreaming = true;
  streamingSessionId = sessionId;
  streamingText = '';
  pendingAssets = [];
  streamingDraftEdits = [];
  streamingSegments = [];
  streamingLiveTextSegmentIndex = -1;
  streamingToolSegmentIndexById = new Map();
  streamingStartMeta = { ...msg };
  streamingSourceHistory = Array.isArray(currentHistory) ? [...currentHistory] : [];
  streamingStatusLabel = msg.action === 'continue'
    ? 'Continuing the responseâ€¦'
    : msg.action === 'regenerate'
      ? 'Regenerating responseâ€¦'
      : 'Thinkingâ€¦';
  sessionErrorStates.delete(sessionId);

  if (sessionId !== activeSessionId) return;

  clearRenderedSessionError();
  showChat();

  if (msg.streamKind === 'assistantAction') {
    renderHistory(streamingSourceHistory.slice(0, Math.max(0, msg.messageIndex ?? 0)));
  }

  const box = document.getElementById('chat-messages');
  if (!box) return;

  streamingBubble = document.createElement('div');
  streamingBubble.className = 'msg-assistant msg-generating';

  if (msg.prefillText) {
    streamingSegments.push({ type: 'text', text: msg.prefillText, generated: false });
  }
  streamingSegments.push(createGeneratedTextSegment(0, null));
  streamingLiveTextSegmentIndex = streamingSegments.length - 1;

  renderStreamingBubble();
  box.appendChild(streamingBubble);
  if (autoScroll) box.scrollTop = box.scrollHeight;
  updateSendBtn(true);
}

// function onToken(token) {
//   if (!streamingBubble) return;
//   ensureLiveTextSegment();
//   streamingText += token;
//   streamingStatusLabel = 'Thinkingâ€¦';
//   renderStreamingBubble();
//   if (autoScroll) {
//     const box = document.getElementById('chat-messages');
//     if (box) box.scrollTop = box.scrollHeight;
//   }
// }

// function onDraftEdited(msg) {
//   if (!streamingBubble) return;
//   streamingText = msg.text || streamingText;
//   if (msg.edit) streamingDraftEdits.push(msg.edit);
//   streamingStatusLabel = 'Revising responseâ€¦';
//   renderStreamingBubble();
// }

// function onChatDone(msg) {
//   const sessionId = msg.sessionId;
//   if (sessionId === streamingSessionId) {
//     isStreaming = false;
//     streamingSessionId = null;
//   }

//   if (sessionId === activeSessionId) {
//     sessionErrorStates.delete(sessionId);
//     updateSendBtn(false);
//     clearStreamingState();
//     if (msg.history) {
//       renderHistory(msg.history);
//     }
//   }
// }

// function onChatAborted(msg) {
//   const sessionId = msg.sessionId;
//   if (sessionId === streamingSessionId) {
//     isStreaming = false;
//     streamingSessionId = null;
//   }

//   if (sessionId === activeSessionId) {
//     updateSendBtn(false);
//     const restoreHistory = msg.history
//       || (streamingStartMeta?.streamKind === 'assistantAction' ? streamingSourceHistory : currentHistory);
//     clearStreamingState();
//     if (restoreHistory) renderHistory(restoreHistory);
//   }
// }

function onChatError(msg) {
  const sessionId = msg?.sessionId || activeSessionId;
  const errorText = String(msg?.error || 'Something went wrong.');
  const partial = hasStreamingContent() || pendingAssets.length > 0;

  isStreaming = false;
  streamingSessionId = null;
  updateSendBtn(false);

  if (sessionId === activeSessionId) {
    if (partial && streamingBubble) {
      streamingBubble.classList.remove('msg-generating');
      renderStreamingBubble();
      const note = document.createElement('div');
      note.className = 'assistant-error-inline';
      note.innerHTML = `
        <span class="assistant-error-inline-copy">${escHtml(errorText)}</span>
        <button class="assistant-error-inline-retry" type="button">
          ${retryIcon()}
          <span>Retry</span>
        </button>
      `;
      note.querySelector('.assistant-error-inline-retry')?.addEventListener('click', () => retryLastSessionRequest(sessionId));
      streamingBubble.appendChild(note);
    } else {
      sessionErrorStates.set(sessionId, { error: errorText });
      const restoreHistory = streamingStartMeta?.streamKind === 'assistantAction' ? streamingSourceHistory : currentHistory;
      clearStreamingState();
      renderHistory(restoreHistory || []);
      return;
    }
  }

  clearStreamingState();
}

function handleLiveToolCall(call) {
  if (!streamingBubble) return;

  const existingIndex = streamingToolSegmentIndexById.get(call.id);
  if (existingIndex == null) {
    const liveSegment = ensureLiveTextSegment();
    liveSegment.end = streamingText.length;
    const toolIndex = streamingSegments.push({
      type: 'tool_call',
      callId: call.id,
      call: { ...call },
    }) - 1;
    streamingToolSegmentIndexById.set(call.id, toolIndex);
    streamingSegments.push(createGeneratedTextSegment(streamingText.length, null));
    streamingLiveTextSegmentIndex = streamingSegments.length - 1;
  } else {
    const prior = streamingSegments[existingIndex] || {};
    streamingSegments[existingIndex] = {
      ...prior,
      type: 'tool_call',
      callId: call.id,
      call: { ...(prior.call || {}), ...call },
    };
  }

  streamingStatusLabel = streamingToolStatus(call);
  renderStreamingBubble();

  if (autoScroll) {
    const box = document.getElementById('chat-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }
}

// ── Submit ────────────────────────────────────────────────────────────────

export function submitMessage(text, attachments = []) {
  if (!text.trim() && attachments.length === 0) return;
  if (isStreaming && streamingSessionId === activeSessionId) {
    send({ type: 'chat:stop', sessionId: activeSessionId });
    return;
  }
  if (!activeSessionId) return;

  const images   = attachments.filter(a => a.type === 'image');
  const textFiles= attachments.filter(a => a.type === 'text');
  const linkedMediaIds = [...new Set(attachments.map(a => a.mediaId).filter(Boolean))];

  let fullText = text;
  if (textFiles.length > 0) {
    fullText += '\n\n<details><summary>Attached Files</summary>\n';
    for (const f of textFiles)
      fullText += `\n<details><summary>${f.name}</summary>\n\n\`\`\`\n${f.content}\n\`\`\`\n\n</details>\n`;
    fullText += '</details>';
  }

  let content;
  if (images.length > 0) {
    content = [
      { type: 'text', text: fullText },
      ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })),
    ];
  } else {
    content = fullText;
  }

  // Append optimistic user bubble
  const box = document.getElementById('chat-messages');
  if (box) {
    const wrap = makeWrap(-1);
    const bubble = document.createElement('div'); bubble.className = 'msg-user';
    const displayText = textWithBullets(stripFileBlocks(text));
    bubble.innerHTML = renderMarkdown(displayText);
    images.forEach(img => {
      const el = document.createElement('img');
      el.src = `data:${img.mimeType};base64,${img.base64}`;
      el.style.cssText = 'max-width:100%;max-height:200px;border-radius:8px;margin-top:6px;display:block;';
      bubble.appendChild(el);
    });
    if (textFiles.length > 0) {
      const fileRow = document.createElement('div');
      fileRow.className = 'msg-file-attachments';
      textFiles.forEach(f => fileRow.appendChild(buildFileChipView(f.name, f.content, false)));
      bubble.appendChild(fileRow);
    }
    wrap.appendChild(bubble);
    box.appendChild(wrap);
    if (autoScroll) box.scrollTop = box.scrollHeight;
  }

  sendTrackedRequest({
    type: 'chat:send',
    sessionId: activeSessionId,
    content,
    tools: getActiveTools(),
    clientId: localStorage.getItem('ipai_client_id') || '',
    linkedMediaIds,
  });
}

// ── Utils ─────────────────────────────────────────────────────────────────

function getActiveTools() {
  const tools = {};
  const container =
    document.querySelector('#bottom-input-bar:not(.hidden)')?.querySelector('.tool-row') ||
    document.querySelector('.center-input-actions');

  if (!container) {console.warn('Tool container not found'); return tools;};

  container.querySelectorAll('[data-tool]').forEach(btn => {
    const toolName = btn.dataset.tool;
    if (toolName) tools[toolName] = btn.classList.contains('active');
  });

  return tools;
}

function msgText(content) {
  if (typeof content === 'string') return content;
  return content.filter(p => p.type === 'text').map(p => p.text).join('\n');
}
function msgImages(content) {
  if (typeof content === 'string') return [];
  return content.filter(p => p.type === 'image_url').map(p => p.image_url.url);
}

/**
 * Convert bullet characters (•) back to markdown list items for rendering.
 * This ensures the display text renders as proper bullet points via marked.js
 */
function textWithBullets(text) {
  if (!text) return text;
  // Convert '• ' at start of line to '* ' for markdown rendering
  return text.replace(/^(\s*)\u2022\s/gm, '$1* ');
}

function processDisplay(text) {
  let result = '', i = 0;
  while (i < text.length) {
    const start = text.indexOf('```svg', i);
    if (start === -1) { result += text.slice(i); break; }
    result += text.slice(i, start) + '[SVG Image]';
    const end = text.indexOf('```', start + 6);
    if (end === -1) break;
    i = end + 3;
  }
  return result;
}

function updateSendBtn(streaming) {
  const sessionStreaming = streaming && (streamingSessionId === activeSessionId || streaming === true);
  document.querySelectorAll('#bottom-send-btn, #center-send-btn').forEach(btn => {
    btn.innerHTML = sessionStreaming
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21L23 12 2 3v7l15 2-15 2v7z"/></svg>';
    btn.classList.toggle('stop', !!sessionStreaming);
  });
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(
    () => showNotification({ type: 'success', message: 'Copied', duration: 1500 }),
    () => showNotification({ type: 'error',   message: 'Copy failed', duration: 1500 })
  );
}

function dlMedia(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function openImageModal(src) {
  import('./modals.js').then(m => m.openImageModal(src));
}

// Scroll tracking
document.getElementById('chat-view')?.addEventListener('scroll', e => {
  const el = e.target;
  autoScroll = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
}, true);
