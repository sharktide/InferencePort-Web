"use client";

import { useState } from "react";
import styles from "./Panel.module.css";
import { navigateConsole } from "../ContextSwitcher";

interface Props { session: any; config: any; apiBase: string; }
type Mode = "text" | "image" | "audio";

function launchPlayground(mode: Mode, modelId?: string) {
  const launch = { source: "gen" as const, mode, ...(modelId ? { modelId } : {}) };
  try { sessionStorage.setItem("console-playground-launch", JSON.stringify(launch)); } catch { /* storage can be unavailable */ }
  window.dispatchEvent(new CustomEvent("console-playground-launch", { detail: launch }));
  navigateConsole("playground");
}

export default function GenApiPanel({ session }: Props) {
  const [mode, setMode] = useState<Mode>("text");
  const apiKeyAuth = "Authorization: Bearer $LIGHTNING_API_KEY";
  const jwtAuth = "Authorization: Bearer $SUPABASE_JWT";
  const sample = mode === "text"
    ? `curl "$API_BASE/gen/chat/completions" \\\n  -H "${apiKeyAuth}" -H "Content-Type: application/json" \\\n  -d '{"model":"MODEL_ID","messages":[{"role":"user","content":"Hello"}]}'`
    : mode === "image"
      ? `curl "$API_BASE/gen/images/generations" \\\n  -H "${apiKeyAuth}" -H "Content-Type: application/json" \\\n  -d '{"model":"MODEL_ID","prompt":"A quiet garden at sunrise"}'`
      : `curl "$API_BASE/gen/audio/generations" \\\n  -H "${jwtAuth}" -H "Content-Type: application/json" \\\n  -d '{"prompt":"Warm ambient music","model":"MODEL_ID"}'`;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2 className={styles.heading}>Generation API</h2>
        <div className={styles.apiDocContent}>
          <p>Use the <strong>Gen API</strong> when requests should draw from your subscription quota. Its endpoints use the <code>/gen</code> prefix and follow subscription tier limits.</p>
          <h3>Authentication</h3>
          <p>Send a Supabase access token or a Lightning API key in the Bearer authorization header. Keep credentials on your server and out of browser code.</p>
          <h3>Available routes</h3>
          <ul>
            <li><code>POST /gen/chat/completions</code> for text chat</li>
            <li><code>POST /gen/images/generations</code> for image generation</li>
            <li><code>POST /gen/audio/generations</code>, <code>/gen/audio/speech</code>, and <code>/gen/audio/transcriptions</code> for supported audio tasks</li>
            <li><code>GET /gen/models</code> to list Generation API models</li>
          </ul>
          <p>Video, 3D, embeddings, realtime, and decision workflows use the P2G API. Named audio models billed by credits also use P2G audio routes.</p>
          <h3>Request example</h3>
          <div className={styles.tabs} role="tablist" aria-label="Generation API examples">
            {(["text", "image", "audio"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} className={`playground-tab ${styles.playgroundTab} ${mode === item ? styles.active : ""}`} onClick={() => setMode(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
          </div>
          <pre className={styles.output}><code>{sample}</code></pre>
          <p>Replace <code>$API_BASE</code>, the credential placeholder, and <code>MODEL_ID</code> with your API base, server-side credential, and a model from <code>GET /gen/models</code>.</p>
          <p><a href="https://docs.inferenceport.ai/en/latest/api/gen-api.html" target="_blank" rel="noreferrer">Read the full Generation API reference</a></p>
        </div>
        <div className={styles.row}>
          <button type="button" onClick={() => launchPlayground(mode)} disabled={!session}>Try this in Playground</button>
          {!session && <span className={`${styles.muted} ${styles.tiny}`}>Sign in to use Playground.</span>}
        </div>
      </section>
    </div>
  );
}
