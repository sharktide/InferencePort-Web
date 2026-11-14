"use client";

import { useEffect, useMemo, useState } from "react";
import UsageBreakdownView, { countLabel, creditsLabel } from "./UsageBreakdownView";
import { recentUsage, totals, usageCsv, usageGroups, type UsageGroupBy, type UsageLedgerRow, type UsagePeriod } from "../../../lib/usageAnalytics";
import s from "./PersonalUsageDashboard.module.css";

interface Props { session: { access_token?: string } | null; apiBase: string }
const PERIODS: { key: UsagePeriod; label: string }[] = [
  { key: "24h", label: "24 hours" }, { key: "7d", label: "7 days" }, { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" }, { key: "all", label: "All loaded" },
];
const GROUPS: { key: UsageGroupBy; label: string }[] = [
  { key: "model", label: "Models" }, { key: "modality", label: "Modalities" }, { key: "day", label: "Days" },
];
const LIMIT = 500;
function displayDate(iso?: string | null) {
  const ms = Date.parse(iso || "");
  return Number.isFinite(ms) ? new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Unknown";
}

export default function PersonalUsageDashboard({ session, apiBase }: Props) {
  const token = session?.access_token;
  const sourceKey = token ? apiBase + "|" + token : "";
  const [loaded, setLoaded] = useState<{ sourceKey: string; entries: UsageLedgerRow[] } | null>(null);
  const [failure, setFailure] = useState<{ sourceKey: string; message: string } | null>(null);
  const entries = loaded?.sourceKey === sourceKey ? loaded.entries : null;
  const loadError = failure?.sourceKey === sourceKey ? failure.message : "";
  const [reload, setReload] = useState(0);
  const [period, setPeriod] = useState<UsagePeriod>("30d");
  const [by, setBy] = useState<UsageGroupBy>("model");
  const [modelFilter, setModelFilter] = useState("");
  const [showRows, setShowRows] = useState(25);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null);
    setFailure(null);
    if (!token) return () => controller.abort();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]);
    void (async () => {
      try {
        const response = await fetch(apiBase + "/v1/credits/ledger/models?limit=" + LIMIT, {
          headers: { Authorization: "Bearer " + token }, signal,
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof json.detail === "string" ? json.detail : "Unable to load usage (HTTP " + response.status + ")");
        if (!Array.isArray(json.entries)) throw new Error("The usage response was not in the expected format.");
        if (!controller.signal.aborted) setLoaded({ sourceKey, entries: json.entries });
      } catch (err) {
        if (!controller.signal.aborted) setFailure({ sourceKey, message: err instanceof Error ? err.message : "Unable to load usage." });
      }
    })();
    return () => controller.abort();
  }, [token, apiBase, reload, sourceKey]);

  const usage = useMemo(() => recentUsage(entries ?? [], period), [entries, period]);
  const models = useMemo(() =>
    Array.from(new Set(recentUsage(entries ?? [], "all").map((entry) => entry.model?.trim() || "Unspecified model"))).sort(),
  [entries]);
  const selected = useMemo(() =>
    modelFilter ? usage.filter((e) => (e.model?.trim() || "Unspecified model") === modelFilter) : usage,
  [usage, modelFilter]);
  const grouping = useMemo(() => usageGroups(selected, by), [selected, by]);
  const summary = useMemo(() => totals(selected), [selected]);
  const topModel = useMemo(() => usageGroups(selected, "model").sort((a, b) => b.credits - a.credits)[0], [selected]);
  const recent = useMemo(() => [...selected].sort((a, b) =>
    Date.parse(b.created_at || "") - Date.parse(a.created_at || "")
  ), [selected]);
  const dateLabel = PERIODS.find((p) => p.key === period)?.label || period;
  const dimensionLabel = GROUPS.find((g) => g.key === by)?.label || "Groups";

  const exportCsv = () => {
    const csv = usageCsv(recent);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "personal-usage-" + period + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <section className={s.layout} aria-labelledby="personal-usage-heading">
      <header className={s.header}>
        <div>
          <h3 id="personal-usage-heading">Personal P2G usage</h3>
          <p>See where your personal API credits go. Organization spending is tracked in the organization workspace.</p>
        </div>
        <button type="button" className="ghost" onClick={() => setReload((n) => n + 1)}>Refresh</button>
      </header>

      {!token && <p className={s.error} role="alert">Your session has no access token. Sign in again to view usage.</p>}
      {token && loadError && <div className={s.error} role="alert">Could not load usage: {loadError} <button type="button" onClick={() => setReload((n) => n + 1)}>Retry</button></div>}
      {token && !entries && !loadError && <p className={s.empty} role="status">Loading model usage…</p>}
      {entries && (
        <>
          <div className={s.controls}>
            <label>Time range
              <select value={period} onChange={(e) => { setPeriod(e.target.value as UsagePeriod); setShowRows(25); }}>
                {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </label>
            <label>Model
              <select value={modelFilter} onChange={(e) => { setModelFilter(e.target.value); setShowRows(25); }}>
                <option value="">All models</option>
                {models.map((m) => <option value={m} key={m}>{m}</option>)}
              </select>
            </label>
            <button type="button" className="ghost" onClick={exportCsv} disabled={recent.length === 0}>Export visible period CSV</button>
          </div>

          <div className={s.summary}>
            <div><span>Credits used</span><strong>{creditsLabel(summary.credits)}</strong></div>
            <div><span>Requests</span><strong>{countLabel(summary.requests)}</strong></div>
            <div><span>Credits per request</span><strong>{creditsLabel(summary.requests ? summary.credits / summary.requests : 0)}</strong></div>
            <div><span>Top model by spend</span><strong className={s.modelName}>{topModel?.label || "—"}</strong></div>
          </div>

          <div className={s.note}>
            Based on the most recent {countLabel(entries.length)} ledger records returned (maximum {LIMIT}, including non-usage events).
            {entries.length >= LIMIT ? " Older records may be excluded; these are not lifetime totals." : " Use “All loaded” to view all the available records."}
            {" "}All times in your local timezone; day groupings use UTC dates.
          </div>
          <div className={s.subheading}>
            <h4>Usage breakdown</h4>
            <div className={s.segmented} role="group" aria-label="Group personal usage by">
              {GROUPS.map((g) => (
                <button key={g.key} type="button" aria-pressed={by === g.key} onClick={() => setBy(g.key)}>{g.label}</button>
              ))}
            </div>
          </div>
          <UsageBreakdownView key={by} rows={grouping} totalCredits={summary.credits}
            totalRequests={summary.requests} dimensionLabel={dimensionLabel} dateDimension={by === "day"} />

          <div className={s.subheading}><h4>Recent requests</h4><span>{dateLabel} · {countLabel(recent.length)} loaded usage records</span></div>
          {recent.length === 0 ? <p className={s.empty}>No requests match these filters.</p> : (
            <>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th scope="col">Model</th><th scope="col">Modality</th><th scope="col">Credits</th><th scope="col">Units</th><th scope="col">Date</th></tr></thead>
                  <tbody>
                    {recent.slice(0, showRows).map((entry, index) => (
                      <tr key={(entry.id || "entry") + "-" + index}>
                        <th scope="row">{entry.model || "Unspecified model"}</th>
                        <td>{entry.usage_kind || "Other"}</td>
                        <td>{creditsLabel(Math.max(0, -Number(entry.delta_credits || 0)))}</td>
                        <td>{entry.units == null ? "—" : countLabel(entry.units)} {entry.unit_label || ""}</td>
                        <td>{displayDate(entry.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {showRows < recent.length && (
                <button type="button" className="ghost" onClick={() => setShowRows((n) => n + 25)}>
                  Show more requests ({countLabel(recent.length - showRows)} remaining)
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
