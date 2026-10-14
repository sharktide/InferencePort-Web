"use client";

import { MODALITIES, type Modality } from "../../../../lib/orgs";
import styles from "./manage.module.css";

/** Fields the editor can show. `locks` maps a field to a hint when the plan does not allow it. */
export type FieldKey = "description" | "budget" | "models" | "modalities" | "rpm" | "ip";

/** Present = locked; the value is the hint shown next to the disabled control. */
export type LockMap = Partial<Record<FieldKey, string>>;

/** Text-friendly form state shared by member limits, key restrictions and org policies. */
export interface LimitsDraft {
  description: string;
  budget: string;
  models: string;
  modalities: Modality[];
  rpm: string;
  ips: string;
}

export interface ParsedLimits {
  description: string | null;
  monthly_credit_limit: number | null;
  allowed_models: string[] | null;
  allowed_modalities: Modality[] | null;
  rate_limit_rpm: number | null;
  ip_allowlist: string[] | null;
}

export const emptyDraft = (): LimitsDraft => ({ description: "", budget: "", models: "", modalities: [], rpm: "", ips: "" });

export function draftFrom(v: {
  description?: string | null;
  monthly_credit_limit?: number | null;
  allowed_models?: string[] | null;
  allowed_modalities?: Modality[] | null;
  rate_limit_rpm?: number | null;
  ip_allowlist?: string[] | null;
}): LimitsDraft {
  return {
    description: v.description ?? "",
    budget: v.monthly_credit_limit != null ? String(v.monthly_credit_limit) : "",
    models: (v.allowed_models ?? []).join("\n"),
    modalities: v.allowed_modalities ?? [],
    rpm: v.rate_limit_rpm != null ? String(v.rate_limit_rpm) : "",
    ips: (v.ip_allowlist ?? []).join("\n"),
  };
}

const MODEL_RE = /^[\w.:/@+-]*\*?$/;
const CIDR_RE = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;
const splitList = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);

/**
 * Validates the draft for the given fields only. Fields not listed come back null, so callers
 * send only what the plan allows (the server rejects gated fields with 402).
 */
export function parseDraft(d: LimitsDraft, fields: FieldKey[]): { value: ParsedLimits } | { error: string } {
  const has = (f: FieldKey) => fields.includes(f);
  const value: ParsedLimits = {
    description: null,
    monthly_credit_limit: null,
    allowed_models: null,
    allowed_modalities: null,
    rate_limit_rpm: null,
    ip_allowlist: null,
  };

  if (has("description")) {
    const t = d.description.trim();
    if (t.length > 200) return { error: "Descriptions can be at most 200 characters." };
    value.description = t || null;
  }
  if (has("budget") && d.budget.trim() !== "") {
    const n = Number(d.budget);
    if (!Number.isFinite(n) || n < 0) return { error: "The monthly credit limit must be a number of 0 or more." };
    value.monthly_credit_limit = n;
  }
  if (has("models")) {
    const models = Array.from(new Set(splitList(d.models)));
    const bad = models.find((m) => !MODEL_RE.test(m));
    if (bad) return { error: `"${bad}" is not a valid model pattern. Use a model id, or end it with * (for example lightning-*).` };
    value.allowed_models = models.length > 0 ? models : null;
  }
  if (has("modalities")) {
    value.allowed_modalities = d.modalities.length > 0 ? [...d.modalities] : null;
  }
  if (has("rpm") && d.rpm.trim() !== "") {
    const n = Number(d.rpm);
    if (!Number.isInteger(n) || n < 1 || n > 100000) return { error: "The rate limit must be a whole number of requests per minute (1 to 100000)." };
    value.rate_limit_rpm = n;
  }
  if (has("ip")) {
    const ips = Array.from(new Set(splitList(d.ips)));
    const bad = ips.find((c) => !CIDR_RE.test(c));
    if (bad) return { error: `"${bad}" is not a valid IP address or CIDR range.` };
    value.ip_allowlist = ips.length > 0 ? ips : null;
  }
  return { value };
}

interface Props {
  idPrefix: string;
  draft: LimitsDraft;
  onChange: (next: LimitsDraft) => void;
  fields: FieldKey[];
  locks?: LockMap;
  disabled?: boolean;
  budgetLabel?: string;
}

const LABELS: Record<FieldKey, string> = {
  description: "Description",
  budget: "Monthly credit limit",
  models: "Allowed models",
  modalities: "Allowed modalities",
  rpm: "Rate limit (requests per minute)",
  ip: "IP allowlist",
};

