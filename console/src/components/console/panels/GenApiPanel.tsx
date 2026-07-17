"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./Panel.module.css";

interface Props { session: any; config: any; apiBase: string; }

function isTextModel(m: any) {
  const i = Array.isArray(m?.input_modalities) ? m.input_modalities : [];
  const o = Array.isArray(m?.output_modalities) ? m.output_modalities : [];
  return i.includes("text") && o.includes("text");
}

function slug(m: any) {
  return m?.id || m?.upstream_id || m?.openrouter?.slug || "";
}

function formatModelPrice(m: any) {
  const p = m?.price;
  if (p == null) return null;
  const type = m.type;
  if (type === "video" || type === "audio") return `$${p}/sec`;
  if (type === "image") return `$${p}/gen`;
  if (type === "3D") return `$${p}/model`;
  return `$${p}`;
}

function getImageModels(config: any) {
  return (config?.models || []).filter((m: any) => m.type === "image");
}

export default function GenApiPanel({ session, config, apiBase }: Props) {
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
  const [videoDur, setVideoDur] = useState(5);
  const [videoOutput, setVideoOutput] = useState("");
  const [audioPrompt, setAudioPrompt] = useState("");
  const [audioDur, setAudioDur] = useState(10);
  const [audioOutput, setAudioOutput] = useState("");

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };
  const sb = (k: string, v: boolean) => setBusy((p) => ({ ...p, [k]: v }));

  const loadModels = useCallback(async () => {
    try {
      const [remoteRes, genRes] = await Promise.all([
        fetch(`${apiBase}/v1/models`),
        fetch(`${apiBase}/gen/models`),
      ]);
      const remoteData = await remoteRes.json().catch(() => ({}));
      const genData = await genRes.json().catch(() => ({}));

      const remoteModels = (Array.isArray(remoteData.data) ? remoteData.data : []).filter((m: any) => isTextModel(m) && m.is_ready !== false);
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

  const runText = async () => { if (!session) return alert("Sign in required"); sb("text", true); setTextOutput("Generating\u2026"); try { setTextOutput(JSON.stringify(await fj("/gen/chat/completions", { method: "POST", headers: authH(), body: JSON.stringify({ stream: false, model: textModel || undefined, messages: [{ role: "user", content: textPrompt || "Hello" }] }) }), null, 2)); } catch (e: any) { setTextOutput(e.message); } sb("text", false); };
  const runImage = async () => { if (!session) return alert("Sign in required"); sb("image", true); setImageOutput("Generating\u2026"); try { const r = await fj("/gen/images/generations", { method: "POST", headers: authH(), body: JSON.stringify({ prompt: imagePrompt || "A colorful neon city.", model: imageModel || undefined }) }); const b = r?.data?.[0]?.b64_json; if (!b) throw new Error("No image returned"); setImageOutput(`data:image/jpeg;base64,${b}`); } catch (e: any) { setImageOutput(e.message); } sb("image", false); };
  const runVideo = async () => { if (!session) return alert("Sign in required"); sb("video", true); setVideoOutput("Generating\u2026"); try { const r = await fetch(`${apiBase}/gen/videos/generations`, { method: "POST", headers: authH(), body: JSON.stringify({ prompt: videoPrompt || "A drifting cloudscape.", duration: Number(videoDur) }) }); if (!r.ok) { const p = await r.json().catch(() => ({})); throw new Error(p.detail || p.error || "Video generation failed"); } const blob = await r.blob(); setVideoOutput(URL.createObjectURL(blob)); } catch (e: any) { setVideoOutput(e.message); } sb("video", false); };
  const runAudio = async () => { if (!session) return alert("Sign in required"); sb("audio", true); setAudioOutput("Generating\u2026"); try { const r = await fetch(`${apiBase}/gen/audio/generations`, { method: "POST", headers: authH(), body: JSON.stringify({ prompt: audioPrompt || "Energetic electronic beat", duration_seconds: Number(audioDur) }) }); if (!r.ok) { const p = await r.json().catch(() => ({})); throw new Error(p.detail || p.error || "Audio generation failed"); } const blob = await r.blob(); setAudioOutput(URL.createObjectURL(blob)); } catch (e: any) { setAudioOutput(e.message); } sb("audio", false); };

  if (!session) return <div className={`${styles.panel} ${styles.active}`}><div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to test the Subscription API.</div></div>;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2>Subscription API (Generation)</h2>
        <div className={styles.apiDocContent}>
          <p>The <strong>Generation API</strong> (prefix <code>/gen</code>) provides AI generation backed by your plan&apos;s subscription quota. Each subscription tier (Free, Light, Core, Creator, Professional) includes daily/weekly usage limits.</p>
          <h3>Endpoints</h3>
          <ul>
            <li><code>POST /gen/chat/completions</code> &mdash; Text chat completions</li>
            <li><code>POST /gen/images/generations</code> &mdash; Image generation</li>
            <li><code>POST /gen/videos/generations</code> &mdash; Video generation</li>
            <li><code>POST /gen/audio/generations</code> &mdash; Audio/music generation</li>
            <li><code>POST /gen/3d/generations</code> &mdash; 3D generation <span className={`${styles.muted} ${styles.tiny}`}>(P2G API only)</span></li>
            <li><code>GET /gen/models</code> &mdash; Available model listing</li>
          </ul>
          <h3>Authentication</h3>
          <p>Use <code>Authorization: Bearer &lt;your-supabase-jwt&gt;</code> or <code>Authorization: Bearer &lt;lightning-api-key&gt;</code>.</p>
          <h3>Rate Limits</h3>
          <p>Rate limits are determined by your subscription tier. See your plan for specific daily/weekly quotas.</p>
          <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "1rem" }}><a href="https://docs.inferenceport.ai/en/latest/api/gen-api.html" target="_blank" rel="noreferrer">Full Generation API docs &rarr;</a></p>
        </div>
      </section>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2>Subscription API Playground</h2>
        <p className={`${styles.muted} ${styles.tiny}`} style={{ marginBottom: "1.25rem" }}>Test the Subscription API endpoints.</p>
        <div className={styles.tabs}>{(["text", "image", "video", "audio"] as const).map((t) => <button key={t} className={`playground-tab ${styles.playgroundTab} ${tab === t ? styles.active : ""}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}</div>
        {tab === "text" && <div className={`${styles.playgroundPanel} ${styles.active}`}><label>Model<select value={textModel} onChange={(e) => setTextModel(e.target.value)}>{textModels.map((m, i) => <option key={i} value={m.id || m.upstream_id || slug(m)}>{m.name}</option>)}</select></label><textarea rows={5} placeholder="Ask something..." value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)} /><button onClick={runText} disabled={busy.text}>{busy.text ? "Generating\u2026" : "Generate text"}</button><pre className={styles.output}>{textOutput}</pre></div>}
        {tab === "image" && <div className={`${styles.playgroundPanel} ${styles.active}`}><label>Image model<select value={imageModel} onChange={(e) => setImageModel(e.target.value)}><option value="">Default</option>{getImageModels(config).map((m: any, i: number) => <option key={i} value={m.id}>{m.name}{formatModelPrice(m) ? ` (${formatModelPrice(m)})` : ""}</option>)}</select></label><textarea rows={4} placeholder="Describe an image..." value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} /><button onClick={runImage} disabled={busy.image}>{busy.image ? "Generating\u2026" : "Generate image"}</button>{imageOutput?.startsWith("data:") ? <img src={imageOutput} alt="Generated" className={styles.mediaOutputMedia} /> : <div className={styles.output}>{imageOutput}</div>}</div>}
        {tab === "video" && <div className={`${styles.playgroundPanel} ${styles.active}`}><textarea rows={4} placeholder="Describe a video..." value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} /><label>Duration (seconds)<input type="number" min={1} max={10} value={videoDur} onChange={(e) => setVideoDur(Number(e.target.value))} /></label><button onClick={runVideo} disabled={busy.video}>{busy.video ? "Generating\u2026" : "Generate video"}</button>{videoOutput?.startsWith("blob:") ? <video controls src={videoOutput} className={styles.mediaOutputMedia} /> : <div className={styles.output}>{videoOutput}</div>}</div>}
        {tab === "audio" && <div className={`${styles.playgroundPanel} ${styles.active}`}><textarea rows={4} placeholder="Describe audio / music / sfx..." value={audioPrompt} onChange={(e) => setAudioPrompt(e.target.value)} /><label>Charge duration estimate (seconds)<input type="number" min={1} max={90} value={audioDur} onChange={(e) => setAudioDur(Number(e.target.value))} /></label><button onClick={runAudio} disabled={busy.audio}>{busy.audio ? "Generating\u2026" : "Generate audio"}</button>{audioOutput?.startsWith("blob:") ? <audio controls src={audioOutput} style={{ width: "100%" }} /> : <div className={styles.output}>{audioOutput}</div>}</div>}
      </section>
    </div>
  );
}
