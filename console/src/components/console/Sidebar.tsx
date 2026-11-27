"use client";

import { useEffect, useRef } from "react";
import styles from "./Sidebar.module.css";
import { PERSONAL_ITEMS } from "../../lib/consoleSections";
import Icon, { type IconName } from "../Icon";
import ContextSwitcher from "./ContextSwitcher";
import { useOptionalOrgContext } from "./OrgContext";
import { isOrgSection, orgSectionAllowed, SPENDING_ROLES, ORG_SECTION_META, type OrgSectionId } from "./OrgWorkspace";

interface SidebarProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  unclaimedRewards?: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
}

interface NavGroup {
  key: string;
  title: string;
  items: NavItem[];
}

const PERSONAL_GROUPS: { title: string; ids: string[] }[] = [
  { title: "", ids: ["overview"] },
  { title: "Build", ids: ["models", "playground", "api-key", "agents", "mcp"] },
  { title: "Infrastructure", ids: ["deploy", "buckets", "shield"] },
  { title: "Manage", ids: ["usage", "billing", "organizations"] },
  { title: "Account", ids: ["account", "authorized-apps", "rewards"] },
  { title: "Integration guides", ids: ["gen-api", "payg-api"] },
];

/* Work tabs run billed to whichever context is active (the org header is set globally). */
const WORK_IDS = ["models", "playground", "agents", "mcp"];
const ORG_INFRA_IDS = ["deploy", "buckets", "shield"];
const ORG_GUIDE_IDS = ["gen-api", "payg-api"];
const ORG_ACCOUNT_IDS = ["account", "organizations"];

function item(id: string): NavItem {
  if (isOrgSection(id)) {
    const meta = ORG_SECTION_META[id as OrgSectionId];
    return { id, label: meta.label, icon: meta.icon };
  }
  const p = PERSONAL_ITEMS[id as keyof typeof PERSONAL_ITEMS];
  return { id, label: p.label, icon: p.icon };
}

export default function Sidebar({
  user,
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  unclaimedRewards = 0,
}: SidebarProps) {
  const ctx = useOptionalOrgContext();
  const activeOrg = ctx?.activeOrg ?? null;
  const navRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) navRef.current?.querySelector<HTMLElement>("button, a, summary")?.focus();
    if (!isOpen && wasOpen.current) document.getElementById("mobile-nav-toggle")?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab" && navRef.current) {
        const controls = Array.from(navRef.current.querySelectorAll<HTMLElement>('button:not([disabled]):not([hidden]), a[href], summary'))
          .filter((el) => el.offsetParent !== null);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const orgItems = (ids: OrgSectionId[]) => ids.filter((id) => orgSectionAllowed(id, activeOrg?.role)).map(item);
  const groups: NavGroup[] = activeOrg
    ? [
        { key: "overview", title: "", items: orgItems(["org-overview"]) },
        ...(SPENDING_ROLES.includes(activeOrg.role) ? [
          { key: "work", title: "Build", items: WORK_IDS.map(item) },
          { key: "infrastructure", title: "Infrastructure", items: ORG_INFRA_IDS.map(item) },
        ] : []),
        { key: "team", title: "Team", items: orgItems(["org-members", "org-teams", "org-keys"]) },
        { key: "manage", title: "Manage", items: orgItems(["org-usage", "org-billing", "org-invoices"]) },
        { key: "settings", title: "Workspace settings", items: orgItems(["org-policies", "org-security", "org-desktop", "org-audit", "org-notifications"]) },
        ...(SPENDING_ROLES.includes(activeOrg.role) ? [{ key: "guides", title: "Integration guides", items: ORG_GUIDE_IDS.map(item) }] : []),
        { key: "account", title: "Account", items: ORG_ACCOUNT_IDS.map(item) },
      ].filter((group) => group.items.length > 0)
    : PERSONAL_GROUPS.map((g) => ({ key: g.title, title: g.title, items: g.ids.map(item) }));

  return (
    <>
      <div
        className={`${styles.mobileNavBackdrop} ${isOpen ? styles.visible : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={navRef}
        className={`${styles.consoleNav} ${isOpen ? styles.mobileOpen : ""}`}
        aria-label="Console sections"
        role="navigation"
      >
        <button type="button" className={styles.mobileClose} onClick={onClose} aria-label="Close navigation">
          <Icon name="x" size={18} aria-hidden="true" />
          Close
        </button>
        <ContextSwitcher variant="sidebar" className={styles.contextHeader} />
        {groups.map((group) => {
          const collapsible = ["Account", "Integration guides", "account", "guides", "settings"].includes(group.key);
          const Group = collapsible ? "details" : "div";
          return <Group key={group.key} open={collapsible ? group.items.some((tab) => tab.id === activeTab) : undefined} className={styles.navGroup} role="group" aria-label={group.title || "Overview"}>
            {group.title && (collapsible
              ? <summary className={styles.consoleNavSummary}>{group.title}</summary>
              : <span className={styles.consoleNavLabel} title={group.title}>{group.title}</span>
            )}
            {group.items.map((tab) => (
              <div
                key={tab.id}
                className={styles.navTabWrap}
              >
                <button
                  type="button"
                  className={`console-nav-tab ${styles.consoleNavTab} ${activeTab === tab.id ? styles.active : ""}`}
                  data-console-tab={tab.id}
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  onClick={() => {
                    onTabChange(tab.id);
                    onClose();
                  }}
                >
                  <Icon name={tab.icon} className={styles.navIcon} />
                  <span className={styles.navLabel}>{tab.label}</span>
                </button>
                {tab.id === "rewards" && unclaimedRewards > 0 && (
                  <span className={styles.rewardBadge} aria-label={`${unclaimedRewards} unclaimed`}>
                    {unclaimedRewards}
                  </span>
                )}
              </div>
            ))}
          </Group>;
        })}
        {user && (
          <div className={styles.sidebarUserSection}>
            {unclaimedRewards > 0 && (
              <div className={styles.rewardNotification}>
                <Icon name="gift" className={styles.rewardNotificationIcon} />
                <span className={styles.rewardNotificationText}>
                  You have {unclaimedRewards} new reward{unclaimedRewards !== 1 ? "s" : ""} to claim.
                </span>
              </div>
            )}
            <div className={styles.sidebarUserTag}>
              <div className={styles.sidebarUserAvatar}>
                {user.email ? user.email[0].toUpperCase() : "?"}
              </div>
              <span className={styles.sidebarUserEmail}>{user.email}</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
