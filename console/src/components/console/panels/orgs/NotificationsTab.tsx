"use client";

import { useEffect, useState } from "react";
import type { NotificationSettings, OrgApi, OrgDetail } from "../../../../lib/orgs";
import shared from "./orgs.module.css";
import s from "./billing.module.css";
import { Callout, errorText } from "./shared";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  userId?: string;
}

type Flags = {
  member_changes: boolean;
  security_alerts: boolean;
  billing_alerts: boolean;
  budget_alerts: boolean;
  receipts: boolean;
};

const MAX_PERCENTS = 5;
const MAX_RECIPIENTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TOGGLES: { key: keyof Flags; title: string; description: string; gate?: "budget"; alwaysAvailable?: boolean }[] = [
  {
    key: "member_changes",
    title: "Member changes",
    description: "Joins, removals, role changes and suspensions go to owners and admins. The affected member is also told about removals, role changes and suspensions.",
  },
  {
    key: "security_alerts",
    title: "Security changes",
    description: "SSO, IP allowlist, domain, audit webhook and ownership changes go to owners.",
  },
  {
    key: "billing_alerts",
    title: "Billing",
    description: "Plan changes, seat changes, cancellations and purchased credits go to the billing email and extra recipients below.",
  },
  {
    key: "budget_alerts",
    title: "Spend and balance alerts",
    description: "Spend crossing the set percentages of the monthly limit, and a low credit balance, go to the billing email and extra recipients. Each alert is sent once per period.",
    gate: "budget",
  },
  {
    key: "receipts",
    title: "Payment receipts",
    description: "Email a receipt when a payment succeeds, with links to the invoice and receipt, to the billing email and extra recipients. Not limited by plan.",
    alwaysAvailable: true,
  },
];

function parsePercent(text: string): number | null {
  const n = Number(text.trim());
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
}

