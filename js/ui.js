// ui.js — notifications, context menus, markdown, shared DOM helpers

// ── Notifications ─────────────────────────────────────────────────────────

export function showNotification({ type = 'info', message, action, duration = 5000 }) {
  const container = document.getElementById('notifications');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `notification ${type}`;

  const text = document.createElement('span');
  text.style.flex = '1';
  text.textContent = message;
  el.appendChild(text);

  if (action) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.style.cssText = 'margin-left:10px;color:var(--yellow);font-size:12px;font-weight:600;white-space:nowrap;';
    btn.addEventListener('click', () => { action.onClick?.(); el.remove(); });
    el.appendChild(btn);
  }

  const close = document.createElement('button');
  close.className = 'notif-close';
  close.textContent = '×';
  close.addEventListener('click', () => el.remove());
  el.appendChild(close);

  container.appendChild(el);
  if (duration > 0) setTimeout(() => el.remove(), duration);
  return el;
}

// ── Context menu ──────────────────────────────────────────────────────────

let activeMenu = null;
let menuDocHandler = null;
let activeMenuTrigger = null;
let activeMenuPoint = null;

export function showContextMenu(x, y, items, options = {}) {
  const menu = options.menuElement
    || document.getElementById(options.menuId || 'session-context-menu');
  if (!menu) return;
  const sameTrigger = !!options.triggerEl && options.triggerEl === activeMenuTrigger;
  const samePoint = !options.triggerEl && activeMenuPoint
    && Math.abs(activeMenuPoint.x - x) < 4
    && Math.abs(activeMenuPoint.y - y) < 4;
  if (activeMenu === menu && (sameTrigger || samePoint)) {
    closeContextMenu();
    return;
  }

  closeContextMenu();
  const hasDescriptions = items.some((item) => !!item?.description);
  menu.innerHTML = '';
  menu.style.zIndex = options.layer === 'modal'
    ? 'calc(var(--z-modal) + 60)'
    : '';
  menu.classList.toggle('context-menu-compact', !!options.compact);
  menu.classList.toggle('context-menu-rich', hasDescriptions);

  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:var(--border);margin:3px 0;';
      menu.appendChild(sep);
      continue;
    }
    const el = document.createElement('div');
    el.className = 'context-item'
      + (item.danger ? ' danger' : '')
      + (item.warning ? ' warning' : '')
      + (item.disabled ? ' disabled' : '')
      + (item.description ? ' has-description' : '');
    if (item.icon) {
      const ic = document.createElement('span');
      ic.className = 'context-item-icon';
      if (typeof item.icon === 'string' && item.icon.trim().startsWith('<svg')) ic.innerHTML = item.icon;
      else ic.textContent = item.icon;
      el.appendChild(ic);
    }
    const copy = document.createElement('div');
    copy.className = 'context-item-copy';

    const label = document.createElement('span');
    label.className = 'context-item-label';
    label.textContent = item.label;
    copy.appendChild(label);

    if (item.description) {
      const description = document.createElement('span');
      description.className = 'context-item-description';
      description.textContent = item.description;
      copy.appendChild(description);
    }

    el.appendChild(copy);
    if (item.disabled) {
      el.setAttribute('aria-disabled', 'true');
    } else {
      el.addEventListener('click', (e) => { e.stopPropagation(); closeContextMenu(); item.onClick?.(); });
    }
    menu.appendChild(el);
  }

  menu.classList.remove('hidden');
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = x, top = y;
  if (left + rect.width > vw - 8)  left = vw - rect.width - 8;
  if (top  + rect.height > vh - 8) top  = y - rect.height;
  if (top < 8) top = 8;
  menu.style.left = `${left}px`;
  menu.style.top  = `${top}px`;

  activeMenu = menu;
  activeMenuTrigger = options.triggerEl || null;
  activeMenuPoint = { x, y };
  queueMicrotask(() => {
    menuDocHandler = (e) => {
      if (!menu.contains(e.target)) closeContextMenu();
    };
    document.addEventListener('click', menuDocHandler);
    document.addEventListener('contextmenu', menuDocHandler);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContextMenu(); }, { once: true });
  });
}

