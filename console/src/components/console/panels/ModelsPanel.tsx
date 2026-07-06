"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./Panel.module.css";

interface Props { config: any; session: any; apiBase: string; }

export default function ModelsPanel({ config, session, apiBase }: Props) {
  const [models, setModels] = useState<any[]>([]);
  const [genModels, setGenModels] = useState<any[]>([]);
  const [source, setSource] = useState<"p2g" | "gen">("p2g");
  const [selectedModel, setSelectedModel] = useState("");
  const [tab, setTab] = useState("text");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
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

  const isTextModel = (m: any) => { const i = Array.isArray(m?.input_modalities) ? m.input_modalities : []; const o = Array.isArray(m?.output_modalities) ? m.output_modalities : []; return i.includes("text") && o.includes("text"); };
  const slug = (m: any) => m?.id || m?.upstream_id || m?.openrouter?.slug || "";
  const modalities = (m: any) => { const arr = Array.isArray(m?.input_modalities) ? m.input_modalities : []; return arr.length ? arr.map((v: string) => v.toUpperCase()).join(" / ") : "Configured model"; };

  const formatPricing = (m: any) => {
    const p = m?.pricing || {};
    if (p.prompt != null && p.completion != null) {
      const perMillion = (v: number) => (v * 1_000_000).toFixed(2);
      return `In: $${perMillion(p.prompt)}/M \u00b7 Out: $${perMillion(p.completion)}/M`;
    }
    return "Pricing unavailable";
  };

  const textModels = useCallback(() => {
    const all = [...models.filter(isTextModel), ...(config?.models || []).filter(isTextModel)];
    const seen = new Set();
    return all.filter((m) => { const k = slug(m) || m.name; if (!k || seen.has(k)) return false; seen.add(k); return true; });
  }, [models, config]);

  const nonTextConfigModels = useCallback(() => {
    return (config?.models || []).filter((m: any) => !isTextModel(m));
  }, [config]);

  const loadModels = useCallback(async () => {
    try {
      if (source === "p2g") { const r = await fetch(`${apiBase}/v1/models`); const d = await r.json().catch(() => ({})); setModels((Array.isArray(d.data) ? d.data : []).filter((m: any) => isTextModel(m) && m.is_ready !== false)); }
      else { const r = await fetch(`${apiBase}/gen/models`); const d = await r.json().catch(() => ({})); setGenModels(Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : []); }
    } catch { /* ignore */ }
  }, [source, apiBase]);

  useEffect(() => { loadModels(); }, [loadModels]);

  const displayModels = source === "p2g" ? textModels() : genModels;
  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };
  const sb = (k: string, v: boolean) => setBusy((p) => ({ ...p, [k]: v }));

  const runText = async () => { if (!session) return alert("Sign in required"); sb("text", true); setTextOutput("Generating\u2026"); try { const path = source === "p2g" ? "/v1/chat/completions" : "/gen/chat/completions"; setTextOutput(JSON.stringify(await fj(path, { method: "POST", headers: authH(), body: JSON.stringify({ stream: false, model: selectedModel || undefined, messages: [{ role: "user", content: textPrompt || "Hello" }] }) }), null, 2)); } catch (e: any) { setTextOutput(e.message); } sb("text", false); };
  const runImage = async () => { if (!session) return alert("Sign in required"); sb("image", true); setImageOutput("Generating\u2026"); try { const path = source === "p2g" ? "/v1/images/generations" : "/gen/images/generations"; const r = await fj(path, { method: "POST", headers: authH(), body: JSON.stringify({ prompt: imagePrompt || "A colorful neon city." }) }); const b = r?.data?.[0]?.b64_json; if (!b) throw new Error("No image returned"); setImageOutput(`data:image/jpeg;base64,${b}`); } catch (e: any) { setImageOutput(e.message); } sb("image", false); };
  const runVideo = async () => { if (!session) return alert("Sign in required"); sb("video", true); setVideoOutput("Generating\u2026"); try { const path = source === "p2g" ? "/v1/videos/generations" : "/gen/videos/generations"; const r = await fetch(`${apiBase}${path}`, { method: "POST", headers: authH(), body: JSON.stringify({ prompt: videoPrompt || "A drifting cloudscape.", duration: Number(videoDur) }) }); if (!r.ok) throw new Error("Video generation failed"); setVideoOutput(URL.createObjectURL(await r.blob())); } catch (e: any) { setVideoOutput(e.message); } sb("video", false); };
  const runAudio = async () => { if (!session) return alert("Sign in required"); sb("audio", true); setAudioOutput("Generating\u2026"); try { const path = source === "p2g" ? "/v1/audio/generations" : "/gen/audio/generations"; const r = await fetch(`${apiBase}${path}`, { method: "POST", headers: authH(), body: JSON.stringify({ prompt: audioPrompt || "Energetic electronic beat", duration_seconds: Number(audioDur) }) }); if (!r.ok) throw new Error("Audio generation failed"); setAudioOutput(URL.createObjectURL(await r.blob())); } catch (e: any) { setAudioOutput(e.message); } sb("audio", false); };
  const run3d = async () => { if (!session) return alert("Sign in required"); if (source === "gen") { setThreeOutput("3D generation is only available via the P2G API."); return; } if (!threeUrl?.trim()) { setThreeOutput("An image URL or base64 data URI is required."); return; } sb("3d", true); setThreeOutput("Generating 3D model\u2026"); try { const r = await fj("/v1/3d/generations", { method: "POST", headers: authH(), body: JSON.stringify({ prompt: threePrompt || "A detailed 3D scan", image_urls: [threeUrl] }) }); const item = r?.data?.[0]; if (!item) throw new Error("No 3D model returned"); let html = ""; if (item.orbit_video_url) html += `<video controls src="${item.orbit_video_url}"></video>`; if (item.model_ply_url) html += `<p><a href="${item.model_ply_url}" target="_blank">Download PLY model</a></p>`; setThreeOutput(html || JSON.stringify(r, null, 2)); } catch (e: any) { setThreeOutput(e.message); } sb("3d", false); };

  const priceMap: Record<string, string> = { VIDEO: "$0.01 per second", AUDIO: "$0.01 per second", IMAGE: "$0.02 per image", "3D": "$0.07 per model" };

  if (!session) return <div className={`${styles.panel} ${styles.active}`}><div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to view available models and run the playground.</div></div>;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Models</div>
        <div className={styles.tabs}>
          <button className={`playground-tab ${styles.playgroundTab} ${source === "p2g" ? styles.active : ""}`} onClick={() => setSource("p2g")}>P2G API</button>
          <button className={`playground-tab ${styles.playgroundTab} ${source === "gen" ? styles.active : ""}`} onClick={() => setSource("gen")}>Gen API</button>
        </div>
        <div className={styles.modelsGrid}>
          {displayModels.map((m: any, i: number) => {
            const label = source === "gen" ? "1x multiplier" : priceMap[String(m.type || modalities(m)).toUpperCase()] || formatPricing(m);
            return (
              <div key={i} className={styles.modelCard}>
                <div className={styles.modelCardTop}>
                  <span className={styles.modelCardName}>{m.name || m.id || "Unnamed model"}</span>
                  <span className={`${styles.modelPill} ${isTextModel(m) ? styles.isText : styles.isConfig}`}>{String(m.type || modalities(m)).toUpperCase()}</span>
                </div>
                <div className={styles.modelMeta}><span className={styles.modelKey}>Slug</span><span className={styles.modelValue}>{slug(m) || "\u2014"}</span></div>
                <div className={styles.modelMeta}><span className={styles.modelKey}>Pricing</span><span className={styles.modelValue}>{label}</span></div>
              </div>
            );
          })}
          {source === "p2g" && nonTextConfigModels().map((m: any, i: number) => {
            const label = priceMap[String(m.type || modalities(m)).toUpperCase()] || "Existing configuration";
            return (
              <div key={`cfg-${i}`} className={styles.modelCard}>
                <div className={styles.modelCardTop}>
                  <span className={styles.modelCardName}>{m.name || m.id || "Unnamed model"}</span>
                  <span className={`${styles.modelPill} ${styles.isConfig}`}>{String(m.type || modalities(m)).toUpperCase()}</span>
                </div>
                <div className={styles.modelMeta}><span className={styles.modelKey}>Slug</span><span className={styles.modelValue}>{slug(m) || "\u2014"}</span></div>
                <div className={styles.modelMeta}><span className={styles.modelKey}>Pricing</span><span className={styles.modelValue}>{label}</span></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Live Playground</div>
        <p className={`${styles.muted} ${styles.tiny}`} style={{ marginBottom: "1.25rem" }}>Test generation using {source === "p2g" ? "P2G API" : "Gen API"}. Every successful generation consumes credits.</p>
        <div className={styles.tabs}>
          {(["text", "image", "video", "audio", "3d"] as const).map((t) => <button key={t} className={`playground-tab ${styles.playgroundTab} ${tab === t ? styles.active : ""}`} onClick={() => setTab(t)}>{t === "3d" ? "3D" : t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
        </div>
        {tab === "text" && <div className={`${styles.playgroundPanel} ${styles.active}`}>
          <label>Text model<select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>{textModels().map((m, i) => <option key={i} value={m.id || m.upstream_id || slug(m)}>{m.name}</option>)}</select></label>
          <textarea rows={5} placeholder="Ask something..." value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)} />
          <button onClick={runText} disabled={busy.text}>{busy.text ? "Generating\u2026" : "Generate text"}</button>
          <pre className={styles.output}>{textOutput}</pre>
        </div>}
        {tab === "image" && <div className={`${styles.playgroundPanel} ${styles.active}`}>
          <textarea rows={4} placeholder="Describe an image..." value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} />
          <button onClick={runImage} disabled={busy.image}>{busy.image ? "Generating\u2026" : "Generate image"}</button>
          {imageOutput?.startsWith("data:") ? <img src={imageOutput} alt="Generated" className={styles.mediaOutputMedia} /> : <div className={styles.output}>{imageOutput}</div>}
        </div>}
        {tab === "video" && <div className={`${styles.playgroundPanel} ${styles.active}`}>
          <textarea rows={4} placeholder="Describe a video..." value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} />
          <label>Duration (seconds)<input type="number" min={1} max={10} value={videoDur} onChange={(e) => setVideoDur(Number(e.target.value))} /></label>
          <button onClick={runVideo} disabled={busy.video}>{busy.video ? "Generating\u2026" : "Generate video"}</button>
          {videoOutput?.startsWith("blob:") ? <video controls src={videoOutput} className={styles.mediaOutputMedia} /> : <div className={styles.output}>{videoOutput}</div>}
        </div>}
        {tab === "audio" && <div className={`${styles.playgroundPanel} ${styles.active}`}>
          <textarea rows={4} placeholder="Describe audio / music / sfx..." value={audioPrompt} onChange={(e) => setAudioPrompt(e.target.value)} />
          <label>Charge duration estimate (seconds)<input type="number" min={1} max={90} value={audioDur} onChange={(e) => setAudioDur(Number(e.target.value))} /></label>
          <button onClick={runAudio} disabled={busy.audio}>{busy.audio ? "Generating\u2026" : "Generate audio"}</button>
          {audioOutput?.startsWith("blob:") ? <audio controls src={audioOutput} style={{ width: "100%" }} /> : <div className={styles.output}>{audioOutput}</div>}
        </div>}
        {tab === "3d" && <div className={`${styles.playgroundPanel} ${styles.active}`}>
          <textarea rows={4} placeholder="Describe the 3D model..." value={threePrompt} onChange={(e) => setThreePrompt(e.target.value)} />
          <input type="text" placeholder="Image URL or base64 data URI (required for image-to-3d)" value={threeUrl} onChange={(e) => setThreeUrl(e.target.value)} />
          <p className={`${styles.muted} ${styles.tiny}`}>3D generation is only available via the P2G API. Requires an input image and produces an orbit video + PLY model.</p>
          <button onClick={run3d} disabled={busy["3d"]}>{busy["3d"] ? "Generating\u2026" : "Generate 3D model"}</button>
          <div dangerouslySetInnerHTML={{ __html: threeOutput }} className={styles.mediaOutput} />
        </div>}
      </section>
    </div>
  );
}