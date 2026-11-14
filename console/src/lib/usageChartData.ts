/** Turn day/hour-level usage groups into evenly spaced, honest time-series bins. */
export interface ChartDatum { key: string; label: string; credits: number; requests: number }
export interface UsageChartRow { key: string; label: string; credits: number; requests: number }
export type TrendRange = "24h" | "1d" | "7d" | "30d" | "90d" | "365d" | "all";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const toIso = (timestamp: number) => new Date(timestamp).toISOString();
function bucketKey(ms: number, interval: "hour" | "day" | "week" | "month"): string {
  const date = new Date(ms);
  if (interval === "hour") return toIso(ms).slice(0, 13);
  if (interval === "day") return toIso(ms).slice(0, 10);
  if (interval === "month") return toIso(ms).slice(0, 7);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const monday = start - ((date.getUTCDay() + 6) % 7) * DAY;
  return toIso(monday).slice(0, 10);
}
function bucketStart(key: string, interval: "hour" | "day" | "week" | "month"): number {
  return Date.parse(key + (interval === "hour" ? ":00:00Z" : interval === "month" ? "-01T00:00:00Z" : "T00:00:00Z"));
}
function nextStart(ms: number, interval: "hour" | "day" | "week" | "month"): number {
  if (interval === "hour") return ms + HOUR;
  if (interval === "day") return ms + DAY;
  if (interval === "week") return ms + DAY * 7;
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}
function labelFor(key: string, interval: "hour" | "day" | "week" | "month"): string {
  const date = new Date(bucketStart(key, interval));
  if (interval === "hour") return date.toLocaleTimeString(undefined, { hour: "numeric", timeZone: "UTC" });
  if (interval === "month") return date.toLocaleDateString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}
export function trendBins(rows: UsageChartRow[], range: TrendRange, now = Date.now()): { interval: string; bins: ChartDatum[] } {
  const interval: "hour" | "day" | "week" | "month" =
    range === "24h" ? "hour" : range === "365d" ? "month" : range === "90d" ? "week" : "day";
  const validRows = rows.filter((row) => Number.isFinite(Date.parse(
    row.key + (row.key.length === 13 ? ":00:00Z" : row.key.length === 7 ? "-01T00:00:00Z" : "T00:00:00Z")
  )));
  const amounts = new Map<string, { credits: number; requests: number }>();
  for (const row of validRows) {
    const timestamp = Date.parse(row.key + (row.key.length === 13 ? ":00:00Z" : row.key.length === 7 ? "-01T00:00:00Z" : "T00:00:00Z"));
    const key = bucketKey(timestamp, interval);
    const current = amounts.get(key) || { credits: 0, requests: 0 };
    current.credits += Math.max(0, Number(row.credits) || 0);
    current.requests += Math.max(0, Number(row.requests) || 0);
    amounts.set(key, current);
  }
  const fixedDays: Partial<Record<TrendRange, number>> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
  const dayCount = fixedDays[range];
  const last = range === "all" ? Math.max(...validRows.map((row) => Date.parse(
    row.key + (row.key.length === 13 ? ":00:00Z" : row.key.length === 7 ? "-01T00:00:00Z" : "T00:00:00Z")
  )), Number.NEGATIVE_INFINITY) : now;
  if (!Number.isFinite(last)) return { interval, bins: [] };
  const first = range === "all" ? Math.min(...validRows.map((row) => Date.parse(
    row.key + (row.key.length === 13 ? ":00:00Z" : row.key.length === 7 ? "-01T00:00:00Z" : "T00:00:00Z")
  ))) : range === "24h" ? now - (23 * HOUR) : now - ((dayCount ?? 30) - 1) * DAY;
  // Cap unbounded "all loaded" to 60 daily bins, keeping recent months clear.
  const effectiveInterval = range === "all" && last - first > 60 * DAY ? "month" : interval;
  const startKey = bucketKey(first, effectiveInterval);
  const endKey = bucketKey(last, effectiveInterval);
  const end = bucketStart(endKey, effectiveInterval);
  const bins: ChartDatum[] = [];
  for (let cursor = bucketStart(startKey, effectiveInterval); cursor <= end && bins.length < 400; cursor = nextStart(cursor, effectiveInterval)) {
    const key = bucketKey(cursor, effectiveInterval);
    const value = amounts.get(key) || { credits: 0, requests: 0 };
    bins.push({ key, label: labelFor(key, effectiveInterval), ...value });
  }
  // "all" with long spans may have been aggregated by day above; consolidate by month.
  if (effectiveInterval !== interval) {
    const months = new Map<string, { credits: number; requests: number }>();
    for (const [key, value] of amounts) {
      const monthKey = key.slice(0, 7);
      const current = months.get(monthKey) || { credits: 0, requests: 0 };
      current.credits += value.credits;
      current.requests += value.requests;
      months.set(monthKey, current);
    }
    for (const bin of bins) Object.assign(bin, months.get(bin.key) || { credits: 0, requests: 0 });
  }
  return { interval: effectiveInterval, bins };
}
export interface PieSlice { key: string; label: string; credits: number; requests: number; value: number; share: number }
export function pieSlices(rows: UsageChartRow[], metric: "credits" | "requests", maxSegments = 5): PieSlice[] {
  const ordered = [...rows].filter((row) => Number.isFinite(row[metric]) && row[metric] > 0)
    .sort((a, b) => b[metric] - a[metric]);
  const total = ordered.reduce((sum, row) => sum + row[metric], 0);
  if (!total) return [];
  const main = ordered.slice(0, maxSegments);
  const leftover = ordered.slice(maxSegments);
  const slices = leftover.length ? [...main, {
    key: "__remaining_groups__", label: "Other (" + leftover.length + ")", credits: leftover.reduce((s, r) => s + r.credits, 0),
    requests: leftover.reduce((s, r) => s + r.requests, 0),
  }] : main;
  return slices.map((row) => ({ ...row, value: row[metric], share: (row[metric] / total) * 100 }));
}
