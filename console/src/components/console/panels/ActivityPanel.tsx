"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import s from "./ActivityPanel.module.css";

interface Props { session: any; apiBase: string; }

interface LedgerEntry {
  id: string;
  delta_credits: number;
  balance_after: number;
  entry_type: string;
  usage_kind?: string;
  units?: number;
  unit_label?: string;
  source?: string;
  source_ref?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  model?: string;
}

const KIND_COLORS: Record<string, string> = {
  text: s.badgeText,
  image: s.badgeImage,
  video: s.badgeVideo,
  audio: s.badgeAudio,
  model3d: s.badge3d,
};

function fmtDate(iso?: string) {
  if (!iso) return "\u2014";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function isWithinPeriod(iso: string | undefined, period: string) {
  if (!iso) return true;
  if (period === "all") return true;
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (period === "24h") return diffMs < 86400000;
  if (period === "7d") return diffMs < 604800000;
  if (period === "30d") return diffMs < 2592000000;
  return true;
}

export default function ActivityPanel({ session, apiBase }: Props) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"24h" | "7d" | "30d" | "all">("all");

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(`${apiBase}${path}`, opts);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`);
    return d;
  };

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const data = await fj("/v1/credits/ledger/models?limit=500", { headers: authH() });
      setEntries(data.entries || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [session, apiBase]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => entries.filter(e => isWithinPeriod(e.created_at, period)), [entries, period]);

  const stats = useMemo(() => {
    let totalCalls = 0;
    let totalCredits = 0;
    let refunds = 0;
    for (const e of filtered) {
      if (e.entry_type === "usage") {
        totalCalls++;
        totalCredits += Math.abs(e.delta_credits);
      } else if (e.entry_type === "adjustment" && e.delta_credits > 0) {
        refunds++;
        totalCredits -= e.delta_credits;
      }
    }
    return { totalCalls, totalCredits, refunds };
  }, [filtered]);

  const modelStats = useMemo(() => {
    const map = new Map<string, { calls: number; credits: number; kinds: Set<string> }>();
    for (const e of filtered) {
      const model = e.model || "unknown";
      if (!map.has(model)) map.set(model, { calls: 0, credits: 0, kinds: new Set() });
      const m = map.get(model)!;
      m.calls++;
      m.credits += Math.abs(e.delta_credits);
      if (e.usage_kind) m.kinds.add(e.usage_kind);
    }
    const arr = Array.from(map.entries())
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.credits - a.credits);
    return arr;
  }, [filtered]);

  const maxCredits = useMemo(() => modelStats.length > 0 ? Math.max(...modelStats.map(m => m.credits)) : 1, [modelStats]);

  const periods = ["24h", "7d", "30d", "all"] as const;

  if (!session) return null;

  return (
    <div className={s.fadeIn}>
      <div className={s.timeFilter}>
        {periods.map(p => (
          <button key={p} className={`${s.timeBtn} ${period === p ? s.timeBtnActive : ""}`} onClick={() => setPeriod(p)}>
            {p === "all" ? "All time" : p}
          </button>
        ))}
      </div>

      <div className={s.activityGrid}>
        <div className={s.statCard}>
          <span className={s.statLabel}>API Calls</span>
          <strong className={s.statValue}>{stats.totalCalls.toLocaleString()}</strong>
          <span className={s.statSub}>model requests</span>
        </div>
        <div className={s.statCard}>
          <span className={s.statLabel}>Credits Spent</span>
          <strong className={s.statValue}>{stats.totalCredits.toFixed(4)}</strong>
          <span className={s.statSub}>net after refunds</span>
        </div>
        <div className={s.statCard}>
          <span className={s.statLabel}>Refunds</span>
          <strong className={s.statValue}>{stats.refunds}</strong>
          <span className={s.statSub}>adjustment entries</span>
        </div>
      </div>

      {modelStats.length > 0 && (
        <>
          <div className={s.sectionLabel}>Model Breakdown</div>
          <div className={s.modelGrid}>
            {modelStats.map(m => (
              <div key={m.model} className={s.modelCard}>
                <div className={s.modelTop}>
                  <span className={s.modelName}>{m.model}</span>
                  {m.kinds.size === 1 ? (
                    <span className={`${s.modelBadge} ${KIND_COLORS[Array.from(m.kinds)[0]] || s.badgeDefault}`}>
                      {Array.from(m.kinds)[0]}
                    </span>
                  ) : null}
                </div>
                <div className={s.modelStats}>
                  <div className={s.modelStatItem}><span>Calls</span><span>{m.calls}</span></div>
                  <div className={s.modelStatItem}><span>Credits</span><span>{m.credits.toFixed(4)}</span></div>
                </div>
                {m.kinds.size > 1 && (
                  <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.15rem" }}>
                    {Array.from(m.kinds).map(k => (
                      <span key={k} className={`${s.modelBadge} ${KIND_COLORS[k] || s.badgeDefault}`}>{k}</span>
                    ))}
                  </div>
                )}
                <div className={s.modelBar}>
                  <div className={s.modelBarFill} style={{ width: `${(m.credits / maxCredits) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={s.sectionLabel} style={{ marginTop: "1.5rem" }}>Recent Activity</div>
      {loading ? (
        <div className={s.emptyState}>Loading activity...</div>
      ) : filtered.length === 0 ? (
        <div className={s.emptyState}>No model activity yet.</div>
      ) : (
        <div className={s.activityTable}>
          <div className={s.tableHeader}>
            <span>Model</span>
            <span>Type</span>
            <span>Credits</span>
            <span>Units</span>
            <span>Date</span>
          </div>
          {filtered.slice(0, 100).map((e, i) => {
            const isRefund = e.entry_type === "adjustment" && e.delta_credits > 0;
            return (
              <div key={e.id || i} className={s.tableRow}>
                <div className={s.tableModel}>{e.model || "\u2014"}</div>
                <div className={s.tableType}>
                  <span className={`${s.typeDot} ${isRefund ? s.typeRefund : s.typeUsage}`} />
                  {isRefund ? "Refund" : "Usage"}
                  {e.usage_kind ? <span className={s.tableMuted}>({e.usage_kind})</span> : null}
                </div>
                <div className={`${s.tableCredits} ${e.delta_credits < 0 ? s.creditsNeg : s.creditsPos}`}>
                  {e.delta_credits < 0 ? "" : "+"}{e.delta_credits.toFixed(4)}
                </div>
                <div className={s.tableMuted}>
                  {e.units != null ? e.units : "\u2014"} {e.unit_label || ""}
                </div>
                <div className={s.tableDate}>{fmtDate(e.created_at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
