"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./Panel.module.css";

interface Props { session: any; apiBase: string; }

export default function ApiKeyPanel({ session, apiBase }: Props) {
  const [keys, setKeys] = useState<any[]>([]);
  const [keyName, setKeyName] = useState("");
  const [keyExpiry, setKeyExpiry] = useState("");
  const [status, setStatus] = useState("Sign in to create and manage Lightning API keys.");
  const [reveal, setReveal] = useState<{ raw: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };
  const fmt = (v: string | null) => { if (!v) return "Never"; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString(); };

  const refresh = useCallback(async () => {
    if (!session?.access_token) { setKeys([]); setStatus("Sign in to create and manage Lightning API keys."); return; }
    try { const r = await fj("/v1/lightning-api-keys", { headers: authH() }); setKeys(r.items || []); setStatus("Use a generated key as Bearer token when calling Lightning."); } catch (e: any) { setStatus(`Error: ${e.message}`); }
  }, [session, apiBase]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async () => {
    if (!session?.access_token) return alert("Sign in first.");
    if (!keyName.trim()) return setStatus("Please enter a name.");
    setBusy(true); setStatus("Creating\u2026");
    try { const r = await fj("/v1/lightning-api-keys", { method: "POST", headers: authH(), body: JSON.stringify({ name: keyName.trim(), expiresAt: keyExpiry.trim() || null }) }); if (!r?.apiKey || !r?.rawKey) throw new Error("Could not create API key"); setKeyName(""); setKeyExpiry(""); setReveal({ raw: r.rawKey, name: r.apiKey.name }); setStatus("New key created. Copy it now."); await refresh(); } catch (e: any) { setStatus(`Error: ${e.message}`); }
    setBusy(false);
  };

  const revoke = async (id: string) => {
    if (prompt("Type REVOKE to confirm.") !== "REVOKE") return;
    try { await fj(`/v1/lightning-api-keys/${encodeURIComponent(id)}`, { method: "DELETE", headers: authH() }); await refresh(); } catch (e: any) { setStatus(`Error: ${e.message}`); }
  };

  if (!session) return <div className={`${styles.panel} ${styles.active}`}><div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to create and manage Lightning API keys.</div></div>;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Lightning API Keys</div>
        <div className={styles.apiKeyShell}>
          <div className={styles.apiKeyForm}>
            <p className={`${styles.muted} ${styles.tiny}`} style={{ marginBottom: "0.85rem" }}>Create long-lived API keys for hosted scripts, servers, and production integrations.</p>
            <div className={styles.stack}>
              <input type="text" maxLength={64} placeholder="Production deploy, CI, backend service..." value={keyName} onChange={(e) => setKeyName(e.target.value)} />
              <input type="text" placeholder="Optional ISO expiry, e.g. 2026-12-31T23:59:59Z" value={keyExpiry} onChange={(e) => setKeyExpiry(e.target.value)} />
              <div className={styles.row}>
                <button onClick={create} disabled={busy} style={{ flex: 1 }}>{busy ? "Creating\u2026" : "Generate API Key"}</button>
                <button className="ghost" onClick={refresh} style={{ flex: 1 }}>Refresh Keys</button>
              </div>
              <p className={`${styles.muted} ${styles.tiny}`}>{status}</p>
            </div>
          </div>
          {reveal && (
            <div className={styles.apiKeyReveal}>
              <div className={styles.apiKeyRevealTitle}>API key created</div>
              <p className={`${styles.muted} ${styles.tiny}`}>Copy this secret now. It is only shown once.</p>
              <pre className={styles.apiKeySecret}>{reveal.raw}</pre>
              <div className={styles.row}>
                <button onClick={async () => { await navigator.clipboard.writeText(reveal.raw); setStatus(`Copied "${reveal.name}".`); }} style={{ flex: 1 }}>Copy Key</button>
                <button className="ghost" onClick={() => setReveal(null)} style={{ flex: 1 }}>Dismiss</button>
              </div>
            </div>
          )}
        </div>
        <div className={styles.apiKeyList}>
          {keys.length === 0 ? <div className={styles.lockedOverlay} style={{ marginTop: "1rem" }}>No API keys yet.</div> : keys.map((k) => {
            const st = k.isRevoked ? { label: "Revoked", cls: styles.isRevoked } : k.isExpired ? { label: "Expired", cls: styles.isExpired } : { label: "Active", cls: styles.isActive };
            return (
              <div key={k.id} className={styles.apiKeyRow}>
                <div className={styles.apiKeyRowHead}>
                  <div className={styles.apiKeyRowTitle}><div className={styles.apiKeyName}>{k.name}</div><div className={styles.apiKeyPrefix}>{k.keyPrefix}...</div></div>
                  <div className={`${styles.apiKeyBadge} ${st.cls}`}>{st.label}</div>
                </div>
                <div className={styles.apiKeyMeta}><span>Created: {fmt(k.createdAt)}</span><span>Last used: {fmt(k.lastUsedAt)}</span><span>Expires: {k.expiresAt ? fmt(k.expiresAt) : "Never"}</span></div>
                <div className={styles.apiKeyActions}><button className="ghost" disabled={k.isRevoked} onClick={() => revoke(k.id)}>{k.isRevoked ? "Revoked" : "Revoke Key"}</button></div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}