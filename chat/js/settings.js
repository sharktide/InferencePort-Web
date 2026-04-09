// settings.js — Settings modal
import { send, on, off } from './ws.js';
import { openModal, closeModal, openDeviceSessionModal, openConfirmModal, openTextPromptModal } from './modals.js';
import { isAuthenticated, currentUser, userProfile, userSettings, getClientId } from './auth.js';
import { deleteAllSessions } from './sessions.js';
import { escHtml, showNotification, showContextMenu, sanitizeEditableHtml } from './ui.js';

const THEME_STORAGE_KEY = 'ipai_theme';

let currentTheme = null;

function menuDotsIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>`;
}

export function applyTheme(theme, animate = true) {
  const t = theme === 'light' ? 'light' : 'dark';
  if (t === currentTheme) return;
  currentTheme = t;
  try { localStorage.setItem('ipai_theme', t); } catch {}
  if (animate) {
    document.documentElement.classList.add('theme-transitioning');
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
  }
  document.documentElement.setAttribute('data-theme', t);
  try {
    const bc = new BroadcastChannel('ipai_theme');
    bc.postMessage({ theme: t });
    bc.close();
  } catch {}
}

try {
  const bc = new BroadcastChannel('ipai_theme');
  bc.onmessage = (e) => {
    if (!e.data?.theme) return;
    const t = e.data.theme === 'light' ? 'light' : 'dark';
    if (t !== currentTheme) {
      if (t === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      currentTheme = t;
    }
  };
} catch {}

export function openSettings(tab = 'chat') {
  // Always fetch fresh settings from server before building the modal
  if (isAuthenticated()) {
    let opened = false;
    const openOnce = (resolvedSettings) => {
      if (opened) return;
      opened = true;
      _openSettingsModal(tab, resolvedSettings);
    };
    send({ type: 'settings:get' });
    // Wait for the settings response, then open modal with fresh data
    const handler = (msg) => {
      off('settings:data', handler);
      const freshSettings = msg.settings || userSettings || _defaultSettings();
      clearTimeout(fallbackTimer);
      openOnce(freshSettings);
    };
    on('settings:data', handler);
    // Fallback: if no response in 1.5s, open with cached settings
    const fallbackTimer = setTimeout(() => {
      off('settings:data', handler);
      openOnce(userSettings || _defaultSettings());
    }, 1500);
  } else {
    // Guest: use localStorage cached settings
    const stored = (() => {
      try { return JSON.parse(localStorage.getItem('ipai_settings') || '{}'); } catch { return {}; }
    })();
    _openSettingsModal(tab, { ..._defaultSettings(), ...stored });
  }
}

function _defaultSettings() {
  const storedTheme = (() => { try { return localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; } })();
  return { theme: storedTheme || 'dark', webSearch: true, imageGen: true, videoGen: true, audioGen: true };
}

function _openSettingsModal(activeTab, settings) {
  openModal(buildSettingsHtml(activeTab, settings), {
    wide: true,
    onOpen(b) {
      const cleanups = [];
      setupSettingsTabs(b);
      setupChatSettings(b);
      const usageCleanup = setupUsagePanels(b);
      if (typeof usageCleanup === 'function') cleanups.push(usageCleanup);
      const personalizationCleanup = setupPersonalizationSettings(b);
      if (typeof personalizationCleanup === 'function') cleanups.push(personalizationCleanup);
      const memoryCleanup = setupMemorySettings(b);
      if (typeof memoryCleanup === 'function') cleanups.push(memoryCleanup);
      if (isAuthenticated()) {
        const accountCleanup = setupAccountSettings(b);
        if (typeof accountCleanup === 'function') cleanups.push(accountCleanup);
      }
      return () => cleanups.forEach((cleanup) => cleanup());
    }
  });
}

function buildSettingsHtml(activeTab, settings) {
  const authed = isAuthenticated();
  const currentTheme = (() => { try { return localStorage.getItem(THEME_STORAGE_KEY) || settings.theme || 'dark'; } catch { return settings.theme || 'dark'; } })();

  return `
  <div class="modal-header">
    <span class="modal-title">Settings</span>
    <button class="modal-close" id="settings-close">×</button>
  </div>
  <div class="settings-tabs">
    <button class="settings-tab ${activeTab==='chat'?'active':''}" data-tab="chat">Chat</button>
    <button class="settings-tab ${activeTab==='personalization'?'active':''}" data-tab="personalization">Personalization</button>
    <button class="settings-tab ${activeTab==='memories'?'active':''}" data-tab="memories">Memories</button>
    ${authed ? `<button class="settings-tab ${activeTab==='account'?'active':''}" data-tab="account">Account</button>` : ''}
  </div>

  <!-- Chat Settings -->
  <div class="settings-pane ${activeTab==='chat'?'active':''}" data-pane="chat" style="padding:0 24px 20px;">
    <div class="setting-row">
      <div>
        <div class="setting-label">Theme</div>
        <div class="setting-desc">Light or dark interface</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn-ghost${currentTheme==='light'?' active-theme':''}" data-theme-btn="light" style="font-size:13px;padding:5px 12px;">☀ Light</button>
        <button class="btn-ghost${currentTheme!=='light'?' active-theme':''}" data-theme-btn="dark" style="font-size:13px;padding:5px 12px;">🌙 Dark</button>
      </div>
    </div>

    <div style="margin-top:16px;margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);">Available Tools</div>
    ${buildToolToggle('webSearch',  'Web Search',     'Search the web for current information', settings.webSearch !== false)}
    ${buildToolToggle('imageGen',   'Image Generation','Generate images from prompts', settings.imageGen !== false)}
    ${buildToolToggle('videoGen',   'Video Generation','Generate videos from prompts', settings.videoGen !== false)}
    ${buildToolToggle('audioGen',   'Audio / SFX',    'Generate music and sound effects', settings.audioGen !== false)}
    <div id="tool-usage-panel" class="settings-usage-panel">
      <div class="settings-usage-empty">Loading tool usageâ€¦</div>
    </div>
  </div>

  ${buildPersonalizationPane(activeTab, authed)}

  ${buildMemoriesPane(activeTab)}

  ${authed ? buildAccountPane(activeTab) : ''}

  <div class="modal-footer" style="border-top:1px solid var(--border);padding-top:12px;">
    <button class="btn-ghost" id="settings-cancel">Cancel</button>
    <button class="btn-primary" id="settings-apply">Apply</button>
  </div>
  `;
}

function buildToolToggle(key, label, desc, enabled) {
  return `
  <div class="setting-row">
    <div>
      <div class="setting-label">${escHtml(label)}</div>
      <div class="setting-desc">${escHtml(desc)}</div>
    </div>
    <label class="toggle-switch" data-toggle="${key}">
      <input type="checkbox" ${enabled ? 'checked' : ''} />
      <div class="toggle-track"></div>
      <div class="toggle-thumb"></div>
    </label>
  </div>`;
}

function buildPersonalizationPane(activeTab, authed) {
  if (!authed) {
    return `
    <div class="settings-pane ${activeTab==='personalization'?'active':''}" data-pane="personalization" style="padding:0 24px 20px;">
      <div class="personalization-card personalization-card-locked">
        <div class="setting-label">Personalization</div>
        <div class="setting-desc">Sign in to customize the private system prompt that shapes your chats across devices.</div>
      </div>
    </div>`;
  }

  return `
  <div class="settings-pane ${activeTab==='personalization'?'active':''}" data-pane="personalization" style="padding:0 24px 20px;">
    <div class="personalization-card">
      <div class="personalization-header">
        <div>
          <div class="setting-label">System Prompt</div>
          <div class="setting-desc">Private instructions sent before each chat. Your custom version is stored encrypted for this account.</div>
        </div>
        <span class="personalization-badge">Encrypted</span>
      </div>
      <div id="system-prompt-toolbar" class="personalization-toolbar"></div>
      <div id="system-prompt-editor" class="personalization-editor" contenteditable="true" spellcheck="false"></div>
      <div class="personalization-meta">
        <span id="system-prompt-status">Loading system prompt…</span>
        <span id="system-prompt-updated"></span>
      </div>
      <div class="personalization-actions">
        <button class="btn-ghost" id="system-prompt-reset">Reset to Default</button>
        <button class="btn-primary" id="system-prompt-save">Save Prompt</button>
      </div>
    </div>
  </div>`;
}

function buildMemoriesPane(activeTab) {
  return `
  <div class="settings-pane ${activeTab==='memories'?'active':''}" data-pane="memories" style="padding:0 24px 20px;">
    <div class="form-group memory-create-group" style="margin-top:4px;">
      <label class="form-label">Add Memory</label>
      <div class="memory-create-row">
        <input class="form-input" id="memory-create-input" placeholder="Short memory or note" style="flex:1;" />
        <button class="btn-ghost" id="memory-create-btn" style="font-size:13px;padding:6px 14px;white-space:nowrap;">Save</button>
      </div>
      <div class="form-hint">Memories are shared across chats and should stay short.</div>
    </div>
    <div id="memories-list" class="memories-list">
      <div style="font-size:13px;color:var(--text-muted);">Loading memories…</div>
    </div>
  </div>`;
}

function buildAccountPane(activeTab) {
  const u = currentUser;
  const p = userProfile;
  const email = u?.email || '';
  const username = p?.username || '';

  return `
  <div class="settings-pane ${activeTab==='account'?'active':''}" data-pane="account" style="padding:0 24px 8px;">
    <!-- Username -->
    <div class="form-group" style="margin-top:4px;">
      <label class="form-label">Username</label>
      <div style="display:flex;gap:8px;">
        <input class="form-input" id="username-input" value="${escHtml(username)}" placeholder="Choose a username" style="flex:1;" />
        <button class="btn-ghost" id="username-save" style="font-size:13px;padding:6px 14px;white-space:nowrap;">Save</button>
      </div>
      <div id="username-msg" class="form-hint" style="display:none;"></div>
    </div>

    <!-- Plan info -->
    <div id="plan-section" style="padding:12px;border-radius:var(--radius-md);background:var(--bg-raised);border:1px solid var(--border);margin-bottom:16px;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Current Plan</div>
      <div id="plan-name-display" style="font-weight:600;font-size:15px;">Loading…</div>
      <button class="btn-ghost" id="billing-portal-btn" style="margin-top:8px;font-size:12px;padding:5px 12px;">Manage Billing ↗</button>
    </div>

    <!-- Data management -->
    <div style="margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);">Data</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
      <button class="btn-danger" id="delete-sessions-btn" style="font-size:13px;">Delete All Chats</button>
    </div>

    <!-- Active sessions -->
    <div style="margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);">Devices &amp; Sessions</div>
    <div id="device-sessions-list" style="margin-bottom:10px;">
      <div style="font-size:13px;color:var(--text-muted);">Loading sessions…</div>
    </div>
    <button class="btn-danger" id="revoke-all-btn" style="font-size:13px;margin-bottom:16px;">Log Out All Other Devices</button>

    <!-- Delete account -->
    <div style="border-top:1px solid var(--border);padding-top:14px;">
      <button class="btn-danger" id="delete-account-btn" style="font-size:13px;">Delete Account</button>
    </div>
  </div>`;
}

const TOOL_USAGE_KEYS = ['webSearchDaily', 'imagesDaily', 'videosDaily', 'audioWeekly', 'cloudChatDaily'];
const ACCOUNT_USAGE_KEYS = ['cloudChatDaily', 'webSearchDaily', 'imagesDaily', 'videosDaily', 'audioWeekly'];

function usageMetricLabel(key) {
  const labels = {
    webSearchDaily: 'Web Search',
    imagesDaily: 'Image Gen',
    videosDaily: 'Video Gen',
    audioWeekly: 'Audio / SFX',
    cloudChatDaily: 'Chat Credits',
  };
  return labels[key] || key;
}

function normalizeUsageMetric(metric) {
  const limit = Number(metric?.limit || 0);
  const used = Number(metric?.used || 0);
  const remaining = metric?.remaining ?? Math.max(0, limit - used);
  const percent = limit > 0 ? Math.max(0, Math.min(100, (used / limit) * 100)) : 0;
  return {
    limit,
    used,
    remaining,
    percent,
    window: metric?.window || '',
    period: metric?.period || '',
  };
}

function buildUsageRow(key, metric, { compact = false } = {}) {
  const normalized = normalizeUsageMetric(metric);
  const tone = normalized.percent >= 90 ? 'danger' : normalized.percent >= 70 ? 'warning' : 'normal';
  return `
    <div class="settings-usage-row ${compact ? 'compact' : ''}" data-tone="${tone}">
      <div class="settings-usage-head">
        <span>${escHtml(usageMetricLabel(key))}</span>
        <span>${normalized.used}/${normalized.limit || '∞'}</span>
      </div>
      <div class="settings-usage-track">
        <div class="settings-usage-fill" style="width:${normalized.percent}%"></div>
      </div>
      <div class="settings-usage-meta">${escHtml(`${normalized.remaining} left${normalized.window ? ` • ${normalized.window}` : ''}`)}</div>
    </div>
  `;
}

function renderUsagePanel(container, usageInfo, keys, { compact = false } = {}) {
  if (!container) return;
  const usage = usageInfo?.usage || {};
  const availableKeys = keys.filter((key) => usage[key]);
  if (!availableKeys.length) {
    container.innerHTML = '<div class="settings-usage-empty">Usage data unavailable right now.</div>';
    return;
  }
  container.innerHTML = `
    <div class="settings-usage-list ${compact ? 'compact' : ''}">
      ${availableKeys.map((key) => buildUsageRow(key, usage[key], { compact })).join('')}
    </div>
  `;
}

function ensureUsagePanels(b) {
  if (!b.querySelector('#tool-usage-panel')) {
    const chatPane = b.querySelector('[data-pane="chat"]');
    if (chatPane) {
      const panel = document.createElement('div');
      panel.id = 'tool-usage-panel';
      panel.className = 'settings-usage-panel';
      panel.innerHTML = '<div class="settings-usage-empty">Loading tool usageâ€¦</div>';
      chatPane.appendChild(panel);
    }
  }

  if (!b.querySelector('#account-usage-panel')) {
    const planSection = b.querySelector('#plan-section');
    const billingButton = b.querySelector('#billing-portal-btn');
    if (planSection && billingButton) {
      const panel = document.createElement('div');
      panel.id = 'account-usage-panel';
      panel.className = 'settings-usage-panel compact';
      panel.innerHTML = '<div class="settings-usage-empty">Loading account usageâ€¦</div>';
      planSection.insertBefore(panel, billingButton);
    }
  }
}

function setupUsagePanels(b) {
  ensureUsagePanels(b);
  const render = (usageInfo) => {
    renderUsagePanel(b.querySelector('#tool-usage-panel'), usageInfo, TOOL_USAGE_KEYS);
    renderUsagePanel(b.querySelector('#account-usage-panel'), usageInfo, ACCOUNT_USAGE_KEYS, { compact: true });
  };

  const handler = (msg) => {
    if (!b.isConnected) return;
    render(msg.usage || {});
  };
  const unsubscribe = on('account:usage', handler);
  send({ type: 'account:getUsage', clientId: getClientId() });
  return () => unsubscribe?.();
}

function markdownToRichHtml(markdown) {
  const source = String(markdown || '').trim();
  if (!source) return '<p></p>';
  const parsed = window.marked?.parse(source) || escHtml(source).replace(/\n/g, '<br>');
  return sanitizeEditableHtml(parsed);
}

function normalizeMarkdownBlock(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function richHtmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');

  function serializeChildren(node, context = {}) {
    return [...node.childNodes].map((child) => serializeNode(child, context)).join('');
  }

  function serializeList(listNode, ordered = false, depth = 0) {
    const items = [...listNode.children].filter((child) => child.tagName?.toLowerCase() === 'li');
    let index = 1;
    return items.map((item) => {
      const indent = '  '.repeat(depth);
      const marker = ordered ? `${index++}. ` : '- ';
      const parts = [];
      const nested = [];
      [...item.childNodes].forEach((child) => {
        const tag = child.tagName?.toLowerCase();
        if (tag === 'ul' || tag === 'ol') nested.push(serializeList(child, tag === 'ol', depth + 1));
        else parts.push(serializeNode(child, { depth }));
      });
      const body = normalizeMarkdownBlock(parts.join('')) || 'Item';
      const nestedText = nested.join('').trimEnd();
      return `${indent}${marker}${body}${nestedText ? `\n${nestedText}` : ''}`;
    }).join('\n');
  }

  function serializeNode(node, context = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      return context.inPre ? text : text.replace(/\s+/g, ' ');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'hr') return '---\n\n';
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      const text = normalizeMarkdownBlock(serializeChildren(node, context));
      return text ? `${'#'.repeat(level)} ${text}\n\n` : '';
    }
    if (tag === 'p' || tag === 'div') {
      const text = normalizeMarkdownBlock(serializeChildren(node, context));
      return text ? `${text}\n\n` : '\n';
    }
    if (tag === 'strong' || tag === 'b') {
      return `**${normalizeMarkdownBlock(serializeChildren(node, context))}**`;
    }
    if (tag === 'em' || tag === 'i') {
      return `*${normalizeMarkdownBlock(serializeChildren(node, context))}*`;
    }
    if (tag === 'u') {
      return `<u>${normalizeMarkdownBlock(serializeChildren(node, context))}</u>`;
    }
    if (tag === 'code' && node.parentElement?.tagName?.toLowerCase() !== 'pre') {
      return `\`${(node.textContent || '').trim()}\``;
    }
    if (tag === 'pre') {
      const codeEl = node.querySelector('code');
      const className = codeEl?.className || '';
      const lang = className.match(/language-([a-z0-9_-]+)/i)?.[1] || '';
      const body = (codeEl?.textContent || node.textContent || '').replace(/\n+$/, '');
      return `\`\`\`${lang}\n${body}\n\`\`\`\n\n`;
    }
    if (tag === 'blockquote') {
      const quote = normalizeMarkdownBlock(serializeChildren(node, context));
      return quote
        ? `${quote.split('\n').map((line) => line ? `> ${line}` : '>').join('\n')}\n\n`
        : '';
    }
    if (tag === 'ul' || tag === 'ol') {
      const listText = serializeList(node, tag === 'ol', context.depth || 0);
      return listText ? `${listText}\n\n` : '';
    }
    if (tag === 'a') {
      const text = normalizeMarkdownBlock(serializeChildren(node, context)) || node.getAttribute('href') || '';
      const href = node.getAttribute('href') || '';
      return href ? `[${text}](${href})` : text;
    }
    return serializeChildren(node, context);
  }

  return normalizeMarkdownBlock(serializeChildren(doc.body));
}

