"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { ORG_SECTION_META, type OrgSectionId } from "../../lib/consoleSections";
import { useOrgContext } from "./OrgContext";
import { navigateConsole } from "./ContextSwitcher";
import { OrgApiError, ROLE_LABELS, type OrgApi, type OrgDetail } from "../../lib/orgs";
import { Badge, Callout, PLAN_LABELS, errorText } from "./panels/orgs/shared";
import OverviewTab from "./panels/orgs/OverviewTab";
import MembersTab from "./panels/orgs/MembersTab";
import TeamsTab from "./panels/orgs/TeamsTab";
import ApiKeysTab from "./panels/orgs/ApiKeysTab";
import UsageTab from "./panels/orgs/UsageTab";
import BillingTab from "./panels/orgs/BillingTab";
import InvoicesTab from "./panels/orgs/InvoicesTab";
import PoliciesTab from "./panels/orgs/PoliciesTab";
import DesktopTab from "./panels/orgs/DesktopTab";
import AuditTab from "./panels/orgs/AuditTab";
import SecurityTab from "./panels/orgs/SecurityTab";
import NotificationsTab from "./panels/orgs/NotificationsTab";
import styles from "./OrgWorkspace.module.css";

/* Section metadata is shared with the static route registry. */
export { ORG_SECTION_META, ORG_SECTION_ORDER, isOrgSection, orgSectionAllowed } from "../../lib/consoleSections";
export type { OrgSectionId } from "../../lib/consoleSections";

interface OrgWorkspaceProps {
  section: OrgSectionId;
  session: Session | null;
  apiBase: string;
  config: unknown;
  supabase: SupabaseClient<any, any, any> | null;
}

function renderSection(
  section: OrgSectionId, api: OrgApi, org: OrgDetail, onChanged: () => void, userId: string | null,
  extras: { onNavigate: (tab: string) => void; onExit: () => void },
): ReactNode {
  const common = { api, org, onChanged, userId: userId ?? undefined };
  switch (section) {
    case "org-overview": return <OverviewTab {...common} onNavigate={extras.onNavigate} onExit={extras.onExit} />;
    case "org-members": return <MembersTab {...common} />;
    case "org-teams": return <TeamsTab {...common} />;
    case "org-keys": return <ApiKeysTab {...common} />;
    case "org-usage": return <UsageTab {...common} />;
    case "org-billing": return <BillingTab {...common} />;
    case "org-invoices": return <InvoicesTab {...common} />;
    case "org-policies": return <PoliciesTab {...common} />;
    case "org-desktop": return <DesktopTab {...common} />;
    case "org-audit": return <AuditTab {...common} />;
    case "org-security": return <SecurityTab {...common} />;
    case "org-notifications": return <NotificationsTab {...common} />;
    default: return null;
  }
}

/* Roles that may bill usage to the org wallet (mirrors the server's `credits.spend` capability). */
export const SPENDING_ROLES = ["owner", "admin", "member"];

/* Renders one organization section for the active org. Keyed by the parent on activeSlug so nothing stale stays on screen. */
export default function OrgWorkspace({ section, session }: OrgWorkspaceProps) {
  const { api, activeSlug, activeOrg, refresh, setActiveSlug } = useOrgContext();
  const userId = session?.user?.id ?? null;
  const [reloadToken, setReloadToken] = useState(0);
  const [loaded, setLoaded] = useState<{ slug: string; org: OrgDetail } | null>(null);
  const [failed, setFailed] = useState<{ slug: string; error: unknown } | null>(null);

  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    api
      .get(activeSlug)
      .then(({ org }) => {
        if (cancelled) return;
        setLoaded({ slug: activeSlug, org });
        setFailed(null);
      })
      .catch((error) => {
        if (!cancelled) setFailed({ slug: activeSlug, error });
      });
    return () => { cancelled = true; };
  }, [api, activeSlug, reloadToken]);

  /* Called by tabs after a change: reload this org and the context switcher's list. */
  const onChanged = useCallback(() => {
    setReloadToken((n) => n + 1);
    void refresh();
  }, [refresh]);

  /* After leaving or deleting the org: drop the saved context first so nothing refetches a now-forbidden org. */
  const onExit = () => {
    setActiveSlug(null);
    navigateConsole("models");
    void refresh();
  };

  if (!activeSlug || !activeOrg) return <p className={styles.muted}>Loading organization…</p>;

  const org = loaded?.slug === activeSlug ? loaded.org : null;
  const error = failed?.slug === activeSlug ? failed.error : null;

  if (!org) {
    if (error === null) return <p className={styles.muted}>Loading organization…</p>;
    const needsSso = error instanceof OrgApiError && error.status === 403 && /sso/i.test(error.message);
    return (
      <section className={styles.workspace} aria-live="polite">
        {needsSso ? (
          <div className={styles.ssoBox}>
            <h2 className={styles.ssoTitle}>Single sign-on required</h2>
            <p className={styles.ssoText}>
              This organization requires members to sign in with its single sign-on provider. Sign out, then sign in with
              your work account to continue.
            </p>
            {activeOrg.role === "owner" && (
              <div className={styles.actions}>
                <button type="button" className="ghost" onClick={() => navigateConsole("org-security")}>
                  Open Security settings
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Callout tone="error">{errorText(error)}</Callout>
            <div className={styles.actions}>
              <button type="button" className="ghost" onClick={() => { setFailed(null); setReloadToken((n) => n + 1); }}>
                Try again
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  const title = ORG_SECTION_META[section].label;

  return (
    <section className={styles.workspace} aria-labelledby="org-workspace-title">
      <header className={styles.head}>
        <nav aria-label="Location" className={styles.crumbs}>
          <span className={styles.crumbOrg}>{org.name}</span>
          <span aria-hidden="true" className={styles.crumbSep}>/</span>
          <span aria-current="page">{title}</span>
        </nav>
        <div className={styles.titleRow}>
          <h2 id="org-workspace-title" className={styles.title}>{title}</h2>
          <div className={styles.badges}>
            <Badge tone="brand">{PLAN_LABELS[org.effective_plan]}</Badge>
            <Badge>{ROLE_LABELS[org.role]}</Badge>
          </div>
        </div>
      </header>
      <div key={section} id="org-section" className={styles.body}>
        {renderSection(section, api, org, onChanged, userId, { onNavigate: navigateConsole, onExit })}
      </div>
    </section>
  );
}
