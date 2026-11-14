"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./Panel.module.css";
import { useModal } from "../../Modal";
import LimitsEditor, { draftFrom, emptyDraft, parseDraft, type LimitsDraft } from "./orgs/LimitsEditor";

interface Props { session: any; apiBase: string; }

export default function ApiKeyPanel({ session, apiBase }: Props) {
  const modal = useModal();
  const [keys, setKeys] = useState<any[]>([]);
  const [keyName, setKeyName] = useState("");
  const [keyExpiry, setKeyExpiry] = useState("");
  const [status, setStatus] = useState("Sign in to create and manage Lightning API keys.");
  const [reveal, setReveal] = useState<{ raw: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [restrictionSupport, setRestrictionSupport] = useState<"loading" | "supported" | "unsupported" | "error">("loading");
  const newestRefresh = useRef(0);
  const newestProbe = useRef(0);
  const activeToken = session?.access_token as string | undefined;
  const activeTokenRef = useRef(activeToken);
  activeTokenRef.current = activeToken;
  const [createLimits, setCreateLimits] = useState<LimitsDraft>(emptyDraft);
  const [editing, setEditing] = useState<{ id: string; name: string; draft: LimitsDraft } | null>(null);

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };
  const fmt = (v: string | null) => { if (!v) return "Never"; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString(); };

  const refresh = useCallback(async () => {
    const token = activeToken;
    const seq = ++newestRefresh.current;
    if (!token) { setKeys([]); setStatus("Sign in to create and manage Lightning API keys."); return; }
    try {
      const r = await fj("/v1/lightning-api-keys", {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (seq !== newestRefresh.current || token !== activeTokenRef.current) return;
      setKeys(r.items || []);
      setStatus("Use a generated key as Bearer token when calling Lightning.");
    } catch (e: any) {
      if (seq === newestRefresh.current && token === activeTokenRef.current) setStatus(`Error: ${e.message}`);
    }
  }, [activeToken, apiBase]);

  const probeCapabilities = useCallback(async () => {
    const token = activeToken;
    const seq = ++newestProbe.current;
    if (!token) return setRestrictionSupport("unsupported");
    setRestrictionSupport("loading");
    try {
      // Only an explicit 404 means an older server. Network/5xx errors must
      // never quietly create an unrestricted key.
      const res = await fetch(`${apiBase}/v1/lightning-api-keys/capabilities`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(7000),
      });
      if (seq !== newestProbe.current || token !== activeTokenRef.current) return;
      if (res.status === 404) { setRestrictionSupport("unsupported"); return; }
      if (!res.ok) { setRestrictionSupport("error"); return; }
      const data = await res.json();
      setRestrictionSupport(data?.personalKeyRestrictions === true ? "supported" : "error");
    } catch {
      if (seq === newestProbe.current && token === activeTokenRef.current) setRestrictionSupport("error");
    }
  }, [activeToken, apiBase]);

  useEffect(() => {
    ++newestRefresh.current;
    ++newestProbe.current;
    setKeys([]);
    setEditing(null);
    setReveal(null);
    setRestrictionSupport("loading");
    void refresh();
    void probeCapabilities();
    // Requests started for a previous token are ignored by sequence and token.
  }, [refresh, probeCapabilities]);


  const getLimits = (draft: LimitsDraft) => {
    const parsed = parseDraft(draft, ["budget", "models", "modalities"]);
    if ("error" in parsed) throw new Error(parsed.error);
    return {
      monthly_credit_limit: parsed.value.monthly_credit_limit,
      allowed_models: parsed.value.allowed_models,
      allowed_modalities: parsed.value.allowed_modalities,
    };
  };

  const create = async () => {
    if (!session?.access_token) return void await modal.alert("Sign in first.");
    if (!keyName.trim()) return setStatus("Please enter a name.");
    setBusy(true); setStatus("Creating…");
    try {
      if (restrictionSupport === "loading" || restrictionSupport === "error") {
        throw new Error("Cannot verify key-limit support. Retry the capability check before creating a key.");
      }
      const restrictions = restrictionSupport === "supported" ? getLimits(createLimits) : {};
      const r = await fj("/v1/lightning-api-keys", {
        method: "POST", headers: authH(),
        body: JSON.stringify({ name: keyName.trim(), expiresAt: keyExpiry.trim() || null, ...restrictions }),
      });
      if (!r?.apiKey || !r?.rawKey) throw new Error("Could not create API key");
      setKeyName(""); setKeyExpiry(""); setCreateLimits(emptyDraft());
      setReveal({ raw: r.rawKey, name: r.apiKey.name });
      setStatus("New key created. Copy it now.");
      await refresh();
    } catch (e: any) { setStatus(`Error: ${e.message}`); }
    finally { setBusy(false); }
  };

  const editKey = (k: any) => {
    if (editing && editing.id !== k.id) return; // Save/cancel the open editor first.
    setEditing({
      id: k.id,
      name: k.name,
      draft: draftFrom({
        monthly_credit_limit: k.monthlyCreditLimit ?? null,
        allowed_models: k.allowedModels ?? null,
        allowed_modalities: k.allowedModalities ?? null,
      }),
    });
  };

  const saveLimits = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const updated = getLimits(editing.draft);
      const live = keys.find((k) => k.id === editing.id);
      if (!live) throw new Error("This API key is not in the current list.");
      const original = getLimits(draftFrom({
        monthly_credit_limit: live.monthlyCreditLimit ?? null,
        allowed_models: live.allowedModels ?? null,
        allowed_modalities: live.allowedModalities ?? null,
      }));
      // PATCH only fields edited in this tab, avoiding resets of other fields.
      const changes = Object.fromEntries(
        Object.entries(updated).filter(([field, value]) =>
          JSON.stringify(value) !== JSON.stringify(original[field as keyof typeof original])),
      );
      if (Object.keys(changes).length) {
        await fj(`/v1/lightning-api-keys/${encodeURIComponent(editing.id)}`, {
          method: "PATCH", headers: authH(), body: JSON.stringify(changes),
        });
      }
      setStatus(`Saved limits for "${editing.name}".`);
      setEditing(null);
      await refresh();
    } catch (e: any) { setStatus(`Error: ${e.message}`); }
    finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    if (await modal.prompt("Type REVOKE to confirm.") !== "REVOKE") return;
    try { await fj(`/v1/lightning-api-keys/${encodeURIComponent(id)}`, { method: "DELETE", headers: authH() }); await refresh(); } catch (e: any) { setStatus(`Error: ${e.message}`); }
  };

  if (!session) return <div className={`${styles.panel} ${styles.active}`}><div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to create and manage Lightning API keys.</div></div>;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Lightning API keys</div>
        <div className={styles.apiKeyShell}>
          <div className={styles.apiKeyForm}>
            <p className={`${styles.muted} ${styles.tiny}`} style={{ marginBottom: "0.85rem" }}>Create long-lived API keys for hosted scripts, servers, and production integrations.</p>
            <div className={styles.stack}>
              <label>Name<input type="text" maxLength={64} placeholder="Production deploy, CI, backend service..." value={keyName} onChange={(e) => setKeyName(e.target.value)} /></label>
              <label>Expires (optional)<input type="text" placeholder="ISO date, for example 2026-12-31T23:59:59Z" value={keyExpiry} onChange={(e) => setKeyExpiry(e.target.value)} /></label>
              {restrictionSupport === "supported" ? (
                <>
                  <p className={styles.muted}>Optional restrictions for this key only. Blank values mean unrestricted; account limits still apply.</p>
                  <LimitsEditor idPrefix="personal-new-key" draft={createLimits} onChange={setCreateLimits} fields={["budget", "models", "modalities"]} disabled={busy} />
                </>
              ) : restrictionSupport === "unsupported" ? (
                <p className={`${styles.muted} ${styles.tiny}`}>This server does not yet support per-key limits. Keys created here are unrestricted at key level.</p>
              ) : (
                <p className={`${styles.muted} ${styles.tiny}`}>
                  {restrictionSupport === "loading" ? "Checking per-key limit support…" : "Unable to verify per-key limit support."}
                  {restrictionSupport === "error" && <button type="button" className="ghost" onClick={probeCapabilities}>Retry</button>}
                </p>
              )}
              <div className={styles.row}>
                <button onClick={create} disabled={busy || restrictionSupport === "loading" || restrictionSupport === "error"} style={{ flex: 1 }}>{busy ? "Creating\u2026" : "Generate API key"}</button>
                <button className="ghost" onClick={refresh} style={{ flex: 1 }}>Refresh keys</button>
              </div>
              <p className={`${styles.muted} ${styles.tiny}`}>{status}</p>
            </div>
          </div>
          {reveal && (
            <div className={styles.apiKeyReveal}>
              <div className={styles.apiKeyRevealTitle} role="status">API key created</div>
              <p className={`${styles.muted} ${styles.tiny}`}>Copy this secret now. It is only shown once.</p>
              <pre className={styles.apiKeySecret}>{reveal.raw}</pre>
              <div className={styles.row}>
                <button onClick={async () => { await navigator.clipboard.writeText(reveal.raw); setStatus(`Copied "${reveal.name}".`); }} style={{ flex: 1 }}>Copy key</button>
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
                <div className={styles.apiKeyMeta}><span>Created {fmt(k.createdAt)}</span><span>Last used {fmt(k.lastUsedAt)}</span><span>Expires {k.expiresAt ? fmt(k.expiresAt) : "Never"}</span></div>
                {restrictionSupport === "supported" && (
                  <div className={styles.apiKeyMeta}>
                    <span>Spent this UTC month: {Number(k.monthSpend || 0).toLocaleString()} / {k.monthlyCreditLimit == null ? "no key limit" : Number(k.monthlyCreditLimit).toLocaleString()} credits</span>
                    <span>Models: {k.allowedModels?.length ? k.allowedModels.join(", ") : "All models"}</span>
                    <span>Modalities: {k.allowedModalities?.length ? k.allowedModalities.join(", ") : "All modalities"}</span>
                  </div>
                )}
                <div className={styles.apiKeyActions}>
                  {restrictionSupport === "supported" && !k.isRevoked && !k.isExpired && <button type="button" className="ghost" onClick={() => editKey(k)} disabled={busy || (editing !== null && editing.id !== k.id)}>Edit limits</button>}
                  <button type="button" className="ghost" disabled={k.isRevoked || busy} onClick={() => revoke(k.id)}>{k.isRevoked ? "Revoked" : "Revoke key"}</button>
                </div>
                {restrictionSupport === "supported" && editing?.id === k.id && (
                  <div className={styles.apiKeyForm}>
                    <div className={styles.heading}>Edit restrictions — {k.name}</div>
                    <LimitsEditor idPrefix={`personal-key-${k.id}`} draft={editing?.draft ?? emptyDraft()}
                      onChange={(draft) => setEditing((current) => current?.id === k.id ? { ...current, draft } : current)}
                      fields={["budget", "models", "modalities"]} disabled={busy} />
                    <div className={styles.row}>
                      <button type="button" onClick={saveLimits} disabled={busy}>Save limits</button>
                      <button type="button" className="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}