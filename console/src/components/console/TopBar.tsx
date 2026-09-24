"use client";

import styles from "./TopBar.module.css";
import Icon from "../Icon";

interface TopBarProps {
  user: any;
  onSignOut: () => void;
  onThemeToggle: () => void;
  theme: "light" | "dark";
  homeUrl: string;
  appName: string;
  isMobileNavOpen: boolean;
  onMobileNavToggle: () => void;
}

/* The brand wordmark: "InferencePort" with a brand-blue trailing "AI" (presentation only). */
function Wordmark({ name }: { name: string }) {
  const match = name.match(/^(.*\S)\s+(AI)$/);
  if (!match) return <span className={styles.brandEmphasis}>{name}</span>;
  return (
    <span className={styles.brandEmphasis}>
      {match[1]} <span className={styles.brandAi}>{match[2]}</span>
    </span>
  );
}

export default function TopBar({
  user,
  onSignOut,
  onThemeToggle,
  theme,
  homeUrl,
  appName,
  isMobileNavOpen,
  onMobileNavToggle,
}: TopBarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <button
          id="mobile-nav-toggle"
          className={`${styles.ghost} ${styles.iconBtn} ${styles.mobileOnly}`}
          type="button"
          aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isMobileNavOpen}
          onClick={onMobileNavToggle}
        >
          <Icon name={isMobileNavOpen ? "x" : "list"} size={20} />
        </button>
        <img src="/console/assets/logo.png" alt="" className={styles.brandLogo} />
        <div>
          <h1 id="app-name">
            <Wordmark name={appName} />{" "}
            <span className={styles.brandDesktop}>Developer Console</span>
            <span className={styles.brandMobile}>Console</span>
          </h1>
          <p className={styles.brandDesktop}>Pay-2-Go API dashboard</p>
        </div>
      </div>
      <div className={styles.topActions}>
        <a id="home-link" href={homeUrl} target="_blank" rel="noreferrer" className={styles.desktopOnly}>Home</a>
        <a href="https://docs.inferenceport.ai" target="_blank" rel="noreferrer" className={styles.desktopOnly}>Docs</a>
        <button
          id="theme-toggle"
          className={`${styles.ghost} ${styles.iconBtn}`}
          type="button"
          aria-label="Toggle dark mode"
          onClick={onThemeToggle}
        >
          <span className={`${styles.themeIcon} ${theme === "dark" ? styles.hidden : ""}`}><Icon name="moon" size={18} /></span>
          <span className={`${styles.themeIcon} ${theme === "light" ? styles.hidden : ""}`}><Icon name="sun" size={18} /></span>
        </button>
        {user ? (
          <button id="logout-btn" className={styles.ghost} onClick={onSignOut}>
            Sign out
          </button>
        ) : null}
      </div>
    </header>
  );
}
