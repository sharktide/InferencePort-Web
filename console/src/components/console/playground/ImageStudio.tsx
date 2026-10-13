"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Icon from "../../Icon";
import shared from "./Playground.module.css";
import styles from "./ImageStudio.module.css";
import { Advanced, Button, Dropzone, ErrorNote, Field, IconButton, ModelSelect, Range, Segmented, StatusLine, cx } from "./ui";
import { accepts, displayName, imageModels, slug } from "./models";
import { apiJson, assertOk, b64ToBlobUrl, bearer, downloadHref, jsonHeaders, uid } from "./api";
import type { StudioProps } from "./types";

type Mode = "generate" | "edit";
type Tool = "brush" | "eraser";

type Item = {
  id: string;
  kind: Mode;
  prompt: string;
  /** Model slug as chosen ("" = Default). */
  model: string;
  modelLabel: string;
  /** Object URL (owned, revoked on removal) or a remote URL. */
  src: string;
  /** Edit results only: the source image before the edit (owned object URL). */
  before?: string;
  ext: string;
};

type Src = { blob: Blob; file: File; url: string; w: number; h: number };

/** Mask stroke. Points are normalized 0..1 so the mask scales with the source. Width is a fraction of the long edge. */
type Stroke = { erase: boolean; width: number; pts: [number, number][] };

type SizeOpt = { id: string; label: string; size: string; w: number; h: number; sub: string };

const AUTO: SizeOpt = { id: "auto", label: "Auto", size: "", w: 1, h: 1, sub: "Model default" };
const SIZES: SizeOpt[] = [
  AUTO,
  { id: "1:1", label: "1:1", size: "1024x1024", w: 1, h: 1, sub: "1024 × 1024" },
  { id: "3:2", label: "3:2", size: "1536x1024", w: 3, h: 2, sub: "1536 × 1024" },
  { id: "2:3", label: "2:3", size: "1024x1536", w: 2, h: 3, sub: "1024 × 1536" },
  { id: "16:9", label: "16:9", size: "1792x1024", w: 16, h: 9, sub: "1792 × 1024" },
];

const MAX_EDGE = 2048;
const HISTORY_CAP = 40;
const DRAG_MIME = "application/x-inferenceport-image";
const CREDIT_HEADER = "X-Payg-Credits-Charged";
const EDIT_UNSUPPORTED = "This API deployment doesn't expose image editing yet.";

const isAbort = (e: unknown) => (e as { name?: string } | null)?.name === "AbortError";
const mimeOf = (b64: string) => (b64.startsWith("/9j/") ? "image/jpeg" : "image/png");
const extOf = (mime: string) => (mime === "image/jpeg" ? "jpg" : "png");
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const revokeIfBlob = (u?: string) => { if (u && u.startsWith("blob:")) URL.revokeObjectURL(u); };
const revokeItem = (it: Item) => { revokeIfBlob(it.src); revokeIfBlob(it.before); };
const doneText = (n: number) => `${n} image${n === 1 ? "" : "s"} ready`;

function labelFor(list: any[], value: string): string {
  if (!value) return "Default";
  const m = list.find((x) => slug(x) === value);
  return m ? displayName(m) : value;
}

/** Draws one stroke. "display" paints a visible overlay; "export" writes the mask (opaque = keep, transparent = edit). */
function paintStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number, mode: "display" | "export") {
  if (!s.pts.length) return;
  ctx.save();
  ctx.lineWidth = Math.max(1, s.width * Math.max(w, h));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (mode === "display") {
    ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    ctx.strokeStyle = "#4f7cff";
  } else {
    ctx.globalCompositeOperation = s.erase ? "source-over" : "destination-out";
    ctx.strokeStyle = "#000";
  }
  const [x0, y0] = s.pts[0];
  ctx.beginPath();
  ctx.moveTo(x0 * w, y0 * h);
  if (s.pts.length === 1) ctx.lineTo(x0 * w + 0.01, y0 * h);
  for (const [x, y] of s.pts.slice(1)) ctx.lineTo(x * w, y * h);
  ctx.stroke();
  ctx.restore();
}

