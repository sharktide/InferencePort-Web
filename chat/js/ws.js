// ws.js - WebSocket connection manager
const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY = 30000;

let ws = null;
let reconnectDelay = RECONNECT_DELAY_MS;
let reconnectTimer = null;
let pendingCallbacks = new Map(); // id -> { resolve, reject, timeout }
let msgId = 0;
const listeners = new Map(); // type -> Set<fn>

export function send(data) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

export function request(data, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = `req_${++msgId}`;
    const full = { ...data, _reqId: id };
    const timer = setTimeout(() => {
      pendingCallbacks.delete(id);
      reject(new Error('Request timeout'));
    }, timeoutMs);
    pendingCallbacks.set(id, { resolve, reject, timer });
    if (!send(full)) {
      clearTimeout(timer);
      pendingCallbacks.delete(id);
      reject(new Error('WebSocket not connected'));
    }
  });
}

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => listeners.get(type)?.delete(fn);
}

export function off(type, fn) {
  listeners.get(type)?.delete(fn);
}

function emit(type, data) {
  listeners.get(type)?.forEach(fn => fn(data));
  listeners.get('*')?.forEach(fn => fn({ type, ...data }));
}



function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
    connectWithPing();
  }, reconnectDelay);
}

export function getReadyState() {
  return ws?.readyState ?? WebSocket.CLOSED;
}

export function isConnected() {
  return ws?.readyState === WebSocket.OPEN;
}

// ── Ping keepalive ────────────────────────────────────────────────────────
// Prevents the WebSocket from being closed by proxies/servers during long
// operations like image/video generation (which can take 30-60+ seconds).
let pingInterval = null;

function startPing() {
  stopPing();
  pingInterval = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
    }
  }, 20000); // every 20 seconds
}

function stopPing() {
  if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
}

// Patch connect to start/stop ping
function connectWithPing() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    reconnectDelay = RECONNECT_DELAY_MS;
    startPing();
    emit('ws:connected', {});
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (!msg?.type) return;
    // Silently swallow pong responses
    if (msg.type === 'pong') return;

    if (msg._reqId && pendingCallbacks.has(msg._reqId)) {
      const cb = pendingCallbacks.get(msg._reqId);
      pendingCallbacks.delete(msg._reqId);
      clearTimeout(cb.timer);
      if (msg.error) cb.reject(new Error(msg.error));
      else cb.resolve(msg);
      return;
    }

    emit(msg.type, msg);
  };

  ws.onclose = () => {
    stopPing();
    emit('ws:disconnected', {});
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

// Boot
connectWithPing();
window.ws = { send, request, on, off, isConnected, getReadyState };
