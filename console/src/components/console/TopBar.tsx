"use client";

import styles from "./TopBar.module.css";
import Icon from "../Icon";
import ContextSwitcher from "./ContextSwitcher";

interface TopBarProps {
  user: any;
  onSignOut: () => void;
  onThemeToggle: () => void;
  theme: "light" | "dark";
  appName: string;
  onOpenSearch: () => void;
}

export default function TopBar({ user, onSignOut, onThemeToggle, theme, appName, onOpenSearch }: TopBarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <img src="/console/assets/logo.png" alt="" className={styles.brandLogo} />
        <h1 id="app-name">
          <span>{appName}</span><span className={styles.suffix}>Console</span>
        </h1>
      </div>
      <div className={styles.topActions}>
        <button type="button" className={styles.searchButton} onClick={onOpenSearch}
          aria-label="Search console (Command K or Control K)">
          <Icon name="sparkle" size={18} />
          <span>Search anything</span><kbd>⌘ K</kbd>
        </button>
        <ContextSwitcher variant="topbar" className={styles.switcher} />
        <a href="https://docs.inferenceport.ai" target="_blank" rel="noreferrer" className={styles.docsLink}>Docs</a>
        <button id="theme-toggle" className={styles.iconButton} type="button"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={onThemeToggle}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
        </button>
        {user && <button id="logout-btn" className={styles.signOut} type="button" onClick={onSignOut}>Sign out</button>}
      </div>
    </header>
  );
}
