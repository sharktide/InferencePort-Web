"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  unclaimedRewards?: number;
}

const navTabs = [
  { id: "account", label: "Account management" },
  { id: "models", label: "Models" },
  { id: "rewards", label: "Rewards" },
  { id: "api-key", label: "API key" },
  { id: "usage", label: "Usage" },
  { id: "gen-api", label: "Generation (Subscription)" },
  { id: "payg-api", label: "P2G API" },
  { id: "shield", label: "Shield" },
  { id: "authorized-apps", label: "Authorized Applications" },
];

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
        <span className={styles.consoleNavLabel}>Navigation</span>
        {navTabs.map((tab) => (
          <div key={tab.id} className={styles.navTabWrap}>
            <button
              type="button"
              className={`console-nav-tab ${styles.consoleNavTab} ${activeTab === tab.id ? styles.active : ""}`}
              data-console-tab={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                onClose();
              }}
            >
              {tab.label}
            </button>
            {tab.id === "rewards" && unclaimedRewards > 0 && (
              <span className={styles.rewardBadge}>
                {unclaimedRewards}
              </span>
            )}
          </div>
        ))}
        {user && (
          <div className={styles.sidebarUserSection}>
            {unclaimedRewards > 0 && (
              <div className={styles.rewardNotification}>
                <span className={styles.rewardNotificationIcon}>🎁</span>
                <span className={styles.rewardNotificationText}>
                  You have {unclaimedRewards} new reward{unclaimedRewards !== 1 ? "s" : ""} to claim!
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
