"use client";

import { useState, useEffect, useCallback, useRef, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { consoleTabFromPath, consoleTabHref, normalizeConsoleTab } from "../../lib/consoleTabs";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import { ORGS_CHANGED_EVENT, OrgProvider, useOrgContext } from "./OrgContext";
import OrgWorkspace, { isOrgSection, orgSectionAllowed, SPENDING_ROLES } from "./OrgWorkspace";
import { CONSOLE_NAVIGATE_EVENT } from "./ContextSwitcher";
import type { OrgSummary } from "../../lib/orgs";
import AccountPanel from "./panels/AccountPanel";
import BillingPanel from "./panels/BillingPanel";
import ModelsPanel from "./panels/ModelsPanel";
import ApiKeyPanel from "./panels/ApiKeyPanel";
import UsagePanel from "./panels/UsagePanel";
import GenApiPanel from "./panels/GenApiPanel";
import PaygApiPanel from "./panels/PaygApiPanel";
import ShieldPanel from "./panels/ShieldPanel";
import AuthorizedAppsPanel from "./panels/AuthorizedAppsPanel";
import DeployPanel from "./panels/DeployPanel";
import PlaygroundPanel from "./panels/PlaygroundPanel";
import AgentsPanel from "./panels/AgentsPanel";
import McpPanel from "./panels/McpPanel";
import OrganizationsPanel from "./panels/OrganizationsPanel";
import RewardsPanel from "./RewardsPanel";
import styles from "./ConsoleLayout.module.css";

/* Personal-only sections. In organization mode the org sections (and the work tabs) replace them. */
const PERSONAL_ONLY_TABS = new Set(["billing", "rewards", "api-key", "usage", "authorized-apps"]);
const SLUG_RE = /^[a-z0-9-]{1,40}$/i;

/* Invitation and organization deep links must not be overridden by the models redirect below */
function landsOnOrganizations(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("org_invite") || params.has("org");
}

/* Explicit console routes and invitation links win over the saved tab. */
function hasExplicitLanding(): boolean {
  if (typeof window === "undefined") return false;
  return landsOnOrganizations()
    || new URLSearchParams(window.location.search).has("invite")
    || consoleTabFromPath(window.location.pathname) !== null;
}

/* First paint tab: query-based invitations and org links take priority over tab paths and saved tabs. */
function initialTab(): string {
  if (typeof window === "undefined") return "account";
  const params = new URLSearchParams(window.location.search);
  if (params.has("invite")) return "agents";
  if (params.has("org_invite")) return "organizations";
  if (params.has("org")) return params.has("billing") ? "org-billing" : "org-overview";
  const routeTab = consoleTabFromPath(window.location.pathname);
  if (routeTab) return routeTab;
  try {
    return normalizeConsoleTab(localStorage.getItem("console-active-tab")) || "account";
  } catch {
    return "account";
  }
}

/* Whether a section can be shown in the current context (personal, or the active organization). */
/* Work tabs (models, playground, agents) bill the org wallet, so they need a role that may spend org credits. */
const WORK_TABS = new Set(["models", "playground", "agents", "mcp"]);

function tabAvailable(tab: string, org: OrgSummary | null): boolean {
  if (isOrgSection(tab)) return !!org && orgSectionAllowed(tab, org.role);
  if (org && WORK_TABS.has(tab) && !SPENDING_ROLES.includes(org.role)) return false;
  /* Deploy is listed in the Work/Build navigation for roles that can spend; keep saved tabs consistent with that. */
  if (org && tab === "deploy" && !SPENDING_ROLES.includes(org.role)) return false;
  if (org) return !PERSONAL_ONLY_TABS.has(tab);
  return true;
}

function defaultTab(org: OrgSummary | null): string {
  return org ? "org-overview" : "models";
}

const FALLBACK_API_BASE = "https://us-east-2.api.inferenceport.ai";
const STAGING_API_BASE = "https://staging-api.inferenceport.ai";

export default function ConsoleLayout() {
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [supabase, setSupabase] = useState<SupabaseClient<any, any, any> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);

  /* Keep the address bar in sync without remounting the console on every tab switch. */
  const updateTab = useCallback((tab: string, method: "push" | "replace") => {
    const normalized = normalizeConsoleTab(tab);
    if (!normalized) return;
    setActiveTab(normalized);
    if (typeof window === "undefined") return;
    const path = consoleTabHref(normalized, window.location.hostname);
    if (window.location.pathname === path) return;
    const href = `${path}${window.location.search}${window.location.hash}`;
    if (method === "push") window.history.pushState(window.history.state, "", href);
    else window.history.replaceState(window.history.state, "", href);
  }, []);
  const navigateTab = useCallback((tab: string) => updateTab(tab, "push"), [updateTab]);
  const replaceTab = useCallback((tab: string) => updateTab(tab, "replace"), [updateTab]);

  /* On refresh, use the requested route; on browser Back/Forward, restore that tab. */
  useEffect(() => {
    const routeTab = consoleTabFromPath(window.location.pathname);
    if (routeTab) {
      const canonical = consoleTabHref(routeTab, window.location.hostname);
      if (window.location.pathname !== canonical) {
        window.history.replaceState(window.history.state, "", `${canonical}${window.location.search}${window.location.hash}`);
      }
    }
    const onPopState = () => {
      const tab = consoleTabFromPath(window.location.pathname);
      if (tab) setActiveTab(tab);
      else if (["/", "/console", "/console/"].includes(window.location.pathname)) setActiveTab(initialTab());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("console-active-tab", activeTab);
    }
  }, [activeTab]);
  /* Read once on first render: did the user already have a saved tab, and are they returning from an OAuth redirect? */
  const hadSavedTab = useRef(typeof window !== "undefined" && !!localStorage.getItem("console-active-tab"));
  const fromAuthRedirect = useRef(typeof window !== "undefined" && /access_token|[?&]code=/.test(window.location.hash + window.location.search));
  const hadSession = useRef(false);
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

  /* Panels and menus ask for a section by id (e.g. "organizations", "org-security") through this event */
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const tab = (e as CustomEvent<unknown>).detail;
      if (typeof tab !== "string" || !tab) return;
      navigateTab(tab);
      setIsMobileNavOpen(false);
    };
    window.addEventListener(CONSOLE_NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(CONSOLE_NAVIGATE_EVENT, onNavigate);
  }, [navigateTab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const staging = new URLSearchParams(window.location.search).get("staging") === "true";
        const bootstrapBase = staging ? STAGING_API_BASE : FALLBACK_API_BASE;
        const res = await fetch(`${bootstrapBase}/v1/config`);
        const cfg = await res.json();
        if (cancelled) return;
        setConfig(cfg);

        const configuredBase = String(cfg?.dashboard?.apiBaseUrl || "").trim();
        const base = staging
          ? STAGING_API_BASE
          : configuredBase.startsWith("https://")
            ? configuredBase.replace(/\/$/, "")
            : FALLBACK_API_BASE;
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
            if (s) {
              hadSession.current = true;
              /* Keep the tab the user was on; only land on Models on a first visit or right after signing in */
              if ((!hadSavedTab.current || fromAuthRedirect.current) && !hasExplicitLanding()) replaceTab("models");
            }
          }
          client.auth.onAuthStateChange(async (_event, s) => {
            if (cancelled) return;
            setSession(s);
            /* First SSO sign-in: let the server add the user to their organization (idempotent, never blocks sign-in) */
            if (_event === "SIGNED_IN" && s && String(s.user?.app_metadata?.provider ?? "").startsWith("sso")) {
              fetch(`${base}/v1/orgs/sso/jit`, { method: "POST", headers: { Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" }, body: "{}" })
                .then(() => window.dispatchEvent(new Event(ORGS_CHANGED_EVENT)))
                .catch(() => {});
            }
            if (s) {
              /* Token refreshes and repeated SIGNED_IN events (e.g. returning to the browser tab) must not reset the tab */
              if (!hadSession.current && !hasExplicitLanding()) replaceTab("models");
              hadSession.current = true;
            } else {
              hadSession.current = false;
              replaceTab("account");
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
  }, [replaceTab]);

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

  if (!initialized) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} aria-hidden="true" />
        <p>Loading console...</p>
      </div>
    );
  }

  return (
    <OrgProvider session={session} apiBase={apiBase}>
      <ConsoleFrame
        config={config}
        session={session}
        supabase={supabase}
        apiBase={apiBase}
        theme={theme}
        onThemeToggle={toggleTheme}
        activeTab={activeTab}
        setActiveTab={replaceTab}
        navigateTab={navigateTab}
        isMobileNavOpen={isMobileNavOpen}
        setMobileNavOpen={setIsMobileNavOpen}
        unclaimedRewards={unclaimedRewards}
        setUnclaimedRewards={setUnclaimedRewards}
      />
    </OrgProvider>
  );
}