function insertInlineCode(editor) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const selectedText = selection.toString().trim() || 'code';
  document.execCommand('insertHTML', false, `<code>${escHtml(selectedText)}</code>`);
  editor.focus();
}

function renderPromptToolbar(toolbar, editor) {
  if (!toolbar || !editor) return;
  const actions = [
    { label: 'Bold', command: 'bold' },
    { label: 'Italic', command: 'italic' },
    { label: 'Heading', command: 'formatBlock', value: 'h2' },
    { label: 'Bullets', command: 'insertUnorderedList' },
    { label: 'Quote', command: 'formatBlock', value: 'blockquote' },
    { label: 'Code', custom: () => insertInlineCode(editor) },
    {
      label: 'Link',
      custom: () => {
        openTextPromptModal({
          title: 'Insert Link',
          label: 'URL',
          placeholder: 'https://example.com',
          confirmLabel: 'Insert',
          onSubmit: (url) => {
            const value = url.trim();
            if (!value) return false;
            editor.focus();
            document.execCommand('createLink', false, value);
            return true;
          },
        });
      },
    },
  ];

  toolbar.innerHTML = '';
  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.className = 'media-editor-tool';
    btn.type = 'button';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      editor.focus();
      if (action.custom) return action.custom();
      document.execCommand(action.command, false, action.value ?? null);
    });
    toolbar.appendChild(btn);
  });
}

