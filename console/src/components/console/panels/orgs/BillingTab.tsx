"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useModal } from "../../../Modal";
import {
  OrgApiError,
  type OrgApi,
  type OrgBilling,
  type OrgDetail,
  type OrgLedgerEntry,
  type PlanCatalogEntry,
  type SelfServePlan,
} from "../../../../lib/orgs";
import shared from "./orgs.module.css";
import s from "./billing.module.css";
import { Badge, Callout, PLAN_LABELS } from "./shared";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  userId?: string;
}

const SELF_SERVE: string[] = ["starter", "team"];
const PAID_STATUSES = ["active", "trialing", "past_due"];
const LEDGER_LIMIT = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const creditFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

const fmtUsd = (n: number | null | undefined) => (n == null ? "—" : usdFmt.format(Number(n)));
const fmtCredits = (n: number | null | undefined) => creditFmt.format(Number(n) || 0);
const fmtDate = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};
const fmtDateTime = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
};

/** Error text that keeps the server's explanation; permission failures get a clear prefix. */
function describe(e: unknown): string {
  if (e instanceof OrgApiError && e.status === 403) return `You do not have permission for this. ${e.message}`;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}

const STATUS_TONE: Record<string, "ok" | "warn" | "crit" | "neutral"> = {
  active: "ok",
  trialing: "ok",
  past_due: "warn",
  unpaid: "crit",
  canceled: "crit",
  incomplete_expired: "crit",
};