interface FrameProps {
  config: any;
  session: Session | null;
  supabase: SupabaseClient<any, any, any> | null;
  apiBase: string;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  navigateTab: (tab: string) => void;
  isMobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  unclaimedRewards: number;
  setUnclaimedRewards: Dispatch<SetStateAction<number>>;
}

/* Inside the org provider: keeps the active section valid for the active context and renders the page. */
function ConsoleFrame({
  config,
  session,
  supabase,
  apiBase,
  theme,
  onThemeToggle,
  activeTab,
  setActiveTab,
  navigateTab,
  isMobileNavOpen,
  setMobileNavOpen,
  unclaimedRewards,
  setUnclaimedRewards,
}: FrameProps) {
  const { orgs, activeSlug, activeOrg, listError, refresh, setActiveSlug } = useOrgContext();

  /* ?org=<slug> from a link: switch to that organization, then drop the param so a reload does not re-apply it */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("org");
    if (!slug) return;
    if (SLUG_RE.test(slug)) setActiveSlug(slug.toLowerCase());
    params.delete("org");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [setActiveSlug]);

  /* Wait for the organization list before judging a section: a stored org tab is valid only if that org is active */
  useEffect(() => {
    if (!session) {
      /* Org pages need a session: a deep link or saved tab while signed out lands on the sign-in page */
      if (isOrgSection(activeTab) || activeTab === "organizations") setActiveTab("account");
      return;
    }
    if (!orgs) return;
    if (!tabAvailable(activeTab, activeOrg)) setActiveTab(defaultTab(activeOrg));
  }, [session, orgs, activeOrg, activeTab, setActiveTab]);

  const renderSection = (tab: string): ReactNode => {
    if (isOrgSection(tab)) {
      if (activeOrg) return <OrgWorkspace section={tab} session={session} apiBase={apiBase} config={config} supabase={supabase} />;
      if (listError) {
        return (
          <p className={styles.waiting} role="alert">
            Could not load your organizations: {listError}{" "}
            <button type="button" onClick={() => { void refresh(); }}>Retry</button>
          </p>
        );
      }
      return <p className={styles.waiting}>Loading organization…</p>;
    }
    const panelMap: Record<string, ReactNode> = {
      account: <AccountPanel config={config} session={session} supabase={supabase} />,
      billing: <BillingPanel config={config} session={session} apiBase={apiBase} />,
      models: <ModelsPanel config={config} session={session} apiBase={apiBase} theme={theme} />,
      playground: <PlaygroundPanel config={config} session={session} apiBase={apiBase} theme={theme} />,
      deploy: <DeployPanel session={session} apiBase={apiBase} config={config} theme={theme} />,
      agents: <AgentsPanel session={session} apiBase={apiBase} />,
      organizations: <OrganizationsPanel session={session} />,
      rewards: <RewardsPanel session={session} apiBase={apiBase} onUnclaimedCount={setUnclaimedRewards} />,
      "api-key": <ApiKeyPanel session={session} apiBase={apiBase} />,
      usage: <UsagePanel session={session} apiBase={apiBase} />,
      "gen-api": <GenApiPanel session={session} config={config} apiBase={apiBase} />,
      mcp: <McpPanel session={session} config={config} apiBase={apiBase} />,
      "payg-api": <PaygApiPanel session={session} config={config} apiBase={apiBase} theme={theme} />,
      shield: <ShieldPanel session={session} config={config} apiBase={apiBase} />,
      "authorized-apps": <AuthorizedAppsPanel session={session} config={config} apiBase={apiBase} supabase={supabase} />,
    };
    return panelMap[tab] || panelMap.account;
  };

  return (
    <div className={styles.consoleWrapper}>
      <TopBar
        user={session?.user}
        onSignOut={() => supabase?.auth.signOut()}
        onThemeToggle={onThemeToggle}
        theme={theme}
        homeUrl={config?.dashboard?.homeUrl || "https://inferenceport.ai"}
        appName={config?.dashboard?.appName || "InferencePort AI"}
        isMobileNavOpen={isMobileNavOpen}
        onMobileNavToggle={() => setMobileNavOpen(!isMobileNavOpen)}
      />
      <div className={styles.consoleShell}>
        <Sidebar
          user={session?.user}
          isOpen={isMobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          activeTab={activeTab}
          onTabChange={navigateTab}
          unclaimedRewards={unclaimedRewards}
        />
        <main className={styles.consoleContent}>
          {/* Org pages are keyed by org so no data from another org stays on screen. Work tabs (playground etc.) are NOT
              remounted on a context switch: the org header changes per request, and people keep their prompt. */}
          <div key={WORK_TABS.has(activeTab) ? "work" : (orgs === null ? "init" : (activeSlug ?? "personal"))} className={styles.contextFrame}>
            {renderSection(activeTab)}
          </div>
        </main>
      </div>
    </div>
  );
}