function setupPersonalizationSettings(b) {
  const editor = b.querySelector('#system-prompt-editor');
  if (!editor) return null;

  const toolbar = b.querySelector('#system-prompt-toolbar');
  const saveBtn = b.querySelector('#system-prompt-save');
  const resetBtn = b.querySelector('#system-prompt-reset');
  const statusEl = b.querySelector('#system-prompt-status');
  const updatedEl = b.querySelector('#system-prompt-updated');
  const state = {
    savedMarkdown: '',
    currentMarkdown: '',
    isCustom: false,
    loaded: false,
  };
  const unsubs = [];

  function setStatus(message, kind = 'info') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
  }

  function syncDirtyState() {
    if (!state.loaded) return;
    state.currentMarkdown = richHtmlToMarkdown(editor.innerHTML);
    const dirty = state.currentMarkdown !== state.savedMarkdown;
    if (saveBtn) saveBtn.disabled = !dirty;
    if (resetBtn) resetBtn.disabled = !state.isCustom && !dirty;
    if (dirty) {
      setStatus('Unsaved changes', 'warning');
      return;
    }
    setStatus(state.isCustom ? 'Custom prompt active' : 'Using default system prompt', 'success');
  }

  function applyPersonalization(personalization = {}) {
    const source = personalization.resolvedPrompt || personalization.defaultPrompt || '';
    editor.innerHTML = markdownToRichHtml(source);
    state.savedMarkdown = richHtmlToMarkdown(editor.innerHTML);
    state.currentMarkdown = state.savedMarkdown;
    state.isCustom = !!personalization.isCustom;
    state.loaded = true;
    if (updatedEl) {
      updatedEl.textContent = personalization.updatedAt
        ? `Updated ${new Date(personalization.updatedAt).toLocaleString()}`
        : 'Default prompt';
    }
    syncDirtyState();
  }

  renderPromptToolbar(toolbar, editor);
  editor.addEventListener('input', syncDirtyState);

  saveBtn?.addEventListener('click', () => {
    const markdown = richHtmlToMarkdown(editor.innerHTML);
    if (!markdown.trim()) {
      setStatus('System prompt cannot be empty', 'error');
      showNotification({ type: 'error', message: 'System prompt cannot be empty', duration: 2600 });
      return;
    }
    setStatus('Saving…', 'info');
    send({ type: 'personalization:saveSystemPrompt', markdown });
  });

  resetBtn?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Reset System Prompt',
      message: 'Reset your custom system prompt and go back to the default prompt?',
      confirmLabel: 'Reset Prompt',
      onConfirm: () => send({ type: 'personalization:resetSystemPrompt' }),
    });
  });

  unsubs.push(on('personalization:data', (msg) => {
    if (!b.isConnected) return;
    applyPersonalization(msg.personalization || {});
  }));

  unsubs.push(on('personalization:updated', (msg) => {
    if (!b.isConnected) return;
    applyPersonalization(msg.personalization || {});
    showNotification({ type: 'success', message: 'System prompt updated', duration: 2200 });
  }));

  unsubs.push(on('personalization:error', (msg) => {
    if (!b.isConnected) return;
    setStatus(msg.message || 'Unable to update system prompt', 'error');
    showNotification({ type: 'error', message: msg.message || 'Unable to update system prompt', duration: 3200 });
  }));

  send({ type: 'personalization:get' });

  return () => {
    unsubs.forEach((unsubscribe) => unsubscribe?.());
  };
}

