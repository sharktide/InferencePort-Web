import { send, on } from './ws.js';
import { showContextMenu } from './ui.js';
import { showShareModal, openConfirmModal } from './modals.js';

function menuDotsIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>`;
}

function shareIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4"/><path d="M15.4 6.5l-6.8 4"/></svg>`;
}

function renameIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;
}

function trashIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`;
}

function warningIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`;
}

export let sessions = [];
export let currentSessionId = null;

let deletedChats = [];
const deletedSelection = new Set();

const sessionListeners = new Set();

export function onSessionChange(fn) {
  sessionListeners.add(fn);
  return () => sessionListeners.delete(fn);
}

function notify(event, data) {
  sessionListeners.forEach((fn) => fn(event, data));
}

function hasSession(id) {
  return !!id && sessions.some((session) => session.id === id);
}

function isChatTrashOverlayOpen() {
  const overlay = document.getElementById('sidebar-trash-overlay');
  const host = document.getElementById('sidebar-sessions');
  return !!overlay && !!host && host.classList.contains('trash-open') && overlay.dataset.context === 'chats';
}

function sortSessionsInPlace() {
  sessions.sort((a, b) => {
    const aTime = a.history?.at(-1)?.timestamp || a.created || 0;
    const bTime = b.history?.at(-1)?.timestamp || b.created || 0;
    return bTime - aTime;
  });
}

function syncSessionList(nextSessions = []) {
  sessions = nextSessions;
  sortSessionsInPlace();
  if (!hasSession(currentSessionId)) {
    currentSessionId = null;
    notify('switched', null);
  }
  renderChatSidebar();
}

on('sessions:list', (msg) => {
  syncSessionList(msg.sessions || []);
});

on('sessions:created', (msg) => {
  const existing = sessions.findIndex((session) => session.id === msg.session.id);
  if (existing === -1) sessions.unshift(msg.session);
  else sessions[existing] = msg.session;
  sortSessionsInPlace();
  renderChatSidebar();
  notify('created', msg.session);
});

on('sessions:deleted', (msg) => {
  sessions = sessions.filter((session) => session.id !== msg.sessionId);
  if (currentSessionId === msg.sessionId) {
    currentSessionId = null;
    notify('switched', null);
  }
  requestDeletedChats();
  renderChatSidebar();
});

on('sessions:deletedAll', () => {
  sessions = [];
  currentSessionId = null;
  requestDeletedChats();
  renderChatSidebar();
  notify('switched', null);
});

on('sessions:renamed', (msg) => {
  const session = sessions.find((entry) => entry.id === msg.sessionId);
  if (session) session.name = msg.name;
  renderChatSidebar();
});

on('sessions:data', (msg) => {
  const existing = sessions.findIndex((session) => session.id === msg.session.id);
  if (existing >= 0) sessions[existing] = msg.session;
  renderChatSidebar();
  notify('data', msg.session);
});

on('auth:ok', (msg) => {
  syncSessionList(msg.sessions || []);
  requestDeletedChats();
});

on('auth:guestOk', (msg) => {
  syncSessionList(msg.sessions || []);
  requestDeletedChats();
});

on('chat:done', (msg) => {
  const session = sessions.find((entry) => entry.id === msg.sessionId);
  if (!session) return;
  session.history = msg.history;
  if (msg.name) session.name = msg.name;
  sortSessionsInPlace();
  renderChatSidebar();
});

on('sessions:imported', (msg) => {
  sessions.unshift(msg.session);
  sortSessionsInPlace();
  renderChatSidebar();
  switchSession(msg.session.id);
});

on('trash:chats:list', (msg) => {
  deletedChats = msg.items || [];
  deletedSelection.clear();
  renderChatTrashOverlay();
});

on('trash:chats:restored', (msg) => {
  const restored = msg.sessions || [];
  restored.forEach((session) => {
    if (!sessions.some((existing) => existing.id === session.id)) sessions.unshift(session);
  });
  sortSessionsInPlace();
  requestDeletedChats();
  renderChatSidebar();
  renderChatTrashOverlay();
});

on('trash:chats:deletedForever', (msg) => {
  const removed = new Set(msg.ids || []);
  deletedChats = deletedChats.filter((chat) => !removed.has(chat.id));
  for (const id of removed) deletedSelection.delete(id);
  renderChatTrashOverlay();
});

on('trash:chats:changed', () => {
  requestDeletedChats();
});

export function showWelcomeScreen() {
  currentSessionId = null;
  renderChatSidebar();
  notify('switched', null);
}

export function createNewSession() {
  send({ type: 'sessions:create' });
}

