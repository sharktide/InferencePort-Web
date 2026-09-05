"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./Panel.module.css";
import billingStyles from "./BillingPanel.module.css";

interface BillingPanelProps { config: any; session: any; apiBase: string; }

const TIER_CONFIG_URL = "https://sharktide-lightning.hf.space/tier-config";
const STRIPE_BILLING_PORTAL = "https://billing.stripe.com/p/login/5kQdR9aIM3ts4steyabbG00";
const PRICING_URL = "https://inferenceport.ai/pricing.html";

const PLAN_FRIENDLY_NAMES: Record<string, string> = {
  free: "Free",
  light: "Light",
  core: "Core",
  creator: "Creator",
  professional: "Professional",
};

export default function BillingPanel({ config, session, apiBase }: BillingPanelProps) {
  const [wallet, setWallet] = useState<any>(null);
  const [usageSummary, setUsageSummary] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [packs] = useState<any[]>(config?.billing?.packs || []);
  const [tierConfig, setTierConfig] = useState<any>(null);

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };

  const loadBillingData = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const [me, ledgerData, subData, tiers] = await Promise.all([
        fj("/v1/me", { headers: authH() }),
        fj("/v1/credits/ledger?limit=100", { headers: authH() }),
        fj("/subscription", { headers: authH() }).catch(() => null),
        fetch(TIER_CONFIG_URL).then(r => r.json()).catch(() => null),
      ]);
      setWallet(me.wallet || {});
      setUsageSummary(me.usage_summary || {});
      setLedger(ledgerData.entries || []);
      if (subData) setSubscription(subData);
      if (tiers) setTierConfig(tiers);
    } catch { /* ignore */ }
  }, [session, apiBase]);

  useEffect(() => { if (session?.access_token) loadBillingData(); }, [session, loadBillingData]);

  const fmt = (v: string | null) => { if (!v) return "Never"; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString(); };

  const purchaseEntries = ledger.filter((e: any) => e.entry_type === "purchase" || e.delta_credits > 0);
  const lastPurchase = purchaseEntries.length > 0 ? purchaseEntries[0] : null;
  const totalPurchased = Number(wallet?.lifetime_credits_purchased || 0).toFixed(4);

  const getPlanFriendlyName = (planKey: string) => PLAN_FRIENDLY_NAMES[planKey] || planKey || "Free";

  const plans = tierConfig?.plans || [];
  const currentPlanKey = subscription?.plan_key || "free";
  const currentPlan = plans.find((p: any) => p.key === currentPlanKey);
  const currentPlanIndex = plans.findIndex((p: any) => p.key === currentPlanKey);
  const hasActiveSubscription = currentPlanKey !== "free" && subscription?.subscription?.length > 0;

  const getStripePortalUrl = () => {
    const email = session?.user?.email || "";
    return `${STRIPE_BILLING_PORTAL}?prefilled_email=${encodeURIComponent(email)}`;
  };

  if (!session) {
    return (
      <div className={`${styles.panel} ${styles.active}`}>
        <div className={styles.lockedOverlay}>Sign in to manage your billing.</div>
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>P2G Credits (Pay-2-Go)</div>
        {wallet ? (
          <div className={billingStyles.walletContent}>
            <div className={billingStyles.balanceCard}>
              <div className={billingStyles.balanceLabel}>Available Balance</div>
              <div className={billingStyles.balanceValue}>{Number(wallet.balance_credits || 0).toFixed(4)}</div>
              <div className={billingStyles.balanceUnit}>credits</div>
            </div>
            <div className={billingStyles.statsRow}>
              <div className={billingStyles.statItem}>
                <span className={billingStyles.statLabel}>Total purchased</span>
                <strong className={billingStyles.statValue}>{totalPurchased}</strong>
              </div>
              <div className={billingStyles.statItem}>
                <span className={billingStyles.statLabel}>Total used</span>
                <strong className={billingStyles.statValue}>{Number(usageSummary?.totalCreditsUsed || 0).toFixed(4)}</strong>
              </div>
              <div className={billingStyles.statItem}>
                <span className={billingStyles.statLabel}>Last purchase</span>
                <strong className={billingStyles.statValue}>{lastPurchase ? fmt(lastPurchase.created_at) : "None"}</strong>
              </div>
            </div>
          </div>
        ) : <div className={styles.lockedOverlay}>Sign in to view your credit balance</div>}
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Top Up Credits</div>
        <div className={billingStyles.packsGrid}>
          {packs.map((p: any) => (
            <div key={p.label} className={billingStyles.packCard}>
              <div className={billingStyles.packPrice}>{p.label}</div>
              <div className={billingStyles.packCredits}>{Number(p.credits).toFixed(4)} credits</div>
              <div className={billingStyles.packUsd}>${Number(p.amountUsd).toFixed(2)} USD</div>
              <button
                className={billingStyles.packBtn}
                disabled={!p.stripePaymentLink}
                onClick={() => {
                  if (!session?.user?.email) return alert("Sign in first.");
                  const url = new URL(p.stripePaymentLink);
                  url.searchParams.set("prefilled_email", session.user.email);
                  window.location.href = url.toString();
                }}
              >
                {!p.stripePaymentLink ? "Link pending" : "Add credits"}
              </button>
            </div>
          ))}
        </div>
        <div className={styles.subheading}>Usage Rates</div>
        <ul className={styles.rateList}>
          {[`${config?.pricing?.textCreditPerMillionTokens} credits per 1,000,000 text tokens (including multimodal text payloads)`, `${config?.pricing?.imageCreditPerImage} credits per image`, `${config?.pricing?.videoCreditPerSecond} credits per second of video`, `${config?.pricing?.audioCreditPerSecond} credits per second of audio (music/sfx)`].map((r, i) => <li key={i} className={styles.rateListItem}>{r}</li>)}
        </ul>
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Subscription (Generation API)</div>
        {subscription ? (
          <div>
            <div className={styles.statGrid} style={{ marginBottom: "1rem" }}>
              <div className={styles.statArticle}>
                <span className={styles.statLabel}>Current Plan</span>
                <strong className={styles.statValue}>{getPlanFriendlyName(subscription.plan_key)}</strong>
              </div>
              <div className={styles.statArticle}>
                <span className={styles.statLabel}>Plan Key</span>
                <strong className={styles.statValue}>{subscription.plan_key || "\u2014"}</strong>
              </div>
              <div className={styles.statArticle}>
                <span className={styles.statLabel}>Signed Up</span>
                <strong className={styles.statValue}>{subscription.signed_up ? fmt(subscription.signed_up) : "\u2014"}</strong>
              </div>
            </div>
            {subscription.subscription?.length ? subscription.subscription.map((sub: any, i: number) => (
              <div key={i} className={styles.ledgerRow}>
                <div><strong>Status</strong><div className={`${styles.muted} ${styles.tiny}`}>{sub.status || "\u2014"}</div></div>
                <div><strong>Period</strong><div className={`${styles.muted} ${styles.tiny}`}>{sub.current_period_start ? fmt(sub.current_period_start) : "\u2014"} \u2014 {sub.current_period_end ? fmt(sub.current_period_end) : "\u2014"}</div></div>
                <div><strong>Plan</strong><div className={`${styles.muted} ${styles.tiny}`}>{sub.plan_id || "\u2014"}</div></div>
              </div>
            )) : <p className={`${styles.muted} ${styles.tiny}`}>No active subscription. You are on the Free plan.</p>}

            {hasActiveSubscription && (
              <div className={billingStyles.subActions}>
                <a href={getStripePortalUrl()} target="_blank" rel="noopener noreferrer" className={billingStyles.portalBtn}>
                  Manage Subscription
                </a>
                <a href={getStripePortalUrl()} target="_blank" rel="noopener noreferrer" className={billingStyles.upgradeBtn}>
                  Upgrade / Downgrade
                </a>
                <a href={getStripePortalUrl()} target="_blank" rel="noopener noreferrer" className={billingStyles.cancelBtn}>
                  Cancel Subscription
                </a>
              </div>
            )}
          </div>
        ) : <div className={styles.lockedOverlay}>Sign in to view your subscription info</div>}
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Available Plans</div>
        <div className={billingStyles.plansGrid}>
          {plans.sort((a: any, b: any) => a.order - b.order).map((plan: any) => {
            const isCurrent = plan.key === currentPlanKey;
            const isUpgrade = plan.order > currentPlanIndex;
            const isDowngrade = plan.order < currentPlanIndex && currentPlanIndex >= 0;

            return (
              <div key={plan.key} className={`${billingStyles.planCard} ${isCurrent ? billingStyles.planCurrent : ""}`}>
                <div className={billingStyles.planName}>{plan.name}</div>
                <div className={billingStyles.planPrice}>{plan.price === "0.00" ? "Free" : `$${plan.price}/mo`}</div>
                {isCurrent && <div className={billingStyles.planBadge}>Current Plan</div>}
                <div className={billingStyles.planLimits}>
                  {plan.limits.cloudChatDaily != null && (
                    <div className={billingStyles.planLimit}>
                      <span>Chat</span><strong>{plan.limits.cloudChatDaily}/day</strong>
                    </div>
                  )}
                  {plan.limits.imagesDaily != null && (
                    <div className={billingStyles.planLimit}>
                      <span>Images</span><strong>{plan.limits.imagesDaily}/day</strong>
                    </div>
                  )}
                  {plan.limits.videosDaily != null && (
                    <div className={billingStyles.planLimit}>
                      <span>Videos</span><strong>{plan.limits.videosDaily}/day</strong>
                    </div>
                  )}
                  {plan.limits.audioWeekly != null && (
                    <div className={billingStyles.planLimit}>
                      <span>Audio</span><strong>{plan.limits.audioWeekly}/week</strong>
                    </div>
                  )}
                  {plan.limits.aiShieldDaily != null && (
                    <div className={billingStyles.planLimit}>
                      <span>Shield</span><strong>{plan.limits.aiShieldDaily}/day</strong>
                    </div>
                  )}
                  {plan.limits.verifyTokenWithEmailDaily != null && (
                    <div className={billingStyles.planLimit}>
                      <span>Token Verify</span><strong>{plan.limits.verifyTokenWithEmailDaily}/day</strong>
                    </div>
                  )}
                </div>
                {isCurrent ? (
                  <div className={`${billingStyles.planBtn} ${billingStyles.planBtnCurrent}`}>Current Plan</div>
                ) : plan.url ? (
                  <a
                    href={hasActiveSubscription ? getStripePortalUrl() : plan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${billingStyles.planBtn} ${isUpgrade ? billingStyles.planBtnUpgrade : billingStyles.planBtnUpgrade}`}
                  >
                    {isUpgrade ? "Upgrade" : "Downgrade"}
                  </a>
                ) : (
                  <div className={`${billingStyles.planBtn} ${billingStyles.planBtnFree}`}>Free Plan</div>
                )}
              </div>
            );
          })}
        </div>
        <div className={billingStyles.pricingLink}>
          <a href={PRICING_URL} target="_blank" rel="noopener noreferrer">View full plan comparison on pricing page</a>
        </div>
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>P2G Ledger (Recent Usage & Purchases)</div>
        <div className={styles.ledger}>
          <div className={styles.ledgerHeader}><span>Type</span><span>Credits</span><span>Units</span><span>Date</span></div>
          {ledger.length === 0 ? <div className={styles.lockedOverlay} style={{ minHeight: 60 }}>No ledger entries yet.</div> : ledger.slice(0, 30).map((e: any, i: number) => (
            <div key={i} className={styles.ledgerRow}>
              <div><strong>{e.entry_type}</strong><div className={`${styles.muted} ${styles.tiny}`}>{e.usage_kind || "\u2014"}</div></div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>{Number(e.delta_credits || 0).toFixed(4)}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>{e.units != null ? e.units : "\u2014"} {e.unit_label || ""}</div>
              <div className={`${styles.muted} ${styles.tiny}`}>{e.created_at || ""}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
