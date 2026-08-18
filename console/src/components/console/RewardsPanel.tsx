"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./RewardsPanel.module.css";

interface Props {
  session: any;
  apiBase: string;
  onUnclaimedCount?: (count: number) => void;
}

interface RewardProgress {
  current: number;
  threshold: number;
  percent: number;
  earned: boolean;
  claimed: boolean;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: number;
  category: string;
  chain: string;
  criteria: any;
  reward: any;
  progress: RewardProgress;
}

const CATEGORY_LABELS: Record<string, string> = {
  spend: "Spend",
  diversity: "Models",
  volume: "Requests",
  tokens: "Tokens",
  streak: "Streak",
  special: "Special",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCriteria(criteria: any): string {
  const t = criteria?.type;
  const thr = criteria?.threshold ?? 0;
  if (t === "total_spend_usd") return `$${formatNumber(thr)} spent`;
  if (t === "total_requests") return `${formatNumber(thr)} requests`;
  if (t === "total_tokens") return `${formatNumber(thr)} tokens`;
  if (t === "unique_models_tried") return `${thr} models`;
  if (t === "days_visited") return `${thr} days visited`;
  if (t === "consecutive_days") return `${thr}-day streak`;
  if (t === "multi_criteria") {
    const conds = criteria?.conditions || [];
    return conds.map((c: any) => formatCriteria(c)).join(" + ");
  }
  return t;
}

export default function RewardsPanel({ session, apiBase, onUnclaimedCount }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<any>(null);
  const [optedOut, setOptedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [showClaimEffect, setShowClaimEffect] = useState<Reward | null>(null);
  const [category, setCategory] = useState("all");
  const claimEffectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/v1/rewards`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRewards(data.rewards || []);
        setDiscounts(data.active_discounts || {});
        setStats(data.stats_summary || null);
        setOptedOut(data.opted_out || false);
        const unclaimed = (data.rewards || []).filter((r: Reward) => r.progress.earned && !r.progress.claimed).length;
        onUnclaimedCount?.(unclaimed);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [session, apiBase, onUnclaimedCount]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleClaim = async (reward: Reward) => {
    if (!session?.access_token || claiming) return;
    setClaiming(reward.id);
    try {
      const res = await fetch(`${apiBase}/v1/rewards/claim/${reward.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setShowClaimEffect(reward);
        if (claimEffectTimeout.current) clearTimeout(claimEffectTimeout.current);
        claimEffectTimeout.current = setTimeout(() => setShowClaimEffect(null), 4000);
        await fetchData();
      }
    } catch {
    } finally {
      setClaiming(null);
    }
  };

  const handleOptOut = async () => {
    if (!session?.access_token) return;
    const newVal = !optedOut;
    try {
      const res = await fetch(`${apiBase}/v1/rewards/opt-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ opted_out: newVal }),
      });
      if (res.ok) setOptedOut(newVal);
    } catch {}
  };

  const filtered = category === "all" ? rewards : rewards.filter((r) => r.category === category);
  const earnedCount = rewards.filter((r) => r.progress.earned).length;
  const claimedCount = rewards.filter((r) => r.progress.claimed).length;
  const discountCount = Object.keys(discounts).filter((k) => !k.startsWith("__")).length;

  const groupedByChain = filtered.reduce<Record<string, Reward[]>>((acc, r) => {
    const chain = r.chain || r.category;
    if (!acc[chain]) acc[chain] = [];
    acc[chain].push(r);
    return acc;
  }, {});

  const chainOrder = ["spend", "diversity", "volume", "tokens", "streak", "special"];

  if (loading) {
    return (
      <div className={styles.rewardsPanel}>
        <div className={styles.emptyState}>
          <div className={styles.spinner} />
          <p>Loading rewards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.rewardsPanel}>
      {showClaimEffect && (
        <div className={styles.claimOverlay}>
          <div className={styles.claimEffect}>
            <div className={styles.claimBurst} />
            <div className={styles.claimIcon}>{showClaimEffect.icon}</div>
            <div className={styles.claimTitle}>Reward Claimed!</div>
            <div className={styles.claimName}>{showClaimEffect.name}</div>
            <div className={styles.claimReward}>{showClaimEffect.reward?.label}</div>
          </div>
        </div>
      )}

      <div className={styles.headerRow}>
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Spent</span>
            <span className={styles.statValue}>${formatNumber(stats?.total_spend_usd || 0)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Models Tried</span>
            <span className={styles.statValue}>{stats?.unique_models_tried || 0}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Days Visited</span>
            <span className={styles.statValue}>{stats?.days_visited || 0}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Earned</span>
            <span className={styles.statValue}>{earnedCount}/{rewards.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Discounts</span>
            <span className={styles.statValue}>{discountCount}</span>
          </div>
        </div>
        <button className={styles.optOutBtn} onClick={handleOptOut}>
          {optedOut ? "Enable Rewards" : "Opt Out"}
        </button>
      </div>

      {optedOut && (
        <div className={styles.optedOutBanner}>
          Rewards are disabled. Click &quot;Enable Rewards&quot; to reactivate.
        </div>
      )}

      {discountCount > 0 && !optedOut && (
        <div className={styles.discountSection}>
          <div className={styles.discountTitle}>Active Discounts</div>
          <div className={styles.discountGrid}>
            {Object.entries(discounts).map(([modelId, pct]) => (
              <span key={modelId} className={`${styles.discountChip} ${modelId === "__all_models__" ? styles.discountChipAll : ""}`}>
                {modelId === "__all_models__" ? "All Models" : modelId}: {pct}% off
              </span>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🏅</div>
          <p>No rewards in this category yet.</p>
        </div>
      ) : (
        <div className={styles.chainsContainer}>
          {chainOrder.filter((ch) => groupedByChain[ch]).map((chainKey) => {
            const chainRewards = groupedByChain[chainKey];
            const chainLabel = CATEGORY_LABELS[chainKey] || chainKey;
            return (
              <div key={chainKey} className={styles.chainGroup}>
                <div className={styles.chainHeader}>
                  <span className={styles.chainTitle}>{chainLabel} Track</span>
                  <span className={styles.chainCount}>
                    {chainRewards.filter((r) => r.progress.claimed).length}/{chainRewards.length} claimed
                  </span>
                </div>
                <div className={styles.chainGrid}>
                  {chainRewards.map((r) => {
                    const cardClass = r.progress.claimed
                      ? styles.rewardCardClaimed
                      : r.progress.earned
                      ? styles.rewardCardEarned
                      : "";
                    return (
                      <div key={r.id} className={`${styles.rewardCard} ${cardClass}`}>
                        <div className={styles.rewardCardBody}>
                          <div className={styles.rewardHeader}>
                            <div className={`${styles.rewardIcon} ${r.progress.earned ? styles.rewardIconEarned : ""}`}>
                              {r.icon}
                            </div>
                            <div className={styles.rewardInfo}>
                              <div className={styles.rewardName}>{r.name}</div>
                              <div className={styles.rewardDesc}>{r.description}</div>
                            </div>
                            <span className={styles.rewardTier}>T{r.tier}</span>
                          </div>

                          {r.reward?.label && (
                            <span className={styles.rewardLabel}>{r.reward.label}</span>
                          )}

                          <div className={styles.progressWrap}>
                            <div className={styles.progressInfo}>
                              <span>{formatCriteria(r.criteria)}</span>
                              <span className={styles.progressCurrent}>
                                {r.progress.percent >= 100 ? "Complete" : `${r.progress.percent}%`}
                              </span>
                            </div>
                            <div className={styles.progressBar}>
                              <div
                                className={`${styles.progressFill} ${r.progress.percent >= 100 ? styles.progressFillComplete : ""}`}
                                style={{ width: `${Math.min(100, r.progress.percent)}%` }}
                              />
                            </div>
                          </div>

                          {r.progress.claimed ? (
                            <span className={styles.claimedBadge}>✓ Claimed</span>
                          ) : r.progress.earned ? (
                            <button
                              className={styles.claimBtn}
                              disabled={claiming === r.id}
                              onClick={() => handleClaim(r)}
                            >
                              {claiming === r.id ? "Claiming..." : "Claim Reward"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
