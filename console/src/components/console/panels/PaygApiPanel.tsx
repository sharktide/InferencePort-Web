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
  const [threePrompt, setThreePrompt] = useState("");
  const [threeUrl, setThreeUrl] = useState("");
  const [threeOutput, setThreeOutput] = useState("");

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };
  const sb = (k: string, v: boolean) => setBusy((p) => ({ ...p, [k]: v }));

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

  const runText = async () => { if (!session) return alert("Sign in required"); sb("text", true); setTextOutput("Generating\u2026"); try { setTextOutput(JSON.stringify(await fj("/v1/chat/completions", { method: "POST", headers: authH(), body: JSON.stringify({ stream: false, model: textModel || undefined, messages: [{ role: "user", content: textPrompt || "Hello" }] }) }), null, 2)); } catch (e: any) { setTextOutput(e.message); } sb("text", false); };
  const runImage = async () => { if (!session) return alert("Sign in required"); sb("image", true); setImageOutput("Generating\u2026"); try { const r = await fj("/v1/images/generations", { method: "POST", headers: authH(), body: JSON.stringify({ prompt: imagePrompt || "A colorful neon city." }) }); const b = r?.data?.[0]?.b64_json; if (!b) throw new Error("No image returned"); setImageOutput(`data:image/jpeg;base64,${b}`); } catch (e: any) { setImageOutput(e.message); } sb("image", false); };
  const runVideo = async () => { if (!session) return alert("Sign in required"); sb("video", true); setVideoOutput("Generating\u2026"); try { const r = await fetch(`${apiBase}/v1/videos/generations`, { method: "POST", headers: authH(), body: JSON.stringify({ prompt: videoPrompt || "A drifting cloudscape at sunset.", duration: Number(videoDur) }) }); if (!r.ok) { const p = await r.json().catch(() => ({})); throw new Error(p.detail || p.error || "Video generation failed"); } const blob = await r.blob(); setVideoOutput(URL.createObjectURL(blob)); } catch (e: any) { setVideoOutput(e.message); } sb("video", false); };
  const runAudio = async () => { if (!session) return alert("Sign in required"); sb("audio", true); setAudioOutput("Generating\u2026"); try { const r = await fetch(`${apiBase}/v1/audio/generations`, { method: "POST", headers: authH(), body: JSON.stringify({ prompt: audioPrompt || "Energetic electronic beat", duration_seconds: Number(audioDur) }) }); if (!r.ok) { const p = await r.json().catch(() => ({})); throw new Error(p.detail || p.error || "Audio generation failed"); } const blob = await r.blob(); setAudioOutput(URL.createObjectURL(blob)); } catch (e: any) { setAudioOutput(e.message); } sb("audio", false); };
  const run3d = async () => { if (!session) return alert("Sign in required"); if (!threeUrl?.trim()) { setThreeOutput("An image URL or base64 data URI is required for 3D generation."); return; } sb("3d", true); setThreeOutput("Generating 3D model\u2026"); try { const r = await fj("/v1/3d/generations", { method: "POST", headers: authH(), body: JSON.stringify({ prompt: threePrompt || "A detailed 3D scan", image_urls: [threeUrl] }) }); const item = r?.data?.[0]; if (!item) throw new Error("No 3D model returned"); let html = ""; if (item.orbit_video_url) html += `<video controls src="${item.orbit_video_url}"></video>`; if (item.model_ply_url) html += `<p className="${styles.muted} ${styles.tiny}"><a href="${item.model_ply_url}" target="_blank" rel="noreferrer">Download PLY model</a></p>`; if (r?.usage) html += `<p className="${styles.muted} ${styles.tiny}">Credits charged: ${r.usage.payg_credits_charged}</p>`; setThreeOutput(html || JSON.stringify(r, null, 2)); } catch (e: any) { setThreeOutput(e.message); } sb("3d", false); };

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
            <li><code>POST /v1/3d/generations</code> &mdash; 3D generation (image-to-3d)</li>
            <li><code>GET /v1/models</code> &mdash; Available models</li>
            <li><code>GET /v1/me</code> &mdash; Account &amp; wallet info</li>
            <li><code>GET /v1/credits/ledger</code> &mdash; Credit transaction history</li>
            <li><code>GET /POST /v1/lightning-api-keys</code> &mdash; API key management</li>
          </ul>
          <h3>Authentication</h3>
          <p>Use <code>Authorization: Bearer &lt;your-supabase-jwt&gt;</code> or <code>Authorization: Bearer &lt;lightning-api-key&gt;</code>.</p>
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
        {tab === "3d" && <div className={`${styles.playgroundPanel} ${styles.active}`}><textarea rows={4} placeholder="Describe the 3D model..." value={threePrompt} onChange={(e) => setThreePrompt(e.target.value)} /><input type="text" placeholder="Image URL or base64 data URI (required for image-to-3d)" value={threeUrl} onChange={(e) => setThreeUrl(e.target.value)} /><p className={`${styles.muted} ${styles.tiny}`}>3D generation requires an input image and produces an orbit video + PLY model. Cost: 0.07 credits per model.</p><button onClick={run3d} disabled={busy["3d"]}>{busy["3d"] ? "Generating\u2026" : "Generate 3D model"}</button><div dangerouslySetInnerHTML={{ __html: threeOutput }} className={styles.mediaOutput} /></div>}
      </section>
    </div>
  );
}
