/** Aggregation of recent *personal* P2G ledger charges. Organization totals come from the org breakdown API. */
export interface UsageLedgerRow {
  id?: string;
  entry_type: string;
  delta_credits: number;
  created_at?: string | null;
  model?: string | null;
  usage_kind?: string | null;
  units?: number | null;
  unit_label?: string | null;
  source?: string | null;
  source_ref?: string | null;
  metadata?: Record<string, unknown> | null;
}
export type UsagePeriod = "24h" | "7d" | "30d" | "90d" | "all";
export type UsageGroupBy = "model" | "modality" | "day" | "service" | "resource";
export type UsageService = "all" | "api" | "storage" | "deployment" | "other";
export const SERVICE_NAMES: Record<Exclude<UsageService, "all">, string> = {
  api: "Model API", storage: "Buckets storage", deployment: "Featherless hosting", other: "Other charges",
};
const INFERENCE_KINDS = new Set(["text", "image", "video", "audio", "model3d", "embedding", "realtime", "decision"]);

/** Match the server ledger service attribution; unknown charges do not become model calls. */
export function usageService(entry: UsageLedgerRow): Exclude<UsageService, "all"> {
  const kind = (entry.usage_kind || "").toLowerCase();
  if (kind === "storage" || entry.source === "buckets") return "storage";
  if (kind === "deployment" || entry.source === "v1_deploy_fee") return "deployment";
  return INFERENCE_KINDS.has(kind) ? "api" : "other";
}
function resourceIdentifier(entry: UsageLedgerRow): string {
  const category = usageService(entry);
  const meta = entry.metadata || {};
  if (category === "storage") return String(meta.bucket_id || entry.source_ref || "unknown");
  if (category === "deployment") return String(meta.deployment_id || "unknown");
  return entry.model?.trim() || entry.usage_kind?.trim() || "Unspecified";
}
/** Full resource identity for correct aggregation, even when labels are abbreviated. */
export function usageResourceKey(entry: UsageLedgerRow): string {
  return usageService(entry) + ":" + resourceIdentifier(entry);
}
export function usageResource(entry: UsageLedgerRow, full = false): string {
  const category = usageService(entry);
  if (category === "api") return entry.model?.trim() || "Unspecified model";
  if (category === "other") return entry.usage_kind?.trim() || "Other charges";
  const id = resourceIdentifier(entry);
  return (category === "storage" ? "Bucket " : "Deployment ") + (full ? id : id.slice(0, 12));
}
export interface UsageGroup { key: string; label: string; credits: number; requests: number }

const PERIOD_MS: Record<Exclude<UsagePeriod, "all">, number> = {
  "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, "90d": 90 * 86_400_000,
};
export const amountSpent = (entry: UsageLedgerRow): number => {
  const amount = Number(entry.delta_credits);
  return Number.isFinite(amount) ? Math.max(0, -amount) : 0;
};

export function recentUsage(entries: UsageLedgerRow[], period: UsagePeriod, now = Date.now()): UsageLedgerRow[] {
  const cutoff = period === "all" ? null : now - PERIOD_MS[period];
  return entries.filter((entry) => {
    if (entry.entry_type !== "usage") return false;
    if (cutoff === null) return true;
    const date = Date.parse(entry.created_at || "");
    return Number.isFinite(date) && date >= cutoff && date <= now;
  });
}

export function usageGroups(entries: UsageLedgerRow[], by: UsageGroupBy): UsageGroup[] {
  const groups = new Map<string, UsageGroup>();
  for (const entry of entries) {
    let key: string;
    if (by === "model") key = entry.model?.trim() || "Unspecified model";
    else if (by === "resource") key = usageResourceKey(entry);
    else if (by === "service") key = usageService(entry);
    else if (by === "modality") key = entry.usage_kind?.trim() || "Other / unspecified";
    else {
      const date = Date.parse(entry.created_at || "");
      key = Number.isFinite(date) ? new Date(date).toISOString().slice(0, 10) : "Unknown date";
    }
    const group = groups.get(key) || { key, label: by === "service" ? SERVICE_NAMES[key as Exclude<UsageService, "all">] : by === "resource" ? usageResource(entry) : key, credits: 0, requests: 0 };
    group.credits += amountSpent(entry);
    group.requests++;
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

/** UTC-hour grouping for a genuine 24-hour trend, rather than two calendar-day bars. */
export function usageHours(entries: UsageLedgerRow[]): UsageGroup[] {
  const groups = new Map<string, UsageGroup>();
  for (const entry of entries) {
    const time = Date.parse(entry.created_at || "");
    if (!Number.isFinite(time)) continue;
    const key = new Date(time).toISOString().slice(0, 13);
    const group = groups.get(key) || { key, label: key, credits: 0, requests: 0 };
    group.credits += amountSpent(entry);
    group.requests += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function totals(entries: UsageLedgerRow[]) {
  return { credits: entries.reduce((sum, entry) => sum + amountSpent(entry), 0), requests: entries.length };
}

/** Prevent a model name or metadata value from being interpreted as a spreadsheet formula. */
export function csvCell(value: unknown): string {
  let str = value == null ? "" : String(value);
  if (/^[\s\uFEFF\u200B]*[=+\-@]/u.test(str) || /^[\t\r\n]/.test(str)) str = "'" + str;
  return '"' + str.replace(/"/g, '""') + '"';
}

export function usageCsv(entries: UsageLedgerRow[]): string {
  const columns = ["Date", "Service", "Model or resource", "Modality", "Credits used", "Units", "Unit"];
  const lines = entries.map((entry) =>
    [entry.created_at, SERVICE_NAMES[usageService(entry)], usageResource(entry, true), entry.usage_kind, amountSpent(entry).toFixed(4), entry.units, entry.unit_label].map(csvCell).join(",")
  );
  return [columns.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
}
