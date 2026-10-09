"use client";

import { useState } from "react";
import styles from "./Panel.module.css";
import { billingUnit, formatModelPrice, slug } from "../../../lib/modelPricing";

type Mode =
  | "generations"
  | "speech"
  | "timestamps"
  | "transcribe"
  | "voice-changer"
  | "voice-isolator"
  | "stem-separation";

interface Props {
  session: any;
  apiBase: string;
  apiPrefix: "/v1" | "/gen";
  models: any[];
}

interface ModeDef {
  id: Mode;
  label: string;
  path: string;
  defaultModel: string;
  kind: "json" | "multipart";
  blurb: string;
}

const MODES: ModeDef[] = [
  { id: "generations", label: "Music / SFX", path: "/audio/generations", defaultModel: "", kind: "json", blurb: "Text to music and sound effects." },
  { id: "speech", label: "Text to speech", path: "/audio/speech", defaultModel: "openai-tts-1", kind: "json", blurb: "OpenAI-compatible TTS. Billed per input character, byte or output second." },
  { id: "timestamps", label: "TTS + timestamps", path: "/audio/speech/with-timestamps", defaultModel: "elevenlabs-eleven-v3", kind: "json", blurb: "Text to speech with character-level timings." },
  { id: "transcribe", label: "Transcribe", path: "/audio/transcriptions", defaultModel: "whisper-large-v3", kind: "multipart", blurb: "Speech to text. Billed per second of input audio." },
  { id: "voice-changer", label: "Voice changer", path: "/audio/voice-changer", defaultModel: "elevenlabs-eleven-multilingual-sts-v2", kind: "multipart", blurb: "Speech to speech voice conversion. Billed per second of input audio." },
  { id: "voice-isolator", label: "Voice isolator", path: "/audio/voice-isolator", defaultModel: "elevenlabs-voice-isolator", kind: "multipart", blurb: "Remove background noise while keeping speech. Billed per second of input audio." },
  { id: "stem-separation", label: "Stem separation", path: "/audio/stem-separation", defaultModel: "elevenlabs-stem-separation", kind: "multipart", blurb: "Split a track into stems (ZIP download). Billed per second of input audio." },
];

const SPEECH_FORMATS = ["mp3", "opus", "aac", "flac", "wav", "pcm"];
const TRANSCRIPT_FORMATS = ["json", "text", "verbose_json", "srt", "vtt"];

const resettable = () => ({ audioUrl: "", text: "", downloadUrl: "", downloadName: "", credits: "" });