function setupSettingsTabs(b) {
  b.querySelector('#settings-close')?.addEventListener('click', closeModal);
  b.querySelector('#settings-cancel')?.addEventListener('click', closeModal);

  b.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      b.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      b.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      b.querySelector(`[data-pane="${tab.dataset.tab}"]`)?.classList.add('active');
    });
  });

  b.querySelector('#settings-apply')?.addEventListener('click', () => applySettings(b));
}

function setupChatSettings(b) {
  b.querySelectorAll('[data-theme-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      b.querySelectorAll('[data-theme-btn]').forEach(t => t.classList.remove('active-theme'));
      btn.classList.add('active-theme');
      applyTheme(btn.dataset.themeBtn);
    });
  });
}

function renderMemoriesList(b, memoryState) {
  const list = b.querySelector('#memories-list');
  if (!list) return;
  const items = memoryState.items || [];
  if (!items.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">No memories saved yet.</div>';
    return;
  }
  list.innerHTML = items.map((memory) => `
    <div class="memory-item${memoryState.editingId === memory.id ? ' editing' : ''}" data-memory-id="${escHtml(memory.id)}">
      ${memoryState.editingId === memory.id ? `
        <input class="memory-edit-input" data-memory-input="${escHtml(memory.id)}" value="${escHtml(memoryState.draft ?? memory.content)}" />
        <div class="memory-inline-actions">
          <button class="btn-ghost memory-cancel-btn" data-memory-cancel="${escHtml(memory.id)}">Cancel</button>
          <button class="btn-primary memory-save-btn" data-memory-save="${escHtml(memory.id)}">Save</button>
        </div>
      ` : `
        <div class="memory-card-copy">
          <div class="memory-text">${escHtml(memory.content)}</div>
          <div class="memory-meta">
            <span>${escHtml(memory.source || 'assistant')}</span>
            <span>${escHtml(new Date(memory.updatedAt).toLocaleString())}</span>
          </div>
        </div>
        <button class="memory-menu-btn" data-memory-menu="${escHtml(memory.id)}" aria-label="Memory options">${menuDotsIcon()}</button>
      `}
    </div>
  `).join('');

  list.querySelectorAll('[data-memory-menu]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = btn.dataset.memoryMenu;
      const memory = items.find((entry) => entry.id === id);
      if (!memory) return;
      const rect = btn.getBoundingClientRect();
      showContextMenu(rect.right - 6, rect.bottom + 6, [
        {
          label: 'Edit',
          onClick: () => {
            memoryState.editingId = id;
            memoryState.draft = memory.content;
            renderMemoriesList(b, memoryState);
          },
        },
        {
          label: 'Delete',
          danger: true,
          onClick: () => {
            openConfirmModal({
              title: 'Delete Memory',
              message: 'Delete this memory?',
              confirmLabel: 'Delete',
              danger: true,
              onConfirm: () => send({ type: 'memories:delete', id }),
            });
          },
        },
      ], { layer: 'modal', triggerEl: event.currentTarget });
    });
  });

  list.querySelectorAll('[data-memory-save]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.memorySave;
      const value = list.querySelector(`[data-memory-input="${id}"]`)?.value.trim() || '';
      if (!value) return;
      send({ type: 'memories:update', id, content: value });
    });
  });

  list.querySelectorAll('[data-memory-input]').forEach((input) => {
    input.addEventListener('input', () => {
      memoryState.draft = input.value;
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        list.querySelector(`[data-memory-save="${input.dataset.memoryInput}"]`)?.click();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        list.querySelector(`[data-memory-cancel="${input.dataset.memoryInput}"]`)?.click();
      }
    });
  });

  list.querySelectorAll('[data-memory-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      memoryState.editingId = null;
      memoryState.draft = '';
      renderMemoriesList(b, memoryState);
    });
  });

  if (memoryState.editingId) {
    queueMicrotask(() => {
      const input = list.querySelector(`[data-memory-input="${memoryState.editingId}"]`);
      input?.focus();
      if (typeof input?.setSelectionRange === 'function') {
        const end = input.value?.length || 0;
        input.setSelectionRange(end, end);
      }
    });
  }
}

