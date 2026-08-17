"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./RewardsPanel.module.css";

interface Props {
  session: any;
  apiBase: string;
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

const CATEGORY_CLASSES: Record<string, string> = {
  spend: styles.catSpend,
  diversity: styles.catDiversity,
  volume: styles.catVolume,
  tokens: styles.catTokens,
  streak: styles.catStreak,
  special: styles.catSpecial,
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
  if (t === "consecutive_days") return `${thr}-day streak`;
  if (t === "multi_criteria") {
    const conds = criteria?.conditions || [];
    return conds.map((c: any) => formatCriteria(c)).join(" + ");
  }
  return t;
}

export default function RewardsPanel({ session, apiBase }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [category, setCategory] = useState("all");

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
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [session, apiBase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClaim = async (rewardId: string) => {
    if (!session?.access_token) return;
    setClaiming(rewardId);
    try {
      const res = await fetch(`${apiBase}/v1/rewards/claim/${rewardId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
    } finally {
      setClaiming(null);
    }
  };

  const filtered = category === "all"
    ? rewards
    : rewards.filter((r) => r.category === category);

  const earnedCount = rewards.filter((r) => r.progress.earned).length;
  const claimedCount = rewards.filter((r) => r.progress.claimed).length;
  const discountCount = Object.keys(discounts).filter((k) => !k.startsWith("__")).length;

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
          <span className={styles.statLabel}>Requests</span>
          <span className={styles.statValue}>{formatNumber(stats?.total_requests || 0)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Badges Earned</span>
          <span className={styles.statValue}>{earnedCount}/{rewards.length}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active Discounts</span>
          <span className={styles.statValue}>{discountCount}</span>
        </div>
      </div>

      {discountCount > 0 && (
        <div className={styles.discountSection}>
          <div className={styles.discountTitle}>Active Model Discounts</div>
          <div className={styles.discountGrid}>
            {Object.entries(discounts).map(([modelId, pct]) => (
              <span
                key={modelId}
                className={`${styles.discountChip} ${modelId === "__all_models__" ? styles.discountChipAll : ""}`}
              >
                {modelId === "__all_models__" ? "All Models" : modelId}: {pct}% off
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={styles.tabs}>
        {["all", "spend", "diversity", "volume", "tokens", "streak", "special"].map((cat) => (
          <button
            key={cat}
            className={`${styles.tab} ${category === cat ? styles.active : ""}`}
            onClick={() => setCategory(cat)}
          >
            {cat === "all" ? "All" : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🏅</div>
          <p>No rewards in this category yet.</p>
        </div>
      ) : (
        <div className={styles.rewardsGrid}>
          {filtered.map((r) => {
            const cardClass = r.progress.claimed
              ? styles.rewardCardClaimed
              : r.progress.earned
              ? styles.rewardCardEarned
              : "";
            return (
              <div key={r.id} className={`${styles.rewardCard} ${cardClass}`}>
                <span className={`${styles.rewardTier}`}>Tier {r.tier}</span>
                <div className={styles.rewardHeader}>
                  <div className={`${styles.rewardIcon} ${r.progress.earned ? styles.rewardIconEarned : ""}`}>
                    {r.icon}
                  </div>
                  <div className={styles.rewardInfo}>
                    <div className={styles.rewardName}>{r.name}</div>
                    <div className={styles.rewardDesc}>{r.description}</div>
                  </div>
                </div>

                <span className={`${styles.rewardCategory} ${CATEGORY_CLASSES[r.category] || ""}`}>
                  {CATEGORY_LABELS[r.category] || r.category}
                </span>

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
                    onClick={() => handleClaim(r.id)}
                  >
                    {claiming === r.id ? "Claiming..." : "Claim Reward"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
