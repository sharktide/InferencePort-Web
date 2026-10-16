"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import shared from "./Playground.module.css";
import styles from "./RealtimeStudio.module.css";
import type { StudioProps } from "./types";
import { realtimeModels, slug } from "./models";
import { useOptionalOrgContext } from "../OrgContext";
import { Advanced, Button, cx, EmptyStage, ErrorNote, Field, ModelSelect, StatusLine } from "./ui";

const DEFAULT_MODEL = "gpt-realtime-2.1";
const PCM_RATE = 24000; // what the API meters by default and what we send
const SEND_SAMPLES = 2400; // ~100 ms per append
const MAX_LOG = 60;

type Phase = "idle" | "connecting" | "live" | "failed";

interface Turn { id: string; role: "user" | "assistant"; text: string; final: boolean }

const CLOSE_REASONS: Record<number, string> = {
  4400: "The request was rejected as invalid.",
  4401: "You are not signed in, or the key was rejected.",
  4402: "You are out of credits. Add credits to keep going.",
  4403: "Your organization's policy does not allow this model.",
  4404: "That realtime model was not found.",
  4408: "The session reached its maximum length.",
  4429: "Too many realtime sessions are already open for this account.",
  1011: "The realtime service is unavailable. Try again shortly.",
};

const num = (v: any): number => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Cost of a response.done usage object at a model's per-million-token rate card (estimate for display). */
export function estimateTokenCost(usage: any, rates: Record<string, any> | undefined): number {
  if (!usage || !rates) return 0;
  const inD = usage.input_token_details || {};
  const outD = usage.output_token_details || {};
  const cached = num(inD.cached_tokens);
  const text = num(inD.text_tokens) || (inD.audio_tokens || inD.image_tokens ? 0 : num(usage.input_tokens));
  const audio = num(inD.audio_tokens);
  const image = num(inD.image_tokens);
  const textOut = num(outD.text_tokens) || (outD.audio_tokens ? 0 : num(usage.output_tokens));
  const cachedText = Math.min(cached, text);
  const cost =
    (Math.max(0, text - cachedText) * num(rates.text_in) +
      cachedText * num(rates.cached_text_in) +
      audio * num(rates.audio_in) +
      image * num(rates.image_in) +
      textOut * num(rates.text_out) +
      num(outD.audio_tokens) * num(rates.audio_out)) / 1_000_000;
  return cost;
}

