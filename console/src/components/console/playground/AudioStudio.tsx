"use client";

import { Fragment, memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import Icon from "../../Icon";
import shared from "./Playground.module.css";
import styles from "./AudioStudio.module.css";
import { Advanced, Button, Dropzone, ErrorNote, Field, IconButton, ModelSelect, Range, Segmented, StatusLine, cx } from "./ui";
import { dedupe, slug } from "./models";
import { dataUrlToBlob, uid } from "./api";
import type { StudioProps } from "./types";
import { billingUnit, formatModelPrice } from "../../../lib/modelPricing";

/* ---------- Task catalogue (endpoints and capability ids match AudioPlayground) ---------- */

type TaskId = "music" | "speech" | "timestamps" | "transcribe" | "voice-changer" | "voice-isolator" | "stem-separation";

type Capability = "music_sfx" | "tts" | "tts_timestamps" | "transcribe" | "voice_changer" | "voice_isolator" | "stem_separation";

interface TaskDef {
  id: TaskId;
  capability: Capability;
  label: string;
  path: string;
  defaultModel: string;
  multipart: boolean;
  action: string;
}

const TASKS: TaskDef[] = [
  { id: "music", capability: "music_sfx", label: "Music", path: "/audio/generations", defaultModel: "", multipart: false, action: "Generate" },
  { id: "speech", capability: "tts", label: "Speech", path: "/audio/speech", defaultModel: "openai-tts-1", multipart: false, action: "Speak" },
  // Reached only through Speech + "Character timings" (Advanced); never shown as its own chip.
  { id: "timestamps", capability: "tts_timestamps", label: "Speech with timings", path: "/audio/speech/with-timestamps", defaultModel: "elevenlabs-eleven-v3", multipart: false, action: "Speak" },
  { id: "transcribe", capability: "transcribe", label: "Transcribe", path: "/audio/transcriptions", defaultModel: "whisper-large-v3", multipart: true, action: "Transcribe" },
  { id: "voice-changer", capability: "voice_changer", label: "Voice changer", path: "/audio/voice-changer", defaultModel: "elevenlabs-eleven-multilingual-sts-v2", multipart: true, action: "Convert" },
  { id: "voice-isolator", capability: "voice_isolator", label: "Isolate", path: "/audio/voice-isolator", defaultModel: "elevenlabs-voice-isolator", multipart: true, action: "Isolate" },
  { id: "stem-separation", capability: "stem_separation", label: "Stems", path: "/audio/stem-separation", defaultModel: "elevenlabs-stem-separation", multipart: true, action: "Split stems" },
];

const CHIP_IDS: TaskId[] = ["music", "speech", "transcribe", "voice-changer", "voice-isolator", "stem-separation"];

const taskLabel = (id: TaskId) => TASKS.find((t) => t.id === id)?.label ?? id;

const SPEECH_FORMATS = ["mp3", "opus", "aac", "flac", "wav", "pcm"];
const TRANSCRIPT_FORMATS = ["json", "text", "verbose_json", "srt", "vtt"];
const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const MUSIC_SAMPLES: { label: string; prompt: string }[] = [
  { label: "Lo-fi beat", prompt: "Relaxed lo-fi hip hop beat with vinyl crackle and soft piano" },
  { label: "Cinematic swell", prompt: "Cinematic orchestral swell that builds to a slow, hopeful climax" },
  { label: "Rain and thunder", prompt: "Gentle rain on a tin roof with distant rolling thunder" },
  { label: "8-bit loop", prompt: "Upbeat 8-bit chiptune loop, bright and playful" },
  { label: "Footsteps", prompt: "Footsteps on old wooden stairs, then a door creaks open" },
];
const RATES = [0.75, 1, 1.25, 1.5];
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_HISTORY = 12;
const ACCEPT = "audio/*,.mp3,.wav,.flac,.m4a,.ogg,.opus,.webm";
const PEAK_BINS = 720;
const WAVE_H = 72;

/* ---------- Timings (word-level highlight) ---------- */

interface Token { text: string; start: number; end: number }

const numArr = (v: any): number[] | null => (Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? v : null);

function groupWords(chars: Token[]): Token[] {
  const out: Token[] = [];
  let cur: Token | null = null;
  for (const c of chars) {
    if (/\s/.test(c.text)) {
      if (cur) out.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { text: c.text, start: c.start, end: c.end };
    else { cur.text += c.text; cur.end = c.end; }
  }
  if (cur) out.push(cur);
  return out;
}

/** Builds word tokens from whichever alignment shape the response uses; null when unknown. */
function parseTimings(data: any): Token[] | null {
  const align = data?.alignment ?? data?.normalized_alignment;
  if (align && Array.isArray(align.characters)) {
    const starts = numArr(align.character_start_times_seconds);
    const ends = numArr(align.character_end_times_seconds);
    const n = align.characters.length;
    if (starts && ends && starts.length === n && ends.length === n) {
      const chars: Token[] = align.characters.map((c: any, i: number) => ({ text: String(c ?? ""), start: starts[i], end: ends[i] }));
      const words = groupWords(chars);
      return words.length ? words : null;
    }
  }
  if (Array.isArray(data?.words)) {
    const out: Token[] = [];
    for (const w of data.words) {
      const text = typeof w?.text === "string" ? w.text : typeof w?.word === "string" ? w.word : "";
      if (!text.trim() || typeof w.start !== "number" || typeof w.end !== "number") continue;
      out.push({ text: text.trim(), start: w.start, end: w.end });
    }
    return out.length ? out : null;
  }
  return null;
}

function activeIndex(tokens: Token[], t: number): number {
  let lo = 0;
  let hi = tokens.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tokens[mid].start <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (found < 0) return -1;
  return t <= tokens[found].end + 0.35 ? found : -1;
}

/* ---------- Results ---------- */

type Kind = "audio" | "transcript" | "json" | "download";

interface Draft {
  kind: Kind;
  blob: Blob;
  url: string;
  name: string;
  credits: string;
  body?: string;
  mono?: boolean;
  json?: string;
  tokens?: Token[] | null;
}

interface Result extends Draft {
  id: string;
  task: TaskId;
  label: string;
  createdAt: number;
}

function makeDraft(kind: Kind, blob: Blob, name: string, credits: string, extra: Partial<Draft> = {}): Draft {
  return { kind, blob, url: URL.createObjectURL(blob), name, credits, ...extra };
}

function extFor(type: string): string {
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg") || type.includes("opus")) return "ogg";
  if (type.includes("flac")) return "flac";
  if (type.includes("aac") || type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("webm")) return "webm";
  if (type.includes("pcm")) return "pcm";
  return "mp3";
}

async function readError(r: Response): Promise<string> {
  const body = await r.text().catch(() => "");
  let msg: any = body;
  try {
    const p = JSON.parse(body);
    const pick = (v: any) => (typeof v === "string" ? v : v?.message ?? (v ? JSON.stringify(v) : ""));
    msg = pick(p.detail) || pick(p.error) || body;
  } catch { /* raw body */ }
  return String(msg || `Request failed (HTTP ${r.status})`).slice(0, 500);
}

async function readResult(r: Response, task: TaskId, format: string): Promise<Draft> {
  const credits = r.headers.get("X-Payg-Credits-Charged") || "";
  const type = (r.headers.get("content-type") || "").toLowerCase();
  if (!r.ok) throw new Error(await readError(r));
  const base = task === "transcribe" ? "transcript" : task;

  if (type.includes("application/json")) {
    const data: any = await r.json();
    let b64: string | null = null;
    for (const key of ["audio", "audio_base64"]) {
      const v = data?.[key];
      if (typeof v === "string" && v.length > 64) { b64 = v; delete data[key]; break; }
    }
    const json = JSON.stringify(data, null, 2);
    const tokens = task === "timestamps" ? parseTimings(data) : null;
    if (b64) {
      return makeDraft("audio", dataUrlToBlob(`data:audio/mpeg;base64,${b64}`), `${base}.mp3`, credits, { json, tokens });
    }
    if (task === "transcribe") {
      const hasText = format === "json" && typeof data?.text === "string";
      const body = hasText ? data.text : json;
      return makeDraft("transcript", new Blob([body], { type: "text/plain" }), "transcript.txt", credits, {
        body, mono: !hasText, json: hasText ? json : undefined,
      });
    }
    return makeDraft("json", new Blob([json], { type: "application/json" }), `${base}.json`, credits, { body: json, mono: true, tokens });
  }

  if (type.startsWith("text/")) {
    const body = await r.text();
    return makeDraft("transcript", new Blob([body], { type: "text/plain" }), "transcript.txt", credits, {
      body, mono: format === "srt" || format === "vtt" || format === "verbose_json",
    });
  }

  const blob = await r.blob();
  if (type.startsWith("audio/")) return makeDraft("audio", blob, `${base}.${extFor(type)}`, credits);

  const disposition = r.headers.get("content-disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match?.[1] || (type.includes("zip") ? "stems.zip" : "result.bin");
  return makeDraft("download", blob, name, credits);
}

/* ---------- Helpers ---------- */

const supportsTask = (m: any, def: TaskDef): boolean => {
  if (Array.isArray(m?.capabilities)) return m.capabilities.includes(def.capability);
  if (m?.type && m.type !== "audio") return false;
  const u = billingUnit(m);
  if (def.id === "music") return u === "seconds";
  if (def.id === "speech" || def.id === "timestamps") return u === "input_chars" || u === "input_bytes" || u === "seconds";
  return u === "input_seconds";
};

const fmt = (s: number) => {
  const v = Number.isFinite(s) && s > 0 ? s : 0;
  return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`;
};

const fmtSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const snippet = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "Untitled";
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
};

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function computePeaks(data: Float32Array, bins: number): Float32Array {
  const out = new Float32Array(bins);
  const size = Math.max(1, Math.floor(data.length / bins));
  for (let b = 0; b < bins; b++) {
    const start = b * size;
    const end = Math.min(data.length, start + size);
    let max = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(data[i]);
      if (v > max) max = v;
    }
    out[b] = max;
  }
  return out;
}

/* ---------- Recorder (MediaRecorder + AnalyserNode level meter) ---------- */

function Recorder({ disabled, onRecorded }: { disabled: boolean; onRecorded: (f: File) => void }) {
  const [phase, setPhase] = useState<"idle" | "starting" | "recording">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const rafRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const startedRef = useRef(0);
  const meterRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef(false);
  const aliveRef = useRef(false);

  const teardown = () => {
    window.clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    if (meterRef.current) meterRef.current.style.transform = "scaleX(0)";
  };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      discardRef.current = true;
      const rec = recRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      recRef.current = null;
      teardown();
    };
    // teardown only touches refs, so a mount-time closure is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setErr("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErr("This browser cannot record audio. Upload a file instead.");
      return;
    }
    setPhase("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError" || e?.name === "PermissionDeniedError";
      if (aliveRef.current) {
        setErr(denied
          ? "Microphone access was denied. Allow the microphone for this site in your browser settings, then try again. You can also upload a file."
          : "No microphone was found or it could not be opened. Upload a file instead.");
        setPhase("idle");
      }
      return;
    }
    if (!aliveRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    let rec: MediaRecorder;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      teardown();
      setPhase("idle");
      setErr("Recording is not supported in this browser. Upload a file instead.");
      return;
    }

    let capped = false;
    chunksRef.current = [];
    bytesRef.current = 0;
    discardRef.current = false;
    rec.ondataavailable = (ev) => {
      if (!ev.data.size) return;
      chunksRef.current.push(ev.data);
      bytesRef.current += ev.data.size;
      if (bytesRef.current >= MAX_BYTES - 512 * 1024 && rec.state !== "inactive") {
        capped = true;
        rec.stop();
      }
    };
    rec.onerror = () => setErr("Recording failed. Try again.");
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
      chunksRef.current = [];
      recRef.current = null;
      teardown();
      if (!aliveRef.current) return;
      setPhase("idle");
      setElapsed(0);
      if (discardRef.current) return;
      if (blob.size === 0) {
        setErr("Nothing was recorded. Try again.");
        return;
      }
      if (capped) setErr("Recording stopped at the 50 MB limit.");
      onRecorded(new File([blob], "recording.webm", { type: blob.type || "audio/webm" }));
    };

    recRef.current = rec;
    startedRef.current = Date.now();
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed((Date.now() - startedRef.current) / 1000), 250);

    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
          const v = (samples[i] - 128) / 128;
          sum += v * v;
        }
        const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
        if (meterRef.current) meterRef.current.style.transform = `scaleX(${level.toFixed(3)})`;
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* the level meter is optional */
    }

    rec.start(1000);
    setPhase("recording");
  };

  const stop = (discard: boolean) => {
    discardRef.current = discard;
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      teardown();
      setPhase("idle");
    }
  };

  const recording = phase === "recording";
  return (
    <div className={styles.recorder}>
      <div className={styles.recRow}>
        {!recording ? (
          <Button variant="ghost" icon="mic" busy={phase === "starting"} disabled={disabled} onClick={start}>
            Record
          </Button>
        ) : (
          <>
            <Button variant="danger" icon="stop" onClick={() => stop(false)}>Stop</Button>
            <IconButton icon="trash" label="Discard recording" onClick={() => stop(true)} />
            <span className={styles.recDot} aria-hidden="true" />
            <span className={styles.timer} role="status">Recording {fmt(elapsed)}</span>
          </>
        )}
      </div>
      {recording && (
        <div className={styles.meter} aria-hidden="true">
          <div ref={meterRef} className={styles.meterBar} />
        </div>
      )}
      {err && <ErrorNote onDismiss={() => setErr("")}>{err}</ErrorNote>}
    </div>
  );
}

/* ---------- Mini preview of the chosen input ---------- */

function InputPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className={styles.inputPreview}>
      <span className={styles.inputCap}>Input preview &middot; {file.name} &middot; {fmtSize(file.size)}</span>
      {url && <audio controls preload="metadata" src={url} className={styles.inAudio} />}
    </div>
  );
}

/* ---------- Timestamp transcript (memoised so only the active word re-renders) ---------- */

const TokenText = memo(function TokenText({ tokens, active, onSeek }: { tokens: Token[]; active: number; onSeek: (t: number) => void }) {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active >= 0) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div className={styles.tokens}>
      {tokens.map((t, i) => (
        <Fragment key={i}>
          <button
            type="button"
            ref={i === active ? activeRef : undefined}
            className={cx(styles.token, i === active && styles.tokenOn)}
            aria-current={i === active ? "true" : undefined}
            title={`${t.start.toFixed(2)}s`}
            onClick={() => onSeek(t.start)}
          >
            {t.text}
          </button>
          {" "}
        </Fragment>
      ))}
    </div>
  );
});

/* ---------- Output: player, waveform, transcript, downloads ---------- */

function OutputCard({ result }: { result: Result }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [width, setWidth] = useState(0);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [decode, setDecode] = useState<"idle" | "decoding" | "ready" | "failed">("idle");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [more, setMore] = useState(false);

  const isAudio = result.kind === "audio";
  const tokens = result.tokens && result.tokens.length > 0 ? result.tokens : null;
  const total = dur;
  const activeTok = tokens ? activeIndex(tokens, time) : -1;

  // Decode the audio for the waveform. Failure only removes the picture.
  useEffect(() => {
    if (!isAudio) return;
    let cancelled = false;
    setDecode("decoding");
    (async () => {
      let ctx: AudioContext | null = null;
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new Ctor() as AudioContext;
        const buf = await ctx.decodeAudioData(await result.blob.arrayBuffer());
        if (cancelled) return;
        setPeaks(computePeaks(buf.getChannelData(0), PEAK_BINS));
        setDur((d) => d || buf.duration);
        setDecode("ready");
      } catch {
        if (!cancelled) setDecode("failed");
      } finally {
        ctx?.close().catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [result, isAudio]);

  // Track the waveform's rendered width.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw the waveform, the played portion and the playhead.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !peaks || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(WAVE_H * dpr);
    const g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, WAVE_H);
    const css = getComputedStyle(cv);
    const on = css.getPropertyValue("--wave-on").trim() || "#4f7cff";
    const off = css.getPropertyValue("--wave-off").trim() || "#9ca3af";
    const head = css.getPropertyValue("--wave-head").trim() || "#111827";
    let max = 0;
    for (let i = 0; i < peaks.length; i++) if (peaks[i] > max) max = peaks[i];
    if (!max) max = 1;
    const n = peaks.length;
    const bw = width / n;
    const mid = WAVE_H / 2;
    const prog = total > 0 ? Math.min(1, time / total) : 0;
    for (let i = 0; i < n; i++) {
      const h = Math.max(2, (peaks[i] / max) * (WAVE_H - 8));
      g.fillStyle = (i + 0.5) / n <= prog ? on : off;
      g.fillRect(i * bw + bw * 0.2, mid - h / 2, Math.max(1, bw * 0.6), h);
    }
    g.fillStyle = head;
    g.fillRect(Math.min(width - 2, prog * width), 0, 2, WAVE_H);
  }, [peaks, width, time, total]);

  // Keep the time readout moving while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      const a = audioRef.current;
      if (a) setTime(a.currentTime);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (!a) return;
    const max = total || (Number.isFinite(a.duration) ? a.duration : 0);
    const v = Math.max(0, max ? Math.min(t, max) : t);
    a.currentTime = v;
    setTime(v);
  }, [total]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => setNote("Playback was blocked or failed. Try again."));
    } else {
      a.pause();
    }
  };

  const onSeekKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      seek(time + (e.key === "ArrowLeft" ? -5 : 5));
    }
  };

  const onWaveClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!total) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width > 0) seek(((e.clientX - r.left) / r.width) * total);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setNote("Copy failed. Select the text and copy it manually.");
    }
  };

  const downloadLink = (
    <a className={cx(shared.btn, shared.btnGhost, styles.linkBtn)} href={result.url} download={result.name}>
      <Icon name="download" />
      Download
    </a>
  );

  const showJson = Boolean(result.json) && (result.kind === "json" || (result.task === "timestamps" && !tokens));

  return (
    <div className={cx(shared.fadeIn, styles.outBody)}>
      <div className={styles.outHead}>
        <span className={styles.outName} title={result.label}>{result.label}</span>
        <span className={styles.outMeta}>
          {taskLabel(result.task)} &middot; {clockTime(result.createdAt)}
          {result.credits && <> &middot; {result.credits} credits</>}
        </span>
      </div>

      {note && <p className={styles.notice} role="status">{note}</p>}

      {isAudio && (
        <>
          <audio
            ref={audioRef}
            src={result.url}
            preload="metadata"
            hidden
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setDur(d);
            }}
            onPlay={() => { setPlaying(true); setNote(""); }}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setNote("This audio could not be played in the browser. Download it to listen.")}
          />

          <div ref={wrapRef} className={styles.waveWrap} onClick={onWaveClick}>
            <canvas
              ref={canvasRef}
              className={styles.wave}
              role="img"
              aria-label={`Waveform of ${result.name}, ${fmt(total)} long`}
              style={{ height: WAVE_H }}
            />
            {decode === "decoding" && (
              <div className={styles.waveOverlay}>
                <span className={styles.spinDot} aria-hidden="true" />
                Analyzing waveform&hellip;
              </div>
            )}
            {decode === "failed" && <div className={styles.waveNote}>Waveform unavailable for this format. Playback still works.</div>}
          </div>

          <div className={styles.playRow}>
            <button
              type="button"
              className={styles.playBtn}
              aria-label={playing ? "Pause" : "Play"}
              title={playing ? "Pause" : "Play"}
              onClick={toggle}
            >
              {playing ? (
                <svg viewBox="0 0 256 256" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
                  <rect x="56" y="48" width="48" height="160" rx="10" />
                  <rect x="152" y="48" width="48" height="160" rx="10" />
                </svg>
              ) : (
                <Icon name="play" size={18} />
              )}
            </button>
            <input
              type="range"
              className={cx(shared.range, styles.seek)}
              aria-label="Seek"
              aria-valuetext={`${fmt(time)} of ${fmt(total)}`}
              min={0}
              max={total || 1}
              step={0.05}
              value={Math.min(time, total || 1)}
              style={{ ["--pct" as any]: `${total ? (Math.min(time, total) / total) * 100 : 0}%` }}
              onChange={(e) => seek(Number(e.target.value))}
              onKeyDown={onSeekKey}
            />
            <span className={styles.time}>{fmt(time)} / {fmt(total)}</span>
            <button
              type="button"
              className={styles.moreBtn}
              aria-expanded={more}
              aria-label="More playback options"
              title="More playback options"
              onClick={() => setMore((m) => !m)}
            >
              &hellip;
            </button>
            {downloadLink}
          </div>
          {more && (
            <div className={styles.speedRow}>
              <Segmented
                size="sm"
                value={rate}
                onChange={setRate}
                options={RATES.map((r) => ({ value: r, label: `${r}x`, title: `Playback speed ${r}x` }))}
              />
            </div>
          )}
        </>
      )}

      {tokens && (
        <div className={styles.transcriptBox}>
          <div className={styles.sectionHead}>
            <span>Transcript</span>
          </div>
          <TokenText tokens={tokens} active={activeTok} onSeek={seek} />
        </div>
      )}

      {result.kind === "transcript" && result.body !== undefined && (
        <div className={styles.outBody}>
          <div className={styles.toolbar}>
            <Button variant="ghost" icon="copy" onClick={() => copyText(result.body || "")}>{copied ? "Copied" : "Copy"}</Button>
            {downloadLink}
          </div>
          {result.mono ? <pre className={styles.pre}>{result.body}</pre> : <div className={styles.prose}>{result.body}</div>}
        </div>
      )}

      {result.kind === "download" && (
        <div className={styles.dlCard}>
          <Icon name="cube" size={28} />
          <div className={styles.dlMeta}>
            <span className={styles.dlName}>{result.name}</span>
            <span className={styles.muted}>{fmtSize(result.blob.size)} &middot; ZIP download</span>
          </div>
          <a className={cx(shared.btn, shared.btnPrimary, styles.linkBtn)} href={result.url} download={result.name}>
            <Icon name="download" />
            Download
          </a>
        </div>
      )}

      {result.json && (
        <Advanced label={showJson ? "Response JSON" : "Response JSON (raw)"} defaultOpen={showJson}>
          <pre className={styles.pre}>{result.json}</pre>
        </Advanced>
      )}

      {result.kind === "json" && !result.json && result.body && (
        <pre className={styles.pre}>{result.body}</pre>
      )}
    </div>
  );
}

/* ---------- Studio ---------- */

export default function AudioStudio({ session, apiBase, apiPrefix, models }: StudioProps) {
  const [taskId, setTaskId] = useState<TaskId>("music");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [speechFormat, setSpeechFormat] = useState("mp3");
  const [transcriptFormat, setTranscriptFormat] = useState("json");
  const [language, setLanguage] = useState("");
  const [speed, setSpeed] = useState(1);
  const [duration, setDuration] = useState(10);
  const [file, setFile] = useState<File | null>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [inputError, setInputError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<Result[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [timings, setTimings] = useState(false);

  const historyRef = useRef<Result[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const selectedTask = TASKS.find((t) => t.id === taskId) ?? TASKS[0];
  // Speech with "Character timings" switches to the timestamps endpoint.
  const task = taskId === "speech" && timings ? TASKS.find((t) => t.id === "timestamps") ?? selectedTask : selectedTask;

  // Abort any in-flight request and drop every object URL on unmount.
  useEffect(() => () => {
    abortRef.current?.abort();
    historyRef.current.forEach((h) => URL.revokeObjectURL(h.url));
    historyRef.current = [];
  }, []);

  // Object URL for the input preview.
  useEffect(() => {
    if (!file) {
      setInputUrl("");
      return;
    }
    const u = URL.createObjectURL(file);
    setInputUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const modelsFor = (def: TaskDef): any[] =>
    apiPrefix !== "/v1" ? [] : dedupe(models.filter((m) => m?.is_ready !== false && supportsTask(m, def)));

  const options = modelsFor(task);
  const available = apiPrefix === "/v1" ? options.length > 0 : task.id === "music";

  const selected = options.find((m) => slug(m) === model);
  const selectedUnit = selected ? billingUnit(selected) : "";
  const priceLabel = selected ? formatModelPrice(selected) : null;
  const isOpenAI = /openai/i.test(model || task.defaultModel);
  const current = history.find((h) => h.id === activeId) ?? null;
  const clampDuration = () => Math.min(90, Math.max(1, Math.round(Number(duration)) || 10));

  const selectTask = (id: TaskId) => {
    if (id === taskId) return;
    abortRef.current?.abort();
    setTaskId(id);
    setModel("");
    setError("");
    setNotice("");
    setActiveId(null);
    setBusy(false);
  };

  const acceptFile = (f: File | null) => {
    setError("");
    if (!f) {
      setFile(null);
      setInputError("");
      return;
    }
    if (f.size > MAX_BYTES) {
      setInputError(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is 50 MB.`);
      return;
    }
    setInputError("");
    setFile(f);
  };

  const pushResult = (item: Result) => {
    const next = [item, ...historyRef.current];
    next.slice(MAX_HISTORY).forEach((h) => URL.revokeObjectURL(h.url));
    historyRef.current = next.slice(0, MAX_HISTORY);
    setHistory(historyRef.current);
  };

  const run = async () => {
    if (!session) {
      setError("Sign in to run audio requests.");
      return;
    }
    if (!available) return;
    if (task.multipart && !file) {
      setError("Choose or record an audio file first.");
      return;
    }
    if (task.id === "music" && !prompt.trim()) {
      setError("Describe the audio you want to generate.");
      return;
    }
    if ((task.id === "speech" || task.id === "timestamps") && !text.trim()) {
      setError("Enter the text to speak.");
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError("");
    setNotice("");
    setActiveId(null);

    const url = `${apiBase}${apiPrefix}${task.path}`;
    const auth = { Authorization: `Bearer ${session?.access_token}` };
    const format = task.id === "speech" ? speechFormat : task.id === "transcribe" ? transcriptFormat : "";
    const label = task.multipart ? file?.name || task.label : snippet(task.id === "music" ? prompt : text);

    try {
      let res: Response;
      if (task.multipart) {
        const form = new FormData();
        form.append("file", file as File);
        if (model) form.append("model", model);
        if (language.trim()) form.append("language", language.trim());
        if (task.id === "voice-changer" && voice.trim()) form.append("voice", voice.trim());
        if (task.id === "transcribe") form.append("response_format", transcriptFormat);
        res = await fetch(url, { method: "POST", headers: auth, body: form, signal: ctrl.signal });
      } else if (task.id === "music") {
        const body: Record<string, any> = { prompt: prompt.trim(), duration_seconds: clampDuration() };
        if (model) body.model = model;
        res = await fetch(url, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } else {
        const body: Record<string, any> = { input: text.trim() };
        if (model) body.model = model;
        if (voice.trim()) body.voice = voice.trim();
        if (task.id === "speech") body.response_format = speechFormat;
        if (speed && speed !== 1) body.speed = Number(speed);
        if (selectedUnit === "seconds") body.duration = clampDuration();
        res = await fetch(url, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      }

      const draft = await readResult(res, task.id, format);
      const item: Result = { ...draft, id: uid(), task: task.id, label, createdAt: Date.now() };
      pushResult(item);
      setActiveId(item.id);
    } catch (e: any) {
      if (ctrl.signal.aborted) setNotice("Request cancelled.");
      else setError(String(e?.message || "Request failed").slice(0, 500));
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setBusy(false);
    }
  };

  const hasTask = (id: TaskId): boolean => {
    if (apiPrefix !== "/v1") return id === "music";
    const def = TASKS.find((t) => t.id === id);
    return def ? modelsFor(def).length > 0 : false;
  };
  const chipIds = CHIP_IDS.filter((id) => (id === "speech" ? hasTask("speech") || hasTask("timestamps") : hasTask(id)));
  const shownChips = chipIds.length ? chipIds : CHIP_IDS.slice(0, 1);
  const modelReason = !available
    ? apiPrefix !== "/v1" ? "Only Music is available on this API." : "No model in the catalog supports this task yet."
    : "";
  const isSpeech = task.id === "speech" || task.id === "timestamps";
  const hasAdvanced = task.id !== "voice-isolator" && task.id !== "stem-separation";

  return (
    <div className={shared.studio}>
      <aside className={shared.controls} aria-label="Audio controls">
        <div className={styles.rail}>
          <div className={styles.chipRow} role="tablist" aria-label="Task">
            {shownChips.map((id) => {
              const on = taskId === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={cx(styles.taskChip, on && styles.taskChipOn)}
                  onClick={() => selectTask(id)}
                >
                  {TASKS.find((t) => t.id === id)?.label}
                </button>
              );
            })}
          </div>

          {modelReason && <p className={styles.note}>{modelReason}</p>}

          {options.length > 0 && (
            <ModelSelect
              models={options}
              value={model}
              onChange={setModel}
              defaultLabel={task.defaultModel ? `Default (${task.defaultModel})` : "Default"}
            />
          )}

          {task.id === "music" && (
            <textarea
              className={shared.textarea}
              rows={3}
              aria-label="Prompt"
              placeholder="Describe the music or sound effect"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          )}

          {isSpeech && (
            <textarea
              className={shared.textarea}
              rows={5}
              aria-label="Text"
              placeholder="Type the text to speak"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}

          {task.multipart && (
            <div className={styles.rail}>
              <Dropzone accept={ACCEPT} file={file} onFile={acceptFile} kind="audio" hint="Drop audio or click to browse (up to 50 MB)" />
              {inputError && <ErrorNote onDismiss={() => setInputError("")}>{inputError}</ErrorNote>}
              <Recorder disabled={busy} onRecorded={acceptFile} />
              {file && inputUrl && <InputPreview file={file} />}
            </div>
          )}

          {hasAdvanced && (
            <Advanced>
              <div className={styles.rail}>
                {task.id === "music" && (
                  <>
                    <Range label="Duration" value={duration} min={1} max={90} onChange={setDuration} format={(v) => `${v}s`} />
                    <div className={styles.chips} aria-label="Sample prompts">
                      {MUSIC_SAMPLES.map((s) => (
                        <button key={s.label} type="button" className={styles.chipBtn} title={s.prompt} onClick={() => setPrompt(s.prompt)}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {isSpeech && (
                  <>
                    <Field label="Voice">
                      <input className={shared.input} type="text" placeholder="e.g. alloy" value={voice} onChange={(e) => setVoice(e.target.value)} />
                    </Field>
                    {isOpenAI && (
                      <div className={styles.chips} aria-label="Voice presets">
                        {OPENAI_VOICES.map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={cx(styles.chipBtn, voice === v && styles.chipOn)}
                            aria-pressed={voice === v}
                            onClick={() => setVoice(v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                    {task.id === "speech" && (
                      <Field label="Format">
                        <select className={shared.select} value={speechFormat} onChange={(e) => setSpeechFormat(e.target.value)}>
                          {SPEECH_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </Field>
                    )}
                    <Range label="Speed" value={speed} min={0.25} max={4} step={0.25} onChange={setSpeed} format={(v) => `${v.toFixed(2)}x`} />
                    {selectedUnit === "seconds" && (
                      <Range label="Billed duration" value={duration} min={1} max={90} onChange={setDuration} format={(v) => `${v}s`} />
                    )}
                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={timings}
                        onChange={(e) => { setTimings(e.target.checked); setModel(""); }}
                      />
                      Character timings
                    </label>
                  </>
                )}

                {task.id === "voice-changer" && (
                  <Field label="Target voice">
                    <input className={shared.input} type="text" placeholder="Voice ID" value={voice} onChange={(e) => setVoice(e.target.value)} />
                  </Field>
                )}

                {task.id === "transcribe" && (
                  <>
                    <Field label="Language">
                      <input className={shared.input} type="text" placeholder="e.g. en" value={language} onChange={(e) => setLanguage(e.target.value)} />
                    </Field>
                    <Field label="Response format">
                      <select className={shared.select} value={transcriptFormat} onChange={(e) => setTranscriptFormat(e.target.value)}>
                        {TRANSCRIPT_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </Field>
                  </>
                )}
              </div>
            </Advanced>
          )}

          <Button icon="play" busy={busy} disabled={!available} onClick={run} className={styles.runBtn}>
            {task.action}
          </Button>
        </div>
      </aside>

      <section className={shared.stage} aria-label="Audio output">
        {error && <ErrorNote onDismiss={() => setError("")}>{error}</ErrorNote>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}

        {busy && (
          <div className={cx(shared.fadeIn, styles.busy)}>
            <StatusLine state="pending">{task.action}&hellip;</StatusLine>
            <div className={cx(shared.skeleton, styles.busyBar)} />
            <div>
              <Button variant="ghost" icon="x" onClick={() => abortRef.current?.abort()}>Cancel</Button>
            </div>
          </div>
        )}

        {!busy && current && <OutputCard key={current.id} result={current} />}

        {!busy && !current && (
          <div className={styles.empty}>
            <Icon name="music" size={28} />
            <p>{history.length ? "Pick a result from History." : "Run a task to see its output here."}</p>
          </div>
        )}

        {history.length > 0 && (
          <Advanced label="History">
            <ul className={styles.history}>
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    aria-pressed={h.id === activeId}
                    className={cx(styles.histItem, h.id === activeId && styles.histOn)}
                    onClick={() => setActiveId(h.id)}
                  >
                    <span className={styles.histLabel}>{h.label}</span>
                    <span className={styles.histMeta}>{taskLabel(h.task)} &middot; {clockTime(h.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Advanced>
        )}
      </section>
    </div>
  );
}
