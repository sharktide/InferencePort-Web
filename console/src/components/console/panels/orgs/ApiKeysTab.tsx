"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import styles from "../Panel.module.css";
import shared from "./orgs.module.css";
import manage from "./manage.module.css";
import { useModal } from "../../../Modal";
import type { ApiKeyRestrictions, OrgApi, OrgApiKey, OrgDetail } from "../../../../lib/orgs";
import { Badge, CopyButton, Callout, errorText, formatDate } from "./shared";
import LimitsEditor, {
  draftFrom,
  emptyDraft,
  fmtCredits,
  parseDraft,
  planHint,
  type FieldKey,
  type LimitsDraft,
  type LockMap,
} from "./LimitsEditor";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  userId?: string | null;
  /** Optional: shown as the base URL hint when the workspace passes it. */
  apiBase?: string;
}

type Notice = { tone: "ok" | "error"; text: string } | null;
type DialogState = { mode: "create" } | { mode: "edit"; key: OrgApiKey } | null;

/** Date helper in UTC, YYYY-MM-DD, offset in days from today. */
function dateIso(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function keyStatus(k: OrgApiKey, now: number): { label: string; tone: "ok" | "warn" | "neutral" } {
  if (k.revoked_at) return { label: "Revoked", tone: "neutral" };
  if (k.expires_at && Date.parse(k.expires_at) <= now) return { label: "Expired", tone: "warn" };
  return { label: "Active", tone: "ok" };
}

/** Human labels for the restrictions a key carries; empty array means unrestricted. */
function restrictionLabels(k: OrgApiKey): string[] {
  const out: string[] = [];
  if (k.monthly_credit_limit != null) out.push(`Budget ${fmtCredits(k.monthly_credit_limit)}/mo`);
  if (k.allowed_models && k.allowed_models.length) out.push(`${k.allowed_models.length} model pattern${k.allowed_models.length === 1 ? "" : "s"}`);
  if (k.allowed_modalities && k.allowed_modalities.length) out.push(k.allowed_modalities.join(", "));
  if (k.rate_limit_rpm != null) out.push(`${k.rate_limit_rpm} rpm`);
  if (k.ip_allowlist && k.ip_allowlist.length) out.push(`${k.ip_allowlist.length} IP range${k.ip_allowlist.length === 1 ? "" : "s"}`);
  return out;
}

export default function ApiKeysTab({ api, org, onChanged, userId, apiBase }: Props) {
  const modal = useModal();
  const canRevokeAny = org.caps.includes("keys.revoke_any");
  const canRestrictAny = org.caps.includes("keys.restrict_any");
  const ent = org.entitlements;
  const atLimit = ent.max_api_keys !== null && org.counts.api_keys >= ent.max_api_keys;

  const [keys, setKeys] = useState<OrgApiKey[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { items } = await api.apiKeys(org.slug);
      setKeys(items);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [api, org.slug]);

  useEffect(() => { load(); }, [load]);

  const revoke = async (k: OrgApiKey) => {
    const ok = await modal.confirm(
      `Revoke the key "${k.name}" (${k.key_prefix}…)? Any application using it will stop working immediately.`,
      "Revoke API key",
    );
    if (!ok) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.revokeApiKey(org.slug, k.id);
      setNotice({ tone: "ok", text: `Revoked ${k.name}.` });
      await load();
      onChanged();
    } catch (err) {
      setNotice({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const now = Date.now();

  return (
    <div className={styles.stack}>
      <div className={shared.sectionHead}>
        <span className={shared.sectionTitle}>API keys</span>
        <span className={`${styles.muted} ${styles.tiny}`}>
          {org.counts.api_keys}{ent.max_api_keys !== null ? ` of ${ent.max_api_keys}` : ""} keys
        </span>
      </div>

      <p className={`${styles.muted} ${styles.tiny}`}>
        Requests made with organization keys are billed to the {org.name} wallet, not to the person who created the key.
        {apiBase && <> Base URL: <code className={shared.mono}>{apiBase}</code></>}
      </p>

      {revealed && (
        <Callout tone="warn">
          <strong>Copy your new key for {revealed.name} now.</strong>
          <div className={shared.copyRow}>
            <code className={shared.secret}>{revealed.key}</code>
            <CopyButton text={revealed.key} label="Copy key" />
          </div>
          <span className={styles.muted}>
            This is the only time the full key is shown. Store it somewhere safe. If you lose it, revoke it and create a new one.
          </span>
          <div className={shared.formRow}>
            <button type="button" className="ghost" onClick={() => setRevealed(null)}>I have copied it</button>
          </div>
        </Callout>
      )}

      {notice && <Callout tone={notice.tone}>{notice.text}</Callout>}
      {loadError && <Callout tone="error">{loadError}</Callout>}
      {!keys && !loadError && <p className={styles.muted}>Loading API keys…</p>}

      {keys && keys.length === 0 && <p className={`${styles.muted} ${styles.tiny}`}>No organization API keys yet.</p>}
      {keys && keys.length > 0 && (
        <div className={shared.tableWrap}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Key</th>
                <th scope="col">Restrictions</th>
                <th scope="col">Spend this month</th>
                <th scope="col">Created by</th>
                <th scope="col">Last used</th>
                <th scope="col">Expires</th>
                <th scope="col">Status</th>
                <th scope="col"><span className={shared.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const status = keyStatus(k, now);
                const live = !k.revoked_at;
                const canRevoke = live && (canRevokeAny || k.created_by === userId);
                const canEdit = live && (canRestrictAny || k.created_by === userId);
                const labels = restrictionLabels(k);
                return (
                  <tr key={k.id}>
                    <td>
                      <div className={shared.wrapAnywhere}>{k.name}</div>
                      {k.description && <div className={`${styles.muted} ${styles.tiny} ${shared.wrapAnywhere}`}>{k.description}</div>}
                    </td>
                    <td className={shared.mono}>{k.key_prefix}…</td>
                    <td>
                      <div className={manage.restrictions}>
                        {labels.length === 0
                          ? <span className={manage.chip}>Unrestricted</span>
                          : labels.map((l) => <span key={l} className={manage.chip}>{l}</span>)}
                      </div>
                    </td>
                    <td>
                      <div className={manage.progress}>
                        <span>
                          {fmtCredits(k.month_spend)} / {k.monthly_credit_limit != null ? fmtCredits(k.monthly_credit_limit) : "no limit"}
                        </span>
                      </div>
                    </td>
                    <td className={shared.wrapAnywhere}>{k.created_by_email ?? "—"}</td>
                    <td>{formatDate(k.last_used_at, true)}</td>
                    <td>{k.expires_at ? formatDate(k.expires_at) : "Never"}</td>
                    <td><Badge tone={status.tone === "ok" ? "ok" : status.tone === "warn" ? "warn" : "neutral"}>{status.label}</Badge></td>
                    <td className="actions">
                      <div className={manage.rowActions}>
                        {canEdit && (
                          <button type="button" className="ghost" disabled={busy} aria-label={`Edit ${k.name}`} onClick={() => setDialog({ mode: "edit", key: k })}>
                            Edit
                          </button>
                        )}
                        {canRevoke && (
                          <button type="button" className={shared.danger} disabled={busy} aria-label={`Revoke ${k.name}`} onClick={() => revoke(k)}>
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={manage.toolbar}>
        <span className={manage.hintText}>
          {atLimit
            ? `Your plan allows ${ent.max_api_keys} keys. Revoke one to create another.`
            : "Keys can be limited by budget, models, modalities, rate and IP range."}
        </span>
        <button type="button" disabled={busy || atLimit} onClick={() => setDialog({ mode: "create" })}>
          Create API key
        </button>
      </div>

      {dialog && (
        <KeyDialog
          api={api}
          org={org}
          existing={dialog.mode === "edit" ? dialog.key : null}
          onClose={() => setDialog(null)}
          onDone={async (done) => {
            setDialog(null);
            if (done.rawKey) {
              setRevealed({ name: done.name, key: done.rawKey });
              setNotice(null);
            } else {
              setNotice({ tone: "ok", text: `Saved restrictions for ${done.name}.` });
            }
            await load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function KeyDialog({
  api,
  org,
  existing,
  onClose,
  onDone,
}: {
  api: OrgApi;
  org: OrgDetail;
  existing: OrgApiKey | null;
  onClose: () => void;
  onDone: (r: { name: string; rawKey?: string }) => void;
}) {
  const ent = org.entitlements;
  const pol = org.settings.policies ?? {};
  // Org policies only bind when the plan includes key policies (server enforces the same rule).
  const maxDays = ent.key_policies && pol.max_key_lifetime_days ? pol.max_key_lifetime_days : null;
  const requireExpiry = ent.key_policies && (!!pol.require_key_expiry || maxDays !== null);

  const locks: LockMap = {};
  if (!ent.key_restrictions) {
    const hint = planHint("key_restrictions");
    locks.budget = hint;
    locks.rpm = hint;
    locks.models = hint;
    locks.modalities = hint;
  }
  if (!ent.key_ip_allowlist) locks.ip = planHint("key_ip_allowlist");

  const gatedFields = (["budget", "models", "modalities", "rpm", "ip"] as FieldKey[]).filter((f) => !locks[f]);
  const isCreate = existing === null;

  const [name, setName] = useState("");
  const [expires, setExpires] = useState("");
  const [draft, setDraft] = useState<LimitsDraft>(() => (existing ? draftFrom(existing) : emptyDraft()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const parsed = parseDraft(draft, [...gatedFields, "description"]);
    if ("error" in parsed) return setError(parsed.error);
    const v = parsed.value;
    const restrictions: ApiKeyRestrictions = {
      description: v.description,
      ...(gatedFields.includes("budget") ? { monthly_credit_limit: v.monthly_credit_limit } : {}),
      ...(gatedFields.includes("models") ? { allowed_models: v.allowed_models } : {}),
      ...(gatedFields.includes("modalities") ? { allowed_modalities: v.allowed_modalities } : {}),
      ...(gatedFields.includes("rpm") ? { rate_limit_rpm: v.rate_limit_rpm } : {}),
      ...(gatedFields.includes("ip") ? { ip_allowlist: v.ip_allowlist } : {}),
    };

    setBusy(true);
    try {
      if (isCreate) {
        const trimmed = name.trim();
        if (!trimmed) return setError("Name the key so you can recognize it later.");
        if (trimmed.length > 64) return setError("Key names can be at most 64 characters.");
        if (requireExpiry && !expires) return setError("This organization requires an expiry date on API keys.");
        if (expires && expires <= dateIso()) return setError("The expiry date must be in the future.");
        if (maxDays !== null && expires && expires > dateIso(maxDays - 1)) {
          return setError(`Keys can live at most ${maxDays} day${maxDays === 1 ? "" : "s"}. Choose an earlier expiry date.`);
        }
        const expiresAt = expires ? new Date(`${expires}T23:59:59Z`).toISOString() : null;
        const res = await api.createApiKey(org.slug, { name: trimmed, expiresAt, ...restrictions });
        onDone({ name: res.apiKey.name, rawKey: res.rawKey });
      } else {
        const res = await api.updateApiKey(org.slug, existing.id, restrictions);
        onDone({ name: res.apiKey.name });
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (busy) return;
    onClose();
  };

  return (
    <div className={shared.overlay} role="presentation" onClick={cancel}>
      <form
        className={`${shared.dialog} ${shared.dialogWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
        onSubmit={submit}
      >
        <h2 id="key-dialog-title" className={shared.dialogTitle}>
          {isCreate ? "Create API key" : `Edit restrictions: ${existing.name}`}
        </h2>
        {!isCreate && (
          <p className={manage.dialogIntro}>
            Key {existing.key_prefix}… · Spend this month {fmtCredits(existing.month_spend)} credits. Changing restrictions applies to the next request.
          </p>
        )}

        {isCreate && (
          <div className={shared.formGrid}>
            <label className={shared.field}>
              Name
              <input required maxLength={64} placeholder="Production backend" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className={shared.field}>
              {requireExpiry ? "Expires on" : "Expires on (optional)"}
              <input
                type="date"
                min={dateIso(1)}
                max={maxDays !== null ? dateIso(maxDays - 1) : undefined}
                required={requireExpiry}
                value={expires}
                disabled={busy}
                onChange={(e) => setExpires(e.target.value)}
              />
            </label>
          </div>
        )}
        {isCreate && (requireExpiry || maxDays !== null) && (
          <p className={manage.hintText}>
            {maxDays !== null
              ? `Your organization requires keys to expire within ${maxDays} day${maxDays === 1 ? "" : "s"}.`
              : "Your organization requires an expiry date on every key."}
          </p>
        )}
        {isCreate && !ent.key_policies && (
          <p className={manage.hintText}>Expiry rules: {planHint("key_policies")}</p>
        )}

        <div className={shared.sectionHead}>
          <span className={shared.sectionTitle}>Restrictions</span>
        </div>
        <LimitsEditor
          idPrefix="key-limits"
          draft={draft}
          onChange={setDraft}
          fields={["description", "budget", "models", "modalities", "rpm", "ip"]}
          locks={locks}
          disabled={busy}
          budgetLabel="Monthly credit budget"
        />

        {error && <Callout tone="error">{error}</Callout>}
        <div className={shared.dialogActions}>
          <button type="button" className="ghost" onClick={cancel} disabled={busy}>Cancel</button>
          <button type="submit" disabled={busy}>
            {busy ? "Saving…" : isCreate ? "Create key" : "Save restrictions"}
          </button>
        </div>
      </form>
    </div>
  );
}