/** Controlled form for limits. Locked fields stay visible, disabled, with the plan hint. */
export default function LimitsEditor({ idPrefix, draft, onChange, fields, locks = {}, disabled = false, budgetLabel }: Props) {
  const set = (patch: Partial<LimitsDraft>) => onChange({ ...draft, ...patch });
  const has = (f: FieldKey) => fields.includes(f);
  const lockedHint = (f: FieldKey) => locks[f];
  const isDisabled = (f: FieldKey) => disabled || lockedHint(f) !== undefined;

  const hintNode = (f: FieldKey) =>
    lockedHint(f) ? <span className={styles.lockHint}>{lockedHint(f)}</span> : null;

  const toggleModality = (m: Modality) =>
    set({ modalities: draft.modalities.includes(m) ? draft.modalities.filter((x) => x !== m) : [...draft.modalities, m] });

  return (
    <div className={styles.editor}>
      {has("description") && (
        <div className={styles.fieldBlock}>
          <label className={styles.field} htmlFor={`${idPrefix}-desc`}>
            {LABELS.description}
            <input
              id={`${idPrefix}-desc`}
              maxLength={200}
              placeholder="What this key is for"
              value={draft.description}
              disabled={isDisabled("description")}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          {hintNode("description")}
        </div>
      )}

      {has("budget") && (
        <div className={styles.fieldBlock}>
          <label className={styles.field} htmlFor={`${idPrefix}-budget`}>
            {budgetLabel ?? LABELS.budget}
            <input
              id={`${idPrefix}-budget`}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="No limit"
              value={draft.budget}
              disabled={isDisabled("budget")}
              onChange={(e) => set({ budget: e.target.value })}
            />
          </label>
          <span className={styles.hintText}>Credits this can spend each UTC month. Leave blank for no limit.</span>
          {hintNode("budget")}
        </div>
      )}

      {has("models") && (
        <div className={styles.fieldBlock}>
          <label className={styles.field} htmlFor={`${idPrefix}-models`}>
            {LABELS.models}
            <textarea
              id={`${idPrefix}-models`}
              rows={3}
              placeholder={"flux\nlightning-*"}
              value={draft.models}
              disabled={isDisabled("models")}
              onChange={(e) => set({ models: e.target.value })}
            />
          </label>
          <span className={styles.hintText}>
            One per line or comma-separated. End a pattern with * to match a prefix (for example lightning-*). Leave blank to allow every model.
          </span>
          {hintNode("models")}
        </div>
      )}

      {has("modalities") && (
        <fieldset className={styles.fieldset} disabled={isDisabled("modalities")}>
          <legend>{LABELS.modalities}</legend>
          <div className={styles.checkGrid}>
            {MODALITIES.map((m) => (
              <label key={m} className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={draft.modalities.includes(m)}
                  onChange={() => toggleModality(m)}
                />
                {m}
              </label>
            ))}
          </div>
          <span className={styles.hintText}>None selected means every modality is allowed.</span>
          {hintNode("modalities")}
        </fieldset>
      )}

      {has("rpm") && (
        <div className={styles.fieldBlock}>
          <label className={styles.field} htmlFor={`${idPrefix}-rpm`}>
            {LABELS.rpm}
            <input
              id={`${idPrefix}-rpm`}
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              step={1}
              placeholder="No limit"
              value={draft.rpm}
              disabled={isDisabled("rpm")}
              onChange={(e) => set({ rpm: e.target.value })}
            />
          </label>
          {hintNode("rpm")}
        </div>
      )}

      {has("ip") && (
        <div className={styles.fieldBlock}>
          <label className={styles.field} htmlFor={`${idPrefix}-ip`}>
            {LABELS.ip}
            <textarea
              id={`${idPrefix}-ip`}
              rows={2}
              placeholder={"203.0.113.0/24\n198.51.100.7"}
              value={draft.ips}
              disabled={isDisabled("ip")}
              onChange={(e) => set({ ips: e.target.value })}
            />
          </label>
          <span className={styles.hintText}>One address or CIDR range per line. Leave blank to allow any IP address.</span>
          {hintNode("ip")}
        </div>
      )}
    </div>
  );
}

/** Minimum plan that unlocks a feature flag (mirrors helper/orgs/plans.py ENTITLEMENTS). */
const TEAM_ONLY_FLAGS = new Set(["key_ip_allowlist", "auditor_role", "usage_reports", "ip_allowlist", "sso_saml", "enforce_sso", "audit_webhook"]);

/** Hint shown next to a locked control. Never compare plan names in feature code; this is copy only. */
export function planHint(flag: string): string {
  return `Available on the ${TEAM_ONLY_FLAGS.has(flag) ? "Team" : "Starter"} plan and above.`;
}

export function memberName(m: { email: string | null; username: string | null; user_id: string }): string {
  return m.email || (m.username ? `@${m.username}` : m.user_id);
}

export function fmtCredits(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
