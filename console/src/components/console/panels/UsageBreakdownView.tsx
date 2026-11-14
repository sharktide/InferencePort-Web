"use client";

import { useMemo, useState } from "react";
import s from "./UsageBreakdownView.module.css";

export interface UsageBreakdownRow {
  key: string;
  label: string;
  credits: number;
  requests: number;
}
export type Metric = "credits" | "requests";
type Sort = "credits" | "requests" | "name" | "date";

export const creditsLabel = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "0.00";
export const countLabel = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString() : "0";
const pct = (part: number, whole: number) => whole > 0 ? (part / whole) * 100 : 0;

interface Props {
  rows: UsageBreakdownRow[];
  totalCredits: number;
  totalRequests: number;
  dimensionLabel: string;
  dateDimension?: boolean;
  metric?: Metric;
  onMetricChange?: (metric: Metric) => void;
  eventLabel?: string;
}

export default function UsageBreakdownView({ rows, totalCredits, totalRequests, dimensionLabel, dateDimension = false, metric, onMetricChange, eventLabel = "requests" }: Props) {
  const [internalMetric, setInternalMetric] = useState<Metric>("credits");
  const activeMetric = metric ?? internalMetric;
  const [sort, setSort] = useState<Sort>(dateDimension ? "date" : "credits");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(25);

  const results = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const list = rows.filter((row) => row.label.toLocaleLowerCase().includes(q));
    return [...list].sort((a, b) => {
      if (sort === "date") return a.key.localeCompare(b.key);
      if (sort === "name") return a.label.localeCompare(b.label);
      if (sort === "requests") return b.requests - a.requests || a.label.localeCompare(b.label);
      return b.credits - a.credits || a.label.localeCompare(b.label);
    });
  }, [rows, search, sort, dateDimension]);

  const chartRows = dateDimension && sort === "date" ? results.slice(-10) : [...results].sort((a, b) => b[activeMetric] - a[activeMetric]).slice(0, 10);
  const maxValue = Math.max(0, ...chartRows.map((row) => row[activeMetric]));
  const total = activeMetric === "credits" ? totalCredits : totalRequests;

  return (
    <div className={s.layout}>
      <div className={s.controls}>
        {!onMetricChange && <fieldset className={s.metricField}>
          <legend>Compare by</legend>
          <div className={s.toggle}>
            {(["credits", "requests"] as const).map((name) => (
              <button key={name} type="button" aria-pressed={activeMetric === name} onClick={() => setInternalMetric(name)}>{name === "credits" ? "Credits" : eventLabel === "requests" ? "Requests" : "Charges"}</button>
            ))}
          </div>
        </fieldset>}
        <label className={s.field}>Search {dimensionLabel.toLowerCase()}
          <input type="search" placeholder={"Find " + dimensionLabel.toLowerCase()} value={search} onChange={(e) => { setSearch(e.target.value); setVisible(25); }} />
        </label>
        <label className={s.field}>Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="credits">Most credits</option>
            <option value="requests">Most requests</option>
            <option value="name">Name A–Z</option>
            {dateDimension && <option value="date">Oldest first</option>}
          </select>
        </label>
      </div>

      <div className={s.resultCount} aria-live="polite">
        Showing {countLabel(results.length)} of {countLabel(rows.length)} {dimensionLabel.toLowerCase()} groups.
        {search && " Percentages refer to the whole selected period."}
      </div>

      {results.length === 0 ? (
        <p className={s.empty}>{rows.length === 0 ? "No usage has been recorded in this period." : "No groups match your search."}</p>
      ) : (
        <>
          <div className={s.chart} aria-label={dimensionLabel + " breakdown"}>
            <div className={s.chartHead}><strong>{activeMetric === "credits" ? "Credits used" : eventLabel === "requests" ? "Requests" : "Charges"}</strong><span>{dateDimension && sort === "date" ? "Latest " + chartRows.length + " days" : "Top " + chartRows.length + " groups"}</span></div>
            {chartRows.map((row) => {
              const value = row[activeMetric];
              return (
                <div key={row.key} className={s.barRow}>
                  <span className={s.barLabel} title={row.label}>{row.label}</span>
                  <div className={s.barTrack} role="img" aria-label={row.label + ": " + (activeMetric === "credits" ? creditsLabel(value) + " credits" : countLabel(value) + " " + eventLabel)}>
                    <span className={s.barFill} style={{ width: (maxValue > 0 ? value / maxValue * 100 : 0) + "%" }} />
                  </div>
                  <strong className={s.barAmount}>{activeMetric === "credits" ? creditsLabel(value) : countLabel(value)}</strong>
                </div>
              );
            })}
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th scope="col">{dimensionLabel}</th><th scope="col">Credits</th><th scope="col">{eventLabel === "requests" ? "Requests" : "Charges"}</th><th scope="col">Share of {activeMetric === "credits" ? "credits" : eventLabel}</th></tr></thead>
              <tbody>
                {results.slice(0, visible).map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td data-label="Credits">{creditsLabel(row.credits)}</td>
                    <td data-label={eventLabel === "requests" ? "Requests" : "Charges"}>{countLabel(row.requests)}</td>
                    <td data-label={"Share of " + (activeMetric === "credits" ? "credits" : eventLabel)}>{pct(row[activeMetric], total).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible < results.length && (
            <button className={s.showMore} type="button" onClick={() => setVisible((n) => n + 25)}>
              Show more ({countLabel(results.length - visible)} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}
