"use client";

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode,
} from "react";
import Icon from "../../Icon";
import shared from "./Playground.module.css";
import s from "./TextChat.module.css";
import type { StudioProps } from "./types";
import { assertOk, fileToDataUrl, jsonHeaders, uid } from "./api";
import { accepts, slug, textModels } from "./models";
import { Advanced, Button, ErrorNote, Field, IconButton, ModelSelect, Range, Segmented, cx } from "./ui";

/* ---------- Types ---------- */

type Role = "user" | "assistant";

interface Stats {
  promptTokens?: number;
  /** Real count from usage, or a rough estimate when the server sent none. */
  completionTokens: number;
  estimated: boolean;
  ms: number;
  tps?: number;
}

interface ChatMsg {
  id: string;
  role: Role;
  content: string;
  /** Data URLs for vision input. Held in memory only, never persisted. */
  images?: string[];
  /** Number of images that were attached; kept after a reload so the message still explains itself. */
  imageCount?: number;
  reasoning?: string;
  stats?: Stats;
  status?: "streaming" | "done" | "stopped";
}

interface Thread {
  id: string;
  title: string;
  updatedAt: number;
  model: string;
  system: string;
  messages: ChatMsg[];
}

interface Cfg {
  model: string;
  system: string;
  temperature: number;
  topP: number;
  maxTokens: number | null;
  stream: boolean;
}

interface Usage {
  promptTokens?: number;
  completionTokens?: number;
}

interface Delta {
  content?: string;
  reasoning?: string;
}

type Block =
  | { t: "p"; text: string }
  | { t: "h"; level: number; text: string }
  | { t: "code"; lang: string; code: string }
  | { t: "quote"; blocks: Block[] }
  | { t: "list"; ordered: boolean; items: string[] }
  | { t: "hr" };

/* ---------- Constants ---------- */

const STORE_KEY = "playground-chats-v1";
const MAX_THREADS = 30;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_TEMPERATURE = 1;
const DEFAULT_TOP_P = 1;
const EMPTY: ChatMsg[] = [];
const STREAM_OPTIONS: { value: "on" | "off"; label: string }[] = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];
const SUGGESTIONS = [
  "Explain how a hash map works, with a small example.",
  "Draft a polite email asking a client for a deadline extension.",
  "Write a Python function that merges two sorted lists.",
];

/* ---------- Pure helpers ---------- */

const byRecent = (a: Thread, b: Thread) => b.updatedAt - a.updatedAt;

function titleOf(text: string, imageCount: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return imageCount ? "Image message" : "New chat";
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
}

function mapThread(ts: Thread[], id: string, fn: (t: Thread) => Thread): Thread[] {
  return ts.map((t) => (t.id === id ? fn(t) : t));
}

function mapMsg(ts: Thread[], threadId: string, msgId: string, fn: (m: ChatMsg) => ChatMsg): Thread[] {
  return mapThread(ts, threadId, (t) => ({ ...t, messages: t.messages.map((m) => (m.id === msgId ? fn(m) : m)) }));
}

function parseMaxTokens(text: string): number | null {
  const n = Math.floor(Number(text));
  return text.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------- Persistence (localStorage, every access guarded) ---------- */

function toMsg(v: unknown): ChatMsg | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Partial<ChatMsg>;
  const role = m.role;
  if (typeof m.id !== "string" || typeof m.content !== "string") return null;
  if (role !== "user" && role !== "assistant") return null;
  return {
    id: m.id,
    role,
    content: m.content,
    reasoning: typeof m.reasoning === "string" ? m.reasoning : undefined,
    imageCount: typeof m.imageCount === "number" ? m.imageCount : undefined,
    stats: m.stats,
    status: m.status === "streaming" ? "stopped" : m.status,
  };
}

function toThread(v: unknown): Thread | null {
  if (!v || typeof v !== "object") return null;
  const t = v as Partial<Thread>;
  if (typeof t.id !== "string" || typeof t.title !== "string" || typeof t.updatedAt !== "number") return null;
  if (!Array.isArray(t.messages)) return null;
  return {
    id: t.id,
    title: t.title,
    updatedAt: t.updatedAt,
    model: typeof t.model === "string" ? t.model : "",
    system: typeof t.system === "string" ? t.system : "",
    messages: t.messages.map(toMsg).filter((m): m is ChatMsg => m !== null),
  };
}

