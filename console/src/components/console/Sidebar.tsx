"use client";

import styles from "./Sidebar.module.css";
import Icon, { type IconName } from "../Icon";

interface SidebarProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  unclaimedRewards?: number;
}

export const navTabs = [
  { id: "account", label: "Account management" },
  { id: "billing", label: "Billing" },
  { id: "models", label: "Models" },
  { id: "deploy", label: "Deploy (Featherless)" },
  { id: "rewards", label: "Rewards" },
  { id: "api-key", label: "API key" },
  { id: "usage", label: "Usage" },
  { id: "gen-api", label: "Generation (Subscription)" },
  { id: "payg-api", label: "P2G API" },
  { id: "shield", label: "Shield" },
  { id: "authorized-apps", label: "Authorized Applications" },
];

/* Presentation only: visual groups over the same ordered tabs, and one icon per tab. */
const navGroups: { title: string; ids: string[] }[] = [
  { title: "Account", ids: ["account", "billing"] },
  { title: "Explore", ids: ["models", "deploy", "rewards"] },
  { title: "Build", ids: ["api-key", "usage", "gen-api", "payg-api", "shield"] },
  { title: "Access", ids: ["authorized-apps"] },
];

const navIcons: Record<string, IconName> = {
  account: "user-circle",
  billing: "credit-card",
  models: "cube",
  rewards: "gift",
  "api-key": "key",
  usage: "chart-bar",
  "gen-api": "chat-circle-text",
  "payg-api": "coins",
  shield: "shield-check",
  "authorized-apps": "plugs-connected",
};

export default function Sidebar({
  user,
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  unclaimedRewards = 0,
}: SidebarProps) {
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
        {navGroups.map((group) => (
          <div key={group.title} className={styles.navGroup}>
            <span className={styles.consoleNavLabel}>{group.title}</span>
            {navTabs.filter((tab) => group.ids.includes(tab.id)).map((tab) => (
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
                  <Icon name={navIcons[tab.id]} className={styles.navIcon} />
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