const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
}
registerProcessor('pcm-capture', PcmCapture);`;

const toBase64 = (bytes: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Linear-interpolation resample of mono float samples to PCM_RATE, as little-endian int16 bytes. */
export function resampleToPcm16(input: Float32Array, fromRate: number): Uint8Array {
  const ratio = fromRate / PCM_RATE;
  const length = Math.max(0, Math.floor(input.length / ratio));
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const s = input[i0] * (1 - frac) + (input[Math.min(i0 + 1, input.length - 1)] ?? 0) * frac;
    out[i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }
  return new Uint8Array(out.buffer);
}

const isConversational = (m: any) => Array.isArray(m?.output_modalities) && m.output_modalities.includes("audio");

const defaultSession = (m: any, voice: string, instructions: string) =>
  JSON.stringify(
    isConversational(m)
      ? { modalities: ["text", "audio"], instructions, voice: voice || undefined, input_audio_format: "pcm16", output_audio_format: "pcm16", turn_detection: { type: "server_vad" } }
      : { input_audio_format: "pcm16" },
    null,
    2,
  );

export default function RealtimeStudio({ session, apiBase, apiPrefix, models }: StudioProps) {
  const org = useOptionalOrgContext();
  const catalog = useMemo(() => realtimeModels(models), [models]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [voice, setVoice] = useState("");
  const [instructions, setInstructions] = useState("You are a friendly assistant. Keep replies short.");
  const [sessionJson, setSessionJson] = useState("");
  const [sessionEdited, setSessionEdited] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [spent, setSpent] = useState(0);
  const [seconds, setSeconds] = useState(0);

  const ws = useRef<WebSocket | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const node = useRef<AudioWorkletNode | null>(null);
  const pending = useRef<Float32Array[]>([]);
  const pendingLen = useRef(0);
  const sentSeconds = useRef(0);
  const playAt = useRef(0);
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const selected = catalog.find((m) => slug(m) === model);
  const talks = isConversational(selected);
  const voices: string[] = Array.isArray(selected?.voices) ? selected.voices : [];

  useEffect(() => {
    if (catalog.length && !catalog.some((m) => slug(m) === model)) setModel(slug(catalog[0]));
  }, [catalog, model]);

  useEffect(() => {
    if (!sessionEdited) setSessionJson(defaultSession(selected, voice, instructions));
  }, [selected, voice, instructions, sessionEdited]);

  useEffect(() => {
    if (voices.length && !voices.includes(voice)) setVoice(voices.includes("marin") ? "marin" : voices[0]);
    if (!voices.length && voice) setVoice("");
  }, [voices, voice]);

  const pushLog = useCallback((line: string) => setLog((l) => [...l.slice(-(MAX_LOG - 1)), line]), []);

  const stopPlayback = useCallback(() => {
    sources.current.forEach((s) => { try { s.stop(); } catch { /* already ended */ } });
    sources.current.clear();
    playAt.current = 0;
  }, []);

  const teardownAudio = useCallback(() => {
    node.current?.disconnect();
    node.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    stopPlayback();
    ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    pending.current = [];
    pendingLen.current = 0;
    setMicOn(false);
  }, [stopPlayback]);

  const disconnect = useCallback(() => {
    const sock = ws.current;
    ws.current = null;
    if (sock && sock.readyState <= WebSocket.OPEN) sock.close(1000);
    teardownAudio();
    setPhase((p) => (p === "failed" ? p : "idle"));
  }, [teardownAudio]);

  useEffect(() => () => { disconnect(); }, [disconnect]);

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const play = useCallback((b64: string) => {
    const audio = ctx.current;
    if (!audio) return;
    const bin = atob(b64);
    const n = Math.floor(bin.length / 2);
    if (!n) return;
    const buf = audio.createBuffer(1, n, PCM_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      ch[i] = (v > 0x7fff ? v - 0x10000 : v) / 0x8000;
    }
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.connect(audio.destination);
    const start = Math.max(audio.currentTime + 0.02, playAt.current);
    src.start(start);
    playAt.current = start + buf.duration;
    sources.current.add(src);
    src.onended = () => sources.current.delete(src);
  }, []);

  const upsertTurn = useCallback((id: string, role: Turn["role"], patch: (t: Turn) => Turn) => {
    setTurns((ts) => {
      const i = ts.findIndex((t) => t.id === id);
      if (i === -1) return [...ts, patch({ id, role, text: "", final: false })];
      const copy = ts.slice();
      copy[i] = patch(copy[i]);
      return copy;
    });
  }, []);

  const onEvent = useCallback((ev: any) => {
    const type: string = ev?.type || "";
    if (type !== "response.output_audio.delta" && type !== "response.audio.delta" && !type.endsWith(".delta")) pushLog(type);
    switch (type) {
      case "response.output_audio.delta":
      case "response.audio.delta":
        if (typeof ev.delta === "string") play(ev.delta);
        break;
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
      case "response.output_text.delta":
      case "response.text.delta":
        upsertTurn(String(ev.item_id || ev.response_id || "assistant"), "assistant", (t) => ({ ...t, text: t.text + (ev.delta || "") }));
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        upsertTurn(String(ev.item_id || ev.response_id || "assistant"), "assistant", (t) => ({ ...t, text: ev.transcript ?? t.text, final: true }));
        break;
      case "conversation.item.input_audio_transcription.delta":
        upsertTurn(String(ev.item_id || "user"), "user", (t) => ({ ...t, text: t.text + (ev.delta || "") }));
        break;
      case "conversation.item.input_audio_transcription.completed":
        upsertTurn(String(ev.item_id || "user"), "user", (t) => ({ ...t, text: ev.transcript ?? t.text, final: true }));
        break;
      case "input_audio_buffer.speech_started":
        stopPlayback();
        break;
      case "response.done": {
        const usage = ev?.response?.usage;
        if (usage) setSpent((s) => s + estimateTokenCost(usage, selected?.realtime_pricing_per_million_tokens));
        break;
      }
      case "error":
        setError(ev?.error?.message || "The realtime API reported an error.");
        break;
      default:
        break;
    }
  }, [play, pushLog, selected, stopPlayback, upsertTurn]);

  const flush = useCallback((from: number) => {
    const sock = ws.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) { pending.current = []; pendingLen.current = 0; return; }
    const all = new Float32Array(pendingLen.current);
    let o = 0;
    for (const c of pending.current) { all.set(c, o); o += c.length; }
    pending.current = [];
    pendingLen.current = 0;
    const bytes = resampleToPcm16(all, from);
    sentSeconds.current += bytes.length / 2 / PCM_RATE;
    sock.send(JSON.stringify({ type: "input_audio_buffer.append", audio: toBase64(bytes) }));
  }, []);

  const startMic = useCallback(async () => {
    const audio = new AudioContext();
    ctx.current = audio;
    await audio.resume().catch(() => undefined);
    await audio.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));
    const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    stream.current = media;
    const source = audio.createMediaStreamSource(media);
    const capture = new AudioWorkletNode(audio, "pcm-capture");
    capture.port.onmessage = (e: MessageEvent<Float32Array>) => {
      pending.current.push(e.data);
      pendingLen.current += e.data.length;
      if (pendingLen.current >= (SEND_SAMPLES * audio.sampleRate) / PCM_RATE) flush(audio.sampleRate);
    };
    source.connect(capture);
    node.current = capture;
    setMicOn(true);
  }, [flush]);

  const connect = async () => {
    if (!session?.access_token) return;
    let extra: Record<string, unknown> = {};
    try {
      const parsed = sessionJson.trim() ? JSON.parse(sessionJson) : {};
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      extra = parsed;
    } catch {
      setError("The session JSON in Advanced is not a valid JSON object.");
      return;
    }
    setError("");
    setNote("");
    setTurns([]);
    setLog([]);
    setSpent(0);
    setSeconds(0);
    sentSeconds.current = 0;
    setPhase("connecting");

    const url = new URL(`${apiBase.replace(/^http/, "ws")}/v1/realtime`);
    url.searchParams.set("model", model);
    if (org?.activeSlug) url.searchParams.set("org", org.activeSlug);
    const sock = new WebSocket(url.toString(), ["realtime", `openai-insecure-api-key.${session.access_token}`]);
    ws.current = sock;
    let opened = false;

    sock.onopen = async () => {
      opened = true;
      setPhase("live");
      sock.send(JSON.stringify({ type: "session.update", session: extra }));
      try {
        await startMic();
      } catch (e) {
        teardownAudio();
        if (talks) {
          // Still usable as a text chat: replies just play without a microphone
          ctx.current = new AudioContext();
          void ctx.current.resume().catch(() => undefined);
          setNote("Microphone unavailable, so this session is text only.");
        } else {
          setError("This model needs microphone audio, and the microphone could not be started.");
          disconnect();
        }
      }
    };
    sock.onmessage = (m) => {
      if (typeof m.data !== "string") return;
      try { onEvent(JSON.parse(m.data)); } catch { /* ignore non-JSON frames */ }
    };
    sock.onerror = () => { /* the close event carries the reason */ };
    sock.onclose = (e) => {
      if (ws.current !== sock) return;
      ws.current = null;
      teardownAudio();
      const reason = CLOSE_REASONS[e.code];
      if (reason) setError((prev) => prev || reason);
      else if (!opened) setError("Could not reach the realtime API.");
      setPhase(reason || !opened ? "failed" : "idle");
    };
  };

  const sendText = () => {
    const sock = ws.current;
    const text = draft.trim();
    if (!sock || sock.readyState !== WebSocket.OPEN || !text) return;
    sock.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } }));
    sock.send(JSON.stringify({ type: "response.create" }));
    upsertTurn(`local-${Date.now()}`, "user", (t) => ({ ...t, text, final: true }));
    setDraft("");
  };

  const commit = () => {
    const sock = ws.current;
    if (sock?.readyState === WebSocket.OPEN) {
      if (pendingLen.current && ctx.current) flush(ctx.current.sampleRate);
      sock.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    }
  };

  if (apiPrefix !== "/v1") {
    return (
      <EmptyStage icon="mic" title="Realtime runs on the P2G API">
        Switch the source to P2G API to start a live session. Sessions are billed from your credits as they run.
      </EmptyStage>
    );
  }

  const perSecond = num(selected?.input_price_per_second);
  const estimate = perSecond > 0 ? sentSeconds.current * perSecond : spent;
  const live = phase === "live";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className={shared.studio}>
      <aside className={cx(shared.controls, styles.rail)} aria-label="Realtime settings">
        <ModelSelect models={catalog} value={model} onChange={setModel} label="Model" hint={catalog.length ? undefined : "No realtime models are available right now."} />

        {talks && voices.length > 0 && (
          <Field label="Voice">
            <select className={shared.select} value={voice} onChange={(e) => setVoice(e.target.value)} disabled={live}>
              {voices.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
        )}

        {talks && (
          <Field label="Instructions">
            <textarea className={shared.textarea} rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={live} />
          </Field>
        )}

        {live || phase === "connecting" ? (
          <Button variant="danger" icon="stop" onClick={disconnect} className={styles.submit}>End session</Button>
        ) : (
          <Button icon="mic" onClick={() => void connect()} disabled={!catalog.length} className={styles.submit}>
            {talks ? "Start conversation" : "Start transcribing"}
          </Button>
        )}

        <ErrorNote onDismiss={() => setError("")}>{error}</ErrorNote>
        {note && <p className={shared.hint}>{note}</p>}

        <Advanced>
          <div className={styles.advBody}>
            <Field label="session.update" hint="Sent when the socket opens. Edit it to match the model's protocol; leave empty to send nothing.">
              <textarea
                className={cx(shared.textarea, shared.mono)}
                rows={8}
                spellCheck={false}
                value={sessionJson}
                disabled={live}
                onChange={(e) => { setSessionJson(e.target.value); setSessionEdited(true); }}
              />
            </Field>
            {sessionEdited && (
              <button type="button" className={styles.linkBtn} disabled={live} onClick={() => setSessionEdited(false)}>Reset to default</button>
            )}
          </div>
        </Advanced>
      </aside>

      <section className={shared.stage} aria-label="Realtime session">
        <div className={styles.bar}>
          <StatusLine state={phase === "failed" ? "failed" : live ? "done" : phase === "connecting" ? "pending" : "pending"}>
            {phase === "connecting" ? "Connecting" : live ? (micOn ? "Live · listening" : "Live") : phase === "failed" ? "Disconnected" : "Not connected"}
          </StatusLine>
          <span className={styles.spacer} />
          {(live || seconds > 0) && <span className={styles.meta} title="Session time">{mm}:{ss}</span>}
          {(live || estimate > 0) && <span className={styles.meta} title="Estimated from usage reported during this session; exact charges are in Activity">≈ ${estimate.toFixed(4)}</span>}
          {live && !talks && <Button variant="ghost" onClick={commit}>Commit audio</Button>}
        </div>

        {turns.length === 0 ? (
          <EmptyStage icon="mic" title={live ? "Listening…" : "No session yet"}>
            {talks
              ? "Start a conversation and speak, or type a message once connected. Replies are played back and transcribed here."
              : "Start transcribing and speak. Incremental and final transcripts appear here as they arrive."}
          </EmptyStage>
        ) : (
          <ol className={styles.turns} aria-live="polite">
            {turns.map((t) => (
              <li key={t.id} className={cx(styles.turn, t.role === "user" ? styles.user : styles.assistant, !t.final && styles.partial)}>
                <span className={styles.role}>{t.role === "user" ? (talks ? "You" : "Transcript") : "Assistant"}</span>
                <span>{t.text || "…"}</span>
              </li>
            ))}
          </ol>
        )}

        {live && talks && (
          <form className={styles.compose} onSubmit={(e) => { e.preventDefault(); sendText(); }}>
            <input className={shared.input} aria-label="Message" placeholder="Type a message instead of speaking…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" icon="arrow-up" disabled={!draft.trim()} aria-label="Send message" />
          </form>
        )}

        {log.length > 0 && (
          <details className={styles.log}>
            <summary>Event log ({log.length})</summary>
            <pre>{log.join("\n")}</pre>
          </details>
        )}
      </section>
    </div>
  );
}