export default function AudioPlayground({ session, apiBase, apiPrefix, models }: Props) {
  const [mode, setMode] = useState<Mode>("generations");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState(resettable);

  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [speechFormat, setSpeechFormat] = useState("mp3");
  const [transcriptFormat, setTranscriptFormat] = useState("json");
  const [speed, setSpeed] = useState(1);
  const [duration, setDuration] = useState(10);
  const [language, setLanguage] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const modes = apiPrefix === "/v1" ? MODES : MODES.filter((m) => m.id === "generations");
  const active: ModeDef = modes.find((m) => m.id === mode) || modes[0];

  const isReady = (m: any) => m?.is_ready !== false;

  const modelsForMode = (m: Mode): any[] => {
    if (apiPrefix !== "/v1") return [];
    return models.filter((mod) => {
      if (!isReady(mod)) return false;
      const u = billingUnit(mod);
      if (m === "generations") return u === "seconds";
      if (m === "speech" || m === "timestamps") return u === "input_chars" || u === "input_bytes" || u === "seconds";
      return u === "input_seconds";
    });
  };

  const options = modelsForMode(active.id);
  const selected = options.find((mod) => slug(mod) === model);
  const selectedUnit = selected ? billingUnit(selected) : "";
  const priceLabel = selected ? formatModelPrice(selected) : null;

  const authHeaders = (): Record<string, string> => ({ Authorization: `Bearer ${session?.access_token}` });

  const fail = (msg: string) => {
    setError(msg);
    setBusy(false);
  };

  const handleResponse = async (r: Response) => {
    const charged = r.headers.get("X-Payg-Credits-Charged");
    const contentType = (r.headers.get("content-type") || "").toLowerCase();

    if (!r.ok) {
      const body = await r.text();
      let msg = body;
      try {
        const parsed = JSON.parse(body);
        msg = parsed.detail || (typeof parsed.error === "object" ? parsed.error?.message : parsed.error) || body;
      } catch { /* keep raw body */ }
      throw new Error(String(msg).slice(0, 500));
    }

    const next = resettable();
    next.credits = charged || "";

    if (contentType.includes("application/json")) {
      const data = await r.json();
      let audioB64: string | null = null;
      if (data && typeof data.audio === "string" && data.audio.length > 64) {
        audioB64 = data.audio;
        delete data.audio;
      }
      next.text = JSON.stringify(data, null, 2);
      if (audioB64) next.audioUrl = `data:audio/mpeg;base64,${audioB64}`;
      setOut(next);
      return;
    }

    if (contentType.startsWith("text/")) {
      next.text = await r.text();
      setOut(next);
      return;
    }

    const blob = await r.blob();
    if (contentType.startsWith("audio/")) {
      next.audioUrl = URL.createObjectURL(blob);
      setOut(next);
      return;
    }

    const disposition = r.headers.get("content-disposition") || "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const name = match?.[1] || (contentType.includes("zip") ? "stems.zip" : "result.bin");
    next.downloadUrl = URL.createObjectURL(blob);
    next.downloadName = name;
    setOut(next);
  };

  const run = async () => {
    if (!session) return alert("Sign in required");
    if (active.kind === "multipart" && !file) {
      setError("Choose an audio file first.");
      return;
    }
    if (active.id === "generations" && !prompt.trim()) {
      setError("Describe the audio you want to generate.");
      return;
    }
    if ((active.id === "speech" || active.id === "timestamps") && !text.trim()) {
      setError("Enter the text to speak.");
      return;
    }

    setBusy(true);
    setError("");
    setOut(resettable());

    try {
      const url = `${apiBase}${apiPrefix}${active.path}`;

      if (active.kind === "multipart") {
        const form = new FormData();
        form.append("file", file as File);
        if (model) form.append("model", model);
        if (language.trim()) form.append("language", language.trim());
        if (active.id === "voice-changer" && voice.trim()) form.append("voice", voice.trim());
        if (active.id === "transcribe") form.append("response_format", transcriptFormat);
        await handleResponse(await fetch(url, { method: "POST", headers: authHeaders(), body: form }));
      } else if (active.id === "generations") {
        const body: Record<string, any> = { prompt: prompt.trim(), duration_seconds: Number(duration) || 10 };
        if (model) body.model = model;
        await handleResponse(await fetch(url, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }));
      } else {
        const body: Record<string, any> = { input: text.trim() };
        if (model) body.model = model;
        if (voice.trim()) body.voice = voice.trim();
        if (active.id === "speech") body.response_format = speechFormat;
        if (speed && speed !== 1) body.speed = Number(speed);
        if (selectedUnit === "seconds") body.duration = Number(duration) || 10;
        await handleResponse(await fetch(url, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }));
      }
    } catch (e: any) {
      fail(e?.message || "Request failed");
      return;
    }
    setBusy(false);
  };

  return (
    <div>
      <div className={styles.tabs}>
        {modes.map((m) => (
          <button
            key={m.id}
            className={`playground-tab ${styles.playgroundTab} ${active.id === m.id ? styles.active : ""}`}
            onClick={() => { setMode(m.id); setError(""); setOut(resettable()); setModel(""); }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={`${styles.playgroundPanel} ${styles.active}`}>
        <p className={`${styles.muted} ${styles.tiny}`} style={{ margin: 0 }}>
          <code>POST {apiPrefix}{active.path}</code> &mdash; {active.blurb}
        </p>

        {options.length > 0 && (
          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">{active.defaultModel ? `Default (${active.defaultModel})` : "Default"}</option>
              {options.map((m: any, i: number) => (
                <option key={i} value={slug(m)}>
                  {m.name || slug(m)}{formatModelPrice(m) ? ` (${formatModelPrice(m)})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {(active.id === "generations") && (
          <label>
            Prompt
            <textarea rows={4} placeholder="Describe audio / music / sfx..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
        )}

        {(active.id === "speech" || active.id === "timestamps") && (
          <label>
            Text
            <textarea rows={4} placeholder="Type the text to speak..." value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        )}

        {active.kind === "multipart" && (
          <label>
            Audio file (max 50 MB)
            <input type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.opus,.webm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        )}

        {(active.id === "speech" || active.id === "timestamps" || active.id === "voice-changer") && (
          <label>
            Voice {active.id === "voice-changer" ? "(target voice ID)" : "(optional)"}
            <input type="text" placeholder={active.id === "voice-changer" ? "e.g. 21m00Tao..." : "e.g. alloy"} value={voice} onChange={(e) => setVoice(e.target.value)} />
          </label>
        )}

        {active.id === "transcribe" && (
          <label>
            Language (optional)
            <input type="text" placeholder="e.g. en" value={language} onChange={(e) => setLanguage(e.target.value)} />
          </label>
        )}

        {active.id === "speech" && (
          <label>
            Output format
            <select value={speechFormat} onChange={(e) => setSpeechFormat(e.target.value)}>
              {SPEECH_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
        )}

        {active.id === "transcribe" && (
          <label>
            Response format
            <select value={transcriptFormat} onChange={(e) => setTranscriptFormat(e.target.value)}>
              {TRANSCRIPT_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
        )}

        {(active.id === "speech" || active.id === "timestamps") && (
          <label>
            Speed
            <input type="number" min={0.25} max={4} step={0.25} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
        )}

        {(active.id === "generations" || selectedUnit === "seconds") && (
          <label>
            {active.id === "generations" ? "Duration (seconds, 1-90)" : "Billed duration (seconds)"}
            <input type="number" min={1} max={90} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </label>
        )}

        <button onClick={run} disabled={busy}>{busy ? "Generating\u2026" : "Run request"}</button>

        {priceLabel && (
          <p className={`${styles.muted} ${styles.tiny}`} style={{ margin: 0 }}>Rate: {priceLabel}</p>
        )}
        {out.credits && (
          <p className={`${styles.muted} ${styles.tiny}`} style={{ margin: 0 }}>Credits charged: {out.credits}</p>
        )}
        {error && <div className={styles.threeError}>{error}</div>}
        {out.audioUrl && <audio controls src={out.audioUrl} style={{ width: "100%" }} />}
        {out.downloadUrl && (
          <a className={styles.threeDownloadBtn} href={out.downloadUrl} download={out.downloadName}>Download {out.downloadName}</a>
        )}
        {out.text && <pre className={styles.output}>{out.text}</pre>}
      </div>
    </div>
  );
}
