"use client";

import { useEffect, useState } from "react";
import styles from "../Panel.module.css";
import shared from "./orgs.module.css";
import manage from "./manage.module.css";
import UsageBreakdownView, { countLabel, creditsLabel } from "../UsageBreakdownView";
import UsageCharts, { type UsageMetric } from "../UsageCharts";
import type { OrgApi, OrgDetail, UsageBreakdown, UsageDimension } from "../../../../lib/orgs";
import { Callout, errorText } from "./shared";
import { EMAIL_RE, planHint } from "./LimitsEditor";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  userId?: string;
}

type Notice = { tone: "ok" | "error"; text: string } | null;
const RANGES = [1, 7, 30, 90, 365] as const;
const DIMENSIONS: { key: UsageDimension; label: string }[] = [
  { key: "user", label: "Members" },
  { key: "key", label: "API keys" },
  { key: "model", label: "Models" },
  { key: "day", label: "Days" },
];

export default function UsageTab({ api, org }: Props) {
  const ent = org.entitlements;
  const canReadAll = org.caps.includes("usage.read_all");
  const canExport = org.caps.includes("usage.export");
  const exportLock = !ent.usage_export ? planHint("usage_export") : !canExport ? "Your role cannot export usage." : null;
  const reportLock = !ent.usage_reports ? planHint("usage_reports") : !canExport ? "Your role cannot email usage reports." : null;

  const [days, setDays] = useState<number>(30);
  const [by, setBy] = useState<UsageDimension>("user");
  const [metric, setMetric] = useState<UsageMetric>("credits");
  const [dailyLoaded, setDailyLoaded] = useState<{ key: string; value: UsageBreakdown } | null>(null);
  const [dailyError, setDailyError] = useState<{ key: string; text: string } | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; value: UsageBreakdown } | null>(null);
  const [loadError, setLoadError] = useState<{ key: string; text: string } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<"csv" | "json" | "report" | null>(null);
  const [reportTo, setReportTo] = useState("");

  const requestKey = [org.slug, days, by, reloadToken].join(":");
  const dayKey = [org.slug, days, reloadToken].join(":");
  const dayData = dailyLoaded?.key === dayKey ? dailyLoaded.value : null;
  const dayError = dailyError?.key === dayKey ? dailyError.text : null;
  const data = by === "day" ? dayData : loaded?.key === requestKey ? loaded.value : null;
  const error = by === "day" ? dayError : loadError?.key === requestKey ? loadError.text : null;

  useEffect(() => {
    if (by === "day") return;
    let live = true;
    api.usage(org.slug, { days, by })
      .then((result) => { if (live) { setLoaded({ key: requestKey, value: result }); setLoadError(null); } })
      .catch((err) => { if (live) { setLoaded(null); setLoadError({ key: requestKey, text: errorText(err) }); } });
    return () => { live = false; };
  }, [api, org.slug, days, by, reloadToken, requestKey]);

  // The server scopes this daily series using the exact same organization permissions as the selected breakdown.
  // Load it separately so changing members/keys/models does not reset the time chart or incur duplicate day requests.
  useEffect(() => {
    let live = true;
    api.usage(org.slug, { days, by: "day" })
      .then((value) => { if (live) { setDailyLoaded({ key: dayKey, value }); setDailyError(null); } })
      .catch((err) => { if (live) { setDailyLoaded(null); setDailyError({ key: dayKey, text: errorText(err) }); } });
    return () => { live = false; };
  }, [api, org.slug, days, reloadToken, dayKey]);

  const download = async (format: "csv" | "json") => {
    if (exportLock || busy) return;
    setBusy(format);
    setNotice(null);
    try {
      const response = await api.usageExport(org.slug, days, format);
      const mime = format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";
      const url = URL.createObjectURL(new Blob([response], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = org.slug + "-usage-" + days + "d." + format;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNotice({ tone: "ok", text: "Exported " + days + " days of organization usage as " + format.toUpperCase() + "." });
    } catch (err) {
      setNotice({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const sendReport = async () => {
    const to = reportTo.trim().toLowerCase();
    if (to && !EMAIL_RE.test(to)) return setNotice({ tone: "error", text: "Enter a valid email address, or leave it blank to send to yourself." });
    if (reportLock || busy) return;
    setBusy("report");
    setNotice(null);
    try {
      const res = await api.sendUsageReport(org.slug, { days, ...(to ? { to } : {}) });
      setNotice({ tone: "ok", text: "Usage report for the last " + days + " days sent to " + res.sent_to + "." });
    } catch (err) {
      setNotice({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const buckets = data?.buckets ?? [];
  const totalCredits = data?.total_credits ?? 0;
  const totalRequests = data?.total_requests ?? 0;

  return (
    <div className={styles.stack}>
      <div className={shared.sectionHead}>
        <span className={shared.sectionTitle}>Organization usage analytics</span>
        <span className={styles.muted}>{canReadAll ? "All organization usage" : "Your organization usage only"}</span>
      </div>
      <p className={styles.muted}>
        Explore credits consumed and requests by member, API key, model, or day.
        {!canReadAll && " Your role only allows you to see your own activity. Ask an owner or administrator for an organization-wide report."}
      </p>

      <div className={manage.toolbar}>
        <div className={manage.toolbarGroup}>
          <label className={shared.field}>
            Time range
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {RANGES.map((r) => <option key={r} value={r}>Last {r} {r === 1 ? "day" : "days"}</option>)}
            </select>
          </label>
          <button className="ghost" type="button" onClick={() => setReloadToken((n) => n + 1)}>Refresh</button>
        </div>
        <div className={manage.segmented} role="group" aria-label="Group organization usage by">
          {DIMENSIONS.map((dimension) => (
            <button key={dimension.key} type="button" className={manage.segment}
              aria-pressed={by === dimension.key} onClick={() => setBy(dimension.key)}>{dimension.label}</button>
          ))}
        </div>
      </div>

      {notice && <Callout tone={notice.tone}>{notice.text}</Callout>}
      {error && (
        <div className={styles.stack}>
          <Callout tone="error">Could not load organization usage: {error}</Callout>
          <div><button type="button" className="ghost" onClick={() => setReloadToken((n) => n + 1)}>Try again</button></div>
        </div>
      )}
      {!data && !error && <p className={styles.muted} role="status">Loading usage breakdown…</p>}
      {data && (
        <>
          <div className={manage.statGrid}>
            <div className={manage.stat}><span className={manage.statLabel}>Credits used</span><strong className={manage.statValue}>{creditsLabel(totalCredits)}</strong></div>
            <div className={manage.stat}><span className={manage.statLabel}>Requests billed</span><strong className={manage.statValue}>{countLabel(totalRequests)}</strong></div>
            <div className={manage.stat}><span className={manage.statLabel}>Credits per request</span><strong className={manage.statValue}>{creditsLabel(totalRequests ? totalCredits / totalRequests : 0)}</strong></div>
            <div className={manage.stat}><span className={manage.statLabel}>Active {DIMENSIONS.find((d) => d.key === by)?.label.toLowerCase()}</span><strong className={manage.statValue}>{countLabel(buckets.length)}</strong></div>
          </div>
          <UsageCharts breakdown={buckets} timeline={dayData?.buckets ?? null} range={days === 1 ? "1d" : days === 7 ? "7d" : days === 30 ? "30d" : days === 90 ? "90d" : "365d"}
            dimensionLabel={DIMENSIONS.find((d) => d.key === by)?.label ?? "Group"}
            metric={metric} onMetricChange={setMetric} timelineError={dayError} />
          <UsageBreakdownView key={by} rows={buckets} totalCredits={totalCredits} totalRequests={totalRequests}
            dimensionLabel={DIMENSIONS.find((d) => d.key === by)?.label ?? "Group"} dateDimension={by === "day"}
            metric={metric} onMetricChange={setMetric} />
          <p className={manage.hintText}>
            Figures reflect organization wallet debits recorded by the server, not personal-wallet usage.
            Switching groups changes how the same usage is grouped, not the total.
          </p>
        </>
      )}

      <div className={shared.sectionHead}><span className={shared.sectionTitle}>Export and reports</span></div>
      <p className={styles.muted}>Download detailed charges for the selected range, or send a report by email. These actions depend on your plan and role.</p>
      <div className={manage.toolbar}>
        <div className={manage.toolbarGroup}>
          <button type="button" className="ghost" onClick={() => void download("csv")} disabled={!!exportLock || !!busy} title={exportLock ?? undefined}>
            {busy === "csv" ? "Exporting…" : "Export CSV"}
          </button>
          <button type="button" className="ghost" onClick={() => void download("json")} disabled={!!exportLock || !!busy} title={exportLock ?? undefined}>
            {busy === "json" ? "Exporting…" : "Export JSON"}
          </button>
        </div>
        {exportLock && <span className={manage.lockHint}>{exportLock}</span>}
      </div>
      <div className={manage.toolbar}>
        <div className={manage.toolbarGroup}>
          <label className={shared.field}>
            Report recipient (optional)
            <input type="email" maxLength={254} placeholder="Your account email"
              value={reportTo} disabled={!!reportLock || !!busy} onChange={(e) => setReportTo(e.target.value)} />
          </label>
          <button type="button" onClick={() => void sendReport()} disabled={!!reportLock || !!busy}>
            {busy === "report" ? "Sending…" : "Email report"}
          </button>
        </div>
        {reportLock && <span className={manage.lockHint}>{reportLock}</span>}
      </div>
      <p className={manage.hintText}>
        Exports contain charge-level records (including member, key, model, and date). Recipients must be your email or an authorized organization billing address.
      </p>
    </div>
  );
}
