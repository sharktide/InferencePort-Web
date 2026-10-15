"use client";

import { useEffect, useState } from "react";
import type { OrgApi, OrgPlan, PlanCatalogEntry, SelfServePlan } from "../../../../lib/orgs";
import shared from "./orgs.module.css";
import s from "./billing.module.css";
import { Badge, Callout, errorText } from "./shared";

interface Props {
  api: OrgApi;
  /** The plan the viewer is on (org context) or null/undefined in personal mode. */
  currentPlan?: OrgPlan | null;
  onClose: () => void;
  /** When given, Starter and Team get a choose button (used by the billing tab and personal landing page). */
  onSelect?: (plan: SelfServePlan) => void;
  /** Address for Enterprise "contact sales" (defaults to the public sales address). */
  salesContact?: string;
}

const DEFAULT_SALES = "support@inferenceport.ai";
const ORDER: OrgPlan[] = ["free", "starter", "team", "enterprise"];

const limit = (v: number | null) => (v === null ? "Unlimited" : String(v));

export default function PlansModal({ api, currentPlan = null, onClose, onSelect, salesContact = DEFAULT_SALES }: Props) {
  const [plans, setPlans] = useState<PlanCatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .plans()
      .then(({ plans: list }) => {
        if (cancelled) return;
        const rank = (k: OrgPlan) => ORDER.indexOf(k);
        setPlans([...list].sort((a, b) => rank(a.key) - rank(b.key)));
      })
      .catch((e) => { if (!cancelled) setError(errorText(e)); });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={shared.overlay} onClick={onClose}>
      <div
        className={`${shared.dialog} ${shared.dialogWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-plans-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="org-plans-title" className={shared.dialogTitle}>Compare plans</h2>
        <p className={shared.dialogBody}>
          Starter and Team bill per seat: one seat per member, updated automatically.
        </p>
        {error && <Callout tone="error">Could not load plans. {error}</Callout>}
        {!plans && !error && <p className={shared.dialogBody} role="status">Loading plans…</p>}
        {plans && (
          <div className={s.compareGrid}>
            {plans.map((p) => {
              const isCurrent = p.key === currentPlan;
              const selectable = onSelect && (p.key === "starter" || p.key === "team") && !isCurrent;
              return (
                <article key={p.key} className={`${s.compareCol} ${isCurrent ? s.planCurrent : ""}`} aria-label={`${p.name} plan`}>
                  <div className={s.cardHead}>
                    <span className={s.planName}>{p.name}</span>
                    {isCurrent && <Badge tone="brand">Current</Badge>}
                  </div>
                  <div className={s.planPrice}>{p.seat_price_usd != null ? `$${p.seat_price_usd.toFixed(2)}` : p.price_label}</div>
                  {p.seat_price_usd != null && <div className={s.planPriceSub}>per seat, per month</div>}
                  <p className={s.planTagline}>{p.tagline}</p>
                  <p className={s.hint}>
                    Members: {limit(p.max_members)} · Teams: {limit(p.max_teams)} · API keys: {limit(p.max_api_keys)}
                  </p>
                  <p className={s.hint}>Audit log kept {p.audit_retention_days} days. {p.support}</p>
                  <ul className={s.features}>
                    {p.features.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                  {p.key === "enterprise" && p.sales_terms.length > 0 && (
                    <ul className={s.hint} style={{ paddingLeft: "1.1rem", margin: 0 }}>
                      {p.sales_terms.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  )}
                  <div className={s.planFoot}>
                    {p.key === "enterprise" ? (
                      <a className={s.ctaLink} href={`mailto:${salesContact}?subject=${encodeURIComponent("InferencePort Enterprise")}`}>
                        Contact sales
                      </a>
                    ) : selectable ? (
                      <button type="button" onClick={() => onSelect?.(p.key as SelfServePlan)}>Choose {p.name}</button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className={s.hint}>
          Plan changes happen in the Billing tab of an organization. Enterprise is arranged with sales.
        </p>
        <div className={shared.dialogActions}>
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