export function showUserMenu(x, y, items) {
  const menu = document.getElementById('user-context-menu');
  menu.innerHTML = '';
  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'context-item' + (item.danger ? ' danger' : '');
    el.textContent = item.label;
    el.addEventListener('click', () => { menu.classList.add('hidden'); item.onClick?.(); });
    menu.appendChild(el);
  }
  menu.classList.remove('hidden');
  const vw = window.innerWidth, vh = window.innerHeight;
  const rect = menu.getBoundingClientRect();
  let left = x, top = y;
  if (left + rect.width > vw - 8) left = vw - rect.width - 8;
  if (top + rect.height > vh - 8) top = y - rect.height;
  menu.style.left = `${left}px`;
  menu.style.top  = `${top}px`;
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) menu.classList.add('hidden');
    }, { once: true });
  }, 0);
}

export function closeContextMenu() {
  activeMenu?.classList.add('hidden');
  activeMenu = null;
  activeMenuTrigger = null;
  activeMenuPoint = null;
  if (menuDocHandler) {
    document.removeEventListener('click', menuDocHandler);
    document.removeEventListener('contextmenu', menuDocHandler);
    menuDocHandler = null;
  }
}

// ── Markdown rendering ────────────────────────────────────────────────────

// Store code snippets by a key so copy button can reference them
const codeStore = new Map();
let codeStoreCounter = 0;
const COLOR_TOKEN_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgb|hsl)a?\([^)]*\)|\b(?:lab|lch|hwb|oklab|oklch)\([^)]*\)/g;

function isCssColorValue(token) {
  if (!token) return false;
  try {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
      ? CSS.supports('color', token)
      : /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(token);
  } catch {
    return false;
  }
}

function renderCodeWithColorSwatches(source) {
  const text = String(source || '');
  let html = '';
  let lastIndex = 0;
  text.replace(COLOR_TOKEN_RE, (match, offset) => {
    html += escHtml(text.slice(lastIndex, offset));
    if (isCssColorValue(match)) {
      html += `<span class="code-color-token">${escHtml(match)}<span class="code-color-swatch" aria-hidden="true"><svg viewBox="0 0 12 12" width="12" height="12" focusable="false"><rect x="1" y="1" width="10" height="10" rx="2.2" ry="2.2" fill="${escAttr(match)}" stroke="rgba(255,255,255,0.28)" stroke-width="1"/></svg></span></span>`;
    } else {
      html += escHtml(match);
    }
    lastIndex = offset + match.length;
    return match;
  });
  html += escHtml(text.slice(lastIndex));
  return html;
}

function buildMarkdownOptions() {
  const renderer = new marked.Renderer();

  renderer.code = (code, lang) => {
    // Store the raw code and generate a unique key for the copy button
    const key = `code-${++codeStoreCounter}`;
    codeStore.set(key, typeof code === 'object' ? (code.text || '') : code);

    const rawCode = typeof code === 'object' ? (code.text || '') : code;
    const rawLang = typeof code === 'object' ? (code.lang || lang || 'code') : (lang || 'code');

    const escapedCode = renderCodeWithColorSwatches(rawCode);
    const displayLang = rawLang || 'code';

    if (rawLang === 'svg') {
      return `<div class="svg-render-block" data-svg="${escAttr(rawCode)}">
        <img src="data:image/svg+xml,${encodeURIComponent(rawCode)}" style="max-width:100%;cursor:pointer;" alt="SVG">
      </div>`;
    }
    return `<div class="code-block">
      <div class="code-header">
        <span class="code-lang">${escHtml(displayLang)}</span>
        <button class="code-copy-btn" data-code-key="${escAttr(key)}">Copy</button>
      </div>
      <pre><code class="language-${escHtml(displayLang)}">${escapedCode}</code></pre>
    </div>`;
  };

  // Override inline code to NOT apply background inside code blocks
  // (the .code-block pre code rule in CSS handles this)
  renderer.codespan = (code) => {
    const raw = typeof code === 'object' ? (code.text || '') : code;
    return `<code class="inline-code">${renderCodeWithColorSwatches(raw)}</code>`;
  };

  renderer.link = (href, title, text) => {
    const hrefStr = typeof href === 'object' ? (href.href || '') : (href || '');
    const titleStr = typeof title === 'string' ? title : '';
    const textStr = typeof text === 'string' ? text : '';
    const safeHref = sanitizeLinkHref(hrefStr);
    return `<a href="${escAttr(safeHref)}" target="_blank" rel="noopener noreferrer" title="${escHtml(titleStr)}">${textStr}</a>`;
  };

  return { renderer, breaks: true, gfm: true };
}

const HTML_SANDBOX_ATTR = 'data-html-sandbox';
let htmlSandboxCounter = 0;
let htmlSandboxMessageBound = false;

