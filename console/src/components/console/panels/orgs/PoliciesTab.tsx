"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../Panel.module.css";
import shared from "./orgs.module.css";
import manage from "./manage.module.css";
import { MODALITIES, type Modality, type OrgApi, type OrgDetail, type OrgPolicies } from "../../../../lib/orgs";
import { Callout, errorText } from "./shared";
import { emptyDraft, parseDraft, planHint, type LimitsDraft } from "./LimitsEditor";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  userId?: string;
}

type Notice = { tone: "ok" | "error"; text: string } | null;

interface FormState {
  models: string;
  modalities: Modality[];
  requireExpiry: boolean;
  maxDays: string;
  defaultLimit: string;
}

function toForm(p: OrgPolicies): FormState {
  return {
    models: (p.allowed_models ?? []).join("\n"),
    modalities: p.allowed_modalities ?? [],
    requireExpiry: p.require_key_expiry,
    maxDays: p.max_key_lifetime_days != null ? String(p.max_key_lifetime_days) : "",
    defaultLimit: p.default_member_monthly_limit != null ? String(p.default_member_monthly_limit) : "",
  };
}

const sameList = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export default function PoliciesTab({ api, org, onChanged }: Props) {
  const ent = org.entitlements;
  const canEdit = org.caps.includes("policies.manage");

  const [saved, setSaved] = useState<OrgPolicies | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { policies } = await api.policies(org.slug);
      setSaved(policies);
      setForm(toForm(policies));
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [api, org.slug]);

  useEffect(() => { load(); }, [load]);

  const locks = useMemo(() => {
    const out: Partial<Record<"models" | "modalities" | "expiry" | "defaultLimit", string>> = {};
    if (!ent.model_policy) {
      out.models = planHint("model_policy");
      out.modalities = planHint("model_policy");
    }
    if (!ent.key_policies) out.expiry = planHint("key_policies");
    if (!ent.member_budgets) out.defaultLimit = planHint("member_budgets");
    return out;
  }, [ent]);

  /** Builds the partial update: only gated-open fields that changed, so locked values never reach the server. */
  const buildChanges = (): { body: Partial<OrgPolicies> } | { error: string } | null => {
    if (!saved || !form) return null;
    const body: Partial<OrgPolicies> = {};
    const models: LimitsDraft = { ...emptyDraft(), models: form.models, modalities: form.modalities };

    if (!locks.models) {
      const parsed = parseDraft(models, ["models"]);
      if ("error" in parsed) return { error: parsed.error };
      if (!sameList(parsed.value.allowed_models, saved.allowed_models)) body.allowed_models = parsed.value.allowed_models;
    }
    if (!locks.modalities) {
      const parsedMods = parseDraft(models, ["modalities"]);
      if ("error" in parsedMods) return { error: parsedMods.error };
      if (!sameList(parsedMods.value.allowed_modalities, saved.allowed_modalities)) body.allowed_modalities = parsedMods.value.allowed_modalities;
    }
    if (!locks.expiry) {
      if (form.requireExpiry !== saved.require_key_expiry) body.require_key_expiry = form.requireExpiry;
      const days = form.maxDays.trim() === "" ? null : Number(form.maxDays);
      if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
        return { error: "Maximum key lifetime must be a whole number of days between 1 and 3650." };
      }
      if (days !== saved.max_key_lifetime_days) body.max_key_lifetime_days = days;
    }
    if (!locks.defaultLimit) {
      const limit = form.defaultLimit.trim() === "" ? null : Number(form.defaultLimit);
      if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
        return { error: "The default member limit must be a number of 0 or more." };
      }
      if (limit !== saved.default_member_monthly_limit) body.default_member_monthly_limit = limit;
    }
    return { body };
  };

  const pending = (() => {
    const r = buildChanges();
    return r && "body" in r ? Object.keys(r.body).length : 0;
  })();

  const save = async () => {
    setFormError(null);
    setNotice(null);
    const r = buildChanges();
    if (!r) return;
    if ("error" in r) return setFormError(r.error);
    if (Object.keys(r.body).length === 0) return setNotice({ tone: "ok", text: "No changes to save." });
    setBusy(true);
    try {
      const { policies } = await api.setPolicies(org.slug, r.body);
      setSaved(policies);
      setForm(toForm(policies));
      setNotice({ tone: "ok", text: "Policies saved." });
      onChanged();
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className={styles.stack}>
        <Callout tone="error">{loadError}</Callout>
        <div><button type="button" className="ghost" onClick={() => { setLoadError(null); load(); }}>Retry</button></div>
      </div>
    );
  }
  if (!saved || !form) return <p className={styles.muted}>Loading policies…</p>;

  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });
  const readOnly = !canEdit || busy;

  return (
    <div className={styles.stack}>
      <div className={shared.sectionHead}>
        <span className={shared.sectionTitle}>Usage policies</span>
        <span className={`${styles.muted} ${styles.tiny}`}>{canEdit ? "Applies to the whole organization" : "Read-only for your role"}</span>
      </div>

      <div className={manage.precedence}>
        <strong>How limits combine.</strong> A request is allowed only if it passes every layer: the organization policy below, the member&apos;s limits and the
        API key&apos;s restrictions. The most restrictive setting wins. Changing a policy here never raises a limit set on a member or key.
      </div>

      {notice && <Callout tone={notice.tone}>{notice.text}</Callout>}
      {formError && <Callout tone="error">{formError}</Callout>}
      {!canEdit && <p className={`${styles.muted} ${styles.tiny}`}>Your role can view policies but cannot change them.</p>}

      <div className={manage.policyRow}>
        <div className={manage.policyHead}>
          <span className={manage.policyTitle} id="policy-models-title">Allowed models</span>
          {locks.models && <span className={manage.lockHint}>{locks.models}</span>}
        </div>
        <label className={shared.field} htmlFor="policy-models">
          Model patterns (one per line or comma-separated)
          <textarea
            id="policy-models"
            rows={3}
            placeholder={"flux\nlightning-*"}
            value={form.models}
            disabled={readOnly || !!locks.models}
            aria-describedby="policy-models-hint"
            onChange={(e) => set({ models: e.target.value })}
          />
        </label>
        <span id="policy-models-hint" className={manage.hintText}>
          Blank allows every model. End a pattern with * to match a prefix. Members and keys can narrow this further, never widen it.
        </span>
      </div>

      <fieldset className={manage.policyFieldset} disabled={readOnly || !!locks.modalities}>
        <legend className={`${manage.policyTitle} ${manage.policyLegend}`}>Allowed modalities</legend>
        {locks.modalities && <span className={manage.lockHint}>{locks.modalities}</span>}
        <div className={manage.checkGrid}>
          {MODALITIES.map((m) => (
            <label key={m} className={manage.checkItem}>
              <input
                type="checkbox"
                checked={form.modalities.includes(m)}
                onChange={() =>
                  set({ modalities: form.modalities.includes(m) ? form.modalities.filter((x) => x !== m) : [...form.modalities, m] })
                }
              />
              {m}
            </label>
          ))}
        </div>
        <span className={manage.hintText}>None selected allows every modality.</span>
      </fieldset>

      <div className={manage.policyRow}>
        <div className={manage.policyHead}>
          <span className={manage.policyTitle}>API key expiry</span>
          {locks.expiry && <span className={manage.lockHint}>{locks.expiry}</span>}
        </div>
        <label className={manage.checkRow}>
          <input
            type="checkbox"
            checked={form.requireExpiry}
            disabled={readOnly || !!locks.expiry}
            onChange={(e) => set({ requireExpiry: e.target.checked })}
          />
          Require an expiry date on every API key
        </label>
        <label className={shared.field} htmlFor="policy-max-days">
          Maximum key lifetime (days, blank for no maximum)
          <input
            id="policy-max-days"
            type="number"
            inputMode="numeric"
            min={1}
            max={3650}
            step={1}
            placeholder="No maximum"
            value={form.maxDays}
            disabled={readOnly || !!locks.expiry}
            onChange={(e) => set({ maxDays: e.target.value })}
          />
        </label>
        <span className={manage.hintText}>A maximum lifetime also requires an expiry date on every new key.</span>
      </div>

      <div className={manage.policyRow}>
        <div className={manage.policyHead}>
          <span className={manage.policyTitle}>Default member monthly limit</span>
          {locks.defaultLimit && <span className={manage.lockHint}>{locks.defaultLimit}</span>}
        </div>
        <label className={shared.field} htmlFor="policy-default-limit">
          Credits per member per month (blank for unlimited)
          <input
            id="policy-default-limit"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="Unlimited"
            value={form.defaultLimit}
            disabled={readOnly || !!locks.defaultLimit}
            onChange={(e) => set({ defaultLimit: e.target.value })}
          />
        </label>
        <span className={manage.hintText}>Monthly credit budget for members who have no individual limit set.</span>
      </div>

      {canEdit && (
        <div className={shared.formRow}>
          <button type="button" onClick={save} disabled={busy || pending === 0}>
            {busy ? "Saving…" : pending === 0 ? "No changes" : `Save ${pending} change${pending === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy || pending === 0}
            onClick={() => { setForm(toForm(saved)); setFormError(null); setNotice(null); }}
          >
            Discard changes
          </button>
        </div>
      )}
    </div>
  );
}
