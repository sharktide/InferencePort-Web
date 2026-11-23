"use client";

import { Fragment, useEffect, useState } from "react";
import styles from "./Sidebar.module.css";
import { PERSONAL_ITEMS } from "../../lib/consoleSections";
import Icon, { type IconName } from "../Icon";
import ContextSwitcher from "./ContextSwitcher";
import { useOptionalOrgContext } from "./OrgContext";
import { isOrgSection, orgSectionAllowed, SPENDING_ROLES, ORG_SECTION_META, ORG_SECTION_ORDER, type OrgSectionId } from "./OrgWorkspace";

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
  { title: "Products", ids: ["deploy", "buckets", "mcp", "agents", "shield"] },
  { title: "Explore", ids: ["models", "playground", "rewards"] },
  { title: "Developer", ids: ["api-key", "usage", "gen-api", "payg-api"] },
  { title: "Account", ids: ["account", "organizations", "billing", "authorized-apps"] },
];

const MODEL_ACCESS_IDS = new Set(["gen-api", "payg-api"]);

/* Work tabs run billed to whichever context is active (the org header is set globally). */
const WORK_IDS = ["models", "playground", "agents", "buckets"];
const ORG_BUILD_IDS = ["deploy", "gen-api", "payg-api", "mcp", "shield"];
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
  const [modelAccessOpen, setModelAccessOpen] = useState(true);

  useEffect(() => {
    if (MODEL_ACCESS_IDS.has(activeTab)) setModelAccessOpen(true);
  }, [activeTab]);

  const groups: NavGroup[] = activeOrg
    ? [
        ...(SPENDING_ROLES.includes(activeOrg.role)
          ? [{ key: "work", title: `Work · billed to ${activeOrg.name}`, items: WORK_IDS.map(item) }]
          : []),
        {
          key: "org",
          title: activeOrg.name,
          items: ORG_SECTION_ORDER.filter((id) => orgSectionAllowed(id, activeOrg.role)).map(item),
        },
        ...(SPENDING_ROLES.includes(activeOrg.role) ? [{ key: "build", title: "Build", items: ORG_BUILD_IDS.map(item) }] : []),
        { key: "account", title: "Account", items: ORG_ACCOUNT_IDS.map(item) },
      ]
    : PERSONAL_GROUPS.map((g) => ({ key: g.title, title: g.title, items: g.ids.map(item) }));

  return (
    <>
      <div
        className={`${styles.mobileNavBackdrop} ${isOpen ? styles.visible : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`${styles.consoleNav} ${isOpen ? styles.mobileOpen : ""}`}
        aria-label="Console sections"
        role="navigation"
      >
        <ContextSwitcher variant="sidebar" className={styles.contextHeader} />
        {groups.map((group) => (
          <div key={group.key} className={styles.navGroup} role="group" aria-label={group.title}>
            <span className={styles.consoleNavLabel} title={group.title}>{group.title}</span>
            {group.items.map((tab) => (
              <Fragment key={tab.id}>
                {!activeOrg && tab.id === "gen-api" && (
                  <button
                    type="button"
                    className={styles.modelAccessToggle}
                    aria-expanded={modelAccessOpen}
                    aria-controls="console-model-access"
                    onClick={() => setModelAccessOpen((open) => !open)}
                  >
                    <Icon name={modelAccessOpen ? "caret-down" : "caret-right"} className={styles.modelAccessChevron} />
                    <span>Model Access</span>
                  </button>
                )}
              <div
                className={`${styles.navTabWrap} ${!activeOrg && MODEL_ACCESS_IDS.has(tab.id) ? styles.nestedTab : ""}`}
                id={!activeOrg && tab.id === "gen-api" ? "console-model-access" : undefined}
                hidden={!activeOrg && MODEL_ACCESS_IDS.has(tab.id) && !modelAccessOpen}
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
              </Fragment>
            ))}
          </div>
        ))}
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