function sanitizeLinkHref(href) {
  const value = String(href || '').trim();
  if (!value) return '#';
  if (value.startsWith('#') || value.startsWith('/')) return value;
  try {
    const url = new URL(value, window.location.origin);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return url.href;
  } catch {}
  return '#';
}

function containsDangerousHtmlAttribute(element) {
  return [...(element?.attributes || [])].some((attr) => {
    const name = attr.name.toLowerCase();
    const value = String(attr.value || '').trim().toLowerCase();
    return name.startsWith('on')
      || ((name === 'href' || name === 'src' || name === 'action') && value.startsWith('javascript:'))
      || value.startsWith('data:text/html');
  });
}

function topLevelHtmlNode(node, root) {
  let current = node;
  while (current?.parentElement && current.parentElement !== root) current = current.parentElement;
  return current;
}

function extractSandboxedHtml(rawHtml) {
  const doc = new DOMParser().parseFromString(`<body>${rawHtml || ''}</body>`, 'text/html');
  const riskyTags = doc.body.querySelectorAll('script, style, iframe, form, link[rel="stylesheet"], meta[http-equiv], object, embed');
  const riskyRoots = new Set();

  riskyTags.forEach((node) => riskyRoots.add(topLevelHtmlNode(node, doc.body)));
  doc.body.querySelectorAll('*').forEach((element) => {
    if (containsDangerousHtmlAttribute(element)) riskyRoots.add(topLevelHtmlNode(element, doc.body));
  });

  riskyRoots.forEach((rootNode) => {
    if (!rootNode?.outerHTML) return;
    const placeholder = doc.createElement('div');
    placeholder.className = 'html-sandbox-placeholder';
    placeholder.setAttribute(HTML_SANDBOX_ATTR, encodeURIComponent(rootNode.outerHTML));
    rootNode.replaceWith(placeholder);
  });

  return doc.body.innerHTML;
}

function sandboxWarningMarkup(risk) {
  return `
    <div class="html-sandbox-warning">
      <div class="html-sandbox-warning-title">Scripted HTML blocked</div>
      <div class="html-sandbox-warning-copy">
        ${escHtml(risk.reason || 'This HTML contains script or external behavior and needs approval before it can run.')}
      </div>
      <button class="html-sandbox-warning-btn" type="button">Review and Run</button>
    </div>
  `;
}

