"use client";

import { useEffect, useState } from "react";
import Icon, { type IconName } from "../Icon";
import { PERSONAL_ITEMS } from "../../lib/consoleSections";
import styles from "./HomePanel.module.css";

interface Props { session: any; apiBase: string; onNavigate: (tab: string) => void }
type Balance = { key: string; amount: number | null; error: boolean };
const actions: { label: string; description: string; id: string; icon: IconName }[] = [
  { label: "Explore models", description: "Compare models, capabilities and pricing.", id: "models", icon: "cube" },
  { label: "Open Playground", description: "Try an idea across eight modalities.", id: "playground", icon: "sparkle" },
  { label: "Get an API key", description: "Connect InferencePort to your project.", id: "api-key", icon: "key" },
];

export default function HomePanel({ session, apiBase, onNavigate }: Props) {
  const token = session?.access_token as string | undefined;
  const userId = session?.user?.id as string | undefined;
  const key = (userId || "") + "|" + apiBase + "|" + (token || "");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const state = balance?.key === key ? balance : null;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch(apiBase + "/v1/me", { headers: { Authorization: "Bearer " + token }, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load wallet");
        return response.json();
      })
      .then((data) => {
        const value = Number(data?.wallet?.balance_credits);
        if (!controller.signal.aborted) setBalance({ key, amount: Number.isFinite(value) ? value : null, error: false });
      })
      .catch(() => { if (!controller.signal.aborted) setBalance({ key, amount: null, error: true }); });
    return () => controller.abort();
  }, [key, apiBase, token]);

  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem("console-recent:" + userId + ":personal") || "[]");
      setRecent(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(0, 4) : []);
    } catch { setRecent([]); }
  }, [userId]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.eyebrow}>Your workspace</div>
        <h2>Good to have you back.</h2>
        <p>Pick up where you left off, test a model or get your next application running.</p>
        <div className={styles.heroActions}>
          <button type="button" className={styles.primary} onClick={() => onNavigate("playground")}><Icon name="play" size={17} /> Open Playground</button>
          <button type="button" className={styles.secondary} onClick={() => onNavigate("build")}>Explore tools <span aria-hidden="true">→</span></button>
        </div>
      </header>
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Available credits</span>
          <strong className={styles.summaryValue}>{!state ? "—" : state.amount === null ? "Unavailable" : state.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong>
          <button type="button" onClick={() => onNavigate("billing")}>Manage balance <span aria-hidden="true">→</span></button>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Your API workspace</span>
          <strong className={styles.summaryValueSmall}>Ready to build</strong>
          <button type="button" onClick={() => onNavigate("usage")}>View your usage <span aria-hidden="true">→</span></button>
        </div>
      </div>
      <section className={styles.section}>
        <div className={styles.sectionTitle}><h3>Quick start</h3><span>One click to your next step</span></div>
        <div className={styles.actions}>
          {actions.map((action) => (
            <button key={action.id} type="button" className={styles.action} onClick={() => onNavigate(action.id)}>
              <span className={styles.actionIcon}><Icon name={action.icon} size={21} /></span>
              <strong>{action.label}</strong>
              <span>{action.description}</span>
              <span className={styles.actionArrow} aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>
      {recent.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}><h3>Continue working</h3><span>Your recently visited pages</span></div>
          <div className={styles.recent}>
            {recent.filter((id) => id in PERSONAL_ITEMS && !["account", "authorized-apps"].includes(id)).map((id) => (
              <button key={id} type="button" onClick={() => onNavigate(id)}>{PERSONAL_ITEMS[id as keyof typeof PERSONAL_ITEMS].label}<span aria-hidden="true">→</span></button>
            ))}
          </div>
        </section>
      )}
      <footer className={styles.footer}>Need a reference? <a href="https://docs.inferenceport.ai" target="_blank" rel="noreferrer">Read the documentation ↗</a></footer>
    </div>
  );
}
