"use client";

import { useMemo } from "react";
import { pieSlices, trendBins, type TrendRange, type UsageChartRow } from "../../../lib/usageChartData";
import { countLabel, creditsLabel } from "./UsageBreakdownView";
import s from "./UsageCharts.module.css";

export type UsageMetric = "credits" | "requests";
interface Props {
  breakdown: UsageChartRow[];
  timeline: UsageChartRow[] | null;
  range: TrendRange;
  dimensionLabel: string;
  metric: UsageMetric;
  onMetricChange: (metric: UsageMetric) => void;
  timelineError?: string | null;
}
const COLORS = ["var(--usage-color-1)", "var(--usage-color-2)", "var(--usage-color-3)", "var(--usage-color-4)", "var(--usage-color-5)", "var(--usage-color-6)"];
const CIRCUMFERENCE = Math.PI * 2 * 70;
const format = (value: number, metric: UsageMetric) => metric === "credits" ? creditsLabel(value) : countLabel(value);

export default function UsageCharts({ breakdown, timeline, range, dimensionLabel, metric, onMetricChange, timelineError }: Props) {
  const trend = useMemo(() => timeline ? trendBins(timeline, range) : null, [timeline, range]);
  const slices = useMemo(() => pieSlices(breakdown, metric), [breakdown, metric]);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const max = Math.max(0, ...(trend?.bins.map((bin) => bin[metric]) ?? []));
  const intervalLabel = trend?.interval === "hour" ? "Hourly" : trend?.interval === "week" ? "Weekly" : trend?.interval === "month" ? "Monthly" : "Daily";
  let cumulative = 0;
  return (
    <section className={s.root} aria-labelledby="usage-charts-heading">
      <div className={s.topline}>
        <div>
          <h4 id="usage-charts-heading">Usage visualizations</h4>
          <p>Compare activity over time and see how the total is distributed.</p>
        </div>
        <div className={s.metric} role="group" aria-label="Chart metric">
          {(["credits", "requests"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={metric === value} onClick={() => onMetricChange(value)}>
              {value === "credits" ? "Credits" : "Requests"}
            </button>
          ))}
        </div>
      </div>
      <div className={s.panels}>
        <div className={s.panel}>
          <div className={s.panelTitle}>
            <div><h5>{metric === "credits" ? "Credits over time" : "Requests over time"}</h5>
              <p>{intervalLabel} totals · UTC</p></div>
            <span className={s.hint}>Hover or focus a bar for details</span>
          </div>
          {timelineError ? <p className={s.empty} role="alert">Timeline unavailable: {timelineError}</p> :
            !trend ? <p className={s.empty} role="status">Loading timeline…</p> :
            trend.bins.length === 0 || trend.bins.every((bin) => bin.credits === 0 && bin.requests === 0) ?
              <p className={s.empty}>No usage in this period.</p> : (
                <div className={s.scroll} aria-label={intervalLabel + " usage bar chart"}>
                  <div className={s.plot} style={{ minWidth: trend.bins.length > 12 ? Math.max(480, trend.bins.length * 23) + "px" : "100%" }}>
                    <div className={s.guide}><span>{format(max, metric)}</span><span>{format(max / 2, metric)}</span><span>0</span></div>
                    <div className={s.bars}>
                      <span className={s.gridTop} aria-hidden="true" />
                      <span className={s.gridMiddle} aria-hidden="true" />
                      {trend.bins.map((bin, index) => {
                        const value = bin[metric];
                        const height = max > 0 ? (value / max) * 100 : 0;
                        const showLabel = trend.bins.length <= 12 || index % Math.ceil(trend.bins.length / 9) === 0 || index === trend.bins.length - 1;
                        const description = bin.key + ": " + creditsLabel(bin.credits) + " credits, " + countLabel(bin.requests) + " requests";
                        return (
                          <div key={bin.key} className={s.slot} tabIndex={0} role="img" title={description} aria-label={description}>
                            <span className={s.bar} style={{ height: height + "%", minHeight: value > 0 ? "2px" : 0 }} />
                            <span className={s.axisLabel}>{showLabel ? bin.label : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
        </div>
        <div className={s.panel}>
          <div className={s.panelTitle}>
            <div><h5>Share by {dimensionLabel.toLowerCase()}</h5><p>Share of total {metric === "credits" ? "credits used" : "requests"}</p></div>
          </div>
          {!slices.length ? <p className={s.empty}>No {metric} to break down.</p> : (
            <div className={s.donutLayout}>
              <div className={s.donut}>
                <svg role="img" aria-label={dimensionLabel + " share of " + metric} viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="70" fill="none" stroke="var(--surface-2)" strokeWidth="23" />
                  {slices.map((slice, index) => {
                    const offset = cumulative;
                    const length = slice.share / 100 * CIRCUMFERENCE;
                    cumulative += length;
                    return (
                      <circle key={slice.key} cx="100" cy="100" r="70" fill="none" stroke={COLORS[index]}
                        strokeWidth="23" strokeDasharray={length + " " + (CIRCUMFERENCE - length)}
                        strokeDashoffset={-offset} transform="rotate(-90 100 100)">
                        <title>{slice.label}: {format(slice.value, metric)} ({slice.share.toFixed(1)}%)</title>
                      </circle>
                    );
                  })}
                </svg>
                <div className={s.donutText}>
                  <strong>{format(total, metric)}</strong>
                  <span>{metric === "credits" ? "credits" : "requests"}</span>
                </div>
              </div>
              <ul className={s.legend} aria-label="Chart categories">
                {slices.map((slice, index) => (
                  <li key={slice.key} title={slice.label}>
                    <span className={s.dot} style={{ background: COLORS[index] }} aria-hidden="true" />
                    <span className={s.legendLabel}>{slice.label}</span>
                    <strong>{slice.share.toFixed(1)}%</strong>
                    <small>{format(slice.value, metric)}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