function loadThreads(): Thread[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const list: unknown = (JSON.parse(raw) as { threads?: unknown } | null)?.threads;
    if (!Array.isArray(list)) return [];
    return list.map(toThread).filter((t): t is Thread => t !== null).sort(byRecent).slice(0, MAX_THREADS);
  } catch {
    return [];
  }
}

function saveThreads(threads: Thread[]) {
  try {
    const clean = [...threads]
      .sort(byRecent)
      .filter((t) => t.messages.length > 0)
      .slice(0, MAX_THREADS)
      .map((t) => ({
        ...t,
        // Image data URLs are large and sensitive; persist only how many there were.
        messages: t.messages.map(({ images, ...m }) => ({
          ...m,
          imageCount: images?.length ?? m.imageCount,
          status: m.status === "streaming" ? ("stopped" as const) : m.status,
        })),
      }));
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ threads: clean }));
  } catch {
    /* Storage full or blocked: the conversation still works in memory. */
  }
}

/* ---------- Streaming client ---------- */

function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((p: { text?: unknown }) => (typeof p?.text === "string" ? p.text : "")).join("");
  return "";
}

function usageOf(u: { prompt_tokens?: number; completion_tokens?: number } | undefined): Usage {
  return { promptTokens: u?.prompt_tokens, completionTokens: u?.completion_tokens };
}

function buildPayload(cfg: Cfg, history: ChatMsg[]): Record<string, unknown> {
  const messages: unknown[] = [];
  if (cfg.system.trim()) messages.push({ role: "system", content: cfg.system.trim() });
  for (const m of history) {
    if (m.role === "user" && m.images?.length) {
      const parts: unknown[] = [];
      if (m.content) parts.push({ type: "text", text: m.content });
      for (const url of m.images) parts.push({ type: "image_url", image_url: { url } });
      messages.push({ role: "user", content: parts });
    } else if (m.role === "assistant" && !m.content) {
      continue;
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }
  const body: Record<string, unknown> = { stream: cfg.stream, messages };
  if (cfg.model) body.model = cfg.model;
  if (cfg.temperature !== DEFAULT_TEMPERATURE) body.temperature = cfg.temperature;
  if (cfg.topP !== DEFAULT_TOP_P) body.top_p = cfg.topP;
  if (cfg.maxTokens) body.max_tokens = cfg.maxTokens;
  return body;
}

/** POSTs a chat completion and reports deltas. Handles SSE and plain JSON responses. */
async function requestCompletion(
  url: string,
  session: StudioProps["session"],
  payload: Record<string, unknown>,
  signal: AbortSignal,
  onDelta: (d: Delta) => void,
): Promise<Usage> {
  const r = await fetch(url, { method: "POST", headers: jsonHeaders(session), body: JSON.stringify(payload), signal });
  await assertOk(r);
  const usage: Usage = {};
  const ct = r.headers.get("content-type") ?? "";

  if (!ct.includes("text/event-stream")) {
    const d = await r.json().catch(() => ({}));
    const msg = d?.choices?.[0]?.message ?? {};
    const content = textOf(msg.content);
    const reasoning = msg.reasoning_content ?? msg.reasoning;
    if (content) onDelta({ content });
    if (typeof reasoning === "string" && reasoning) onDelta({ reasoning });
    return usageOf(d?.usage);
  }

  if (!r.body) throw new Error("The server returned an empty response.");
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  /** Returns true when the stream signals completion. */
  const handle = (raw: string): boolean => {
    const line = raw.trim();
    if (!line.startsWith("data:")) return false;
    const data = line.slice(5).trim();
    if (!data) return false;
    if (data === "[DONE]") return true;
    let j: any;
    try {
      j = JSON.parse(data);
    } catch {
      return false;
    }
    if (j?.error) throw new Error(typeof j.error === "string" ? j.error : j.error?.message || "The stream failed.");
    const delta = j?.choices?.[0]?.delta ?? {};
    const content = textOf(delta.content);
    if (content) onDelta({ content });
    const reasoning = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoning === "string" && reasoning) onDelta({ reasoning });
    if (j?.usage) Object.assign(usage, usageOf(j.usage));
    return false;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (handle(line)) {
        await reader.cancel().catch(() => undefined);
        return usage;
      }
    }
  }
  buffer += decoder.decode();
  for (const line of buffer.split("\n")) if (handle(line)) break;
  return usage;
}

