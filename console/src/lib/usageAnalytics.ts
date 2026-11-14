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
}
export type UsagePeriod = "24h" | "7d" | "30d" | "90d" | "all";
export type UsageGroupBy = "model" | "modality" | "day";
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
    else if (by === "modality") key = entry.usage_kind?.trim() || "Other / unspecified";
    else {
      const date = Date.parse(entry.created_at || "");
      key = Number.isFinite(date) ? new Date(date).toISOString().slice(0, 10) : "Unknown date";
    }
    const group = groups.get(key) || { key, label: key, credits: 0, requests: 0 };
    group.credits += amountSpent(entry);
    group.requests++;
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

export function totals(entries: UsageLedgerRow[]) {
  return { credits: entries.reduce((sum, entry) => sum + amountSpent(entry), 0), requests: entries.length };
}

/** Prevent a model name or metadata value from being interpreted as a spreadsheet formula. */
export function csvCell(value: unknown): string {
  let str = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  return '"' + str.replace(/"/g, '""') + '"';
}

export function usageCsv(entries: UsageLedgerRow[]): string {
  const columns = ["Date", "Model", "Modality", "Credits used", "Units", "Unit"];
  const lines = entries.map((entry) =>
    [entry.created_at, entry.model, entry.usage_kind, amountSpent(entry).toFixed(4), entry.units, entry.unit_label].map(csvCell).join(",")
  );
  return [columns.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
}