function loadMemoriesInto(memoryState) {
  send({ type: 'memories:list' });
  return memoryState;
}

function setupMemorySettings(b) {
  const memoryState = {
    items: [],
    editingId: null,
    draft: '',
  };
  const unsubs = [];
  const reload = () => {
    loadMemoriesInto(memoryState);
  };

  unsubs.push(on('memories:list', (msg) => {
    if (!b.isConnected) return;
    memoryState.items = msg.items || [];
    if (!memoryState.items.some((item) => item.id === memoryState.editingId)) {
      memoryState.editingId = null;
      memoryState.draft = '';
    }
    renderMemoriesList(b, memoryState);
  }));

  reload();
  b.querySelector('#memory-create-btn')?.addEventListener('click', () => {
    const input = b.querySelector('#memory-create-input');
    const value = input?.value.trim();
    if (!value) return;
    send({ type: 'memories:create', content: value, source: 'manual' });
    if (input) input.value = '';
  });
  ['memories:created', 'memories:updated', 'memories:deleted', 'memories:changed'].forEach((type) => {
    unsubs.push(on(type, () => {
      memoryState.editingId = null;
      memoryState.draft = '';
      if (b.isConnected) reload();
    }));
  });
  b.querySelector('#memory-create-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      b.querySelector('#memory-create-btn')?.click();
    }
  });
  return () => {
    unsubs.forEach((unsubscribe) => unsubscribe?.());
  };
}