/* ---------- Markdown (hand-written, builds React nodes only) ---------- */

const RE_FENCE = /^\s{0,3}(`{3,})\s*([^`\s]*)[^`]*$/;
const RE_CLOSE = /^\s{0,3}`{3,}\s*$/;
const RE_HEAD = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const RE_HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const RE_QUOTE = /^\s{0,3}>\s?(.*)$/;
const RE_UL = /^\s{0,3}[-*+]\s+(.*)$/;
const RE_OL = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;

function startsBlock(line: string): boolean {
  return RE_FENCE.test(line) || RE_HEAD.test(line) || RE_HR.test(line) || RE_QUOTE.test(line) || RE_UL.test(line) || RE_OL.test(line);
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = RE_FENCE.exec(line);
    if (fence) {
      // An unterminated fence (common while streaming) runs to the end of the input.
      const body: string[] = [];
      i++;
      while (i < lines.length && !RE_CLOSE.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++;
      out.push({ t: "code", lang: fence[2], code: body.join("\n") });
      continue;
    }
    const head = RE_HEAD.exec(line);
    if (head) {
      out.push({ t: "h", level: head[1].length, text: head[2] });
      i++;
      continue;
    }
    if (RE_HR.test(line)) {
      out.push({ t: "hr" });
      i++;
      continue;
    }
    if (RE_QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length) {
        const m = RE_QUOTE.exec(lines[i]);
        if (!m) break;
        inner.push(m[1]);
        i++;
      }
      out.push({ t: "quote", blocks: parseBlocks(inner.join("\n")) });
      continue;
    }
    if (RE_UL.test(line) || RE_OL.test(line)) {
      const ordered = RE_OL.test(line);
      const re = ordered ? RE_OL : RE_UL;
      const items: string[] = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      out.push({ t: "list", ordered, items });
      continue;
    }
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push({ t: "p", text: para.join("\n") });
  }
  return out;
}

