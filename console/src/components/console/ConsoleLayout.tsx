"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import TopBar from "./TopBar";
import Sidebar, { navTabs } from "./Sidebar";
import AccountPanel from "./panels/AccountPanel";
import BillingPanel from "./panels/BillingPanel";
import ModelsPanel from "./panels/ModelsPanel";
import ApiKeyPanel from "./panels/ApiKeyPanel";
import UsagePanel from "./panels/UsagePanel";
import GenApiPanel from "./panels/GenApiPanel";
import PaygApiPanel from "./panels/PaygApiPanel";
import ShieldPanel from "./panels/ShieldPanel";
import AuthorizedAppsPanel from "./panels/AuthorizedAppsPanel";
import RewardsPanel from "./RewardsPanel";
import styles from "./ConsoleLayout.module.css";

const FALLBACK_API_BASE = "https://sharktide-lightning.hf.space";

/* Presentation only: one line under each page title. */
const tabDescriptions: Record<string, string> = {
  account: "Sign in, and manage your profile, linked accounts and security.",
  billing: "Your P2G credit wallet, top-ups, subscription plan and recent ledger entries.",
  models: "Browse the model catalog with pricing, and try models in the playground.",
  rewards: "Rewards you have earned, and the ones ready to claim.",
  "api-key": "Long-lived keys for scripts, servers and production. Send a key as a Bearer token when you call Lightning.",
  usage: "Credits and requests from your P2G ledger, your plan limits and recent activity.",
  "gen-api": "The subscription Generation API, which uses your plan quotas: reference and playground.",
  "payg-api": "The credit-billed Pay-2-Go API: reference, pricing and playground.",
  shield: "AI Shield abuse and fraud analysis: how it works, and a playground to test signals.",
  "authorized-apps": "Applications you have allowed to access your InferencePort AI account.",
};

export default function ConsoleLayout() {
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [supabase, setSupabase] = useState<SupabaseClient<any, any, any> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "account";
    return localStorage.getItem("console-active-tab") || "account";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("console-active-tab", activeTab);
    }
  }, [activeTab]);
  const [initialized, setInitialized] = useState(false);
  const [apiBase, setApiBase] = useState(FALLBACK_API_BASE);
  const [unclaimedRewards, setUnclaimedRewards] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("session_id")) {
      router.replace(`/confirm${window.location.search}${window.location.hash}`);
      return;
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("console-theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved || (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("console-theme", next);
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${FALLBACK_API_BASE}/v1/config`);
        const cfg = await res.json();
        if (cancelled) return;
        setConfig(cfg);

        const configuredBase = String(cfg?.dashboard?.apiBaseUrl || "").trim();
        const base = configuredBase.startsWith("https://") ? configuredBase.replace(/\/$/, "") : FALLBACK_API_BASE;
        setApiBase(base);

        const url = cfg?.supabase?.url;
        const key = cfg?.supabase?.publishableKey;
        if (url && key) {
          const client = createClient(url, key, { auth: { persistSession: true } });
          setSupabase(client);
          const { data: { session: s } } = await client.auth.getSession();
          if (!cancelled) {
            setSession(s);
            setInitialized(true);
            if (s) setActiveTab("models");
          }
          client.auth.onAuthStateChange(async (_event, s) => {
            if (cancelled) return;
            setSession(s);
            if (s) {
              setActiveTab("models");
            } else {
              setActiveTab("account");
            }
          });
        } else {
          if (!cancelled) setInitialized(true);
        }
      } catch {
        if (!cancelled) setInitialized(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${apiBase}/v1/rewards`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        const unclaimed = (d.rewards || []).filter((r: any) => r.progress?.earned && !r.progress?.claimed).length;
        setUnclaimedRewards(unclaimed);
      })
      .catch(() => {});
  }, [session, apiBase]);

  const panelMap: Record<string, React.ReactNode> = {
    account: <AccountPanel config={config} session={session} supabase={supabase} />,
    billing: <BillingPanel config={config} session={session} apiBase={apiBase} />,
    models: <ModelsPanel config={config} session={session} apiBase={apiBase} theme={theme} />,
    rewards: <RewardsPanel session={session} apiBase={apiBase} onUnclaimedCount={setUnclaimedRewards} />,
    "api-key": <ApiKeyPanel session={session} apiBase={apiBase} />,
    usage: <UsagePanel session={session} apiBase={apiBase} />,
    "gen-api": <GenApiPanel session={session} config={config} apiBase={apiBase} />,
    "payg-api": <PaygApiPanel session={session} config={config} apiBase={apiBase} />,
    shield: <ShieldPanel session={session} config={config} apiBase={apiBase} />,
    "authorized-apps": <AuthorizedAppsPanel session={session} config={config} apiBase={apiBase} supabase={supabase} />,
  };

  if (!initialized) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} aria-hidden="true" />
        <p>Loading console...</p>
      </div>
    );
  }

  return (
    <div className={styles.consoleWrapper}>
      <TopBar
        user={session?.user}
        onSignOut={() => supabase?.auth.signOut()}
        onThemeToggle={toggleTheme}
        theme={theme}
        homeUrl={config?.dashboard?.homeUrl || "https://inferenceport.ai"}
        appName={config?.dashboard?.appName || "InferencePort AI"}
        isMobileNavOpen={isMobileNavOpen}
        onMobileNavToggle={() => setIsMobileNavOpen(!isMobileNavOpen)}
      />
      <div className={styles.consoleShell}>
        <Sidebar
          user={session?.user}
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unclaimedRewards={unclaimedRewards}
        />
        <main className={styles.consoleContent}>
          {(() => {
            const shownTab = panelMap[activeTab] ? activeTab : "account";
            const tabInfo = navTabs.find((t) => t.id === shownTab);
            return (
              <header className={styles.pageHead}>
                <h1>{tabInfo?.label}</h1>
                {tabDescriptions[shownTab] && <p>{tabDescriptions[shownTab]}</p>}
              </header>
            );
          })()}
          {panelMap[activeTab] || panelMap.account}
        </main>
      </div>
    </div>
  );
}
