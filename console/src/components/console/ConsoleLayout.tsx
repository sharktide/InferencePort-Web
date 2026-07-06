"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import AccountPanel from "./panels/AccountPanel";
import ModelsPanel from "./panels/ModelsPanel";
import ApiKeyPanel from "./panels/ApiKeyPanel";
import UsagePanel from "./panels/UsagePanel";
import GenApiPanel from "./panels/GenApiPanel";
import PaygApiPanel from "./panels/PaygApiPanel";
import ShieldPanel from "./panels/ShieldPanel";
import AuthorizedAppsPanel from "./panels/AuthorizedAppsPanel";
import styles from "./ConsoleLayout.module.css";

const FALLBACK_API_BASE = "https://sharktide-lightning.hf.space";

export default function ConsoleLayout() {
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [supabase, setSupabase] = useState<SupabaseClient<any, any, any> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const [initialized, setInitialized] = useState(false);
  const [apiBase, setApiBase] = useState(FALLBACK_API_BASE);

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

  const panelMap: Record<string, React.ReactNode> = {
    account: <AccountPanel config={config} session={session} supabase={supabase} apiBase={apiBase} />,
    models: <ModelsPanel config={config} session={session} apiBase={apiBase} />,
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
        />
        <main className={styles.consoleContent}>
          {panelMap[activeTab] || panelMap.account}
        </main>
      </div>
    </div>
  );
}