function buildMaskBlob(strokes: Stroke[], w: number, h: number): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas is unavailable in this browser."));
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  for (const s of strokes) paintStroke(ctx, s, w, h, "export");
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("Could not build the mask."))), "image/png"),
  );
}

/** Re-encodes any picture as PNG, capped at MAX_EDGE on the long side. Handles EXIF orientation via createImageBitmap. */
async function loadSource(input: Blob, name: string): Promise<Src> {
  const bmp = await createImageBitmap(input);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/png"),
  );
  const base = name.replace(/\.[^.]+$/, "") || "source";
  const file = new File([blob], `${base}.png`, { type: "image/png" });
  return { blob, file, url: URL.createObjectURL(blob), w, h };
}

function parseImages(data: any): { src: string; ext: string }[] {
  const out: { src: string; ext: string }[] = [];
  const list: any[] = Array.isArray(data?.data) ? data.data : [];
  for (const entry of list) {
    if (typeof entry?.b64_json === "string" && entry.b64_json) {
      const mime = mimeOf(entry.b64_json);
      out.push({ src: b64ToBlobUrl(entry.b64_json, mime), ext: extOf(mime) });
    } else if (typeof entry?.url === "string" && entry.url) {
      out.push({ src: entry.url, ext: "png" });
    }
  }
  return out;
}

function makeItems(
  kind: Mode,
  prompt: string,
  model: string,
  modelLabel: string,
  images: { src: string; ext: string }[],
  beforeBlob?: Blob,
): Item[] {
  return images.map((img) => ({
    id: uid(),
    kind,
    prompt,
    model,
    modelLabel,
    src: img.src,
    ext: img.ext,
    before: beforeBlob ? URL.createObjectURL(beforeBlob) : undefined,
  }));
}

