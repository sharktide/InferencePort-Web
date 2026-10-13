"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../Panel.module.css";
import shared from "./orgs.module.css";
import manage from "./manage.module.css";
import type { OrgApi, OrgDetail, UsageBreakdown, UsageDimension } from "../../../../lib/orgs";
import { Callout, errorText } from "./shared";
import { EMAIL_RE, fmtCredits, planHint } from "./LimitsEditor";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  userId?: string;
}

type Notice = { tone: "ok" | "error"; text: string } | null;

const RANGES = [7, 30, 90] as const;
const DIMENSIONS: { key: UsageDimension; label: string }[] = [
  { key: "user", label: "Members" },
  { key: "key", label: "API keys" },
  { key: "model", label: "Models" },
  { key: "day", label: "Days" },
];

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

export default function UsageTab({ api, org }: Props) {
  const ent = org.entitlements;
  const canReadAll = org.caps.includes("usage.read_all");
  const canExport = org.caps.includes("usage.export");
  const exportLock = !ent.usage_export ? planHint("usage_export") : !canExport ? "Your role cannot export usage." : null;
  const reportLock = !ent.usage_reports ? planHint("usage_reports") : !canExport ? "Your role cannot email usage reports." : null;

  const [days, setDays] = useState<number>(30);
  const [by, setBy] = useState<UsageDimension>("user");
  const [data, setData] = useState<UsageBreakdown | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<"export" | "report" | null>(null);
  const [reportTo, setReportTo] = useState("");

  useEffect(() => {
    let live = true;
    setLoadError(null);
    api
      .usage(org.slug, { days, by })
      .then((res) => { if (live) setData(res); })
      .catch((e) => { if (live) { setData(null); setLoadError(errorText(e)); } });
    return () => { live = false; };
  }, [api, org.slug, days, by, reloadToken]);

  const exportCsv = async () => {
    setBusy("export");
    setNotice(null);
    try {
      const text = await api.usageExport(org.slug, days, "csv");
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${org.slug}-usage-${days}d.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice({ tone: "ok", text: `Exported the last ${days} days as CSV.` });
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  const sendReport = async () => {
    const to = reportTo.trim().toLowerCase();
    if (to && !EMAIL_RE.test(to)) return setNotice({ tone: "error", text: "Enter a valid email address, or leave it blank to send to yourself." });
    setBusy("report");
    setNotice(null);
    try {
      const res = await api.sendUsageReport(org.slug, { days, ...(to ? { to } : {}) });
      setNotice({ tone: "ok", text: `Usage report for the last ${days} days sent to ${res.sent_to}.` });
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  const buckets = data?.buckets ?? [];
  const maxCredits = buckets.reduce((m, b) => Math.max(m, b.credits), 0);
  const total = data?.total_credits ?? 0;
  const totalRequests = data?.total_requests ?? 0;

  return (
    <div className={styles.stack}>
      <div className={shared.sectionHead}>
        <span className={shared.sectionTitle}>Usage</span>
        <span className={`${styles.muted} ${styles.tiny}`}>
          {canReadAll ? "Organization-wide" : "Your usage"}
        </span>
      </div>

      {!canReadAll && (
        <p className={`${styles.muted} ${styles.tiny}`}>Your role shows only your own usage in this organization.</p>
      )}

      <div className={manage.toolbar}>
        <div className={manage.toolbarGroup}>
          <label className={shared.field}>
            Range
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {RANGES.map((r) => <option key={r} value={r}>Last {r} days</option>)}
            </select>
          </label>
        </div>
        <div className={manage.segmented} role="group" aria-label="Group usage by">
          {DIMENSIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              className={manage.segment}
              aria-pressed={by === d.key}
              onClick={() => setBy(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {notice && <Callout tone={notice.tone}>{notice.text}</Callout>}

      {loadError && (
        <div className={styles.stack}>
          <Callout tone="error">{loadError}</Callout>
          <div><button type="button" className="ghost" onClick={() => setReloadToken((n) => n + 1)}>Retry</button></div>
        </div>
      )}
      {!data && !loadError && <p className={styles.muted}>Loading usage…</p>}

      {data && (
        <>
          <div className={manage.statGrid}>
            <div className={manage.stat}>
              <span className={manage.statLabel}>Credits used</span>
              <span className={manage.statValue}>{fmtCredits(total)}</span>
            </div>
            <div className={manage.stat}>
              <span className={manage.statLabel}>Requests</span>
              <span className={manage.statValue}>{totalRequests.toLocaleString()}</span>
            </div>
            <div className={manage.stat}>
              <span className={manage.statLabel}>Groups</span>
              <span className={manage.statValue}>{buckets.length}</span>
            </div>
          </div>

          {buckets.length === 0 ? (
            <p className={styles.muted}>No usage in the last {days} days.</p>
          ) : (
            <>
              <div className={manage.bars} role="list" aria-label={`Credits by ${DIMENSIONS.find((d) => d.key === by)?.label ?? by}`}>
                {buckets.map((b) => (
                  <div key={b.key} className={manage.barRow} role="listitem">
                    <span className={manage.barLabel}>{b.label}</span>
                    <span className={manage.barTrack} aria-hidden="true">
                      <span className={manage.barFill} style={{ display: "block", width: `${maxCredits > 0 ? (b.credits / maxCredits) * 100 : 0}%` }} />
                    </span>
                    <span className={manage.barValue}>{fmtCredits(b.credits)} · {pct(b.credits, total)}%</span>
                  </div>
                ))}
              </div>

              <div className={shared.tableWrap}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th scope="col">{DIMENSIONS.find((d) => d.key === by)?.label ?? "Group"}</th>
                      <th scope="col">Credits</th>
                      <th scope="col">Requests</th>
                      <th scope="col">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((b) => (
                      <tr key={b.key}>
                        <td className={shared.wrapAnywhere}>{b.label}</td>
                        <td>{fmtCredits(b.credits)}</td>
                        <td>{b.requests.toLocaleString()}</td>
                        <td>{pct(b.credits, total)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <div className={shared.sectionHead}>
        <span className={shared.sectionTitle}>Export and reports</span>
      </div>
      <div className={manage.toolbar}>
        <div className={manage.toolbarGroup}>
          <button
            type="button"
            className="ghost"
            onClick={exportCsv}
            disabled={!!exportLock || busy !== null}
            title={exportLock ?? undefined}
          >
            {busy === "export" ? "Exporting…" : "Export CSV"}
          </button>
          {exportLock && <span className={manage.lockHint}>{exportLock}</span>}
        </div>
      </div>

      <div className={manage.toolbar}>
        <div className={manage.toolbarGroup}>
          <label className={shared.field}>
            Send report to (optional)
            <input
              type="email"
              maxLength={254}
              placeholder="Your email"
              value={reportTo}
              disabled={!!reportLock || busy !== null}
              onChange={(e) => setReportTo(e.target.value)}
            />
          </label>
          <button type="button" onClick={sendReport} disabled={!!reportLock || busy !== null}>
            {busy === "report" ? "Sending…" : "Email report"}
          </button>
        </div>
        {reportLock && <span className={manage.lockHint}>{reportLock}</span>}
      </div>
      <p className={manage.hintText}>
        Reports and exports cover the selected range and include the member, key, model and day for each charge. The recipient must be a billing address for this organization or your own email.
      </p>
    </div>
  );
}
