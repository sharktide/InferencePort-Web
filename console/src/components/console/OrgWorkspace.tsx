"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { IconName } from "../Icon";
import { useOrgContext } from "./OrgContext";
import { navigateConsole } from "./ContextSwitcher";
import { OrgApiError, ROLE_LABELS, type OrgApi, type OrgDetail, type OrgRole } from "../../lib/orgs";
import { Badge, Callout, PLAN_LABELS, errorText } from "./panels/orgs/shared";
import OverviewTab from "./panels/orgs/OverviewTab";
import MembersTab from "./panels/orgs/MembersTab";
import TeamsTab from "./panels/orgs/TeamsTab";
import ApiKeysTab from "./panels/orgs/ApiKeysTab";
import UsageTab from "./panels/orgs/UsageTab";
import BillingTab from "./panels/orgs/BillingTab";
import PoliciesTab from "./panels/orgs/PoliciesTab";
import AuditTab from "./panels/orgs/AuditTab";
import SecurityTab from "./panels/orgs/SecurityTab";
import NotificationsTab from "./panels/orgs/NotificationsTab";
import styles from "./OrgWorkspace.module.css";

/* Organization sections. In org mode they are top-level sidebar items (no nested tab bar). */
export type OrgSectionId =
  | "org-overview"
  | "org-members"
  | "org-teams"
  | "org-keys"
  | "org-usage"
  | "org-billing"
  | "org-policies"
  | "org-audit"
  | "org-security"
  | "org-notifications";

const ALL_ROLES: OrgRole[] = ["owner", "admin", "billing_manager", "auditor", "member"];

export const ORG_SECTION_META: Record<OrgSectionId, { label: string; icon: IconName; roles: OrgRole[] }> = {
  "org-overview": { label: "Overview", icon: "gauge", roles: ALL_ROLES },
  "org-members": { label: "Members", icon: "user-circle", roles: ALL_ROLES },
  "org-teams": { label: "Teams", icon: "chat-circle-text", roles: ALL_ROLES },
  "org-keys": { label: "API keys", icon: "key", roles: ALL_ROLES },
  "org-usage": { label: "Usage", icon: "chart-bar", roles: ALL_ROLES },
  "org-billing": { label: "Billing", icon: "credit-card", roles: ["owner", "admin", "billing_manager", "auditor"] },
  "org-policies": { label: "Policies", icon: "shield-check", roles: ["owner", "admin"] },
  "org-audit": { label: "Audit log", icon: "clock-countdown", roles: ["owner", "admin", "auditor"] },
  "org-security": { label: "Security", icon: "lock-simple", roles: ["owner", "admin"] },
  "org-notifications": { label: "Notifications", icon: "warning-circle", roles: ["owner", "admin", "billing_manager"] },
};

export const ORG_SECTION_ORDER = Object.keys(ORG_SECTION_META) as OrgSectionId[];

export function isOrgSection(id: string): id is OrgSectionId {
  return Object.prototype.hasOwnProperty.call(ORG_SECTION_META, id);
}

/* Visibility is a UI convenience only: the server enforces every capability. */
export function orgSectionAllowed(id: OrgSectionId, role: OrgRole | null | undefined): boolean {
  return !!role && ORG_SECTION_META[id].roles.includes(role);
}

interface OrgWorkspaceProps {
  section: OrgSectionId;
  session: Session | null;
  apiBase: string;
  config: unknown;
  supabase: SupabaseClient<any, any, any> | null;
}

function renderSection(section: OrgSectionId, api: OrgApi, org: OrgDetail, onChanged: () => void, userId: string | null): ReactNode {
  const common = { api, org, onChanged, userId: userId ?? undefined };
  switch (section) {
    case "org-overview": return <OverviewTab {...common} />;
    case "org-members": return <MembersTab {...common} />;
    case "org-teams": return <TeamsTab {...common} />;
    case "org-keys": return <ApiKeysTab {...common} />;
    case "org-usage": return <UsageTab {...common} />;
    case "org-billing": return <BillingTab {...common} />;
    case "org-policies": return <PoliciesTab {...common} />;
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
  const { api, activeSlug, activeOrg, refresh } = useOrgContext();
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
        {renderSection(section, api, org, onChanged, userId)}
      </div>
    </section>
  );
}
