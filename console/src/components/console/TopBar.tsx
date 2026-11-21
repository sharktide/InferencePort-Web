"use client";

import styles from "./TopBar.module.css";
import Icon from "../Icon";

interface TopBarProps {
  onThemeToggle: () => void;
  theme: "light" | "dark";
  appName: string;
  onOpenSearch: () => void;
  isMobileNavOpen: boolean;
  onMobileNavToggle: () => void;
}

export default function TopBar({ onThemeToggle, theme, appName, onOpenSearch, isMobileNavOpen, onMobileNavToggle }: TopBarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <img src="/console/assets/logo.png" alt="" className={styles.brandLogo} />
        <h1 id="app-name">
          <span className={styles.brandName}>{appName}</span><span className={styles.suffix}>Console</span>
        </h1>
      </div>
      <div className={styles.topActions}>
        <button id="mobile-nav-toggle" type="button" className={styles.mobileMenuButton}
          onClick={onMobileNavToggle} aria-expanded={isMobileNavOpen}
          aria-controls="console-sidebar-nav"
          aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}>
          <Icon name={isMobileNavOpen ? "x" : "list"} size={21} />
        </button>
        <button type="button" className={styles.searchButton} onClick={onOpenSearch}
          aria-label="Search console (Command K or Control K)">
          <Icon name="sparkle" size={18} />
          <span>Search console</span><kbd>⌘ K</kbd>
        </button>
        <button id="theme-toggle" className={styles.iconButton} type="button"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={onThemeToggle}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
        </button>
      </div>
    </header>
  );
}
