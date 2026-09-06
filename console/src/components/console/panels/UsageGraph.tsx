"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import s from "./UsageGraph.module.css";

interface Props { session: any; apiBase: string; }

interface LedgerEntry {
  id: string;
  delta_credits: number;
  entry_type: string;
  usage_kind?: string;
  units?: number;
  unit_label?: string;
  model?: string;
  created_at?: string;
}

interface BarData {
  label: string;
  time: number;
  credits: number;
  requests: number;
  entries: LedgerEntry[];
}

function getBarKey(date: Date, period: string): string {
  if (period === "24h") return `${date.getHours().toString().padStart(2, "0")}:00`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getBarTime(date: Date, period: string): number {
  if (period === "24h") {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d.getTime();
  }
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtDate(iso?: string) {
  if (!iso) return "\u2014";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function UsageGraph({ session, apiBase }: Props) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [metric, setMetric] = useState<"credits" | "requests">("credits");
  const [modelFilter, setModelFilter] = useState("all");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; bar: BarData } | null>(null);
  const [touchedBar, setTouchedBar] = useState<number | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);

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

  const usageEntries = useMemo(() => entries.filter(e => e.entry_type === "usage"), [entries]);

  const models = useMemo(() => {
    const set = new Set<string>();
    usageEntries.forEach(e => { if (e.model) set.add(e.model); });
    return Array.from(set).sort();
  }, [usageEntries]);

  const filtered = useMemo(() => {
    let result = usageEntries;
    if (modelFilter !== "all") result = result.filter(e => e.model === modelFilter);
    const now = new Date();
    if (period === "24h") {
      const cutoff = now.getTime() - 86400000;
      result = result.filter(e => e.created_at && new Date(e.created_at).getTime() >= cutoff);
    } else if (period === "7d") {
      const cutoff = now.getTime() - 604800000;
      result = result.filter(e => e.created_at && new Date(e.created_at).getTime() >= cutoff);
    } else if (period === "30d") {
      const cutoff = now.getTime() - 2592000000;
      result = result.filter(e => e.created_at && new Date(e.created_at).getTime() >= cutoff);
    }
    return result;
  }, [usageEntries, modelFilter, period]);

  const bars = useMemo(() => {
    const map = new Map<string, BarData>();
    for (const e of filtered) {
      if (!e.created_at) continue;
      const date = new Date(e.created_at);
      const key = getBarKey(date, period);
      const time = getBarTime(date, period);
      if (!map.has(key)) map.set(key, { label: key, time, credits: 0, requests: 0, entries: [] });
      const bar = map.get(key)!;
      bar.credits += Math.abs(e.delta_credits);
      bar.requests++;
      bar.entries.push(e);
    }
    return Array.from(map.values()).sort((a, b) => a.time - b.time);
  }, [filtered, period]);

  const maxVal = useMemo(() => {
    if (bars.length === 0) return 1;
    return Math.max(...bars.map(b => metric === "credits" ? b.credits : b.requests)) || 1;
  }, [bars, metric]);

  const summary = useMemo(() => {
    let totalCredits = 0;
    let totalRequests = 0;
    const modelMap = new Map<string, { credits: number; requests: number }>();
    for (const e of filtered) {
      totalCredits += Math.abs(e.delta_credits);
      totalRequests++;
      const model = e.model || "unknown";
      if (!modelMap.has(model)) modelMap.set(model, { credits: 0, requests: 0 });
      const m = modelMap.get(model)!;
      m.credits += Math.abs(e.delta_credits);
      m.requests++;
    }
    let topModel = "";
    let topCredits = 0;
    let topReqs = 0;
    for (const [model, data] of modelMap) {
      if (data.credits > topCredits) {
        topModel = model;
        topCredits = data.credits;
        topReqs = data.requests;
      }
    }
    return { totalCredits, totalRequests, topModel, topCredits, topReqs };
  }, [filtered]);

  const periods = ["24h", "7d", "30d", "all"] as const;

  const showTooltip = (barEl: HTMLElement, bar: BarData) => {
    const rect = barEl.getBoundingClientRect();
    const graphRect = graphRef.current?.getBoundingClientRect();
    if (graphRect) {
      let x = rect.left - graphRect.left + rect.width / 2;
      let y = rect.top - graphRect.top - 8;
      if (y < 120) y = rect.bottom - graphRect.top + 8;
      setTooltip({ x, y, bar });
    }
  };

  const hideTooltip = () => { setTooltip(null); setTouchedBar(null); };

  const handleTouch = (barEl: HTMLElement, bar: BarData, idx: number) => {
    if (touchedBar === idx) { hideTooltip(); return; }
    setTouchedBar(idx);
    showTooltip(barEl, bar);
  };

  if (!session) return null;

  return (
    <div className={s.graphWrapper} onClick={(e) => { if (touchedBar !== null && !graphRef.current?.contains(e.target as Node)) hideTooltip(); }}>
      <div className={s.controls}>
        <div className={s.controlGroup}>
          <span className={s.controlLabel}>Models</span>
          <select className={s.modelSelect} value={modelFilter} onChange={e => setModelFilter(e.target.value)}>
            <option value="all">All</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className={s.controlGroup}>
          <span className={s.controlLabel}>Metric</span>
          <div className={s.metricToggle}>
            <button className={`${s.metricBtn} ${metric === "credits" ? s.metricBtnActive : ""}`} onClick={() => setMetric("credits")}>Credits</button>
            <button className={`${s.metricBtn} ${metric === "requests" ? s.metricBtnActive : ""}`} onClick={() => setMetric("requests")}>Requests</button>
          </div>
        </div>
        <div className={s.controlGroup}>
          <span className={s.controlLabel}>Timeframe</span>
          <div className={s.metricToggle}>
            {periods.map(p => (
              <button key={p} className={`${s.metricBtn} ${period === p ? s.metricBtnActive : ""}`} onClick={() => setPeriod(p)}>
                {p === "all" ? "All" : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={s.chartContainer} ref={graphRef}>
        {loading ? (
          <div className={s.emptyState}>Loading chart...</div>
        ) : bars.length === 0 ? (
          <div className={s.emptyState}>No usage data for this period.</div>
        ) : (
          <>
            <div className={s.chartArea}>
              <div className={s.yAxis}>
                {Array.from({ length: 5 }, (_, i) => {
                  const val = (maxVal / 4) * (4 - i);
                  return (
                    <span key={i} className={s.yLabel}>
                      {metric === "credits" ? val.toFixed(val >= 1 ? 1 : 4) : Math.round(val)}
                    </span>
                  );
                })}
              </div>
              <div className={s.barsContainer}>
                {bars.map((bar, i) => {
                  const val = metric === "credits" ? bar.credits : bar.requests;
                  const heightPct = (val / maxVal) * 100;
                  return (
                    <div key={i} className={s.barCol}>
                      <div
                        className={s.barWrapper}
                        onMouseEnter={(e) => showTooltip(e.currentTarget, bar)}
                        onMouseLeave={hideTooltip}
                        onTouchStart={(e) => { e.preventDefault(); handleTouch(e.currentTarget, bar, i); }}
                      >
                        <div className={`${s.bar} ${touchedBar === i ? s.barActive : ""}`} style={{ height: `${heightPct}%` }} />
                      </div>
                      <span className={s.xLabel}>{bar.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {tooltip && (
              <div className={s.tooltip} style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}>
                <div className={s.tooltipHeader}>{tooltip.bar.label}</div>
                <div className={s.tooltipRow}>
                  <span>Credits</span><strong>{tooltip.bar.credits.toFixed(4)}</strong>
                </div>
                <div className={s.tooltipRow}>
                  <span>Requests</span><strong>{tooltip.bar.requests}</strong>
                </div>
                {tooltip.bar.entries.length > 0 && (
                  <div className={s.tooltipModels}>
                    {Array.from(new Map(tooltip.bar.entries.map(e => [e.model || "unknown", { credits: 0, requests: 0 }])).entries()).map(([model]) => {
                      const me = tooltip.bar.entries.filter(e => (e.model || "unknown") === model);
                      const mCredits = me.reduce((sum, e) => sum + Math.abs(e.delta_credits), 0);
                      return (
                        <div key={model} className={s.tooltipModelRow}>
                          <span className={s.tooltipModelDot} />
                          <span>{model}</span>
                          <span>{mCredits.toFixed(4)} cr</span>
                          <span>{me.length} req{me.length !== 1 ? "s" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className={s.summaryRow}>
        <div className={s.summaryCard}>
          <span className={s.summaryLabel}>Credits Spent</span>
          <strong className={s.summaryValue}>{summary.totalCredits.toFixed(4)}</strong>
        </div>
        <div className={s.summaryCard}>
          <span className={s.summaryLabel}>Requests</span>
          <strong className={s.summaryValue}>{summary.totalRequests.toLocaleString()}</strong>
        </div>
        {summary.topModel && (
          <div className={s.summaryCard}>
            <span className={s.summaryLabel}>Top Model</span>
            <strong className={s.summaryValue}>{summary.topModel}</strong>
            <span className={s.summarySub}>{summary.topReqs} reqs &middot; {summary.topCredits.toFixed(4)} cr</span>
          </div>
        )}
      </div>
    </div>
  );
}