const INLINE_SRC =
  "`([^`\\n]+)`" +
  "|\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)" +
  "|\\*\\*(?!\\s)([^*\\n]+?)\\*\\*" +
  "|__(?!\\s)([^_\\n]+?)__" +
  "|\\*(?![\\s*])([^*\\n]+?)\\*" +
  "|(?<![A-Za-z0-9])_(?!\\s)([^_\\n]+?)_(?![A-Za-z0-9])";

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = new RegExp(INLINE_SRC, "g");
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) {
      out.push(<code key={k} className={s.inlineCode}>{m[1]}</code>);
    } else if (m[2] !== undefined) {
      out.push(
        <a key={k} href={m[3]} target="_blank" rel="noopener noreferrer" className={s.link}>
          {inline(m[2], k)}
        </a>,
      );
    } else if (m[4] !== undefined || m[5] !== undefined) {
      out.push(<strong key={k}>{inline(m[4] ?? m[5], k)}</strong>);
    } else {
      out.push(<em key={k}>{inline(m[6] ?? m[7], k)}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderLines(text: string, key: string): ReactNode[] {
  return text.split("\n").flatMap((ln, j) =>
    j === 0 ? inline(ln, `${key}-0`) : [<br key={`${key}-br${j}`} />, ...inline(ln, `${key}-${j}`)],
  );
}

function renderBlocks(blocks: Block[], key: string): ReactNode[] {
  return blocks.map((b, i) => {
    const k = `${key}-${i}`;
    switch (b.t) {
      case "p":
        return <p key={k}>{renderLines(b.text, k)}</p>;
      case "h": {
        const Tag = b.level <= 2 ? "h3" : b.level === 3 ? "h4" : "h5";
        return <Tag key={k}>{inline(b.text, k)}</Tag>;
      }
      case "code":
        return <CodeBlock key={k} lang={b.lang} code={b.code} />;
      case "quote":
        return <blockquote key={k}>{renderBlocks(b.blocks, k)}</blockquote>;
      case "list": {
        const items = b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>);
        return b.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>;
      }
      case "hr":
        return <hr key={k} />;
      default:
        return null;
    }
  });
}

function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return <>{renderBlocks(blocks, "md")}</>;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={s.codeWrap}>
      <div className={s.codeHead}>
        <span className={s.codeLang}>{lang || "text"}</span>
        <button
          type="button"
          className={s.codeCopy}
          aria-label="Copy code"
          onClick={async () => {
            if (await copyText(code)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={s.pre}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ---------- Small pieces ---------- */

function Thinking({ text, live }: { text: string; live: boolean }) {
  return (
    <details className={s.thinking} open={live || undefined}>
      <summary>
        {live ? "Thinking…" : "Thinking"}
        <span className={s.hint}>{text.length.toLocaleString()} chars</span>
      </summary>
      <div className={s.thinkBody}>{text}</div>
    </details>
  );
}

function StatsLine({ stats }: { stats: Stats }) {
  const parts: string[] = [];
  if (stats.promptTokens !== undefined) parts.push(`${stats.promptTokens} in`);
  parts.push(`${stats.completionTokens} out${stats.estimated ? " (est.)" : ""}`);
  parts.push(`${(stats.ms / 1000).toFixed(1)}s`);
  if (stats.tps) parts.push(`${stats.tps.toFixed(stats.tps < 10 ? 1 : 0)} tok/s`);
  return <div className={s.stats}>{parts.join(" · ")}</div>;
}

/* ---------- Component ---------- */

export default function TextChat({ session, apiBase, apiPrefix, models }: StudioProps) {
  const list = useMemo(() => textModels(models), [models]);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [modelPick, setModelPick] = useState("");
  const [system, setSystem] = useState("");
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [topP, setTopP] = useState(DEFAULT_TOP_P);
  const [maxTokensText, setMaxTokensText] = useState("");
  const [stream, setStream] = useState<"on" | "off">("on");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinned, setPinned] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pinnedRef = useRef(true);

  /* Model: fall back to the first text model when nothing valid is picked. */
  const effModel = list.some((m) => slug(m) === modelPick) ? modelPick : (list[0] ? slug(list[0]) : "") || "";
  const selected = list.find((m) => slug(m) === effModel);
  const canAttach = !!selected && accepts(selected, "image");

  const sorted = useMemo(() => [...threads].sort(byRecent), [threads]);
  const active = threads.find((t) => t.id === activeId) ?? null;
  const messages = active?.messages ?? EMPTY;
  let lastAssistantIdx = -1;
  for (let k = messages.length - 1; k >= 0; k--) {
    if (messages[k].role === "assistant") {
      lastAssistantIdx = k;
      break;
    }
  }
  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";
  const canSend = !busy && (input.trim().length > 0 || images.length > 0);
  const maxTokens = parseMaxTokens(maxTokensText);
  const cfg: Cfg = { model: effModel, system, temperature, topP, maxTokens, stream: stream === "on" };

  /* Load saved threads once on mount, then persist when idle. */
  useEffect(() => {
    setThreads(loadThreads());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !busy) saveThreads(threads);
  }, [threads, busy, loaded]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /* Keep the view pinned to the bottom while streaming, unless the user scrolled up. */
  useEffect(() => {
    const el = bodyRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* Composer grows with its content up to a limit. */
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  const onScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    pinnedRef.current = near;
    setPinned(near);
  };

  const jumpToLatest = () => {
    const el = bodyRef.current;
    pinnedRef.current = true;
    setPinned(true);
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  /* Runs one completion for a thread. `history` must end with the user turn. */
  const run = useCallback(
    async (threadId: string, history: ChatMsg[], conf: Cfg) => {
      const aid = uid();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setBusy(true);
      setError(null);
      setThreads((ts) =>
        mapThread(ts, threadId, (t) => ({
          ...t,
          model: conf.model,
          system: conf.system,
          updatedAt: Date.now(),
          messages: [...history, { id: aid, role: "assistant", content: "", status: "streaming" }],
        })),
      );

      let text = "";
      let think = "";
      let timer: ReturnType<typeof setTimeout> | undefined;
      /* Batch token updates so long replies don't re-render on every chunk. */
      const paint = () => {
        timer = undefined;
        const t = text;
        const r = think;
        setThreads((ts) => mapMsg(ts, threadId, aid, (m) => ({ ...m, content: t, reasoning: r || undefined })));
      };

      const started = performance.now();
      try {
        const usage = await requestCompletion(
          `${apiBase}${apiPrefix}/chat/completions`,
          session,
          buildPayload(conf, history),
          ctrl.signal,
          (d) => {
            if (d.content) text += d.content;
            if (d.reasoning) think += d.reasoning;
            if (timer === undefined) timer = setTimeout(paint, 40);
          },
        );
        if (timer !== undefined) clearTimeout(timer);
        const ms = performance.now() - started;
        const completionTokens = usage.completionTokens ?? Math.ceil(text.length / 4);
        const stats: Stats = {
          promptTokens: usage.promptTokens,
          completionTokens,
          estimated: usage.completionTokens === undefined,
          ms,
          tps: ms > 0 && completionTokens > 0 ? completionTokens / (ms / 1000) : undefined,
        };
        setThreads((ts) =>
          mapMsg(ts, threadId, aid, (m) => ({ ...m, content: text, reasoning: think || undefined, status: "done", stats })),
        );
      } catch (e) {
        if (timer !== undefined) clearTimeout(timer);
        if (ctrl.signal.aborted) {
          const t = text;
          const r = think;
          setThreads((ts) =>
            mapThread(ts, threadId, (th) => ({
              ...th,
              messages: th.messages.flatMap((m): ChatMsg[] => {
                if (m.id !== aid) return [m];
                if (!t && !r) return [];
                return [{ ...m, content: t, reasoning: r || undefined, status: "stopped" }];
              }),
            })),
          );
        } else {
          // Drop the empty placeholder; the user turn stays so it can be retried.
          setThreads((ts) => mapThread(ts, threadId, (th) => ({ ...th, messages: th.messages.filter((m) => m.id !== aid) })));
          setError(e instanceof Error ? e.message : "The request failed.");
        }
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
        setBusy(false);
      }
    },
    [apiBase, apiPrefix, session],
  );

  const send = (text: string, imgs: string[]): boolean => {
    if (busy || (!text.trim() && imgs.length === 0)) return false;
    if (imgs.length && !canAttach) {
      setError("This model cannot read images. Remove them or choose a vision model.");
      return false;
    }
    const user: ChatMsg = { id: uid(), role: "user", content: text.trim(), images: imgs.length ? imgs : undefined };
    pinnedRef.current = true;
    setPinned(true);
    setEditing(null);
    if (active) {
      void run(active.id, [...messages, user], cfg);
    } else {
      const id = uid();
      const t: Thread = { id, title: titleOf(text, imgs.length), updatedAt: Date.now(), model: cfg.model, system: cfg.system, messages: [] };
      setThreads((ts) => [t, ...ts].sort(byRecent).slice(0, MAX_THREADS));
      setActiveId(id);
      void run(id, [user], cfg);
    }
    return true;
  };

  const submit = () => {
    if (send(input, images)) {
      setInput("");
      setImages([]);
    }
  };

  const stop = () => abortRef.current?.abort();

  const retry = () => {
    if (!active || busy || !lastIsUser) return;
    void run(active.id, messages, cfg);
  };

  const regenerate = (i: number) => {
    if (!active || busy || i <= 0) return;
    void run(active.id, messages.slice(0, i), cfg);
  };

  const saveEdit = (i: number) => {
    if (!editing || !active || busy) return;
    const original = messages[i];
    const text = editing.text.trim();
    if (!original || (!text && !original.images?.length)) return;
    setEditing(null);
    void run(active.id, [...messages.slice(0, i), { ...original, content: text, reasoning: undefined, stats: undefined, status: undefined }], cfg);
  };

  const removeMsg = (id: string) => {
    if (!active || busy) return;
    setThreads((ts) => mapThread(ts, active.id, (t) => ({ ...t, messages: t.messages.filter((m) => m.id !== id) })));
  };

  const copyMsg = async (m: ChatMsg) => {
    if (await copyText(m.content)) {
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500);
    }
  };

  const selectThread = (t: Thread) => {
    if (busy) return;
    setActiveId(t.id);
    setModelPick(t.model);
    setSystem(t.system);
    setEditing(null);
    setError(null);
    pinnedRef.current = true;
    setPinned(true);
  };

  const newChat = () => {
    if (busy) return;
    setActiveId(null);
    setEditing(null);
    setError(null);
  };

  const deleteThread = (id: string) => {
    if (busy) return;
    setThreads((ts) => ts.filter((t) => t.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setEditing(null);
    }
  };

  const addFiles = async (files: File[]) => {
    const pics = files.filter((f) => f.type.startsWith("image/"));
    if (!pics.length) return;
    if (!canAttach) {
      setError("The selected model cannot read images. Choose a vision model to attach images.");
      return;
    }
    const room = MAX_IMAGES - images.length;
    if (room <= 0 || pics.length > room) {
      setError(`Up to ${MAX_IMAGES} images per message.`);
      return;
    }
    const big = pics.find((f) => f.size > MAX_IMAGE_BYTES);
    if (big) {
      setError(`"${big.name}" is larger than 10 MB.`);
      return;
    }
    try {
      const urls = await Promise.all(pics.map((f) => fileToDataUrl(f)));
      setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.");
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.items)
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length && canAttach) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (canAttach && e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDragOver(true);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    void addFiles(Array.from(e.dataTransfer.files));
  };

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) submit();
    }
  };

  const onEditKey = (e: KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    if (e.key === "Escape") setEditing(null);
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveEdit(i);
    }
  };

  const renderMessage = (m: ChatMsg, i: number) => {
    const isUser = m.role === "user";
    const streaming = m.status === "streaming";
    const isLastAssistant = !isUser && i === lastAssistantIdx;

    if (isUser && editing?.id === m.id) {
      return (
        <article key={m.id} className={cx(s.msg, s.userMsg)} aria-label="Editing your message">
          <textarea
            className={cx(shared.textarea, s.editArea)}
            value={editing.text}
            autoFocus
            aria-label="Edit message"
            onChange={(e) => {
              const text = e.target.value;
              setEditing((ed) => (ed ? { ...ed, text } : ed));
            }}
            onKeyDown={(e) => onEditKey(e, i)}
          />
          <div className={s.editActions}>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => saveEdit(i)} disabled={!editing.text.trim() && !m.images?.length}>Save and resend</Button>
          </div>
        </article>
      );
    }

    return (
      <article key={m.id} className={cx(s.msg, isUser ? s.userMsg : s.botMsg)} aria-label={isUser ? "You" : "Assistant"}>
        {m.images?.length ? (
          <div className={s.msgImages}>
            {m.images.map((src, k) => (
              <img key={k} src={src} alt={`Attached image ${k + 1}`} className={s.msgImg} />
            ))}
          </div>
        ) : m.imageCount ? (
          <div className={s.hint}>{m.imageCount} image{m.imageCount > 1 ? "s" : ""} (not saved with this chat)</div>
        ) : null}

        {!isUser && m.reasoning && <Thinking text={m.reasoning} live={streaming} />}

        {isUser ? (
          m.content && <div className={s.plain}>{m.content}</div>
        ) : (
          <div className={s.md} aria-live={streaming ? "polite" : undefined} aria-busy={streaming || undefined}>
            {m.content ? <Markdown text={m.content} /> : streaming ? (
              <span className={s.typing} role="status" aria-label="Waiting for response"><i /><i /><i /></span>
            ) : null}
            {streaming && m.content && <span className={s.caret} aria-hidden="true" />}
          </div>
        )}

        {m.stats && <StatsLine stats={m.stats} />}
        {m.status === "stopped" && <div className={s.hint}>Stopped</div>}

        <div className={cx(s.actions, isUser && s.actionsEnd)}>
          <IconButton
            icon={copiedId === m.id ? "check" : "copy"}
            label="Copy message"
            onClick={() => void copyMsg(m)}
            disabled={!m.content}
          />
          {isUser && <IconButton icon="pencil" label="Edit and resend" onClick={() => setEditing({ id: m.id, text: m.content })} disabled={busy} />}
          {isLastAssistant && <IconButton icon="arrow-clockwise" label="Regenerate response" onClick={() => regenerate(i)} disabled={busy} />}
          <IconButton icon="trash" label="Delete message" onClick={() => removeMsg(m.id)} disabled={busy || streaming} />
        </div>
      </article>
    );
  };

  return (
    <div className={shared.studio}>
      {/* Controls rail */}
      <aside className={shared.controls} aria-label="Chat settings">
        <ModelSelect
          models={list}
          value={effModel}
          onChange={setModelPick}
          placeholder="No text models available"
        />

        <Button variant="ghost" icon="plus" className={s.newChat} onClick={newChat} disabled={busy || !activeId}>
          New chat
        </Button>

        <Advanced>
          <div className={s.advStack}>
            <div className={s.history}>
              <span className={shared.label}>History</span>
              <div className={s.threadList} role="list">
                {sorted.map((t) => (
                  <div key={t.id} role="listitem" className={cx(s.threadRow, t.id === activeId && s.threadActive)}>
                    <button
                      type="button"
                      className={s.threadBtn}
                      onClick={() => selectThread(t)}
                      disabled={busy}
                      aria-current={t.id === activeId ? "true" : undefined}
                    >
                      <span className={s.threadTitle}>{t.title}</span>
                      <span className={s.threadMeta}>{new Date(t.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </button>
                    <IconButton icon="trash" label={`Delete conversation: ${t.title}`} onClick={() => deleteThread(t.id)} disabled={busy} />
                  </div>
                ))}
              </div>
              {sorted.length === 0 && <p className={s.quietHint}>Saved in this browser.</p>}
            </div>

            <Field label="System prompt">
              <textarea
                className={cx(shared.textarea, s.sys)}
                rows={3}
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                placeholder="Sets the assistant's role or tone."
                aria-label="System prompt"
              />
            </Field>

            <Range label="Temperature" value={temperature} min={0} max={2} step={0.05} onChange={setTemperature} format={(v) => v.toFixed(2)} />
            <Range label="Top P" value={topP} min={0} max={1} step={0.01} onChange={setTopP} format={(v) => v.toFixed(2)} />

            <Field label="Max tokens">
              <input
                className={shared.input}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="Model default"
                value={maxTokensText}
                onChange={(e) => setMaxTokensText(e.target.value)}
                aria-label="Max tokens"
              />
            </Field>

            <Field label="Streaming">
              <Segmented value={stream} onChange={setStream} options={STREAM_OPTIONS} />
            </Field>
          </div>
        </Advanced>
      </aside>

      {/* Chat stage */}
      <section className={shared.stage} aria-label="Text chat">
        <div className={s.card}>
          {active && (
            <header className={s.cardHead}>
              <span className={s.title}>{active.title}</span>
              <IconButton icon="trash" label="Delete conversation" onClick={() => deleteThread(active.id)} disabled={busy} />
            </header>
          )}

          <div className={s.body} ref={bodyRef} onScroll={onScroll}>
            {messages.length === 0 ? (
              <div className={s.empty}>
                <h2 className={s.emptyTitle}>How can I help?</h2>
                <div className={s.suggest}>
                  {SUGGESTIONS.map((p) => (
                    <button key={p} type="button" className={s.suggestBtn} disabled={busy} onClick={() => void send(p, [])}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className={s.msgs}>{messages.map(renderMessage)}</div>
            )}
          </div>

          <div
            className={cx(s.composer, dragOver && s.composerDrag)}
            onDragOver={onDragOver}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {!pinned && messages.length > 0 && (
              <button type="button" className={s.jump} onClick={jumpToLatest}>
                <Icon name="arrow-up" className={s.flip} /> Jump to latest
              </button>
            )}

            {error && (
              <div className={s.errorRow}>
                <ErrorNote onDismiss={() => setError(null)}>{error}</ErrorNote>
                {active && lastIsUser && !busy && (
                  <Button variant="ghost" icon="arrow-clockwise" onClick={retry}>Retry</Button>
                )}
              </div>
            )}

            {images.length > 0 && (
              <div className={s.thumbs}>
                {images.map((src, k) => (
                  <div key={k} className={s.thumb}>
                    <img src={src} alt={`Attachment ${k + 1}`} />
                    <button
                      type="button"
                      className={s.thumbX}
                      aria-label={`Remove image ${k + 1}`}
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== k))}
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className={s.inputRow}>
              {canAttach && (
                <IconButton
                  icon="image"
                  label="Attach image"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy || images.length >= MAX_IMAGES}
                />
              )}
              <textarea
                ref={taRef}
                rows={1}
                className={s.textarea}
                value={input}
                placeholder="Message…"
                aria-label="Message"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onComposerKey}
                onPaste={onPaste}
              />
              {busy ? (
                <button type="button" className={cx(s.sendBtn, s.stopBtn)} onClick={stop} aria-label="Stop generating" title="Stop generating">
                  <Icon name="stop" />
                </button>
              ) : (
                <button type="button" className={s.sendBtn} onClick={submit} disabled={!canSend} aria-label="Send message" title="Send message">
                  <Icon name="arrow-up" />
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
