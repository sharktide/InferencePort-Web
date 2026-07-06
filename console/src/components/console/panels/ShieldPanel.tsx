"use client";

import { useState } from "react";
import styles from "./Panel.module.css";

const featureGroups: Record<string, string[]> = {
  Signal: ["heuristics"],
  Memory: ["historical_memory"],
  Graph: ["duplicate_detection", "campaign_detection"],
  Intelligence: ["email_intelligence", "ip_intelligence", "phone_intelligence", "username_intelligence", "device_intelligence", "behavior_intelligence", "content_intelligence", "prompt_intelligence"],
  Agent: ["identity_analysis", "fraud_analysis", "prompt_analysis", "content_analysis", "exfiltration_analysis"],
  Decision: ["llm_reasoning"],
  Storage: ["memory_update"],
};

const defaultDisabled = new Set(["duplicate_detection", "campaign_detection", "memory_update"]);

interface Props { session: any; config: any; apiBase: string; }

export default function ShieldPanel({ session, config, apiBase }: Props) {
  const [fields, setFields] = useState({ email: "", phone: "", ip: "", username: "", device: "", content: "", country: "", city: "", lat: "", lon: "", signupTime: "", metadata: "" });
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const d: Record<string, boolean> = {};
    Object.values(featureGroups).flat().forEach((f) => { d[f] = !defaultDisabled.has(f); });
    return d;
  });
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!session) return alert("Sign in required");
    setBusy(true);
    setResult(null);
    try {
      const body: any = {};
      if (fields.email) body.email = fields.email;
      if (fields.phone) body.phone = fields.phone;
      if (fields.ip) body.ip = fields.ip;
      if (fields.username) body.username = fields.username;
      if (fields.device) body.device_fingerprint = fields.device;
      if (fields.content) body.content = fields.content;

      if (fields.country || fields.city || fields.lat || fields.lon) {
        body.geolocation = {};
        if (fields.country) body.geolocation.country = fields.country;
        if (fields.city) body.geolocation.city = fields.city;
        if (fields.lat) body.geolocation.lat = parseFloat(fields.lat);
        if (fields.lon) body.geolocation.lon = parseFloat(fields.lon);
      }

      if (fields.signupTime) body.signup_time = fields.signupTime;

      if (fields.metadata) {
        try { body.metadata = JSON.parse(fields.metadata); }
        catch { alert("Invalid metadata JSON"); setBusy(false); return; }
      }

      const disabledFeatures = Object.keys(toggles).filter((k) => !toggles[k]);
      if (disabledFeatures.length > 0) {
        body.config = { features: {} };
        for (const k of disabledFeatures) body.config.features[k] = false;
      }

      if (!Object.keys(body).length) {
        alert("Enter at least one signal to analyze.");
        setBusy(false);
        return;
      }

      const r = await fetch(`${apiBase}/ai-shield/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`);
      setResult(d);
    } catch (e: any) { alert(e.message || "Shield analysis failed"); }
    setBusy(false);
  };

  const dcls = (d: string) => {
    if (d === "allow") return styles.decisionAllow;
    if (d === "challenge") return styles.decisionChallenge;
    if (d === "rate_limit") return styles.decisionRateLimit;
    if (d === "review") return styles.decisionReview;
    if (d === "block") return styles.decisionBlock;
    return "";
  };

  if (!session) return <div className={`${styles.panel} ${styles.active}`}><div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to test the AI Shield analysis.</div></div>;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2>AI Shield</h2>
        <div className={styles.apiDocContent}>
          <p><strong>AI Shield</strong> is an intelligent abuse prevention and fraud detection system. It analyzes requests in real time to detect and prevent abuse, fraud, and malicious usage of your AI applications.</p>
          <h3>How It Works</h3>
          <p>Shield employs a multi-layered analysis pipeline:</p>
          <ol>
            <li><strong>Signal Collection</strong> &mdash; Gathers email, IP, phone, device, content, and behavioral signals from each request.</li>
            <li><strong>Heuristic Analysis</strong> &mdash; Runs fast pattern-based checks for prompt injection, spam, and known abuse patterns.</li>
            <li><strong>Intelligence Collection</strong> &mdash; Queries external and internal intelligence sources for IP reputation, email risk, device fingerprinting, and more.</li>
            <li><strong>Agent Analysis</strong> &mdash; Specialized agents analyze identity fraud, exfiltration attempts, prompt threats, content policy violations, and payment fraud.</li>
            <li><strong>Relationship Graph</strong> &mdash; Maps entity relationships to detect duplicate accounts and coordinated campaigns.</li>
            <li><strong>Historical Memory</strong> &mdash; Checks encrypted global and customer-specific memory for prior abuse history.</li>
            <li><strong>LLM Reasoning</strong> &mdash; Synthesizes all evidence through an LLM for final risk scoring and decision.</li>
            <li><strong>Decision Engine</strong> &mdash; Produces a final verdict: <code>allow</code>, <code>challenge</code>, <code>rate_limit</code>, <code>review</code>, or <code>block</code>.</li>
          </ol>
          <h3>Endpoint</h3>
          <p><code>POST /ai-shield/analyze</code> &mdash; Submit signals for abuse analysis.</p>
          <h3>Response Fields</h3>
          <ul>
            <li><code>risk_score</code> &mdash; 0-100 overall risk</li>
            <li><code>confidence</code> &mdash; 0-1 confidence in the decision</li>
            <li><code>decision</code> &mdash; allow, challenge, rate_limit, review, or block</li>
            <li><code>recommended_action</code> &mdash; Human-readable recommended action</li>
            <li><code>threat_categories</code> &mdash; Identified threat types</li>
            <li><code>reasons</code> &mdash; Human-readable explanations</li>
          </ul>
          <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "1rem" }}><a href="https://docs.inferenceport.ai/en/latest/api/shield.html" target="_blank" rel="noreferrer">Full Shield docs &rarr;</a></p>
        </div>
      </section>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2>Shield Playground</h2>
        <p className={`${styles.muted} ${styles.tiny}`} style={{ marginBottom: "1.25rem" }}>Submit signals to the Shield analysis engine and inspect the decision.</p>
        <div className={styles.shieldForm}>
          {([["Email", "email", "email", "user@example.com"], ["Phone", "phone", "text", "+1234567890"], ["IP Address", "ip", "text", "203.0.113.1"], ["Username", "username", "text", "johndoe"], ["Device Fingerprint", "device", "text", "abc123..."]] as const).map(([label, key, type, placeholder]) => <label key={key}>{label}<input type={type} placeholder={placeholder} value={(fields as any)[key]} onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))} /></label>)}
          <label>Content<textarea rows={4} placeholder="Content to analyze for prompt injection, policy violations..." value={fields.content} onChange={(e) => setFields((p) => ({ ...p, content: e.target.value }))} /></label>

          <details className={styles.shieldConfigDetails}>
            <summary className={styles.shieldConfigSummary}>Advanced Signals <span className={`${styles.muted} ${styles.tiny}`}>(geolocation, signup time, metadata)</span></summary>
            <div className={styles.shieldAdvancedGrid}>
              <label className={styles.shieldAdvancedLabel}>Country<input type="text" placeholder="US" value={fields.country} onChange={(e) => setFields((p) => ({ ...p, country: e.target.value }))} /></label>
              <label className={styles.shieldAdvancedLabel}>City<input type="text" placeholder="San Francisco" value={fields.city} onChange={(e) => setFields((p) => ({ ...p, city: e.target.value }))} /></label>
              <label className={styles.shieldAdvancedLabel}>Latitude<input type="text" placeholder="37.7749" value={fields.lat} onChange={(e) => setFields((p) => ({ ...p, lat: e.target.value }))} /></label>
              <label className={styles.shieldAdvancedLabel}>Longitude<input type="text" placeholder="-122.4194" value={fields.lon} onChange={(e) => setFields((p) => ({ ...p, lon: e.target.value }))} /></label>
              <label className={styles.shieldAdvancedLabel}>Signup Time<input type="text" placeholder="2026-01-01T00:00:00Z" value={fields.signupTime} onChange={(e) => setFields((p) => ({ ...p, signupTime: e.target.value }))} /></label>
              <label className={`${styles.shieldAdvancedLabel} ${styles.shieldAdvancedFullCol}`}>Metadata (JSON)<textarea rows={3} placeholder='{"user_agent": "Mozilla/5.0 ...", "session_id": "sess_abc123", "account_age_days": 30}' value={fields.metadata} onChange={(e) => setFields((p) => ({ ...p, metadata: e.target.value }))} /></label>
            </div>
          </details>

          <details className={styles.shieldConfigDetails}>
            <summary className={styles.shieldConfigSummary}>Feature Config <span className={`${styles.muted} ${styles.tiny}`}>(all enabled by default)</span></summary>
            <p className={`${styles.muted} ${styles.tiny}`} style={{ margin: "0.5rem 0 0.75rem" }}>Uncheck any feature to skip that analysis step.</p>
            <div className={styles.shieldConfigGrid}>
              {Object.entries(featureGroups).map(([group, feats]) => <div key={group} className={styles.shieldConfigGroup}><h4>{group}</h4>{feats.map((f) => <label key={f} className={styles.shieldToggle}><input type="checkbox" checked={toggles[f] ?? true} onChange={() => setToggles((p) => ({ ...p, [f]: !p[f] }))} /><span>{f}</span></label>)}</div>)}
            </div>
          </details>

          <button onClick={run} disabled={busy}>{busy ? "Analyzing\u2026" : "Run Analysis"}</button>
        </div>
        {result && (
          <div className={styles.shieldResult}>
            <h3 className={styles.shieldResultTitle}>Analysis Result</h3>
            <div className={styles.shieldResultGrid}>
              {[["Risk Score", result.risk_score], ["Confidence", result.confidence], ["Decision", result.decision], ["Recommended Action", result.recommended_action], ["Duplicate Score", result.duplicate_user_score], ["Linked Accounts", result.linked_accounts], ["Campaign Risk", result.campaign_risk_score]].map(([label, val], i) => (
                <div key={i} className={styles.shieldStat}><span className={styles.shieldStatLabel}>{label}</span><span className={`${styles.shieldStatValue} ${label === "Decision" || label === "Recommended Action" ? dcls(val as string) : ""}`}>{val ?? "\u2014"}</span></div>
              ))}
            </div>
            {result.threat_categories?.length > 0 && <><h3>Threat Categories</h3><div className={styles.shieldThreats}>{result.threat_categories.map((t: string, i: number) => <span key={i} className={styles.shieldThreatTag}>{t}</span>)}</div></>}
            {result.reasons?.length > 0 && <><h3>Reasons</h3><ul className={styles.shieldReasons}>{result.reasons.map((r: string, i: number) => <li key={i} className={styles.shieldReasonItem}>{r}</li>)}</ul></>}
            {result.investigation && <><h3>Investigation</h3><pre className={styles.output}>{JSON.stringify(result.investigation, null, 2)}</pre></>}
            {result.evidence && <><h3>Evidence</h3><pre className={styles.output}>{JSON.stringify(result.evidence, null, 2)}</pre></>}
            {result.config_applied && <><h3>Config Applied</h3><pre className={styles.output}>{JSON.stringify(result.config_applied, null, 2)}</pre></>}
            <h3>Full Response</h3>
            <pre className={styles.output}>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </section>
    </div>
  );
}
