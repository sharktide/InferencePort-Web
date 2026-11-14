"use client";

import { useEffect, useMemo, useState } from "react";
import UsageBreakdownView, { countLabel, creditsLabel } from "./UsageBreakdownView";
import UsageCharts, { type UsageMetric } from "./UsageCharts";
import { recentUsage, totals, usageCsv, usageGroups, usageHours, usageService, usageResource, SERVICE_NAMES, type UsageService, type UsageGroupBy, type UsageLedgerRow, type UsagePeriod } from "../../../lib/usageAnalytics";
import s from "./PersonalUsageDashboard.module.css";
import cards from "./orgs/UsageServices.module.css";

interface Props { session: { access_token?: string } | null; apiBase: string }
const PERIODS: { key: UsagePeriod; label: string }[] = [
  { key: "24h", label: "24 hours" }, { key: "7d", label: "7 days" }, { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" }, { key: "all", label: "All loaded" },
];
const GROUPS: { key: UsageGroupBy; label: string }[] = [
  { key: "model", label: "Models" }, { key: "resource", label: "Buckets / deployments" },
  { key: "service", label: "Services" }, { key: "modality", label: "Modalities" }, { key: "day", label: "Days" },
];
const SERVICES: { key: UsageService; name: string; hint: string }[] = [
  { key: "all", name: "All services", hint: "Total wallet charges" },
  { key: "api", name: "Model API", hint: "Inference and generation" },
  { key: "storage", name: "Buckets storage", hint: "Storage and transfer charges" },
  { key: "deployment", name: "Featherless hosting", hint: "Deployment hosting fees" },
  { key: "other", name: "Other charges", hint: "Unclassified billable events" },
];
function defaultGroup(service: UsageService): UsageGroupBy {
  return service === "all" ? "service" : service === "api" ? "model" : "resource";
}
function groupsFor(service: UsageService): UsageGroupBy[] {
  return service === "api" ? ["model", "modality", "day"] :
    service === "all" ? ["service", "day"] : ["resource", "day"];
}
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
  const [service, setService] = useState<UsageService>("api");
  const [by, setBy] = useState<UsageGroupBy>("model");
  const [metric, setMetric] = useState<UsageMetric>("credits");
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
  const serviceGroups = useMemo(() => usageGroups(usage, "service"), [usage]);
  const models = useMemo(() =>
    Array.from(new Set(recentUsage(entries ?? [], "all").filter((e) => usageService(e) === "api")
      .map((entry) => entry.model?.trim() || "Unspecified model"))).sort(),
  [entries]);
  const selected = useMemo(() => {
    const scoped = service === "all" ? usage : usage.filter((entry) => usageService(entry) === service);
    return service === "api" && modelFilter ? scoped.filter((e) => (e.model?.trim() || "Unspecified model") === modelFilter) : scoped;
  }, [usage, service, modelFilter]);
  const selectService = (next: UsageService) => {
    setService(next);
    setBy(defaultGroup(next));
    setModelFilter("");
    setShowRows(25);
  };
  const grouping = useMemo(() => usageGroups(selected, by), [selected, by]);
  const timeline = useMemo(() => period === "24h" ? usageHours(selected) : usageGroups(selected, "day"), [selected, period]);
  const summary = useMemo(() => totals(selected), [selected]);
  const topSource = useMemo(() => usageGroups(selected, service === "api" ? "model" : service === "all" ? "service" : "resource").sort((a, b) => b.credits - a.credits)[0], [selected, service]);
  const recent = useMemo(() => [...selected].sort((a, b) =>
    Date.parse(b.created_at || "") - Date.parse(a.created_at || "")
  ), [selected]);
  const dateLabel = PERIODS.find((p) => p.key === period)?.label || period;
  const dimensionLabel = GROUPS.find((g) => g.key === by)?.label || "Groups";
  const eventLabel = service === "api" ? "requests" : "charge events";
  const serviceName = service === "all" ? "All services" : SERVICE_NAMES[service];

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
          <p>Explore personal wallet charges by service. Model inference, Buckets storage, and Featherless hosting are tracked separately.</p>
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
            {service === "api" && <label>Model
              <select value={modelFilter} onChange={(e) => { setModelFilter(e.target.value); setShowRows(25); }}>
                <option value="">All models</option>
                {models.map((m) => <option value={m} key={m}>{m}</option>)}
              </select>
            </label>}
            <button type="button" className="ghost" onClick={exportCsv} disabled={recent.length === 0}>Export visible period CSV</button>
          </div>

          <div className={cards.serviceCards} role="group" aria-label="Choose personal billed service">
            {SERVICES.map((option) => {
              const bucket = serviceGroups.find((item) => item.key === option.key);
              const amount = option.key === "all" ? totals(usage) : { credits: bucket?.credits ?? 0, requests: bucket?.requests ?? 0 };
              return (
                <button key={option.key} type="button" className={cards.card}
                  aria-pressed={service === option.key} onClick={() => selectService(option.key)}>
                  <span className={cards.cardLabel}>{option.name}</span>
                  <strong className={cards.cardValue}>{creditsLabel(amount.credits)}</strong>
                  <span className={cards.cardHint}>{countLabel(amount.requests)} charges · {option.hint}</span>
                </button>
              );
            })}
          </div>
          <div className={s.summary}>
            <div><span>{serviceName} · credits</span><strong>{creditsLabel(summary.credits)}</strong></div>
            <div><span>{service === "api" ? "Billable inference events" : "Charge events"}</span><strong>{countLabel(summary.requests)}</strong></div>
            <div><span>Credits per charge</span><strong>{creditsLabel(summary.requests ? summary.credits / summary.requests : 0)}</strong></div>
            <div><span>Top {service === "api" ? "model" : "source"} by spend</span><strong className={s.modelName}>{topSource?.label || "—"}</strong></div>
          </div>

          <div className={s.note}>
            Based on the most recent {countLabel(entries.length)} ledger records returned (maximum {LIMIT}, including non-usage events).
            {entries.length >= LIMIT ? " Older records may be excluded; these are not lifetime totals." : " Use “All loaded” to view all the available records."}
            {" "}The counts represent charge events; a charge does not always correspond to one request. Times are local; day groupings use UTC.
          </div>
          <UsageCharts breakdown={grouping} timeline={timeline} range={period} dimensionLabel={dimensionLabel}
            metric={metric} onMetricChange={setMetric} eventLabel={eventLabel} />
          <div className={s.subheading}>
            <h4>Usage breakdown</h4>
            <div className={s.segmented} role="group" aria-label="Group personal usage by">
              {GROUPS.filter((g) => groupsFor(service).includes(g.key)).map((g) => (
                <button key={g.key} type="button" aria-pressed={by === g.key} onClick={() => setBy(g.key)}>{g.label}</button>
              ))}
            </div>
          </div>
          <UsageBreakdownView key={by} rows={grouping} totalCredits={summary.credits}
            totalRequests={summary.requests} dimensionLabel={dimensionLabel} dateDimension={by === "day"}
            metric={metric} onMetricChange={setMetric} eventLabel={eventLabel} />

          <div className={s.subheading}><h4>Recent {service === "api" ? "inference charges" : "wallet charges"}</h4><span>{dateLabel} · {countLabel(recent.length)} loaded debit records</span></div>
          {recent.length === 0 ? <p className={s.empty}>No charges match these filters.</p> : (
            <>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th scope="col">Model / resource</th><th scope="col">Service</th><th scope="col">Credits</th><th scope="col">Units</th><th scope="col">Date</th></tr></thead>
                  <tbody>
                    {recent.slice(0, showRows).map((entry, index) => (
                      <tr key={(entry.id || "entry") + "-" + index}>
                        <th scope="row">{usageResource(entry)}</th>
                        <td>{SERVICE_NAMES[usageService(entry)]}</td>
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
                  Show more charges ({countLabel(recent.length - showRows)} remaining)
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