function analyzeHtmlRisk(html) {
  const source = String(html || '');
  const riskPatterns = [
    { re: /window\.open\s*\(/i, reason: 'This script attempts to open a new browser window or tab.' },
    { re: /\blocation\.(assign|replace)\s*\(|\blocation\s*=/i, reason: 'This script attempts to navigate to another URL.' },
    { re: /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bnavigator\.sendBeacon\b/i, reason: 'This script attempts to contact another service.' },
    { re: /\bdocument\.cookie\b|\blocalStorage\b|\bsessionStorage\b/i, reason: 'This script attempts to access stored browser data.' },
    { re: /\btop\.|\bparent\.|\bpostMessage\s*\(/i, reason: 'This script attempts to interact outside its preview container.' },
    { re: /<iframe\b|<form\b|javascript:/i, reason: 'This HTML includes external or executable content.' },
  ];

  const match = riskPatterns.find((entry) => entry.re.test(source));
  return {
    dangerous: !!match,
    reason: match?.reason || '',
  };
}

function confirmHtmlExecution(risk) {
  const first = window.confirm(
    `${risk.reason || 'This HTML can execute script behavior.'}\n\nOnly continue if you trust the content and understand that it may be unsafe.`
  );
  if (!first) return false;
  return window.confirm(
    'Final warning: running this content may open URLs, make network requests, or behave unexpectedly. InferencePort AI is not responsible for any damages it may cause.\n\nRun it anyway?'
  );
}

function buildSandboxSrcdoc(html, sandboxId, { relaxed = false } = {}) {
  const csp = relaxed
    ? "default-src 'none'; img-src * data: blob:; media-src * data: blob:; style-src 'unsafe-inline'; font-src * data:; script-src 'unsafe-inline'; connect-src * data: blob:; frame-src * data: blob:; form-action *; base-uri 'none'; object-src 'none';"
    : "default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none';";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${escAttr(csp)}" />
    <style>
      html, body { margin: 0; padding: 0; background: transparent; color: inherit; font: 14px/1.6 system-ui, sans-serif; overflow-wrap: anywhere; }
      body { padding: 12px; }
      img, video, audio, iframe, canvas, svg { max-width: 100%; }
    </style>
  </head>
  <body>
    ${html}
    <script>
      const sendHeight = () => {
        const height = Math.max(
          document.documentElement.scrollHeight || 0,
          document.body?.scrollHeight || 0,
          document.documentElement.offsetHeight || 0,
          document.body?.offsetHeight || 0
        );
        parent.postMessage({ type: 'ipai:html-sandbox:height', id: ${JSON.stringify(sandboxId)}, height }, '*');
      };
      new ResizeObserver(sendHeight).observe(document.body);
      addEventListener('load', () => {
        sendHeight();
        setTimeout(sendHeight, 60);
      });
    </script>
  </body>
</html>`;
}

function bindHtmlSandboxListener() {
  if (htmlSandboxMessageBound) return;
  htmlSandboxMessageBound = true;
  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type !== 'ipai:html-sandbox:height' || !data.id) return;
    const frame = document.querySelector(`iframe[data-html-sandbox-id="${CSS.escape(data.id)}"]`);
    if (!frame) return;
    const height = Math.max(80, Math.min(Number(data.height) || 0, 1200));
    frame.style.height = `${height}px`;
  });
}

function renderHtmlSandboxPlaceholder(node) {
  const html = decodeURIComponent(node.getAttribute(HTML_SANDBOX_ATTR) || '');
  const risk = analyzeHtmlRisk(html);

  if (risk.dangerous && node.dataset.htmlApproved !== '1') {
    node.innerHTML = sandboxWarningMarkup(risk);
    node.querySelector('.html-sandbox-warning-btn')?.addEventListener('click', () => {
      if (!confirmHtmlExecution(risk)) return;
      node.dataset.htmlApproved = '1';
      renderHtmlSandboxPlaceholder(node);
    });
    return;
  }

  bindHtmlSandboxListener();
  const iframe = document.createElement('iframe');
  const sandboxId = `html-sandbox-${++htmlSandboxCounter}`;
  iframe.className = 'html-sandbox-frame';
  iframe.setAttribute('data-html-sandbox-id', sandboxId);
  iframe.setAttribute('sandbox', risk.dangerous ? 'allow-scripts allow-forms allow-popups' : 'allow-scripts');
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.srcdoc = buildSandboxSrcdoc(html, sandboxId, {
    relaxed: risk.dangerous && node.dataset.htmlApproved === '1',
  });
  node.innerHTML = '';
  node.appendChild(iframe);
}

export function hydrateHtmlSandboxPlaceholders(container) {
  container?.querySelectorAll?.(`[${HTML_SANDBOX_ATTR}]`)?.forEach((node) => {
    if (node.dataset.htmlHydrated === '1') return;
    node.dataset.htmlHydrated = '1';
    renderHtmlSandboxPlaceholder(node);
  });
}

export function sanitizeEditableHtml(html) {
  const source = String(html || '').trim();
  if (!source) return '<p></p>';
  return window.DOMPurify?.sanitize(source, {
    ALLOWED_TAGS: [
      'p','br','strong','em','del','u','s','h1','h2','h3','h4','h5','h6',
      'ul','ol','li','blockquote','hr','table','thead','tbody','tr','th','td',
      'pre','code','a','img','span','div','details','summary','button'
    ],
    ALLOWED_ATTR: ['href','src','alt','title','class','data-color','target','rel','style','open','align','type','aria-label','aria-hidden'],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'iframe', 'form', 'object', 'embed', 'meta', 'link'],
  }) || '<p></p>';
}

export function renderMarkdown(text) {
  if (!text) return '';
  try {
    marked.setOptions(buildMarkdownOptions());
    const raw = marked.parse(text);
    const isolated = extractSandboxedHtml(raw);
    const clean = DOMPurify.sanitize(isolated, {
      ALLOWED_TAGS: [
        'p','br','strong','em','del','u','s','h1','h2','h3','h4','h5','h6',
        'ul','ol','li','blockquote','hr','table','thead','tbody','tr','th','td',
        'pre','code','a','img','span','div','details','summary','button','svg','rect',
      ],
      ALLOWED_ATTR: ['href','src','alt','title','class','data-code','data-code-key','data-svg','data-color', HTML_SANDBOX_ATTR,
        'target','rel','style','open','align','type','aria-label','aria-hidden','viewBox','width','height',
        'focusable','x','y','rx','ry','fill','stroke','stroke-width'],
      ALLOW_DATA_ATTR: true,
    });
    return clean.replace(/href="([^"]+)"/g, (_match, href) => `href="${escAttr(sanitizeLinkHref(href))}"`);
  } catch (e) {
    return escHtml(text);
  }
}

export function attachCodeCopyListeners(container) {
  container.querySelectorAll('.code-copy-btn').forEach(btn => {
    // Remove any existing listeners by cloning the button
    const fresh = btn.cloneNode(true);
    btn.parentNode?.replaceChild(fresh, btn);

    fresh.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Try data-code-key first (new approach), then data-code (legacy)
      const key = fresh.getAttribute('data-code-key');
      let code = '';
      if (key && codeStore.has(key)) {
        code = codeStore.get(key);
      } else {
        // Fallback: grab text from the sibling <pre><code>
        const pre = fresh.closest('.code-block')?.querySelector('pre code');
        if (pre) code = pre.textContent || '';
      }

      try {
        await navigator.clipboard.writeText(code);
        fresh.textContent = 'Copied!';
        setTimeout(() => fresh.textContent = 'Copy', 1400);
      } catch {
        // Fallback for environments where clipboard API is unavailable
        try {
          const ta = document.createElement('textarea');
          ta.value = code;
          ta.style.cssText = 'position:fixed;opacity:0;';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          fresh.textContent = 'Copied!';
          setTimeout(() => fresh.textContent = 'Copy', 1400);
        } catch {
          fresh.textContent = 'Error';
          setTimeout(() => fresh.textContent = 'Copy', 1400);
        }
      }
    });
  });
}

export function attachSvgPanelListeners(container) {
  container.querySelectorAll('.svg-render-block img').forEach(img => {
    img.addEventListener('click', () => {
      const svgCode = img.closest('.svg-render-block')?.getAttribute('data-svg') || '';
      openSvgPanel(svgCode);
    });
  });
}

function openSvgPanel(svgCode) {
  let panel = document.getElementById('svg-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'svg-panel';
    panel.innerHTML = `
      <div id="svg-panel-header">
        <span style="font-size:13px;font-weight:600;">SVG Preview</span>
        <div style="display:flex;gap:6px">
          <button id="svg-toggle-btn" style="font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid var(--border-bright);background:var(--bg-hover)">XML</button>
          <button id="svg-close-btn" style="color:var(--text-muted);font-size:18px;padding:0 4px;">×</button>
        </div>
      </div>
      <div id="svg-panel-content"></div>`;
    document.body.appendChild(panel);
  }
  const content = document.getElementById('svg-panel-content');
  const toggleBtn = document.getElementById('svg-toggle-btn');
  const closeBtn  = document.getElementById('svg-close-btn');

  let showingXml = false;
  const renderImg = () => {
    content.innerHTML = `<img src="data:image/svg+xml,${encodeURIComponent(svgCode)}" style="max-width:100%;" alt="SVG">`;
  };
  renderImg();

  toggleBtn.onclick = () => {
    showingXml = !showingXml;
    toggleBtn.textContent = showingXml ? 'Image' : 'XML';
    if (showingXml) {
      content.innerHTML = `<pre style="font-size:12px;white-space:pre-wrap;word-break:break-all;padding:8px;background:var(--bg-raised);border-radius:6px;">${escHtml(svgCode)}</pre>`;
    } else renderImg();
  };
  closeBtn.onclick = () => panel.remove();
}

// ── Textarea auto-resize ───────────────────────────────────────────────────

export function autoResize(textarea, maxLines = 6) {
  const lh = parseFloat(getComputedStyle(textarea).lineHeight) || 22;
  const pad = parseFloat(getComputedStyle(textarea).paddingTop || '0')
            + parseFloat(getComputedStyle(textarea).paddingBottom || '0');
  textarea.style.height = 'auto';
  const max = lh * maxLines + pad;
  textarea.style.height = Math.min(textarea.scrollHeight, max) + 'px';
  textarea.style.overflowY = textarea.scrollHeight > max ? 'auto' : 'hidden';
}

// ── Escape helpers ────────────────────────────────────────────────────────

export function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function escAttr(str) {
  return String(str).replace(/"/g,'&quot;');
}

window.ui = {
  showNotification,
  showContextMenu,
  showUserMenu,
  renderMarkdown,
  hydrateHtmlSandboxPlaceholders,
  sanitizeEditableHtml,
};
