"use client";

import styles from "./Sidebar.module.css";
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

/* Personal sections (ids are the panel keys in ConsoleLayout). */
const PERSONAL_ITEMS: Record<string, { label: string; icon: IconName }> = {
  account: { label: "Account management", icon: "user-circle" },
  organizations: { label: "Organizations", icon: "user-circle" },
  billing: { label: "Billing", icon: "credit-card" },
  models: { label: "Models", icon: "cube" },
  playground: { label: "Playground", icon: "sparkle" },
  deploy: { label: "Deploy (Featherless)", icon: "gauge" },
  agents: { label: "Agents", icon: "chat-circle-text" },
  rewards: { label: "Rewards", icon: "gift" },
  "api-key": { label: "API key", icon: "key" },
  usage: { label: "Usage", icon: "chart-bar" },
  "gen-api": { label: "Generation (Subscription)", icon: "chat-circle-text" },
  "payg-api": { label: "P2G API", icon: "coins" },
  shield: { label: "Shield", icon: "shield-check" },
  "authorized-apps": { label: "Authorized Applications", icon: "plugs-connected" },
};

const PERSONAL_GROUPS: { title: string; ids: string[] }[] = [
  { title: "Account", ids: ["account", "billing"] },
  { title: "Organization", ids: ["organizations"] },
  { title: "Explore", ids: ["models", "playground", "deploy", "rewards"] },
  { title: "Build", ids: ["agents", "api-key", "usage", "gen-api", "payg-api", "shield"] },
  { title: "Access", ids: ["authorized-apps"] },
];

/* Work tabs run billed to whichever context is active (the org header is set globally). */
const WORK_IDS = ["models", "playground", "agents"];
const ORG_BUILD_IDS = ["gen-api", "payg-api", "shield"];
const ORG_ACCOUNT_IDS = ["account", "organizations"];

function item(id: string): NavItem {
  if (isOrgSection(id)) {
    const meta = ORG_SECTION_META[id as OrgSectionId];
    return { id, label: meta.label, icon: meta.icon };
  }
  const p = PERSONAL_ITEMS[id];
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
              <div key={tab.id} className={styles.navTabWrap}>
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
