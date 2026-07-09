"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./Panel.module.css";

interface Props { session: any; config: any; apiBase: string; }

interface ThreeJobResult {
  glbUrl?: string;
  plyUrl?: string;
  videoUrl?: string;
  usage?: { payg_credits_charged: number; model_count: number };
}

function isTextModel(m: any) {
  const i = Array.isArray(m?.input_modalities) ? m.input_modalities : [];
  const o = Array.isArray(m?.output_modalities) ? m.output_modalities : [];
  return i.includes("text") && o.includes("text");
}

function slug(m: any) {
  return m?.id || m?.upstream_id || m?.openrouter?.slug || "";
}

export default function PaygApiPanel({ session, config, apiBase }: Props) {
  const [textModels, setTextModels] = useState<any[]>([]);
  const [tab, setTab] = useState("text");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [textModel, setTextModel] = useState("");
  const [textPrompt, setTextPrompt] = useState("");
  const [textOutput, setTextOutput] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageOutput, setImageOutput] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoDur, setVideoDur] = useState(5);
  const [videoOutput, setVideoOutput] = useState("");
  const [audioPrompt, setAudioPrompt] = useState("");
  const [audioDur, setAudioDur] = useState(10);
  const [audioOutput, setAudioOutput] = useState("");
  const [threeModel, setThreeModel] = useState("tripoSR");
  const [threeResolution, setThreeResolution] = useState<"low" | "medium" | "high">("low");
  const [threePrompt, setThreePrompt] = useState("");
  const [threeUrl, setThreeUrl] = useState("");
  const [threeStatus, setThreeStatus] = useState<"idle" | "submitting" | "polling" | "completed" | "failed">("idle");
  const [threeStatusText, setThreeStatusText] = useState("");
  const [threeResult, setThreeResult] = useState<ThreeJobResult | null>(null);
  const [threeError, setThreeError] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };
  const sb = (k: string, v: boolean) => setBusy((p) => ({ ...p, [k]: v }));

  const decodeBase64 = (b64: string): string => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes]));
  };

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/v1/models`);
      const data = await res.json().catch(() => ({}));
      const remoteModels = (Array.isArray(data.data) ? data.data : []).filter((m: any) => isTextModel(m) && m.is_ready !== false);
      const configModels = (config?.models || []).filter(isTextModel);
      const all = [...remoteModels, ...configModels];
      const seen = new Set();
      const unique = all.filter((m: any) => { const k = slug(m) || m.name; if (!k || seen.has(k)) return false; seen.add(k); return true; });
      setTextModels(unique);
      if (unique.length > 0 && !textModel) {
        setTextModel(unique[0].id || unique[0].upstream_id || slug(unique[0]));
      }
    } catch { /* ignore */ }
  }, [apiBase, config, textModel]);

  useEffect(() => { loadModels(); }, [loadModels]);

  useEffect(() => {
    import("@google/model-viewer/dist/model-viewer");
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  const runText = async () => { if (!session) return alert("Sign in required"); sb("text", true); setTextOutput("Generating\u2026"); try { setTextOutput(JSON.stringify(await fj("/v1/chat/completions", { method: "POST", headers: authH(), body: JSON.stringify({ stream: false, model: textModel || undefined, messages: [{ role: "user", content: textPrompt || "Hello" }] }) }), null, 2)); } catch (e: any) { setTextOutput(e.message); } sb("text", false); };
  const runImage = async () => { if (!session) return alert("Sign in required"); sb("image", true); setImageOutput("Generating\u2026"); try { const r = await fj("/v1/images/generations", { method: "POST", headers: authH(), body: JSON.stringify({ prompt: imagePrompt || "A colorful neon city." }) }); const b = r?.data?.[0]?.b64_json; if (!b) throw new Error("No image returned"); setImageOutput(`data:image/jpeg;base64,${b}`); } catch (e: any) { setImageOutput(e.message); } sb("image", false); };
  const runVideo = async () => { if (!session) return alert("Sign in required"); sb("video", true); setVideoOutput("Generating\u2026"); try { const r = await fetch(`${apiBase}/v1/videos/generations`, { method: "POST", headers: authH(), body: JSON.stringify({ prompt: videoPrompt || "A drifting cloudscape at sunset.", duration: Number(videoDur) }) }); if (!r.ok) { const p = await r.json().catch(() => ({})); throw new Error(p.detail || p.error || "Video generation failed"); } const blob = await r.blob(); setVideoOutput(URL.createObjectURL(blob)); } catch (e: any) { setVideoOutput(e.message); } sb("video", false); };
  const runAudio = async () => { if (!session) return alert("Sign in required"); sb("audio", true); setAudioOutput("Generating\u2026"); try { const r = await fetch(`${apiBase}/v1/audio/generations`, { method: "POST", headers: authH(), body: JSON.stringify({ prompt: audioPrompt || "Energetic electronic beat", duration_seconds: Number(audioDur) }) }); if (!r.ok) { const p = await r.json().catch(() => ({})); throw new Error(p.detail || p.error || "Audio generation failed"); } const blob = await r.blob(); setAudioOutput(URL.createObjectURL(blob)); } catch (e: any) { setAudioOutput(e.message); } sb("audio", false); };

  const run3d = async () => {
    if (!session) return alert("Sign in required");
    if (!threeUrl?.trim()) { setThreeError("An image URL or base64 data URI is required for 3D generation."); return; }
    sb("3d", true);
    setThreeStatus("submitting");
    setThreeStatusText("Submitting 3D generation job\u2026");
    setThreeResult(null);
    setThreeError("");

    try {
      const body: Record<string, any> = {
        model: threeModel,
        image_urls: [threeUrl],
      };
      if (threeModel === "asset-harvester" && threePrompt) {
        body.prompt = threePrompt;
      }
      if (threeModel === "trellis2") {
        body.resolution = threeResolution;
      }

      const r = await fj("/v1/3d/generations", {
        method: "POST",
        headers: authH(),
        body: JSON.stringify(body),
      });

      if (r.job_id) {
        setThreeStatus("polling");
        setThreeStatusText(`Job submitted (ID: ${r.job_id.slice(0, 8)}\u2026). Polling for result\u2026`);
        await pollJob(r.job_id);
      } else if (r.data) {
        processResult(r);
      } else {
        throw new Error("Unexpected response from 3D generation endpoint");
      }
    } catch (e: any) {
      setThreeStatus("failed");
      setThreeError(e.message);
      sb("3d", false);
    }
  };

  const pollJob = async (jobId: string) => {
    try {
      const r = await fj(`/v1/3d/jobs/${jobId}`, { headers: authH() });

      if (r.status === "completed") {
        processResult(r);
        return;
      }

      if (r.status === "failed") {
        setThreeStatus("failed");
        setThreeError(r.error || "3D generation job failed.");
        sb("3d", false);
        return;
      }

      setThreeStatusText(`Job ${r.status}\u2026 Polling in 5s`);
      pollRef.current = setTimeout(() => pollJob(jobId), 5000);
    } catch (e: any) {
      setThreeStatus("failed");
      setThreeError(e.message);
      sb("3d", false);
    }
  };

  const processResult = (r: any) => {
    const result: ThreeJobResult = {};
    const item = r?.data?.[0];

    if (item?.model_glb_b64_bytes) {
      result.glbUrl = decodeBase64(item.model_glb_b64_bytes);
    }
    if (item?.model_ply_b64_bytes) {
      result.plyUrl = decodeBase64(item.model_ply_b64_bytes);
    }
    if (item?.orbit_video_b64_bytes) {
      result.videoUrl = decodeBase64(item.orbit_video_b64_bytes);
    }
    if (r?.usage) {
      result.usage = r.usage;
    }

    setThreeResult(result);
    setThreeStatus("completed");
    setThreeStatusText("3D generation complete!");
    sb("3d", false);
  };

  if (!session) return <div className={`${styles.panel} ${styles.active}`}><div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to test the P2G API.</div></div>;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2>Pay-2-Go (P2G) API</h2>
        <div className={styles.apiDocContent}>
          <p>The <strong>Pay-2-Go API</strong> (prefix <code>/v1</code>) provides credit-billed AI generation. Purchase credits and consume them per request. No monthly subscription required &mdash; only pay for what you use.</p>
          <h3>Endpoints</h3>
          <ul>
            <li><code>POST /v1/chat/completions</code> &mdash; Text chat completions</li>
            <li><code>POST /v1/images/generations</code> &mdash; Image generation</li>
            <li><code>POST /v1/videos/generations</code> &mdash; Video generation</li>
            <li><code>POST /v1/audio/generations</code> &mdash; Audio/music generation</li>
            <li><code>POST /v1/3d/generations</code> &mdash; 3D generation (async job model)</li>
            <li><code>GET /v1/3d/jobs/{'{'}job_id{'}'}</code> &mdash; Poll 3D job status</li>
            <li><code>GET /v1/models</code> &mdash; Available models</li>
            <li><code>GET /v1/me</code> &mdash; Account &amp; wallet info</li>
            <li><code>GET /v1/credits/ledger</code> &mdash; Credit transaction history</li>
            <li><code>GET /POST /v1/lightning-api-keys</code> &mdash; API key management</li>
          </ul>
          <h3>Authentication</h3>
          <p>Use <code>Authorization: Bearer &lt;your-supabase-jwt&gt;</code> or <code>Authorization: Bearer &lt;lightning-api-key&gt;</code>.</p>
          <h3>3D Generation</h3>
          <p>3D generation uses an asynchronous job model. Submitting a request returns a <code>job_id</code> immediately (HTTP 202); you then poll <code>GET /v1/3d/jobs/{'{'}job_id{'}'}</code> until the job reaches <code>completed</code> or <code>failed</code> status. Credits are charged at submission time and refunded automatically if the job fails.</p>
          <p>Supported models: <code>tripoSR</code> ($0.02), <code>asset-harvester</code> ($0.07), <code>sv3d</code> ($0.02), <code>trellis2</code> ($0.24&ndash;$0.35 with resolution options).</p>
          <h3>Pricing</h3>
          <p>Credits are consumed per request. View your <strong>Account</strong> tab for current credit balance and purchase packs. See the <strong>Models</strong> tab for per-model pricing.</p>
          <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "1rem" }}><a href="https://docs.inferenceport.ai/en/latest/api/p2g-api.html" target="_blank" rel="noreferrer">Full P2G API docs &rarr;</a></p>
        </div>
      </section>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2>P2G API Playground</h2>
        <p className={`${styles.muted} ${styles.tiny}`} style={{ marginBottom: "1.25rem" }}>Test the Pay-2-Go API. Every successful generation consumes credits.</p>
        <div className={styles.tabs}>{(["text", "image", "video", "audio", "3d"] as const).map((t) => <button key={t} className={`playground-tab ${styles.playgroundTab} ${tab === t ? styles.active : ""}`} onClick={() => setTab(t)}>{t === "3d" ? "3D" : t.charAt(0).toUpperCase() + t.slice(1)}</button>)}</div>
        {tab === "text" && <div className={`${styles.playgroundPanel} ${styles.active}`}><label>Model<select value={textModel} onChange={(e) => setTextModel(e.target.value)}>{textModels.map((m, i) => <option key={i} value={m.id || m.upstream_id || slug(m)}>{m.name}</option>)}</select></label><textarea rows={5} placeholder="Ask something..." value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)} /><button onClick={runText} disabled={busy.text}>{busy.text ? "Generating\u2026" : "Generate text"}</button><pre className={styles.output}>{textOutput}</pre></div>}
        {tab === "image" && <div className={`${styles.playgroundPanel} ${styles.active}`}><textarea rows={4} placeholder="Describe an image..." value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} /><button onClick={runImage} disabled={busy.image}>{busy.image ? "Generating\u2026" : "Generate image"}</button>{imageOutput?.startsWith("data:") ? <img src={imageOutput} alt="Generated" className={styles.mediaOutputMedia} /> : <div className={styles.output}>{imageOutput}</div>}</div>}
        {tab === "video" && <div className={`${styles.playgroundPanel} ${styles.active}`}><textarea rows={4} placeholder="Describe a video..." value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} /><label>Duration (seconds)<input type="number" min={1} max={10} value={videoDur} onChange={(e) => setVideoDur(Number(e.target.value))} /></label><button onClick={runVideo} disabled={busy.video}>{busy.video ? "Generating\u2026" : "Generate video"}</button>{videoOutput?.startsWith("blob:") ? <video controls src={videoOutput} className={styles.mediaOutputMedia} /> : <div className={styles.output}>{videoOutput}</div>}</div>}
        {tab === "audio" && <div className={`${styles.playgroundPanel} ${styles.active}`}><textarea rows={4} placeholder="Describe audio / music / sfx..." value={audioPrompt} onChange={(e) => setAudioPrompt(e.target.value)} /><label>Charge duration estimate (seconds)<input type="number" min={1} max={90} value={audioDur} onChange={(e) => setAudioDur(Number(e.target.value))} /></label><button onClick={runAudio} disabled={busy.audio}>{busy.audio ? "Generating\u2026" : "Generate audio"}</button>{audioOutput?.startsWith("blob:") ? <audio controls src={audioOutput} style={{ width: "100%" }} /> : <div className={styles.output}>{audioOutput}</div>}</div>}
        {tab === "3d" && <div className={`${styles.playgroundPanel} ${styles.active}`}>
          <label>3D Model<select value={threeModel} onChange={(e) => setThreeModel(e.target.value as any)}>
            <option value="tripoSR">TripoSR ($0.02)</option>
            <option value="asset-harvester">Asset Harvester ($0.07)</option>
            <option value="sv3d">SF3D ($0.02)</option>
            <option value="trellis2">Trellis 2 ($0.24&ndash;$0.35)</option>
          </select></label>
          {threeModel === "trellis2" && (
            <label>Resolution<select value={threeResolution} onChange={(e) => setThreeResolution(e.target.value as any)}>
              <option value="low">Low ($0.24)</option>
              <option value="medium">Medium ($0.29)</option>
              <option value="high">High ($0.35)</option>
            </select></label>
          )}
          {threeModel === "asset-harvester" && <textarea rows={4} placeholder="Describe the 3D model (required for Asset Harvester)..." value={threePrompt} onChange={(e) => setThreePrompt(e.target.value)} />}
          <input type="text" placeholder="Image URL or base64 data URI (required)" value={threeUrl} onChange={(e) => setThreeUrl(e.target.value)} />
          <p className={`${styles.muted} ${styles.tiny}`}>
            {threeModel === "asset-harvester" && "Asset Harvester produces GLB + PLY + orbit video. Requires a prompt."}
            {threeModel === "tripoSR" && "TripoSR produces a GLB model from a single image."}
            {threeModel === "sv3d" && "SF3D produces a GLB model from a single image."}
            {threeModel === "trellis2" && `Trellis 2 produces a GLB model. Resolution: ${threeResolution}.`}
            {" "}Async job polling &mdash; most jobs complete within 1&ndash;5 minutes.
          </p>
          <button onClick={run3d} disabled={busy["3d"]}>{busy["3d"] ? (threeStatus === "submitting" ? "Submitting\u2026" : "Generating\u2026") : "Generate 3D model"}</button>

          {threeStatusText && threeStatus !== "idle" && (
            <div className={styles.threeJobStatus}>
              <div className={`${styles.threeStatusDot} ${threeStatus === "completed" ? styles.threeStatusDone : threeStatus === "failed" ? styles.threeStatusFailed : styles.threeStatusPending}`} />
              <span>{threeStatusText}</span>
            </div>
          )}

          {threeError && <div className={styles.threeError}>{threeError}</div>}

          {threeResult && (
            <div className={styles.threeOutput}>
              {threeResult.glbUrl && (
                <div className={styles.threeViewerWrap}>
                  <model-viewer
                    src={threeResult.glbUrl}
                    alt="Generated 3D model"
                    camera-controls
                    auto-rotate
                    shadow-intensity="1"
                    style={{ width: "100%", height: "400px", background: "var(--surface-2)", borderRadius: "10px" }}
                  />
                </div>
              )}
              {threeResult.videoUrl && (
                <div className={styles.threeMediaRow}>
                  <span className={`${styles.muted} ${styles.tiny}`}>Orbit Preview</span>
                  <video controls src={threeResult.videoUrl} className={styles.mediaOutputMedia} />
                </div>
              )}
              <div className={styles.threeDownloadRow}>
                {threeResult.glbUrl && (
                  <a href={threeResult.glbUrl} download="model.glb" className={styles.threeDownloadBtn}>Download GLB</a>
                )}
                {threeResult.plyUrl && (
                  <a href={threeResult.plyUrl} download="model.ply" className={styles.threeDownloadBtn}>Download PLY</a>
                )}
              </div>
              {threeResult.usage && (
                <p className={`${styles.muted} ${styles.tiny}`}>Credits charged: ${threeResult.usage.payg_credits_charged}</p>
              )}
            </div>
          )}
        </div>}
      </section>
    </div>
  );
}
