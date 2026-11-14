"use client";

import { useMemo, useState } from "react";
import { pieSlices, trendBins, type TrendRange, type UsageChartRow } from "../../../lib/usageChartData";
import { countLabel as numberLabel, creditsLabel } from "./UsageBreakdownView";
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
  eventLabel?: string;
}
const COLORS = ["var(--usage-color-1)", "var(--usage-color-2)", "var(--usage-color-3)", "var(--usage-color-4)", "var(--usage-color-5)", "var(--usage-color-6)"];
const CIRCUMFERENCE = Math.PI * 2 * 70;
const format = (value: number, metric: UsageMetric) => metric === "credits" ? creditsLabel(value) : numberLabel(value);

export default function UsageCharts({
  breakdown, timeline, range, dimensionLabel, metric, onMetricChange, timelineError, eventLabel = "requests",
}: Props) {
  const trend = useMemo(() => timeline ? trendBins(timeline, range) : null, [timeline, range]);
  const slices = useMemo(() => pieSlices(breakdown, metric), [breakdown, metric]);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const totalTrend = (trend?.bins ?? []).reduce((sum, bin) => sum + bin[metric], 0);
  const max = Math.max(0, ...(trend?.bins.map((bin) => bin[metric]) ?? []));
  const intervalLabel = trend?.interval === "hour" ? "Hourly" : trend?.interval === "week" ? "Weekly" : trend?.interval === "month" ? "Monthly" : "Daily";
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [pinnedBar, setPinnedBar] = useState<string | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [pinnedSlice, setPinnedSlice] = useState<string | null>(null);
  const activeBar = trend?.bins.find((bin) => bin.key === (hoveredBar ?? pinnedBar));
  const activeSlice = slices.find((slice) => slice.key === (hoveredSlice ?? pinnedSlice));
  let cumulative = 0;
  return (
    <section className={s.root} aria-label="Usage charts">
      <div className={s.topline}>
        <div>
          <h4>Usage visualizations</h4>
          <p>Inspect daily trends and where spending is distributed. Select a bar or slice to pin its details.</p>
        </div>
        <div className={s.metric} role="group" aria-label="Chart metric">
          {(["credits", "requests"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={metric === value} onClick={() => onMetricChange(value)}>
              {value === "credits" ? "Credits" : eventLabel === "requests" ? "Requests" : "Charges"}
            </button>
          ))}
        </div>
      </div>
      <div className={s.panels}>
        <div className={s.panel}>
          <div className={s.panelTitle}>
            <div>
              <h5>{metric === "credits" ? "Credits over time" : (eventLabel === "requests" ? "Requests" : "Charges") + " over time"}</h5>
              <p>{intervalLabel} totals · UTC</p>
            </div>
            <span className={s.hint}>Hover, focus or click a bar</span>
          </div>
          {timelineError ? <p className={s.empty} role="alert">Timeline unavailable: {timelineError}</p> :
            !trend ? <p className={s.empty} role="status">Loading timeline…</p> :
            trend.bins.length === 0 || trend.bins.every((bin) => bin.credits === 0 && bin.requests === 0) ?
              <p className={s.empty}>No usage in this period.</p> : (
                <>
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
                          const description = bin.key + ": " + creditsLabel(bin.credits) + " credits, " + numberLabel(bin.requests) + " " + eventLabel;
                          return (
                            <button key={bin.key} type="button"
                              className={s.slot + (pinnedBar === bin.key ? " " + s.slotSelected : "")}
                              aria-label={description} aria-pressed={pinnedBar === bin.key}
                              onMouseEnter={() => setHoveredBar(bin.key)}
                              onMouseLeave={() => setHoveredBar(null)}
                              onFocus={() => setHoveredBar(bin.key)}
                              onBlur={() => setHoveredBar(null)}
                              onClick={() => setPinnedBar((current) => current === bin.key ? null : bin.key)}>
                              <span className={s.bar} style={{ height: height + "%", minHeight: value > 0 ? "2px" : 0 }} />
                              <span className={s.axisLabel}>{showLabel ? bin.label : ""}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className={s.inspect} aria-live="polite" aria-atomic="true">
                    {activeBar ? (
                      <>
                        <strong>{activeBar.key} UTC</strong>
                        <span>{creditsLabel(activeBar.credits)} credits</span>
                        <span>{numberLabel(activeBar.requests)} {eventLabel}</span>
                        <span>{totalTrend > 0 ? (activeBar[metric] / totalTrend * 100).toFixed(1) : "0.0"}% of displayed {metric === "credits" ? "credits" : eventLabel}</span>
                        {pinnedBar === activeBar.key && <button type="button" className={s.clear} onClick={() => setPinnedBar(null)}>Clear selection</button>}
                      </>
                    ) : <span className={s.inspectHint}>Point to a bar for its credits, {eventLabel}, and share; click to keep it selected.</span>}
                  </div>
                </>
              )}
        </div>
        <div className={s.panel}>
          <div className={s.panelTitle}>
            <div>
              <h5>Share by {dimensionLabel.toLowerCase()}</h5>
              <p>Share of total {metric === "credits" ? "credits used" : eventLabel}</p>
            </div>
            <span className={s.hint}>Select a slice or legend item</span>
          </div>
          {!slices.length ? <p className={s.empty}>No {metric === "credits" ? "credits" : eventLabel} to break down.</p> : (
            <>
              <div className={s.donutLayout}>
                <div className={s.donut}>
                  <svg role="img" aria-label={dimensionLabel + " share of " + metric} viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="70" fill="none" stroke="var(--surface-2)" strokeWidth="23" />
                    {slices.map((slice, index) => {
                      const offset = cumulative;
                      const length = slice.share / 100 * CIRCUMFERENCE;
                      cumulative += length;
                      const selected = slice.key === (hoveredSlice ?? pinnedSlice);
                      const description = slice.label + ": " + format(slice.value, metric) + " (" + slice.share.toFixed(1) + "%)";
                      return (
                        <circle key={slice.key} cx="100" cy="100" r="70" fill="none" stroke={COLORS[index]}
                          className={s.arc + (selected ? " " + s.arcActive : "")} strokeWidth="23"
                          strokeDasharray={length + " " + Math.max(0, CIRCUMFERENCE - length)}
                          strokeDashoffset={-offset} transform="rotate(-90 100 100)"
                          role="button" tabIndex={0} aria-label={description}
                          aria-pressed={pinnedSlice === slice.key}
                          onMouseEnter={() => setHoveredSlice(slice.key)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          onFocus={() => setHoveredSlice(slice.key)}
                          onBlur={() => setHoveredSlice(null)}
                          onClick={() => setPinnedSlice((current) => current === slice.key ? null : slice.key)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setPinnedSlice((current) => current === slice.key ? null : slice.key); } }}>
                          <title>{description}</title>
                        </circle>
                      );
                    })}
                  </svg>
                  <div className={s.donutText}>
                    <strong>{activeSlice ? format(activeSlice.value, metric) : format(total, metric)}</strong>
                    <span>{activeSlice ? activeSlice.share.toFixed(1) + "% of total" : metric === "credits" ? "credits" : eventLabel}</span>
                  </div>
                </div>
                <ul className={s.legend} aria-label="Chart categories">
                  {slices.map((slice, index) => (
                    <li key={slice.key}>
                      <button type="button" title={slice.label}
                        className={s.legendButton + (pinnedSlice === slice.key ? " " + s.legendActive : "")}
                        aria-pressed={pinnedSlice === slice.key}
                        onMouseEnter={() => setHoveredSlice(slice.key)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        onFocus={() => setHoveredSlice(slice.key)}
                        onBlur={() => setHoveredSlice(null)}
                        onClick={() => setPinnedSlice((current) => current === slice.key ? null : slice.key)}>
                        <span className={s.dot} style={{ background: COLORS[index] }} aria-hidden="true" />
                        <span className={s.legendLabel}>{slice.label}</span>
                        <strong>{slice.share.toFixed(1)}%</strong>
                        <small>{format(slice.value, metric)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {activeSlice && (
                <div className={s.inspect} aria-live="polite" aria-atomic="true">
                  <strong>{activeSlice.label}</strong>
                  <span>{creditsLabel(activeSlice.credits)} credits</span>
                  <span>{numberLabel(activeSlice.requests)} {eventLabel}</span>
                  <span>{activeSlice.share.toFixed(1)}% of total {metric === "credits" ? "credits" : eventLabel}</span>
                  {pinnedSlice === activeSlice.key && <button className={s.clear} type="button" onClick={() => setPinnedSlice(null)}>Clear selection</button>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