export function switchSession(id) {
  if (!id) return;
  currentSessionId = id;
  renderChatSidebar();
  send({ type: 'sessions:get', sessionId: id });
  notify('switched', id);
}

export function deleteSession(id) {
  openConfirmModal({
    title: 'Move Chat To Recently Deleted',
    message: 'This chat will stay in Recently Deleted for 30 days unless you remove it permanently.',
    confirmLabel: 'Move to Recently Deleted',
    danger: true,
    onConfirm: () => send({ type: 'sessions:delete', sessionId: id }),
  });
}

export function deleteAllSessions() {
  openConfirmModal({
    title: 'Move All Chats',
    message: 'Move all chats to Recently Deleted? You can restore them for 30 days.',
    confirmLabel: 'Move All Chats',
    danger: true,
    onConfirm: () => send({ type: 'sessions:deleteAll' }),
  });
}

export function renameSession(id, name) {
  send({ type: 'sessions:rename', sessionId: id, name });
  const session = sessions.find((entry) => entry.id === id);
  if (session) session.name = name;
  renderChatSidebar();
}

export function requestSessions() {
  send({ type: 'sessions:list' });
}

export function requestDeletedChats() {
  send({ type: 'trash:chats:list' });
}

export function getCurrentSession() {
  return sessions.find((session) => session.id === currentSessionId) || null;
}

export function openChatTrashView() {
  const overlay = document.getElementById('sidebar-trash-overlay');
  if (!overlay) return;
  overlay.dataset.context = 'chats';
  document.getElementById('sidebar-trash-title').textContent = 'Recently Deleted';
  document.getElementById('sidebar-trash-subtitle').textContent = 'Chats waiting for permanent deletion';
  renderChatTrashOverlay();
  requestDeletedChats();
}

function renderChatSidebar() {
  const list = document.getElementById('session-list');
  if (!list) return;

  if (sessions.length === 0) {
    list.innerHTML = `<div class="sidebar-empty-state">No chats yet</div>`;
    return;
  }

  const groups = groupByDate(sessions);
  list.innerHTML = groups.map(([label, group]) => `
    <div class="session-group">
      <div class="session-date-label">${escHtml(label)}</div>
      ${group.map((session) => `
        <div class="session-item${session.id === currentSessionId ? ' active' : ''}" data-id="${escHtml(session.id)}">
          <span class="session-name" data-id="${escHtml(session.id)}">${escHtml(session.name || 'New Chat')}</span>
          <button class="session-menu-btn" data-id="${escHtml(session.id)}" title="Options">···</button>
        </div>
      `).join('')}
    </div>
  `).join('');

  list.querySelectorAll('.session-item').forEach((el) => {
    el.addEventListener('click', (event) => {
      if (event.target.closest('.session-menu-btn')) return;
      switchSession(el.dataset.id);
    });
    el.addEventListener('contextmenu', (event) => {
      if (event.target.closest('.session-menu-btn')) return;
      event.preventDefault();
      openSessionMenu(event, el.dataset.id);
    });
  });

  list.querySelectorAll('.session-menu-btn').forEach((btn) => {
    btn.setAttribute('aria-label', 'Chat options');
    btn.innerHTML = `<span class="session-menu-dots" aria-hidden="true">${menuDotsIcon()}</span>`;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      openSessionMenu(event, btn.dataset.id);
    });
  });

  list.querySelectorAll('.session-name').forEach((el) => {
    el.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      startInlineRename(el);
    });
  });
}

