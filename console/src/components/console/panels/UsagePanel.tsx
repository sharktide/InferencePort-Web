"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./Panel.module.css";
import ActivityPanel from "./ActivityPanel";

interface Props { session: any; apiBase: string; }

export default function UsagePanel({ session, apiBase }: Props) {
  const [genUsage, setGenUsage] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    try { const [u, l] = await Promise.all([fj("/usage", { headers: authH() }), fj("/v1/credits/ledger?limit=30", { headers: authH() })]); setGenUsage(u.usage || {}); setLedger(l.entries || []); } catch { /* ignore */ }
  }, [session, apiBase]);

  useEffect(() => { load(); }, [load]);

  const fmt = (u: any) => u ? `${u.used} / ${u.limit} (${u.remaining} remaining)` : "\u2014";

  if (!session) return <div className={`${styles.panel} ${styles.active}`}><div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to view recent usage and purchases.</div></div>;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Generation API Usage (Plan Limits)</div>
        {genUsage ? (
          <div className={styles.statGrid} style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {[["Chat (Daily)", genUsage.cloudChatDaily], ["Images (Daily)", genUsage.imagesDaily], ["Videos (Daily)", genUsage.videosDaily], ["Audio (Weekly)", genUsage.audioWeekly], ["AI Shield (Daily)", genUsage.aiShieldDaily], ["Server Token Verifications (Daily)", genUsage.verifyTokenWithEmailDaily]].map(([label, val], i) => (
              <div key={i} className={styles.statArticle}><span className={styles.statLabel}>{label}</span><strong className={styles.statValue}>{fmt(val)}</strong></div>
            ))}
          </div>
        ) : <div className={styles.lockedOverlay}>Sign in to view your plan usage.</div>}
      </section>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Activity</div>
        <ActivityPanel session={session} apiBase={apiBase} />
      </section>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>P2G Ledger (Recent Usage & Purchases)</div>
        <div className={styles.ledger}>
          <div className={styles.ledgerHeader}><span>Type</span><span>Credits</span><span>Units</span><span>Date</span></div>
          {ledger.length === 0 ? <div className={styles.lockedOverlay} style={{ minHeight: 60 }}>No ledger entries yet.</div> : ledger.map((e: any, i: number) => (
            <div key={i} className={styles.ledgerRow}>
              <div><strong>{e.entry_type}</strong><div className={`${styles.muted} ${styles.tiny}`}>{e.usage_kind || "\u2014"}</div></div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>{Number(e.delta_credits || 0).toFixed(4)}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>{e.units != null ? e.units : "\u2014"} {e.unit_label || ""}</div>
              <div className={`${styles.muted} ${styles.tiny}`}>{e.created_at || ""}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}