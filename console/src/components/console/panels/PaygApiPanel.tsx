"use client";

import { useState } from "react";
import styles from "./Panel.module.css";
import { navigateConsole } from "../ContextSwitcher";

interface Props { session: any; config: any; apiBase: string; theme?: "light" | "dark"; }
type Mode = "text" | "image" | "video" | "audio" | "3d" | "embedding" | "realtime" | "decision";

function launchPlayground(mode: Mode, modelId?: string) {
  const launch = { source: "p2g" as const, mode, ...(modelId ? { modelId } : {}) };
  try { sessionStorage.setItem("console-playground-launch", JSON.stringify(launch)); } catch { /* storage can be unavailable */ }
  window.dispatchEvent(new CustomEvent("console-playground-launch", { detail: launch }));
  navigateConsole("playground");
}

export default function PaygApiPanel({ session }: Props) {
  const [mode, setMode] = useState<Mode>("text");
  const example = mode === "text"
    ? `curl "$API_BASE/v1/chat/completions" \\\n  -H "Authorization: Bearer $LIGHTNING_API_KEY" -H "Content-Type: application/json" \\\n  -d '{"model":"MODEL_ID","messages":[{"role":"user","content":"Hello"}]}'`
    : mode === "image"
      ? `curl "$API_BASE/v1/images/generations" \\\n  -H "Authorization: Bearer $LIGHTNING_API_KEY" -H "Content-Type: application/json" \\\n  -d '{"model":"MODEL_ID","prompt":"A quiet garden at sunrise"}'`
      : `curl "$API_BASE/v1/embeddings" \\\n  -H "Authorization: Bearer $LIGHTNING_API_KEY" -H "Content-Type: application/json" \\\n  -d '{"model":"MODEL_ID","input":"A short sentence to embed"}'`;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2 className={styles.heading}>Pay as you go API</h2>
        <div className={styles.apiDocContent}>
          <p>The P2G API uses the OpenAI compatible <code>/v1</code> routes and charges your credit balance for supported requests. Model pricing and billing units vary by modality; check the model catalog before running production workloads.</p>
          <h3>Authentication</h3>
          <p>Use a Lightning API key or Supabase access token as a Bearer token. Requests made with an organization key are billed to that organization; personal keys use your personal credit balance.</p>
          <h3>Common endpoints</h3>
          <ul>
            <li><code>POST /v1/chat/completions</code> and <code>POST /v1/responses</code> for text and multimodal chat</li>
            <li><code>POST /v1/images/generations</code> for image generation</li>
            <li><code>POST /v1/videos</code> and <code>POST /v1/3d/generations</code> for asynchronous media jobs</li>
            <li><code>POST /v1/audio/*</code> for music, speech, transcription, and audio tools</li>
            <li><code>POST /v1/embeddings</code> for text vectors; realtime and decision workflows are also available in Playground</li>
          </ul>
          <h3>Request example</h3>
          <div className={styles.tabs} role="tablist" aria-label="P2G API examples">
            {(["text", "image", "embedding"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={(mode === item || (mode !== "text" && mode !== "image" && item === "embedding"))} className={`playground-tab ${styles.playgroundTab} ${(mode === item || (mode !== "text" && mode !== "image" && item === "embedding")) ? styles.active : ""}`} onClick={() => setMode(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
          </div>
          <pre className={styles.output}><code>{example}</code></pre>
          <p>Replace <code>$API_BASE</code>, the credential placeholder, and <code>MODEL_ID</code> with your API base, server-side credential, and a compatible model. Audio endpoints that accept files use multipart form data.</p>
          <p><a href="https://docs.inferenceport.ai/en/latest/api/" target="_blank" rel="noreferrer">Read the full API documentation</a></p>
        </div>
        <div className={styles.row}>
          <button type="button" onClick={() => launchPlayground(mode)} disabled={!session}>Try this in Playground</button>
          {!session && <span className={`${styles.muted} ${styles.tiny}`}>Sign in to use Playground.</span>}
        </div>
      </section>
    </div>
  );
}