export default function ImageStudio(props: StudioProps) {
  const { session, apiBase, apiPrefix, models } = props;

  const genModels = useMemo(() => imageModels(models), [models]);
  const editInfo = useMemo(() => {
    const strict = genModels.filter((m) => accepts(m, "image"));
    return { list: strict.length ? strict : genModels, fallback: strict.length === 0 };
  }, [genModels]);

  const [mode, setMode] = useState<Mode>("generate");
  const [prompt, setPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [genModel, setGenModel] = useState("");
  const [editModel, setEditModel] = useState("");
  const [sizeId, setSizeId] = useState("auto");
  const [count, setCount] = useState(1);

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ state: "done" | "failed"; text: string; credits?: string | null } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [history, setHistory] = useState<Item[]>([]);
  const [lbId, setLbId] = useState<string | null>(null);
  const lbIndex = lbId ? history.findIndex((i) => i.id === lbId) : -1;

  const [src, setSrc] = useState<Src | null>(null);
  const [painting, setPainting] = useState(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [brush, setBrush] = useState(4);
  const [strokeCount, setStrokeCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<Item[]>(history);
  const strokesRef = useRef<Stroke[]>([]);
  const liveRef = useRef<Stroke | null>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);

  const sizeOpt = SIZES.find((s) => s.id === sizeId) ?? AUTO;

  /* ---------- lifecycle ---------- */

  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      historyRef.current.forEach(revokeItem);
    };
  }, []);

  // Revoke the previous source preview whenever the source changes, and on unmount.
  useEffect(() => {
    if (!src) return;
    return () => URL.revokeObjectURL(src.url);
  }, [src]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1800);
    return () => window.clearTimeout(t);
  }, [flash]);

  // Painting only makes sense in Edit mode with a source image loaded.
  useEffect(() => {
    if (mode !== "edit" || !src) setPainting(false);
  }, [mode, src]);

  /* ---------- mask painting ---------- */

  const redrawMask = useCallback(() => {
    const c = maskRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokesRef.current) paintStroke(ctx, s, c.width, c.height, "display");
  }, []);

  // The canvas is re-mounted on mode switch and resized on source change; repaint from stroke data.
  useEffect(() => { redrawMask(); }, [src, mode, redrawMask]);

  const pointOf = (e: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
  };

  const onMaskDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const c = e.currentTarget;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.setPointerCapture(e.pointerId);
    const s: Stroke = { erase: tool === "eraser", width: brush / 100, pts: [pointOf(e)] };
    liveRef.current = s;
    paintStroke(ctx, s, c.width, c.height, "display");
  };

  const onMaskMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = liveRef.current;
    if (!s) return;
    const c = e.currentTarget;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = pointOf(e);
    const prev = s.pts[s.pts.length - 1];
    if (Math.abs(p[0] - prev[0]) + Math.abs(p[1] - prev[1]) < 0.0005) return;
    s.pts.push(p);
    paintStroke(ctx, { erase: s.erase, width: s.width, pts: [prev, p] }, c.width, c.height, "display");
  };

  const onMaskUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = liveRef.current;
    liveRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!s) return;
    strokesRef.current.push(s);
    setStrokeCount(strokesRef.current.length);
  };

  const undoStroke = () => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redrawMask();
  };

  const clearMask = () => {
    strokesRef.current = [];
    setStrokeCount(0);
    redrawMask();
  };

  /* ---------- source image ---------- */

  const acceptSource = useCallback(async (input: Blob, name: string): Promise<boolean> => {
    try {
      const next = await loadSource(input, name);
      strokesRef.current = [];
      liveRef.current = null;
      setStrokeCount(0);
      setSrc(next);
      setError(null);
      return true;
    } catch {
      setError("Couldn't read that image. Try a PNG, JPEG or WebP file.");
      return false;
    }
  }, []);

  const clearSource = () => {
    strokesRef.current = [];
    liveRef.current = null;
    setStrokeCount(0);
    setSrc(null);
  };

  // Paste an image anywhere on the page while in Edit mode.
  useEffect(() => {
    if (mode !== "edit") return;
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
      if (!f) return;
      e.preventDefault();
      void acceptSource(f, f.name || "pasted.png");
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [mode, acceptSource]);

  /* ---------- requests ---------- */

  const begin = (n: number) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setPending(n);
    setError(null);
    setStatus(null);
    return ctrl;
  };

  const end = (ctrl: AbortController) => {
    if (abortRef.current !== ctrl) return;
    abortRef.current = null;
    setBusy(false);
    setPending(0);
  };

  const commit = useCallback((items: Item[]) => {
    setHistory((prev) => {
      const next = [...items, ...prev];
      next.slice(HISTORY_CAP).forEach(revokeItem);
      return next.slice(0, HISTORY_CAP);
    });
  }, []);

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setPending(0);
    setStatus({ state: "failed", text: "Cancelled" });
  };

  const runGenerate = async () => {
    const p = prompt.trim();
    if (!p || busy) return;
    const n = count;
    const chosen = genModel;
    const size = sizeOpt.size;
    const ctrl = begin(n);
    try {
      const body: Record<string, unknown> = { prompt: p };
      if (chosen) body.model = chosen;
      if (size) body.size = size;
      if (n > 1) body.n = n;
      const { data, headers } = await apiJson(
        props,
        `${apiPrefix}/images/generations`,
        { method: "POST", headers: jsonHeaders(session), body: JSON.stringify(body) },
        ctrl.signal,
      );
      const images = parseImages(data);
      if (!images.length) throw new Error("The API returned no images.");
      commit(makeItems("generate", p, chosen, labelFor(genModels, chosen), images));
      setStatus({ state: "done", text: doneText(images.length), credits: headers.get(CREDIT_HEADER) });
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      end(ctrl);
    }
  };

  const runEdit = async () => {
    const p = editPrompt.trim();
    if (!p || !src || busy) return;
    const current = src;
    const n = count;
    const chosen = editModel;
    const size = sizeOpt.size;
    const ctrl = begin(n);
    try {
      const fd = new FormData();
      fd.append("image", current.file, current.file.name);
      fd.append("prompt", p);
      if (chosen) fd.append("model", chosen);
      if (strokesRef.current.length) {
        const mask = await buildMaskBlob(strokesRef.current, current.w, current.h);
        fd.append("mask", mask, "mask.png");
      }
      if (n > 1) fd.append("n", String(n));
      if (size) fd.append("size", size);

      // Multipart: the browser sets the boundary, so no Content-Type header here.
      const r = await fetch(`${apiBase}${apiPrefix}/images/edits`, {
        method: "POST",
        headers: bearer(session),
        body: fd,
        signal: ctrl.signal,
      });
      if (r.status === 404 || r.status === 405 || r.status === 501) throw new Error(EDIT_UNSUPPORTED);
      await assertOk(r);
      const data = await r.json().catch(() => ({}));
      const images = parseImages(data);
      if (!images.length) throw new Error("The API returned no images.");
      commit(makeItems("edit", p, chosen, labelFor(editInfo.list, chosen), images, current.blob));
      setStatus({ state: "done", text: doneText(images.length), credits: r.headers.get(CREDIT_HEADER) });
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : "Edit failed.");
    } finally {
      end(ctrl);
    }
  };

  const submit = () => {
    if (mode === "generate") void runGenerate();
    else void runEdit();
  };

  const canSubmit = mode === "generate" ? prompt.trim().length > 0 : !!src && editPrompt.trim().length > 0;

  const onPromptKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  /* ---------- history actions ---------- */

  const download = (item: Item) => downloadHref(item.src, `inferenceport-${item.id}.${item.ext}`);

  const copyPrompt = async (item: Item) => {
    try {
      await navigator.clipboard.writeText(item.prompt);
      setFlash("Prompt copied");
    } catch {
      setFlash("Copy was blocked by the browser");
    }
  };

  const editFrom = async (item: Item) => {
    setLbId(null);
    setMode("edit");
    try {
      const r = await fetch(item.src);
      if (!r.ok) throw new Error("fetch failed");
      const ok = await acceptSource(await r.blob(), `${item.id}.${item.ext}`);
      if (ok) setFlash("Loaded into Edit");
    } catch {
      setError("Couldn't load that image into the editor. Download it and upload it instead.");
    }
  };

  const reuse = (item: Item) => {
    setLbId(null);
    if (item.kind === "edit") {
      setMode("edit");
      setEditPrompt(item.prompt);
    } else {
      setMode("generate");
      setPrompt(item.prompt);
      if (!item.model || genModels.some((m) => slug(m) === item.model)) setGenModel(item.model);
    }
    setFlash("Prompt reused");
  };

  const removeItem = (id: string) => {
    const it = historyRef.current.find((x) => x.id === id);
    if (!it) return;
    revokeItem(it);
    setHistory((prev) => prev.filter((x) => x.id !== id));
    setLbId((cur) => (cur === id ? null : cur));
  };

  const clearAll = () => {
    history.forEach(revokeItem);
    setHistory([]);
    setLbId(null);
  };

  /* ---------- render helpers ---------- */

  const promptField = (value: string, set: (v: string) => void, label: string, placeholder: string) => (
    <Field label={label}>
      <textarea
        className={shared.textarea}
        rows={5}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => set(e.target.value)}
        onKeyDown={onPromptKey}
      />
    </Field>
  );

  const emptyText = mode === "generate"
    ? "Describe an image to begin"
    : src ? "Describe the change to begin" : "Add a source image to begin";

  return (
    <>
      <div className={shared.studio}>
        <aside className={shared.controls} aria-label="Image controls">
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: "generate", label: "Generate" },
              { value: "edit", label: "Edit" },
            ]}
          />

          <div className={styles.promptBlock}>
            {mode === "generate" ? (
              promptField(prompt, setPrompt, "Prompt", "A watercolor fox reading in a rainy library…")
            ) : (
              <>
                <Field label="Source image">
                  <div
                    onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault(); }}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData(DRAG_MIME);
                      if (!id) return;
                      e.preventDefault();
                      const it = history.find((x) => x.id === id);
                      if (it) void editFrom(it);
                    }}
                  >
                    <Dropzone
                      accept="image/*"
                      kind="image"
                      file={src?.file ?? null}
                      previewUrl={src?.url}
                      hint="Drop, paste or browse"
                      onFile={(f) => { if (f) void acceptSource(f, f.name); else clearSource(); }}
                    />
                  </div>
                </Field>
                {promptField(editPrompt, setEditPrompt, "Describe the edit", "Replace the sky with a dusky purple sunset…")}
              </>
            )}

            <div className={styles.submitRow}>
              <Button
                className={shared.grow}
                busy={busy}
                icon={mode === "generate" ? "sparkle" : "pencil"}
                disabled={!canSubmit}
                onClick={submit}
              >
                {busy ? (mode === "generate" ? "Generating…" : "Applying…") : mode === "generate" ? "Generate" : "Apply edit"}
              </Button>
              {busy && (
                <Button variant="ghost" icon="x" className={styles.smallBtn} onClick={cancel}>Cancel</Button>
              )}
            </div>
          </div>

          {mode === "generate" ? (
            <ModelSelect models={genModels} value={genModel} onChange={setGenModel} defaultLabel="Default" />
          ) : (
            <ModelSelect
              models={editInfo.list}
              value={editModel}
              onChange={setEditModel}
              defaultLabel="Default"
              hint={editInfo.fallback ? "No dedicated edit models listed. Showing all image models." : undefined}
            />
          )}

          <Advanced>
            <Field label="Aspect ratio">
              <div className={styles.ratios} role="radiogroup" aria-label="Aspect ratio">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={s.id === sizeId}
                    title={s.sub}
                    className={cx(styles.ratioChip, s.id === sizeId && styles.ratioOn)}
                    onClick={() => setSizeId(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Images">
              <Segmented<number>
                value={count}
                onChange={setCount}
                options={[1, 2, 3, 4].map((v) => ({ value: v, label: String(v) }))}
              />
            </Field>

            {mode === "edit" && (
              <>
                <Range label="Brush size" value={brush} min={1} max={15} onChange={setBrush} format={(v) => `${v}%`} />
                <div className={styles.actions}>
                  <Button variant="ghost" icon="arrow-clockwise" className={styles.smallBtn} onClick={undoStroke} disabled={!strokeCount}>Undo stroke</Button>
                  <Button variant="ghost" icon="trash" className={styles.smallBtn} onClick={clearMask} disabled={!strokeCount}>Clear mask</Button>
                </div>
              </>
            )}

            {history.length > 0 && (
              <div className={styles.actions}>
                <Button variant="ghost" icon="trash" className={styles.smallBtn} onClick={clearAll} disabled={busy}>Clear results</Button>
              </div>
            )}
          </Advanced>
        </aside>

        <section className={shared.stage} aria-label="Results">
          {error && <ErrorNote onDismiss={() => setError(null)}>{error}</ErrorNote>}
          {busy ? (
            <StatusLine state="pending">
              {mode === "generate"
                ? `Generating ${pending > 1 ? `${pending} images` : "an image"}…`
                : `Applying the edit${pending > 1 ? ` to ${pending} variants` : ""}…`}
            </StatusLine>
          ) : status ? (
            <>
              <StatusLine state={status.state}>{status.text}</StatusLine>
              {status.state === "done" && status.credits && (
                <p className={styles.credits}>Credits charged: {status.credits}</p>
              )}
            </>
          ) : null}

          {mode === "edit" && src && (
            <div className={styles.editor}>
              <div className={styles.maskWrap}>
                <div
                  className={styles.maskFrame}
                  style={{
                    width: `min(100%, calc(60vh * ${src.w} / ${src.h}))`,
                    aspectRatio: `${src.w} / ${src.h}`,
                  }}
                >
                  <img src={src.url} alt="Source image" className={styles.maskImg} draggable={false} />
                  <canvas
                    ref={maskRef}
                    width={src.w}
                    height={src.h}
                    className={cx(styles.maskCanvas, painting && styles.maskCanvasOn)}
                    aria-label="Mask painting area"
                    onPointerDown={onMaskDown}
                    onPointerMove={onMaskMove}
                    onPointerUp={onMaskUp}
                    onPointerCancel={onMaskUp}
                  />
                </div>
              </div>
              <div className={styles.paintRow}>
                <Button
                  variant="ghost"
                  icon="pencil"
                  className={styles.smallBtn}
                  aria-pressed={painting}
                  onClick={() => setPainting((p) => !p)}
                >
                  {painting ? "Done painting" : "Paint mask"}
                </Button>
                {painting && (
                  <Segmented<Tool>
                    size="sm"
                    value={tool}
                    onChange={setTool}
                    options={[
                      { value: "brush", label: "Brush" },
                      { value: "eraser", label: "Eraser" },
                    ]}
                  />
                )}
              </div>
            </div>
          )}

          {history.length === 0 && !busy && (
            <div className={styles.empty}>
              <Icon name="image" size={28} />
              <div>{emptyText}</div>
            </div>
          )}

          {(busy || history.length > 0) && (
            <div className={styles.grid}>
              {busy && Array.from({ length: pending }, (_, i) => (
                <SkeletonCard key={`sk-${i}`} ratio={`${sizeOpt.w} / ${sizeOpt.h}`} />
              ))}
              {history.map((item) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  onOpen={setLbId}
                  onDownload={download}
                  onEdit={editFrom}
                  onReuse={reuse}
                  onDelete={(it) => removeItem(it.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {lbIndex >= 0 && (
        <Lightbox
          items={history}
          index={lbIndex}
          onIndex={(i) => setLbId(history[i].id)}
          onClose={() => setLbId(null)}
          onDownload={download}
          onCopy={copyPrompt}
          onEdit={editFrom}
          onReuse={reuse}
        />
      )}

      {flash && <div className={styles.toast} role="status" aria-live="polite">{flash}</div>}
    </>
  );
}

/* ---------- Gallery ---------- */

function SkeletonCard({ ratio }: { ratio: string }) {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={cx(shared.skeleton, styles.skelImg)} style={{ aspectRatio: ratio }} />
    </div>
  );
}

function GalleryCard({
  item, onOpen, onDownload, onEdit, onReuse, onDelete,
}: {
  item: Item;
  onOpen: (id: string) => void;
  onDownload: (item: Item) => void;
  onEdit: (item: Item) => void;
  onReuse: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  return (
    <figure className={styles.card}>
      <button type="button" className={styles.thumbBtn} onClick={() => onOpen(item.id)} aria-label={`Open image: ${item.prompt.slice(0, 80)}`}>
        <img
          src={item.src}
          alt=""
          className={styles.thumb}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, item.id);
            e.dataTransfer.effectAllowed = "copy";
          }}
        />
      </button>
      <div className={styles.cardActions}>
        <IconButton icon="eye" label="Open" className={styles.actBtn} onClick={() => onOpen(item.id)} />
        <IconButton icon="download" label="Download" className={styles.actBtn} onClick={() => onDownload(item)} />
        <IconButton icon="pencil" label="Edit this" className={styles.actBtn} onClick={() => void onEdit(item)} />
        <IconButton icon="sparkle" label="Reuse prompt" className={styles.actBtn} onClick={() => onReuse(item)} />
        <IconButton icon="trash" label="Delete" className={styles.actBtn} onClick={() => onDelete(item)} />
      </div>
    </figure>
  );
}

/* ---------- Lightbox ---------- */

function Chevron({ dir }: { dir: "left" | "right" }) {
  const d = dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Compare({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className={styles.lbPair}>
      <img src={after} alt="After edit" className={styles.lbImg} draggable={false} />
      <img
        src={before}
        alt="Before edit"
        className={styles.lbImg}
        draggable={false}
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div className={styles.cmpLine} style={{ left: `${pos}%` }} />
      <span className={cx(styles.cmpTag, styles.cmpTagL)}>Before</span>
      <span className={cx(styles.cmpTag, styles.cmpTagR)}>After</span>
      <div className={styles.cmpBar}>
        <input
          type="range"
          className={shared.range}
          min={0}
          max={100}
          value={pos}
          aria-label="Compare before and after"
          style={{ ["--pct" as string]: `${pos}%` }}
          onChange={(e) => setPos(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

function Lightbox({
  items, index, onIndex, onClose, onDownload, onCopy, onEdit, onReuse,
}: {
  items: Item[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDownload: (item: Item) => void;
  onCopy: (item: Item) => void;
  onEdit: (item: Item) => void;
  onReuse: (item: Item) => void;
}) {
  const item = items[index];
  const count = items.length;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the close button on open; restore the previously focused element on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  // Re-bound each render so the handler always sees the current index.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
        e.preventDefault();
        onIndex((index + (e.key === "ArrowRight" ? 1 : -1) + count) % count);
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const f = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"));
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return createPortal(
    <div
      className={styles.lbBackdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Image preview" className={styles.lbDialog}>
        <div className={styles.lbBar}>
          <div className={styles.lbMeta}>
            <div className={styles.cardTop}>
              <span className={cx(shared.chip, item.kind === "edit" ? shared.chipGold : shared.chipBrand)}>
                {item.kind === "edit" ? "Edit" : "Generate"}
              </span>
              <span className={cx(shared.chip, styles.modelChip)} title={item.modelLabel}>{item.modelLabel}</span>
            </div>
            <p className={styles.lbPrompt}>{item.prompt}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={cx(shared.iconBtn, styles.lbClose)}
            aria-label="Close preview"
            title="Close (Esc)"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>

        <div className={styles.lbBody}>
          {item.before ? (
            <Compare key={item.id} before={item.before} after={item.src} />
          ) : (
            <div className={styles.lbPair}>
              <img src={item.src} alt={item.prompt} className={styles.lbImg} draggable={false} />
            </div>
          )}
          {count > 1 && (
            <>
              <button
                type="button"
                className={cx(styles.lbNav, styles.lbPrev)}
                aria-label="Previous image"
                title="Previous (←)"
                onClick={() => onIndex((index - 1 + count) % count)}
              >
                <Chevron dir="left" />
              </button>
              <button
                type="button"
                className={cx(styles.lbNav, styles.lbNext)}
                aria-label="Next image"
                title="Next (→)"
                onClick={() => onIndex((index + 1) % count)}
              >
                <Chevron dir="right" />
              </button>
            </>
          )}
        </div>

        <div className={styles.lbFoot}>
          <Button variant="ghost" icon="download" className={styles.smallBtn} onClick={() => onDownload(item)}>Download</Button>
          <Button variant="ghost" icon="copy" className={styles.smallBtn} onClick={() => void onCopy(item)}>Copy prompt</Button>
          <Button variant="ghost" icon="pencil" className={styles.smallBtn} onClick={() => void onEdit(item)}>Edit this</Button>
          <Button variant="ghost" icon="sparkle" className={styles.smallBtn} onClick={() => onReuse(item)}>Reuse prompt</Button>
          <span className={styles.lbCount}>{index + 1} / {count}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