export default function BillingTab({ api, org, onChanged }: Props) {
  const modal = useModal();
  const slug = org.slug;

  const [billing, setBilling] = useState<OrgBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<OrgLedgerEntry[] | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanCatalogEntry[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "info"; text: string } | null>(null);

  const [emailDraft, setEmailDraft] = useState("");
  const [emailNotice, setEmailNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [spendDraft, setSpendDraft] = useState("");
  const [salesMessage, setSalesMessage] = useState("");
  const [salesMailto, setSalesMailto] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const [b, l, p] = await Promise.allSettled([
      api.billing(slug),
      api.ledger(slug, LEDGER_LIMIT),
      api.plans(),
    ]);
    if (b.status === "fulfilled") {
      setBilling(b.value.billing);
      setSpendDraft(b.value.billing.monthly_spend_limit == null ? "" : String(b.value.billing.monthly_spend_limit));
    } else {
      setLoadError(describe(b.reason));
    }
    if (l.status === "fulfilled") {
      setLedger(l.value.entries);
      setLedgerError(null);
    } else {
      setLedgerError(describe(l.reason));
    }
    if (p.status === "fulfilled") {
      setPlans(p.value.plans.filter((x) => x.key !== "free"));
      setPlansError(null);
    } else {
      setPlansError(describe(p.reason));
    }
    setLoading(false);
  }, [api, slug]);

  useEffect(() => { void load(); }, [load]);

  // Keep the billing-email draft in step with the saved value (after loads and saves).
  useEffect(() => {
    setEmailDraft(billing?.billing_email ?? "");
  }, [billing?.billing_email]);

  // Stripe returns here with ?billing=success|cancel. Show a banner once, refresh, then drop only that param.
  useEffect(() => {
    const url = new URL(window.location.href);
    const flag = url.searchParams.get("billing");
    if (flag !== "success" && flag !== "cancel") return;
    setBanner(flag === "success"
      ? { tone: "ok", text: "Payment received. Your plan and credits can take a moment to update." }
      : { tone: "info", text: "Checkout was cancelled. Nothing was changed." });
    if (flag === "success") {
      void load();
      onChanged();
    }
    url.searchParams.delete("billing");
    window.history.replaceState(null, "", url.toString());
  }, [load, onChanged]);

  const refresh = async () => {
    await load();
    onChanged();
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className={s.loading} role="status"><span className={s.spinner} aria-hidden="true" />Loading billing…</div>;
  }
  if (!billing) {
    return (
      <Callout tone="error">
        <strong>Could not load billing.</strong>
        <span>{loadError}</span>
        <div><button className="ghost" onClick={() => { setLoading(true); void load(); }}>Try again</button></div>
      </Callout>
    );
  }

  // Derived state.
  const canManage = billing.can_manage && org.caps.includes("billing.manage");
  const plan = billing.plan;
  const effective = billing.effective_plan;
  const status = billing.subscription_status;
  const hasPaidSub = SELF_SERVE.includes(plan) && PAID_STATUSES.includes(status ?? "");
  const seats = Math.max(1, billing.seats);
  const currentEntry = plans?.find((p) => p.key === plan) ?? null;
  const spendLimit = billing.monthly_spend_limit;
  const spendRatio = spendLimit && spendLimit > 0 ? Math.min(1, billing.month_spend / spendLimit) : 0;
  const packs = billing.packs ?? [];
  const billingEmailDirty = emailDraft.trim() !== (billing.billing_email ?? "");

  const seatExplainer = billing.seat_price_usd != null
    ? `${seats} member${seats === 1 ? "" : "s"} × ${fmtUsd(billing.seat_price_usd)} per seat = ${fmtUsd(billing.monthly_estimate_usd)} per month. Seats follow your member list automatically: adding someone charges the rest of the current month right away, removing someone credits it, and every renewal is exactly seats × price.`
    : plan === "enterprise"
      ? "Enterprise is billed by contract, so seats are not billed per member here."
      : "The Free plan bills nothing. Choose Starter or Team to start per-seat billing, where each member is one seat.";

  // Actions.
  const choosePlan = (target: SelfServePlan) => run(async () => {
    const { url } = await api.subscribe(slug, target);
    window.location.href = url;
  });

  const switchPlan = (target: PlanCatalogEntry) => run(async () => {
    const ok = await modal.confirm(
      `Switch ${org.name} to ${target.name}? The change applies now and seats are prorated for the rest of this billing period.`,
      `Switch to ${target.name}`,
    );
    if (!ok) return;
    await api.changePlan(slug, target.key as SelfServePlan);
    setBanner({ tone: "ok", text: `Switched to ${target.name}.` });
    await refresh();
  });

  const openPortal = () => run(async () => {
    const { url } = await api.portal(slug);
    window.location.href = url;
  });

  const buyPack = (packId: string) => run(async () => {
    const { url } = await api.buyCredits(slug, packId);
    window.location.href = url;
  });

  const saveSpendLimit = (value: number | null) => run(async () => {
    await api.setSpendLimit(slug, value);
    setBanner({ tone: "ok", text: value == null ? "Monthly spend limit removed." : `Monthly spend limit set to ${fmtUsd(value)}.` });
    await refresh();
  });

  const submitSpendLimit = () => {
    const trimmed = spendDraft.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setActionError("Enter a non-negative amount, or leave the field empty for no limit.");
      return;
    }
    void saveSpendLimit(value);
  };

  const contactSales = () => run(async () => {
    const res = await api.contactSales(slug, salesMessage.trim() || undefined);
    setSalesMailto(res.mailto);
    if (res.mailto.startsWith("mailto:")) window.location.href = res.mailto;
  });

  const saveBillingEmail = async (value: string) => {
    const next = value.trim();
    if (next && !EMAIL_RE.test(next)) {
      setEmailNotice({ tone: "error", text: "Enter a valid email address, or clear the field to use the owner's email." });
      return;
    }
    setBusy(true);
    setEmailNotice(null);
    try {
      await api.update(slug, { billing_email: next });
      setEmailNotice({
        tone: "ok",
        text: next ? "Billing email saved." : "Billing email cleared. Invoices now go to the owner's email.",
      });
      await refresh();
    } catch (e) {
      setEmailNotice({ tone: "error", text: describe(e) });
    } finally {
      setBusy(false);
    }
  };

  const renderPlanCard = (p: PlanCatalogEntry) => {
    const isCurrent = p.key === plan;
    const isEnterprise = p.key === "enterprise";
    const fits = p.max_members == null || seats <= p.max_members;
    const monthly = p.seat_price_usd == null ? null : seats * p.seat_price_usd;
    // Features the current paid plan has that the target lacks (shown before a switch).
    const lost = currentEntry && hasPaidSub && !isCurrent && !isEnterprise
      ? currentEntry.features.filter((f) => !p.features.includes(f))
      : [];

    let action: ReactNode = null;
    if (isCurrent) {
      action = <button className="ghost" disabled>Current plan</button>;
    } else if (plan === "enterprise") {
      action = null;
    } else if (isEnterprise) {
      action = canManage ? (
        <>
          <label className={shared.field}>
            Message (optional)
            <textarea value={salesMessage} maxLength={2000} rows={3} onChange={(e) => setSalesMessage(e.target.value)} />
          </label>
          <button className="ghost" disabled={busy} onClick={contactSales}>Contact sales</button>
          {salesMailto && (
            <p className={s.hint}>If your mail app did not open, <a href={salesMailto}>open the email draft</a>.</p>
          )}
        </>
      ) : null;
    } else if (!canManage) {
      action = null;
    } else if (!fits) {
      action = <button className="ghost" disabled>Too many members for {p.name}</button>;
    } else if (hasPaidSub) {
      action = <button disabled={busy} onClick={() => switchPlan(p)}>Switch to {p.name}</button>;
    } else {
      action = <button disabled={busy} onClick={() => choosePlan(p.key as SelfServePlan)}>Choose {p.name}</button>;
    }

    return (
      <article key={p.key} className={`${s.plan} ${isCurrent ? s.planCurrent : ""}`} aria-label={`${p.name} plan`}>
        <div className={s.cardHead}>
          <span className={s.planName}>{p.name}</span>
          {isCurrent && <Badge tone="brand">Current</Badge>}
        </div>
        <div className={s.planPrice}>{p.seat_price_usd != null ? fmtUsd(p.seat_price_usd) : p.price_label}</div>
        {p.seat_price_usd != null && <div className={s.planPriceSub}>per seat, per month</div>}
        <p className={s.planTagline}>{p.tagline}</p>
        {monthly != null && (
          <p className={s.hint}>
            For your {seats} member{seats === 1 ? "" : "s"}: <strong>{fmtUsd(monthly)}</strong> per month
          </p>
        )}
        <ul className={s.features}>
          {p.features.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
        {lost.length > 0 && (
          <div className={s.lostBox}>Switching to {p.name} removes: {lost.join("; ")}.</div>
        )}
        {!fits && !isCurrent && (
          <p className={s.hint}>
            Your organization has {seats} members and {p.name} allows {p.max_members}. Remove members first to switch.
          </p>
        )}
        <div className={s.planFoot}>{action}</div>
      </article>
    );
  };

  return (
    <div className={s.page}>
      {banner && (
        <Callout tone={banner.tone === "ok" ? "ok" : "info"}>
          <div className={s.cardHead}>
            <span>{banner.text}</span>
            <button className="text-btn" onClick={() => setBanner(null)} aria-label="Dismiss message">Dismiss</button>
          </div>
        </Callout>
      )}
      {actionError && (
        <Callout tone="error">
          <div className={s.cardHead}>
            <span>{actionError}</span>
            <button className="text-btn" onClick={() => setActionError(null)} aria-label="Dismiss error">Dismiss</button>
          </div>
        </Callout>
      )}
      {loadError && <Callout tone="warn">Some billing details may be out of date: {loadError}</Callout>}
      {!canManage && (
        <Callout tone="info">
          Read-only. Ask an owner or billing manager to change the plan, billing email, credits or spend limit.
        </Callout>
      )}

      {/* Subscription overview */}
      <section className={s.card} aria-labelledby="billing-overview">
        <div className={s.cardHead}>
          <div>
            <h2 id="billing-overview" className={s.cardTitle}>{PLAN_LABELS[effective]} plan</h2>
            {effective !== plan && (
              <p className={s.hint}>
                Your {PLAN_LABELS[plan]} subscription is not active, so limits follow the {PLAN_LABELS[effective]} plan.
              </p>
            )}
          </div>
          <div className={s.actions}>
            <Badge tone={STATUS_TONE[status ?? ""] ?? "neutral"}>{status ?? (plan === "free" ? "Free" : "No subscription")}</Badge>
          </div>
        </div>

        <div className={s.stats}>
          <div className={s.stat}>
            <span className={s.statLabel}>Members (seats)</span>
            <span className={s.statValue}>{billing.seats}</span>
            <span className={s.statHint}>Seats follow your member list</span>
          </div>
          <div className={s.stat}>
            <span className={s.statLabel}>Monthly estimate</span>
            <span className={s.statValue}>{billing.monthly_estimate_usd == null ? "—" : fmtUsd(billing.monthly_estimate_usd)}</span>
            <span className={s.statHint}>Every renewal invoice</span>
          </div>
          <div className={s.stat}>
            <span className={s.statLabel}>Next renewal</span>
            <span className={s.statValue}>{fmtDate(billing.current_period_end)}</span>
          </div>
        </div>

        <p className={s.explainer}>{seatExplainer}</p>

        {billing.cancel_at_period_end && (
          <Callout tone="warn">
            Your subscription is set to end on {fmtDate(billing.current_period_end)}. Open the payment portal to resume it.
          </Callout>
        )}

        {canManage && billing.has_billing_account && (
          <div className={s.actions}>
            <button className="ghost" disabled={busy} onClick={openPortal}>Manage payment method and invoices</button>
          </div>
        )}
      </section>

      {/* Plans */}
      <section className={s.card} aria-labelledby="billing-plans">
        <div className={s.cardHead}>
          <h2 id="billing-plans" className={s.cardTitle}>Plans</h2>
        </div>
        <p className={s.lead}>
          Starter and Team bill per seat. Changing plans applies immediately and is prorated. Plan limits are checked against your current member count.
        </p>
        {plansError && <Callout tone="error">Could not load plans. {plansError}</Callout>}
        {!plans && !plansError && <div className={s.loading} role="status"><span className={s.spinner} aria-hidden="true" />Loading plans…</div>}
        {plans && plan === "enterprise" && (
          <p className={s.hint}>Enterprise terms are arranged with sales. Contact <a href={`mailto:${billing.sales_contact}`}>{billing.sales_contact}</a> to change them.</p>
        )}
        {plans && <div className={s.plans}>{plans.map(renderPlanCard)}</div>}
      </section>

      {/* Billing contact */}
      <section className={s.card} aria-labelledby="billing-contact">
        <div className={s.cardHead}>
          <h2 id="billing-contact" className={s.cardTitle}>Billing contact</h2>
        </div>
        <p className={s.lead}>
          Invoices, receipts and billing alerts go here. It can be any address, even one without an InferencePort account.
          It does not change who owns or can sign in to the organization.
        </p>

        <div className={s.fieldGrid}>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <span className={s.label}>Organization owner</span>
            <div className={s.readonly}>{billing.owner_email ?? org.owner_email ?? "Unknown"}</div>
            <span className={s.hint}>Read-only. The owner is the member with the owner role.</span>
          </div>

          {canManage ? (
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label className={shared.field}>
                Billing email
                <input
                  type="email"
                  value={emailDraft}
                  maxLength={254}
                  placeholder={billing.owner_email ?? "billing@example.com"}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  aria-describedby="billing-email-hint"
                />
              </label>
              <span id="billing-email-hint" className={s.hint}>
                {billing.billing_email
                  ? "Receiving billing mail now. Clear the field and save to fall back to the owner's email."
                  : `Empty: billing mail goes to the owner's email (${billing.owner_email ?? "unknown"}).`}
              </span>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <span className={s.label}>Billing email</span>
              <div className={s.readonly}>{billing.billing_email ?? `${billing.owner_email ?? "owner"} (owner's email)`}</div>
            </div>
          )}
        </div>

        {canManage && (
          <div className={s.actions}>
            <button disabled={busy || !billingEmailDirty} onClick={() => saveBillingEmail(emailDraft)}>Save billing email</button>
            {billing.billing_email && (
              <button className="ghost" disabled={busy} onClick={() => saveBillingEmail("")}>Use owner email</button>
            )}
          </div>
        )}
        {emailNotice && <Callout tone={emailNotice.tone === "ok" ? "ok" : "error"}>{emailNotice.text}</Callout>}
      </section>

      {/* Wallet and spend */}
      <section className={s.card} aria-labelledby="billing-wallet">
        <div className={s.cardHead}>
          <h2 id="billing-wallet" className={s.cardTitle}>Credits and spend</h2>
        </div>
        <div className={s.stats}>
          <div className={s.stat}>
            <span className={s.statLabel}>Balance</span>
            <span className={s.statValue}>{fmtCredits(billing.wallet.balance_credits)}</span>
            <span className={s.statHint}>credits</span>
          </div>
          <div className={s.stat}>
            <span className={s.statLabel}>Paid</span>
            <span className={s.statValue}>{fmtCredits(billing.wallet.paid_credits)}</span>
          </div>
          <div className={s.stat}>
            <span className={s.statLabel}>Promotional</span>
            <span className={s.statValue}>{fmtCredits(billing.wallet.promotional_credits)}</span>
          </div>
          <div className={s.stat}>
            <span className={s.statLabel}>Lifetime purchased</span>
            <span className={s.statValue}>{fmtCredits(billing.wallet.lifetime_credits_purchased)}</span>
          </div>
        </div>

        <div className={s.stat}>
          <span className={s.statLabel}>This month&apos;s spend</span>
          <span className={s.statValue}>
            {fmtUsd(billing.month_spend)} of {spendLimit == null ? "no monthly limit" : fmtUsd(spendLimit)}
          </span>
          {spendLimit != null && (
            <span
              className={s.progress}
              role="progressbar"
              aria-label="Monthly spend against limit"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(spendRatio * 100)}
            >
              <span className={`${s.progressFill} ${spendRatio >= 0.8 ? s.progressWarn : ""}`} style={{ width: `${spendRatio * 100}%` }} />
            </span>
          )}
        </div>

        {org.entitlements.spend_limits ? (
          canManage ? (
            <>
              <div className={s.actions}>
                <label className={`${shared.field} ${s.narrowField}`} style={{ flex: "1 1 200px" }}>
                  Monthly limit (USD)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={spendDraft}
                    placeholder="No limit"
                    onChange={(e) => setSpendDraft(e.target.value)}
                  />
                </label>
                <button disabled={busy} onClick={submitSpendLimit}>Save limit</button>
                <button className="ghost" disabled={busy || spendLimit == null} onClick={() => { setSpendDraft(""); void saveSpendLimit(null); }}>
                  Remove limit
                </button>
              </div>
              <p className={s.hint}>Requests are refused with a clear error once the month&apos;s spend reaches the limit.</p>
            </>
          ) : null
        ) : (
          <div className={s.lock}>Monthly spend limits are not included on your current plan. See Plans above.</div>
        )}

        {packs.length > 0 && (
          <>
            <h3 className={s.cardTitle}>Credit packs</h3>
            <div className={s.packs}>
              {packs.map((p) => (
                <div key={p.id} className={s.pack}>
                  <span className={s.packTitle}>{p.label ?? `${fmtCredits(p.credits)} credits`}</span>
                  <span className={s.hint}>{fmtCredits(p.credits)} credits</span>
                  {p.price != null && <span className={s.packPrice}>{fmtUsd(p.price)}</span>}
                  {canManage && (
                    <button disabled={busy} onClick={() => buyPack(p.id)} aria-label={`Buy ${p.label ?? p.id}`}>Buy</button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Ledger */}
      <section className={s.card} aria-labelledby="billing-ledger">
        <div className={s.cardHead}>
          <h2 id="billing-ledger" className={s.cardTitle}>Ledger</h2>
        </div>
        {ledgerError && <Callout tone="error">Could not load the ledger. {ledgerError}</Callout>}
        {ledger && ledger.length === 0 && <p className={s.hint}>No ledger entries yet.</p>}
        {ledger && ledger.length > 0 && (
          <div className={shared.tableWrap}>
            <table className={`${shared.table} ${shared.tableWide}`}>
              <caption className={s.hint} style={{ textAlign: "left", padding: "0.6rem 0.85rem" }}>
                Most recent {ledger.length} entries
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">Model</th>
                  <th scope="col">Member</th>
                  <th scope="col">Key</th>
                  <th scope="col">Credits</th>
                  <th scope="col">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id}>
                    <td className={shared.mono}>{fmtDateTime(e.created_at)}</td>
                    <td data-label="Type">
                      {e.entry_type}
                      {(e.usage_kind ?? e.source) && <span className={s.hint}> {e.usage_kind ?? e.source}</span>}
                    </td>
                    <td data-label="Model" className={shared.mono}>{e.model ?? "—"}</td>
                    <td data-label="Member">{e.actor_email ?? "System"}</td>
                    <td data-label="Key" className={shared.mono}>{e.key_prefix ? `${e.key_prefix}…` : "Console"}</td>
                    <td data-label="Credits" className={shared.mono} style={{ color: e.delta_credits < 0 ? "var(--crit)" : "var(--success-ink)" }}>
                      {e.delta_credits > 0 ? "+" : ""}{fmtCredits(e.delta_credits)}
                    </td>
                    <td data-label="Balance after" className={shared.mono}>{fmtCredits(e.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
