"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./Panel.module.css";
import AudioPlayground from "./AudioPlayground";
import { formatModelPrice } from "../../../lib/modelPricing";

interface Props { session: any; config: any; apiBase: string; }

function isTextModel(m: any) {
  const i = Array.isArray(m?.input_modalities) ? m.input_modalities : [];
  const o = Array.isArray(m?.output_modalities) ? m.output_modalities : [];
  return i.includes("text") && o.includes("text");
}

function slug(m: any) {
  return m?.id || m?.upstream_id || m?.openrouter?.slug || "";
}

function getVideoModels(allModels: any[]) {
  return allModels.filter((m: any) => m.output_modalities?.includes("video") && m.is_ready !== false);
}

function getImageModels(allModels: any[]) {
  return allModels.filter((m: any) => m.output_modalities?.includes("image") && m.is_ready !== false);
}

export default function GenApiPanel({ session, config, apiBase }: Props) {
  const [allModels, setAllModels] = useState<any[]>([]);
  const [allRemoteModels, setAllRemoteModels] = useState<any[]>([]);
  const [textModels, setTextModels] = useState<any[]>([]);
  const [tab, setTab] = useState("text");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [textModel, setTextModel] = useState("");
  const [textPrompt, setTextPrompt] = useState("");
  const [textOutput, setTextOutput] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageOutput, setImageOutput] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoModels, setVideoModels] = useState<any[]>([]);
  const [videoModel, setVideoModel] = useState("");
  const [videoDur, setVideoDur] = useState(4);
  const [videoStatus, setVideoStatus] = useState<"idle" | "submitting" | "polling" | "completed" | "failed">("idle");
  const [videoStatusText, setVideoStatusText] = useState("");
  const [videoError, setVideoError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) { const errMsg = d.detail || (typeof d.error === "object" ? d.error?.message : d.error) || `HTTP ${r.status}`; throw new Error(errMsg); } return d; };
  const sb = (k: string, v: boolean) => setBusy((p) => ({ ...p, [k]: v }));

  const loadModels = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const [remoteRes, genRes] = await Promise.all([
        fetch(`${apiBase}/v1/models`, { headers }),
        fetch(`${apiBase}/gen/models`),
      ]);
      const remoteData = await remoteRes.json().catch(() => ({}));
      const genData = await genRes.json().catch(() => ({}));

      const remoteModels = (Array.isArray(remoteData.data) ? remoteData.data : []).filter((m: any) => m.is_ready !== false);
      setAllModels(remoteModels);
      setAllRemoteModels(Array.isArray(genData) ? genData : Array.isArray(genData.data) ? genData.data : []);
      setVideoModels(remoteModels.filter((m: any) => m.output_modalities?.includes("video") && m.is_ready !== false));

      const textOnly = remoteModels.filter((m: any) => isTextModel(m));
      const seen = new Set();
      const unique = textOnly.filter((m: any) => { const k = slug(m) || m.name; if (!k || seen.has(k)) return false; seen.add(k); return true; });
      setTextModels(unique);
      if (unique.length > 0 && !textModel) {
        setTextModel(unique[0].id || unique[0].upstream_id || slug(unique[0]));
      }
    } catch { /* ignore */ }
  }, [apiBase, textModel, session]);

  useEffect(() => { loadModels(); }, [loadModels]);

  const runText = async () => { if (!session) return alert("Sign in required"); sb("text", true); setTextOutput("Generating\u2026"); try { setTextOutput(JSON.stringify(await fj("/gen/chat/completions", { method: "POST", headers: authH(), body: JSON.stringify({ stream: false, model: textModel || undefined, messages: [{ role: "user", content: textPrompt || "Hello" }] }) }), null, 2)); } catch (e: any) { setTextOutput(e.message); } sb("text", false); };
  const runImage = async () => { if (!session) return alert("Sign in required"); sb("image", true); setImageOutput("Generating\u2026"); try { const r = await fj("/gen/images/generations", { method: "POST", headers: authH(), body: JSON.stringify({ prompt: imagePrompt || "A colorful neon city.", model: imageModel || undefined }) }); const b = r?.data?.[0]?.b64_json; if (!b) throw new Error("No image returned"); setImageOutput(`data:image/jpeg;base64,${b}`); } catch (e: any) { setImageOutput(e.message); } sb("image", false); };
  const runVideo = async () => {
    if (!session) return alert("Sign in required");
    sb("video", true);
    setVideoStatus("submitting");
    setVideoStatusText("Submitting video generation job\u2026");
    setVideoError("");
    try {
      const body: Record<string, any> = { prompt: videoPrompt };
      if (videoModel) body.model = videoModel;
      if (videoDur) body.seconds = videoDur;
      const r = await fj("/gen/videos", { method: "POST", headers: authH(), body: JSON.stringify(body) });
      if (r.id) {
        setVideoStatus("polling");
        setVideoStatusText(`Job submitted (ID: ${r.id.slice(0, 8)}\u2026). Polling for result\u2026`);
        await pollVideoJob(r.id);
      } else {
        throw new Error("Unexpected response from video generation endpoint");
      }
    } catch (e: any) {
      setVideoStatus("failed");
      setVideoError(e.message);
      sb("video", false);
    }
  };

  const fetchVideoContent = async (jobId: string): Promise<string> => {
    const r = await fetch(`${apiBase}/gen/videos/${jobId}/content`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (r.ok) {
      const blob = await r.blob();
      return URL.createObjectURL(blob);
    }
    return "";
  };

  const pollVideoJob = async (jobId: string) => {
    try {
      const r = await fj(`/gen/videos/${jobId}`, { headers: authH() });
      if (r.status === "completed") {
        setVideoStatus("completed");
        setVideoStatusText("Video generation complete!");
        try {
          const url = await fetchVideoContent(jobId);
          if (url) setVideoUrl(url);
        } catch { /* ignore content fetch errors */ }
        sb("video", false);
        return;
      }
      if (r.status === "failed") {
        setVideoStatus("failed");
        setVideoError(r.error?.message || (typeof r.error === "string" ? r.error : "Video generation job failed."));
        sb("video", false);
        return;
      }
      setVideoStatusText(`Job ${r.status}${r.progress ? ` (${r.progress}%)` : ""}\u2026 Polling in 3s`);
      setTimeout(() => pollVideoJob(jobId), 3000);
    } catch (e: any) {
      setVideoStatus("failed");
      setVideoError(e.message);
      sb("video", false);
    }
  };
  if (!session) return <div className={`${styles.panel} ${styles.active}`}><div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to test the Subscription API.</div></div>;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2>Subscription API (Generation)</h2>
        <div className={styles.apiDocContent}>
          <p>The <strong>Generation API</strong> (prefix <code>/gen</code>) provides AI generation backed by your plan&apos;s subscription quota. Each subscription tier (Free, Light, Core, Creator, Professional) includes daily/weekly usage limits.</p>
          <h3>Endpoints</h3>
          <ul>
            <li><code>POST /gen/chat/completions</code>: text chat completions</li>
            <li><code>POST /gen/images/generations</code>: image generation</li>
            <li><code>POST /gen/videos/generations</code>: video generation</li>
            <li><code>POST /gen/audio/generations</code>: audio/music generation</li>
            <li><code>POST /gen/audio/speech</code>: text-to-speech (OpenAI compatible)</li>
            <li><code>POST /gen/audio/speech/with-timestamps</code>: text-to-speech with character timings</li>
            <li><code>POST /gen/audio/transcriptions</code>: speech-to-text</li>
            <li><code>POST /gen/audio/voice-changer</code>: speech-to-speech voice conversion</li>
            <li><code>POST /gen/audio/voice-isolator</code>: background noise removal</li>
            <li><code>POST /gen/audio/stem-separation</code>: split audio into stems</li>
            <li><code>POST /gen/3d/generations</code>: 3D generation <span className={`${styles.muted} ${styles.tiny}`}>(P2G API only)</span></li>
            <li><code>GET /gen/models</code>: available model listing</li>
          </ul>
          <p className={`${styles.muted} ${styles.tiny}`}>Audio endpoints accept the lightning router models; credit-metered named audio models (Whisper, ElevenLabs, TTS) are exposed through the P2G <code>/v1/audio/*</code> routes.</p>
          <h3>Authentication</h3>
          <p>Use <code>Authorization: Bearer &lt;your-supabase-jwt&gt;</code> or <code>Authorization: Bearer &lt;lightning-api-key&gt;</code>.</p>
          <h3>Rate limits</h3>
          <p>Rate limits are determined by your subscription tier. See your plan for specific daily/weekly quotas.</p>
          <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "1rem" }}><a href="https://docs.inferenceport.ai/en/latest/api/gen-api.html" target="_blank" rel="noreferrer">Full Generation API docs</a></p>
        </div>
      </section>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2>Subscription API playground</h2>
        <p className={`${styles.muted} ${styles.tiny}`} style={{ marginBottom: "1.25rem" }}>Test the Subscription API endpoints.</p>
        <div className={styles.tabs}>{(["text", "image", "video", "audio"] as const).map((t) => <button key={t} className={`playground-tab ${styles.playgroundTab} ${tab === t ? styles.active : ""}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}</div>
        {tab === "text" && <div className={`${styles.playgroundPanel} ${styles.active}`}><label>Model<select value={textModel} onChange={(e) => setTextModel(e.target.value)}>{textModels.map((m, i) => <option key={i} value={m.id || m.upstream_id || slug(m)}>{m.name}</option>)}</select></label><textarea rows={5} placeholder="Ask something..." value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)} /><button onClick={runText} disabled={busy.text}>{busy.text ? "Generating\u2026" : "Generate text"}</button><pre className={styles.output}>{textOutput}</pre></div>}
        {tab === "image" && <div className={`${styles.playgroundPanel} ${styles.active}`}>          <label>Image model<select value={imageModel} onChange={(e) => setImageModel(e.target.value)}><option value="">Default</option>{getImageModels(allModels).map((m: any, i: number) => <option key={i} value={m.id}>{m.name}{formatModelPrice(m) ? ` (${formatModelPrice(m)})` : ""}</option>)}</select></label><textarea rows={4} placeholder="Describe an image..." value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} /><button onClick={runImage} disabled={busy.image}>{busy.image ? "Generating\u2026" : "Generate image"}</button>{imageOutput?.startsWith("data:") ? <img src={imageOutput} alt="Generated" className={styles.mediaOutputMedia} /> : <div className={styles.output}>{imageOutput}</div>}</div>}
        {tab === "video" && <div className={`${styles.playgroundPanel} ${styles.active}`}>
          <label>Video model<select value={videoModel} onChange={(e) => setVideoModel(e.target.value)}>
            <option value="">Default</option>
            {getVideoModels(allModels).map((m: any, i: number) => <option key={i} value={m.id}>{m.name}{formatModelPrice(m) ? ` (${formatModelPrice(m)})` : ""}</option>)}
          </select></label>
          <textarea rows={4} placeholder="Describe a video..." value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} />
          <label>Duration
            <select value={videoDur} onChange={(e) => setVideoDur(Number(e.target.value))}>
              <option value={4}>4 seconds</option>
              <option value={8}>8 seconds</option>
              <option value={12}>12 seconds</option>
              <option value={20}>20 seconds</option>
              <option value={30}>30 seconds</option>
            </select>
          </label>
          <button onClick={runVideo} disabled={busy.video}>{busy.video ? "Generating\u2026" : "Generate video"}</button>
          {videoStatusText && videoStatus !== "idle" && (
            <div className={styles.threeJobStatus}>
              <div className={`${styles.threeStatusDot} ${videoStatus === "completed" ? styles.threeStatusDone : videoStatus === "failed" ? styles.threeStatusFailed : styles.threeStatusPending}`} />
              <span>{videoStatusText}</span>
            </div>
          )}
          {videoError && <div className={styles.threeError}>{videoError}</div>}
          {videoStatus === "completed" && videoUrl && (
            <div style={{ marginTop: "0.75rem" }}>
              <video controls src={videoUrl} className={styles.mediaOutputMedia} />
            </div>
          )}
          {videoStatus === "completed" && !videoUrl && (
            <p className={`${styles.muted} ${styles.tiny}`}>Video generation complete. Use the asset CDN endpoint to retrieve the result.</p>
          )}
        </div>}
        {tab === "audio" && (
          <AudioPlayground session={session} apiBase={apiBase} apiPrefix="/gen" models={allRemoteModels} />
        )}
      </section>
    </div>
  );
}