export default function NotificationsTab({ api, org }: Props) {
  const slug = org.slug;
  const canManage = org.caps.includes("notifications.manage");
  const emailEntitled = org.entitlements.email_notifications;
  const budgetEntitled = org.entitlements.budget_alerts;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState<NotificationSettings | null>(null);
  const [flags, setFlags] = useState<Flags>({ member_changes: true, security_alerts: true, billing_alerts: true, budget_alerts: true, receipts: true });
  const [percents, setPercents] = useState<number[]>([80, 100]);
  const [thresholdText, setThresholdText] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);

  const [percentDraft, setPercentDraft] = useState("");
  const [recipientDraft, setRecipientDraft] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const applySettings = (n: NotificationSettings) => {
    setSaved(n);
    setFlags({
      member_changes: n.member_changes,
      security_alerts: n.security_alerts,
      billing_alerts: n.billing_alerts,
      budget_alerts: n.budget_alerts,
      receipts: n.receipts,
    });
    setPercents([...n.budget_alert_percents].sort((a, b) => a - b));
    setThresholdText(n.low_balance_threshold == null ? "" : String(n.low_balance_threshold));
    setRecipients(n.extra_recipients);
  };

  const load = async () => {
    setLoadError(null);
    try {
      const { notifications } = await api.notifications(slug);
      applySettings(notifications);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, slug]);

  // Threshold: blank means off; otherwise a non-negative number. NaN marks an invalid value.
  const thresholdValue = thresholdText.trim() === "" ? null : Number(thresholdText);
  const thresholdValid = thresholdValue === null || (Number.isFinite(thresholdValue) && thresholdValue >= 0);

  const payload = {
    ...flags,
    budget_alert_percents: percents,
    low_balance_threshold: thresholdValid ? thresholdValue : null,
    extra_recipients: recipients,
  };
  const savedPayload = saved && {
    member_changes: saved.member_changes,
    security_alerts: saved.security_alerts,
    billing_alerts: saved.billing_alerts,
    budget_alerts: saved.budget_alerts,
    receipts: saved.receipts,
    budget_alert_percents: [...saved.budget_alert_percents].sort((a, b) => a - b),
    low_balance_threshold: saved.low_balance_threshold,
    extra_recipients: saved.extra_recipients,
  };
  const dirty = !!savedPayload && JSON.stringify(payload) !== JSON.stringify(savedPayload);
  // Receipts are never plan-gated, so a receipts-only change may be saved on any plan.
  const gatedChanged = !!savedPayload && JSON.stringify({ ...payload, receipts: null }) !== JSON.stringify({ ...savedPayload, receipts: null });
  const editable = canManage && emailEntitled;

  const addPercent = () => {
    const n = parsePercent(percentDraft);
    if (n === null) return setFieldError("Alert percentages are whole numbers from 1 to 100.");
    if (percents.includes(n)) return setFieldError(`${n}% is already set.`);
    if (percents.length >= MAX_PERCENTS) return setFieldError(`You can set up to ${MAX_PERCENTS} alert percentages.`);
    setFieldError(null);
    setPercents([...percents, n].sort((a, b) => a - b));
    setPercentDraft("");
  };

  const addRecipient = () => {
    const email = recipientDraft.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return setFieldError("Enter a valid email address.");
    if (recipients.includes(email)) return setFieldError("That address is already on the list.");
    if (recipients.length >= MAX_RECIPIENTS) return setFieldError(`You can add up to ${MAX_RECIPIENTS} extra recipients.`);
    setFieldError(null);
    setRecipients([...recipients, email]);
    setRecipientDraft("");
  };

  const save = async () => {
    if (!thresholdValid) return setNotice({ tone: "error", text: "The low balance threshold must be zero or more, or empty to turn it off." });
    setBusy(true);
    setNotice(null);
    try {
      const { notifications } = await api.setNotifications(slug, payload);
      applySettings(notifications);
      setNotice({ tone: "ok", text: "Notification settings saved." });
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const res = await api.sendTestEmail(slug);
      setNotice(res.success
        ? { tone: "ok", text: `Test email sent to ${res.sent_to}.` }
        : { tone: "error", text: "The test email could not be sent. Check the server mail configuration." });
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className={s.loading} role="status"><span className={s.spinner} aria-hidden="true" />Loading notifications…</div>;
  }
  if (!saved) {
    return (
      <Callout tone="error">
        <strong>Could not load notification settings.</strong>
        <span>{loadError}</span>
        <div><button className="ghost" onClick={() => { setLoading(true); void load(); }}>Try again</button></div>
      </Callout>
    );
  }

  return (
    <div className={s.page}>
      {!saved.email_configured && (
        <Callout tone="warn">
          Email delivery is not configured on this server, so settings are saved but no emails will be sent until it is.
        </Callout>
      )}

      {!emailEntitled && (
        <div className={s.lock}>
          Email notifications are available on the Starter plan and above. Upgrade in Billing to turn them on.
        </div>
      )}

      {!canManage && emailEntitled && (
        <Callout tone="info">Read-only. You need the notifications permission to change these settings.</Callout>
      )}

      <section className={s.card} aria-labelledby="notif-who">
        <h2 id="notif-who" className={s.cardTitle}>Who gets emails</h2>
        <p className={s.lead}>
          Invitations and failed-payment emails are always sent. The options below control everything else.
        </p>

        <div className={s.toggles}>
          {TOGGLES.map((t) => {
            const gatedOff = t.gate === "budget" && !budgetEntitled;
            const disabled = (t.alwaysAvailable ? !canManage : !editable) || gatedOff;
            return (
              <label key={t.key} className={`${s.toggle} ${gatedOff ? s.toggleOff : ""}`}>
                <input
                  type="checkbox"
                  checked={flags[t.key]}
                  disabled={disabled}
                  onChange={(e) => setFlags({ ...flags, [t.key]: e.target.checked })}
                  aria-describedby={`notif-${t.key}-desc`}
                />
                <span className={s.toggleTitle}>{t.title}</span>
                <span id={`notif-${t.key}-desc`} className={s.toggleDesc}>
                  {t.description}
                  {gatedOff && " Not included on your current plan."}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className={s.card} aria-labelledby="notif-thresholds">
        <h2 id="notif-thresholds" className={s.cardTitle}>Alert thresholds</h2>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <span className={s.label}>Spend alerts at these percentages of the monthly limit</span>
          <div className={s.chips}>
            {percents.length === 0 && <span className={s.hint}>None set.</span>}
            {percents.map((p) => (
              <span key={p} className={s.chip}>
                {p}%
                {editable && (
                  <button
                    type="button"
                    className={s.chipRemove}
                    aria-label={`Remove ${p}% alert`}
                    onClick={() => setPercents(percents.filter((x) => x !== p))}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {editable && (
            <div className={shared.formRow}>
              <label className={shared.field} style={{ maxWidth: 160 }}>
                Add percentage
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  step={1}
                  value={percentDraft}
                  onChange={(e) => setPercentDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPercent(); } }}
                />
              </label>
              <button type="button" className="ghost" onClick={addPercent} disabled={!percentDraft.trim()}>Add</button>
            </div>
          )}
          <span className={s.hint}>Whole numbers from 1 to 100, up to {MAX_PERCENTS}. Only applies when a monthly spend limit is set.</span>
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label className={shared.field} style={{ maxWidth: 260 }}>
            Low balance threshold (credits)
            <input
              type="number"
              min={0}
              step="any"
              value={thresholdText}
              placeholder="Off"
              disabled={!editable}
              onChange={(e) => setThresholdText(e.target.value)}
              aria-invalid={!thresholdValid}
            />
          </label>
          <span className={s.hint}>
            {thresholdValid
              ? "Send a billing alert when the wallet balance drops to or below this. Leave empty to turn it off."
              : "Enter zero or more, or leave empty to turn it off."}
          </span>
        </div>
      </section>

      <section className={s.card} aria-labelledby="notif-extra">
        <h2 id="notif-extra" className={s.cardTitle}>Extra recipients</h2>
        <p className={s.lead}>
          Billing and budget alerts go to the billing email plus these addresses. They can be anyone, with or without an InferencePort account. Up to {MAX_RECIPIENTS}.
        </p>
        <div className={s.chips}>
          {recipients.length === 0 && <span className={s.hint}>None added.</span>}
          {recipients.map((r) => (
            <span key={r} className={s.chip}>
              {r}
              {editable && (
                <button
                  type="button"
                  className={s.chipRemove}
                  aria-label={`Remove ${r}`}
                  onClick={() => setRecipients(recipients.filter((x) => x !== r))}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {editable && (
          <div className={shared.formRow}>
            <label className={shared.field} style={{ flex: "1 1 260px" }}>
              Add an email address
              <input
                type="email"
                value={recipientDraft}
                maxLength={254}
                placeholder="finance@example.com"
                onChange={(e) => setRecipientDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
              />
            </label>
            <button type="button" className="ghost" onClick={addRecipient} disabled={!recipientDraft.trim()}>Add</button>
          </div>
        )}
        {fieldError && <Callout tone="error">{fieldError}</Callout>}
      </section>

      {notice && <Callout tone={notice.tone === "ok" ? "ok" : "error"}>{notice.text}</Callout>}

      <div className={s.actions}>
        {canManage && (
          <button
            type="button"
            disabled={busy || !dirty || !thresholdValid || (!emailEntitled && gatedChanged)}
            onClick={save}
          >
            {busy ? "Saving…" : "Save notification settings"}
          </button>
        )}
        {canManage && (
          <button
            type="button"
            className="ghost"
            disabled={testing || !saved.email_configured}
            onClick={sendTest}
            title={saved.email_configured ? undefined : "Email is not configured on this server"}
          >
            {testing ? "Sending…" : "Send me a test email"}
          </button>
        )}
      </div>
      <p className={s.hint}>The test email goes only to your own address. Emails link back to this organization.</p>
    </div>
  );
}
