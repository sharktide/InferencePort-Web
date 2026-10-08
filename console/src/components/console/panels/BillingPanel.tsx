"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./Panel.module.css";
import billingStyles from "./BillingPanel.module.css";
import { useModal } from "../../Modal";

interface BillingPanelProps { config: any; session: any; apiBase: string; }

const TIER_CONFIG_URL = "https://us-east-2.api.inferenceport.ai/tier-config";
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
  const modal = useModal();
  const [wallet, setWallet] = useState<any>(null);
  const [usageSummary, setUsageSummary] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [packs] = useState<any[]>(config?.billing?.packs || []);
  const [tierConfig, setTierConfig] = useState<any>(null);
  const [showAllPacks, setShowAllPacks] = useState(false);
  const [deployments, setDeployments] = useState<any[]>([]);

  const DEFAULT_PACK_IDS = new Set(["pack_10", "pack_50", "pack_100", "pack_200"]);
  const defaultPacks = packs.filter((p: any) => DEFAULT_PACK_IDS.has(p.id));
  const extraPacks = packs.filter((p: any) => !DEFAULT_PACK_IDS.has(p.id));
  const visiblePacks = showAllPacks ? packs : defaultPacks;

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };

  const loadBillingData = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const [me, ledgerData, subData, tiers, deployData] = await Promise.all([
        fj("/v1/me", { headers: authH() }),
        fj("/v1/credits/ledger?limit=100", { headers: authH() }),
        fj("/subscription", { headers: authH() }).catch(() => null),
        fetch(TIER_CONFIG_URL).then(r => r.json()).catch(() => null),
        fj("/v1/deploy", { headers: authH() }).catch(() => ({ data: [] })),
      ]);
      setWallet(me.wallet || {});
      setUsageSummary(me.usage_summary || {});
      setLedger(ledgerData.entries || []);
      setDeployments(deployData.data || []);
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
        <div className={styles.heading}>P2G credits (Pay-2-Go)</div>
        {wallet ? (
          <div className={billingStyles.walletContent}>
            <div className={billingStyles.balanceCard}>
              <div className={billingStyles.balanceLabel}>Available balance</div>
              <div className={billingStyles.balanceValue}>{Number(wallet.balance_credits || 0).toFixed(4)}</div>
              <div className={billingStyles.balanceUnit}>credits</div>
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: "0.2rem" }}>Paid Credits</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "1.1rem", fontWeight: 600, color: "#22c55e" }}>{Number(wallet.paid_credits || 0).toFixed(4)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: "0.2rem" }}>Promotional Credits</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "1.1rem", fontWeight: 600, color: "#a78bfa" }}>{Number(wallet.promotional_credits || 0).toFixed(4)}</div>
                </div>
              </div>
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
        ) : <div className={styles.lockedOverlay}>Sign in to view your credit balance.</div>}
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Top up credits</div>
        <div className={showAllPacks ? billingStyles.packsGrid : `${billingStyles.packsGrid} ${billingStyles.packsGridConstrained}`}>
          {visiblePacks.map((p: any) => (
            <div key={p.label} className={billingStyles.packCard}>
              <div className={billingStyles.packPrice}>{p.label}</div>
              <div className={billingStyles.packCredits}>{Number(p.credits).toFixed(4)} credits</div>
              <div className={billingStyles.packUsd}>${Number(p.amountUsd).toFixed(2)} USD</div>
              <button
                className={billingStyles.packBtn}
                disabled={!p.stripePaymentLink}
                onClick={() => {
                  if (!session?.user?.email) return void modal.alert("Sign in first.");
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
        {!showAllPacks && extraPacks.length > 0 && (
          <button
            className={billingStyles.showMorePacks}
            onClick={() => setShowAllPacks(true)}
          >
            Show {extraPacks.length} more pack{extraPacks.length > 1 ? "s" : ""}
          </button>
        )}
        {showAllPacks && (
          <button
            className={billingStyles.showMorePacks}
            onClick={() => setShowAllPacks(false)}
          >
            Show fewer options
          </button>
        )}
        <div className={styles.subheading}>Usage rates</div>
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
                <span className={styles.statLabel}>Current plan</span>
                <strong className={styles.statValue}>{getPlanFriendlyName(subscription.plan_key)}</strong>
              </div>
              <div className={styles.statArticle}>
                <span className={styles.statLabel}>Plan key</span>
                <strong className={styles.statValue}>{subscription.plan_key || "None"}</strong>
              </div>
              <div className={styles.statArticle}>
                <span className={styles.statLabel}>Signed up</span>
                <strong className={styles.statValue}>{subscription.signed_up ? fmt(subscription.signed_up) : "None"}</strong>
              </div>
            </div>
            {subscription.subscription?.length ? subscription.subscription.map((sub: any, i: number) => (
              <div key={i} className={styles.ledgerRow}>
                <div><strong>Status</strong><div className={`${styles.muted} ${styles.tiny}`}>{sub.status || "None"}</div></div>
                <div><strong>Period</strong><div className={`${styles.muted} ${styles.tiny}`}>{sub.current_period_start ? fmt(sub.current_period_start) : "None"} to {sub.current_period_end ? fmt(sub.current_period_end) : "None"}</div></div>
                <div><strong>Plan</strong><div className={`${styles.muted} ${styles.tiny}`}>{sub.plan_id || "None"}</div></div>
              </div>
            )) : <p className={`${styles.muted} ${styles.tiny}`}>No active subscription. You are on the Free plan.</p>}

            {hasActiveSubscription && (
              <div className={billingStyles.subActions}>
                <a href={getStripePortalUrl()} target="_blank" rel="noopener noreferrer" className={billingStyles.portalBtn}>
                  Manage subscription
                </a>
                <a href={getStripePortalUrl()} target="_blank" rel="noopener noreferrer" className={billingStyles.upgradeBtn}>
                  Upgrade / Downgrade
                </a>
                <a href={getStripePortalUrl()} target="_blank" rel="noopener noreferrer" className={billingStyles.cancelBtn}>
                  Cancel subscription
                </a>
              </div>
            )}
          </div>
        ) : <div className={styles.lockedOverlay}>Sign in to view your subscription.</div>}
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Featherless deployments</div>
        {(() => {
          const activeDeployments = deployments.filter((d: any) => d.status === "active");
          if (activeDeployments.length === 0) {
            return <p className={`${styles.muted} ${styles.tiny}`}>No active deployments. Deploy models from the Deploy tab.</p>;
          }
          return (
            <div>
              <div className={billingStyles.statsRow} style={{ marginBottom: "12px" }}>
                <div className={billingStyles.statItem}>
                  <span className={billingStyles.statLabel}>Active</span>
                  <strong className={billingStyles.statValue}>{activeDeployments.length}</strong>
                </div>
                <div className={billingStyles.statItem}>
                  <span className={billingStyles.statLabel}>Monthly fees</span>
                  <strong className={billingStyles.statValue}>${activeDeployments.reduce((s: number, d: any) => s + (d.monthly_fee || 0), 0).toFixed(2)}</strong>
                </div>
              </div>
              {activeDeployments.map((d: any) => (
                <div key={d.id} className={styles.ledgerRow}>
                  <div>
                    <strong>{d.featherless_model_id}</strong>
                    <div className={`${styles.muted} ${styles.tiny}`}>{d.display_model_id}</div>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>${d.monthly_fee}/mo</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>
                    {d.total_input_tokens?.toLocaleString()} in / {d.total_output_tokens?.toLocaleString()} out
                  </div>
                  <div>
                    <span className={`${styles.muted} ${styles.tiny}`}>Cycle ends: {d.billing_cycle_end ? new Date(d.billing_cycle_end).toLocaleDateString() : "N/A"}</span>
                    <button
                      onClick={async () => {
                        if (!await modal.confirm("Access will remain until the end of the current billing cycle.", "Cancel this deployment?")) return;
                        try {
                          await fj(`/v1/deploy/${d.id}/cancel`, { method: "POST", headers: authH() });
                          loadBillingData();
                        } catch (e: any) { await modal.alert(e.message); }
                      }}
                      style={{ marginLeft: "8px", padding: "2px 8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text)", cursor: "pointer", fontSize: "11px" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
              <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "8px" }}>
                <a href="#" onClick={(e) => { e.preventDefault(); (document.querySelector('[data-console-tab="deploy"]') as HTMLButtonElement)?.click(); }}>Manage all deployments</a>
              </p>
            </div>
          );
        })()}
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Available plans</div>
        <div className={billingStyles.plansGrid}>
          {plans.sort((a: any, b: any) => a.order - b.order).map((plan: any) => {
            const isCurrent = plan.key === currentPlanKey;
            const isUpgrade = plan.order > currentPlanIndex;
            const isDowngrade = plan.order < currentPlanIndex && currentPlanIndex >= 0;

            return (
              <div key={plan.key} className={`${billingStyles.planCard} ${isCurrent ? billingStyles.planCurrent : ""}`}>
                <div className={billingStyles.planName}>{plan.name}</div>
                <div className={billingStyles.planPrice}>{plan.price === "0.00" ? "Free" : `$${plan.price}/mo`}</div>
                {isCurrent && <div className={billingStyles.planBadge}>Current plan</div>}
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
                      <span>Token verify</span><strong>{plan.limits.verifyTokenWithEmailDaily}/day</strong>
                    </div>
                  )}
                </div>
                {isCurrent ? (
                  <div className={`${billingStyles.planBtn} ${billingStyles.planBtnCurrent}`}>Current plan</div>
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
                  <div className={`${billingStyles.planBtn} ${billingStyles.planBtnFree}`}>Free plan</div>
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
        <div className={styles.heading}>P2G ledger <span className={`${styles.muted} ${styles.tiny}`} style={{ fontWeight: 500 }}>Recent usage and purchases</span></div>
        <div className={styles.ledger}>
          <div className={styles.ledgerHeader}><span>Type</span><span>Credits</span><span>Units</span><span>Date</span></div>
          {ledger.length === 0 ? <div className={styles.lockedOverlay} style={{ minHeight: 60 }}>No ledger entries yet.</div> : ledger.slice(0, 30).map((e: any, i: number) => (
            <div key={i} className={styles.ledgerRow}>
              <div><strong>{e.entry_type}</strong><div className={`${styles.muted} ${styles.tiny}`}>{e.usage_kind || "None"}</div></div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>{Number(e.delta_credits || 0).toFixed(4)}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>{e.units != null ? e.units : "None"} {e.unit_label || ""}</div>
              <div className={`${styles.muted} ${styles.tiny}`}>{e.created_at || ""}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