function setupAccountSettings(b) {
  const unsubs = [];
  const deviceState = {
    sessions: [],
    currentToken: null,
  };

  function renderDeviceSessions() {
    const listEl = b.querySelector('#device-sessions-list');
    if (!listEl) return;
    if (!deviceState.sessions.length) {
      listEl.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">No sessions found.</div>';
      return;
    }
    listEl.innerHTML = deviceState.sessions.map((session) => `
      <div class="device-session-item" data-token="${escHtml(session.token)}">
        <div class="device-badge">&#128187;</div>
        <div class="device-info">
          <div class="device-name">${escHtml(session.userAgent?.slice(0, 56) || 'Unknown device')}</div>
          <div class="device-meta">${escHtml(session.ip || '—')} · Last seen ${escHtml(session.lastSeen ? new Date(session.lastSeen).toLocaleDateString() : '—')}</div>
          ${session.token === deviceState.currentToken ? '<div class="device-current">Current session</div>' : ''}
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.device-session-item').forEach((el) => {
      el.addEventListener('click', () => {
        const token = el.dataset.token;
        const session = deviceState.sessions.find((entry) => entry.token === token);
        if (session) openDeviceSessionModal(session, token === deviceState.currentToken);
      });
    });
  }
  // Username
  b.querySelector('#username-save')?.addEventListener('click', async () => {
    const val = b.querySelector('#username-input')?.value;
    const msgEl = b.querySelector('#username-msg');
    send({ type: 'account:setUsername', username: val });
    const handler = (msg) => {
      off('account:usernameResult', handler);
      msgEl.style.display = '';
      if (msg.success) {
        msgEl.textContent = `Username set to @${msg.username}`;
        msgEl.style.color = 'var(--plan-core)';
      } else {
        msgEl.textContent = msg.error || 'Failed';
        msgEl.style.color = '#f87171';
      }
    };
    on('account:usernameResult', handler);
  });

  // Billing portal
  b.querySelector('#billing-portal-btn')?.addEventListener('click', () => {
    window.open('https://sharktide-lightning.hf.space/portal', '_blank');
  });

  // Delete all sessions
  b.querySelector('#delete-sessions-btn')?.addEventListener('click', () => {
    deleteAllSessions();
    closeModal();
  });

  // Revoke all devices
  b.querySelector('#revoke-all-btn')?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Log Out Other Devices',
      message: 'Log out all other devices right now?',
      confirmLabel: 'Log Out Others',
      danger: true,
      onConfirm: () => send({ type: 'account:revokeAllOthers' }),
    });
  });

  // Delete account
  b.querySelector('#delete-account-btn')?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Delete Account',
      message: 'Delete your account permanently? This cannot be undone.',
      confirmLabel: 'Delete Account',
      danger: true,
      onConfirm: async () => {
        const auth = JSON.parse(localStorage.getItem('ipai_auth_v1') || '{}');
        if (!auth.access_token) return;
        const res = await fetch('https://dpixehhdbtzsbckfektd.supabase.co/functions/v1/delete_account', {
          method: 'POST', headers: { Authorization: `Bearer ${auth.access_token}` },
        });
        if (res.ok) {
          closeModal();
          import('./auth.js').then(a => a.logout());
        } else {
          const d = await res.json().catch(() => ({}));
          showNotification({ type: 'error', message: d.error || 'Delete failed', duration: 4000 });
        }
      },
    });
  });

  // Load subscription + device sessions
  send({ type: 'account:getSubscription' });
  send({ type: 'account:getSessions' });

  const subHandler = (msg) => {
    const planEl = b.querySelector('#plan-name-display');
    if (planEl && msg.info) {
      const pKey = msg.info.planKey || 'free';
      const pName = msg.info.planName || 'Free Tier';
      planEl.innerHTML = `<span style="color:var(--plan-${pKey})">${escHtml(pName)}</span>`;
    }
  };
  unsubs.push(on('account:subscription', subHandler));

  const sessHandler = (msg) => {
    deviceState.sessions = (msg.sessions || []).filter((session) => session.active !== false);
    deviceState.currentToken = msg.currentToken || deviceState.currentToken;
    renderDeviceSessions();
    return;
    const listEl = b.querySelector('#device-sessions-list');
    if (!listEl) return;
    const sessions = msg.sessions || [];
    const currentToken = msg.currentToken;
    if (sessions.length === 0) {
      listEl.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">No sessions found.</div>';
      return;
    }
    listEl.innerHTML = sessions.map(s => `
      <div class="device-session-item" data-token="${escHtml(s.token)}">
        <div class="device-badge">💻</div>
        <div class="device-info">
          <div class="device-name">${escHtml(s.userAgent?.slice(0,50) || 'Unknown device')}</div>
          <div class="device-meta">${escHtml(s.ip || '—')} · Last seen ${escHtml(s.lastSeen ? new Date(s.lastSeen).toLocaleDateString() : '—')}</div>
          ${s.token === currentToken ? '<div class="device-current">Current session</div>' : ''}
        </div>
      </div>`).join('');

    listEl.querySelectorAll('.device-session-item').forEach(el => {
      el.addEventListener('click', () => {
        const token = el.dataset.token;
        const session = sessions.find(s => s.token === token);
        if (session) openDeviceSessionModal(session, token === currentToken);
      });
    });
  };
  unsubs.push(on('account:deviceSessions', sessHandler));
  unsubs.push(on('account:sessionRevoked', (msg) => {
    deviceState.sessions = deviceState.sessions.filter((session) => session.token !== msg.token);
    renderDeviceSessions();
    showNotification({ type: 'success', message: 'Session logged out', duration: 2200 });
  }));
  unsubs.push(on('account:allOthersRevoked', () => {
    deviceState.sessions = deviceState.sessions.filter((session) => session.token === deviceState.currentToken);
    renderDeviceSessions();
    showNotification({ type: 'success', message: 'Other sessions logged out', duration: 2200 });
  }));
  return () => {
    unsubs.forEach((unsubscribe) => unsubscribe?.());
  };
}

function applySettings(b) {
  const theme = b.querySelector('[data-theme-btn].active-theme')?.dataset.themeBtn
    || (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  const tools = {};
  b.querySelectorAll('[data-toggle]').forEach(label => {
    const key = label.dataset.toggle;
    const checked = label.querySelector('input[type="checkbox"]').checked;
    tools[key] = checked;
  });

  const newSettings = { theme, ...tools };
  applyTheme(theme);

  // Sync tool buttons in chat UI
  document.querySelectorAll('[data-tool]').forEach(btn => {
    const t = btn.dataset.tool;
    if (t in tools) {
      btn.classList.toggle('active', !!tools[t]);
      btn.style.display = '';
    }
  });

  // Cache for guests
  if (!isAuthenticated()) {
    try { localStorage.setItem('ipai_settings', JSON.stringify(newSettings)); } catch {}
  }

  if (isAuthenticated()) {
    send({ type: 'settings:save', settings: newSettings });
    const promptEditor = b.querySelector('#system-prompt-editor');
    const promptSaveBtn = b.querySelector('#system-prompt-save');
    const promptDirty = !!promptEditor && !!promptSaveBtn && !promptSaveBtn.disabled;
    if (promptDirty) {
      const markdown = richHtmlToMarkdown(promptEditor.innerHTML);
      if (!markdown.trim()) {
        showNotification({ type: 'error', message: 'System prompt cannot be empty', duration: 2600 });
        return;
      }
      send({ type: 'personalization:saveSystemPrompt', markdown });
    }
  }

  closeModal();
}

(function initThemeEarly() {
  try {
    const stored = localStorage.getItem('ipai_theme');
    if (stored) {
      document.documentElement.setAttribute('data-theme', stored);
      currentTheme = stored;
    }
  } catch {}
})();

// Apply from auth response
on('auth:ok', (msg) => {
  if (msg.settings?.theme) applyTheme(msg.settings.theme, true);
});
on('auth:guestOk', () => {
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem('ipai_settings') || '{}'); } catch { return {}; }
  })();
  applyTheme(stored.theme || localStorage.getItem(THEME_STORAGE_KEY) || 'dark', false);
});
on('settings:updated', (msg) => {
  if (msg.settings?.theme) applyTheme(msg.settings.theme, true);
});
