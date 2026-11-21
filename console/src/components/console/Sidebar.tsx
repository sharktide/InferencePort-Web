"use client";

import styles from "./Sidebar.module.css";
import Icon from "../Icon";
import ContextSwitcher from "./ContextSwitcher";
import { useOptionalOrgContext } from "./OrgContext";
import { SPENDING_ROLES } from "./OrgWorkspace";
import { MAIN_NAV, mainSectionForTab } from "../../lib/consoleNavigation";

interface SidebarProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  unclaimedRewards?: number;
}

export default function Sidebar({ user, isOpen, onClose, activeTab, onTabChange, unclaimedRewards = 0 }: SidebarProps) {
  const activeOrg = useOptionalOrgContext()?.activeOrg ?? null;
  const canSpend = !activeOrg || SPENDING_ROLES.includes(activeOrg.role);
  const activeGroup = activeOrg && !canSpend && activeTab === "org-keys" ? "settings" : mainSectionForTab(activeTab);
  const navigate = (id: string) => { onTabChange(id); onClose(); };

  return (
    <>
      <div className={styles.mobileNavBackdrop + (isOpen ? " " + styles.visible : "")} onClick={onClose} aria-hidden="true" />
      <aside className={styles.consoleNav + (isOpen ? " " + styles.mobileOpen : "")} aria-label="Console navigation">
        <div className={styles.contextBlock}><ContextSwitcher variant="sidebar" className={styles.contextHeader} /></div>
        <div className={styles.navGroup} role="group" aria-label="Workspace">
          {MAIN_NAV.filter((item) => (canSpend || !["playground", "models", "build"].includes(item.id))).map((item) => (
            <button key={item.id} type="button" className={styles.consoleNavTab + (activeGroup === item.id ? " " + styles.active : "")}
              aria-current={activeGroup === item.id ? "page" : undefined}
              onClick={() => navigate(activeOrg && item.id === "usage" ? "org-usage" : item.id)}>
              <Icon name={item.icon} className={styles.navIcon} />
              <span className={styles.navLabel}>{item.label}</span>
              {item.id === "usage" && unclaimedRewards > 0 && !activeOrg && (
                <span className={styles.rewardBadge} aria-label={unclaimedRewards + " unclaimed rewards"}>{unclaimedRewards}</span>
              )}
            </button>
          ))}
        </div>
        <div className={styles.sideBottom}>
          <a href="https://docs.inferenceport.ai" target="_blank" rel="noreferrer" className={styles.utilityLink}>
            <Icon name="question" className={styles.navIcon} /> Documentation
          </a>
          <button type="button" className={styles.consoleNavTab + (activeGroup === "settings" ? " " + styles.active : "")}
            aria-current={activeGroup === "settings" ? "page" : undefined} onClick={() => navigate("settings")}>
            <Icon name="user-circle" className={styles.navIcon} /> Settings
          </button>
          {user && <div className={styles.sidebarUserTag}>
            <span className={styles.sidebarUserAvatar}>{user.email ? user.email[0].toUpperCase() : "?"}</span>
            <span className={styles.sidebarUserEmail}>{user.email}</span>
          </div>}
        </div>
      </aside>
    </>
  );
}