function renderDeletedChatsInto(list, bar) {
  if (!list || !bar) return;

  if (deletedChats.length === 0) {
    list.innerHTML = `<div class="sidebar-empty-state">No recently deleted chats</div>`;
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  list.innerHTML = deletedChats.map((chat) => `
    <div class="deleted-chat-item" data-id="${escHtml(chat.id)}">
      <label class="deleted-chat-check">
        <input type="checkbox" ${deletedSelection.has(chat.id) ? 'checked' : ''} data-chat-check="${escHtml(chat.id)}" />
        <span class="selection-checkmark" aria-hidden="true"></span>
      </label>
      <div class="deleted-chat-copy">
        <div class="deleted-chat-name">${escHtml(chat.name || 'Deleted Chat')}</div>
        <div class="deleted-chat-meta">Deleted ${new Date(chat.deletedAt).toLocaleString()}</div>
      </div>
      <div class="deleted-chat-actions">
        <button class="deleted-chat-action" data-chat-restore="${escHtml(chat.id)}">Restore</button>
        <button class="deleted-chat-action danger" data-chat-delete="${escHtml(chat.id)}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-chat-check]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) deletedSelection.add(input.dataset.chatCheck);
      else deletedSelection.delete(input.dataset.chatCheck);
      renderDeletedSelectionBar(bar);
    });
  });

  list.querySelectorAll('[data-chat-restore]').forEach((btn) => {
    btn.addEventListener('click', () => {
      send({ type: 'trash:chats:restore', ids: [btn.dataset.chatRestore] });
    });
  });

  list.querySelectorAll('[data-chat-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Delete Chat Permanently',
        message: 'Delete this chat permanently? This cannot be undone.',
        confirmLabel: 'Delete Forever',
        danger: true,
        onConfirm: () => send({ type: 'trash:chats:deleteForever', ids: [btn.dataset.chatDelete] }),
      });
    });
  });

  renderDeletedSelectionBar(bar);
}

function renderDeletedSelectionBar(bar) {
  if (!bar) return;
  if (!deletedSelection.size) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  const ids = [...deletedSelection];
  bar.innerHTML = `
    <span>${ids.length} selected</span>
    <div class="sidebar-selection-actions">
      <button class="sidebar-action-btn" id="deleted-chat-restore-selected">Restore</button>
      <button class="sidebar-action-btn danger" id="deleted-chat-delete-selected">Delete Forever</button>
    </div>
  `;
  bar.classList.remove('hidden');
  bar.querySelector('#deleted-chat-restore-selected')?.addEventListener('click', () => {
    send({ type: 'trash:chats:restore', ids });
  });
  bar.querySelector('#deleted-chat-delete-selected')?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Delete Chats Permanently',
      message: `Delete ${ids.length} selected chat${ids.length === 1 ? '' : 's'} permanently? This cannot be undone.`,
      confirmLabel: 'Delete Forever',
      danger: true,
      onConfirm: () => send({ type: 'trash:chats:deleteForever', ids }),
    });
  });
}

function renderChatTrashOverlay() {
  if (!isChatTrashOverlayOpen()) return;
  renderDeletedChatsInto(
    document.getElementById('sidebar-trash-list'),
    document.getElementById('sidebar-trash-selection-bar')
  );
}

function startInlineRename(el) {
  const id = el.dataset.id;
  const original = el.textContent;
  el.setAttribute('contenteditable', 'true');
  el.focus();
  document.execCommand('selectAll', false, null);

  const finish = () => {
    el.removeAttribute('contenteditable');
    const name = el.textContent.trim();
    if (name && name !== original) renameSession(id, name);
    else el.textContent = original;
  };

  el.addEventListener('blur', finish, { once: true });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = original; el.blur(); }
  });
}

// function openSessionMenu(e, id) {
//   const items = [
//     {
//       label: 'Share', icon: '🔗',
//       onClick: () => showShareModal(id),
//     },
//     {
//       label: 'Rename', icon: '✏️',
//       onClick: () => {
//         const nameEl = document.querySelector(`.session-name[data-id="${id}"]`);
//         if (nameEl) startInlineRename(nameEl);
//       },
//     },
//     { separator: true },
//     {
//       label: 'Move to Recently Deleted', icon: '🗑️', danger: true,
//       onClick: () => deleteSession(id),
//     },
//     {
//       label: 'Delete All Chats', icon: '⚠️', danger: true,
//       onClick: () => deleteAllSessions(),
//     },
//   ];
//   showContextMenu(e.clientX, e.clientY, items, { compact: true });
// }

function openSessionMenu(e, id) {
  const items = [
    {
      label: 'Share',
      icon: shareIcon(),
      onClick: () => showShareModal(id),
    },
    {
      label: 'Rename',
      icon: renameIcon(),
      onClick: () => {
        const nameEl = document.querySelector(`.session-name[data-id="${id}"]`);
        if (nameEl) startInlineRename(nameEl);
      },
    },
    { separator: true },
    {
      label: 'Move to Recently Deleted',
      icon: trashIcon(),
      danger: true,
      onClick: () => deleteSession(id),
    },
    {
      label: 'Delete All Chats',
      icon: warningIcon(),
      danger: true,
      onClick: () => deleteAllSessions(),
    },
  ];
  showContextMenu(e.clientX, e.clientY, items, { compact: true, triggerEl: e.currentTarget || null });
}

function groupByDate(allSessions) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const week = today - 6 * 86400000;

  const groups = new Map([
    ['Today', []],
    ['Yesterday', []],
    ['This Week', []],
    ['Older', []],
  ]);

  for (const session of allSessions) {
    const t = session.history?.at(-1)?.timestamp || session.created || 0;
    if (t >= today) groups.get('Today').push(session);
    else if (t >= yesterday) groups.get('Yesterday').push(session);
    else if (t >= week) groups.get('This Week').push(session);
    else groups.get('Older').push(session);
  }

  return [...groups.entries()].filter(([, group]) => group.length > 0);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
