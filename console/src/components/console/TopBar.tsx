"use client";

import styles from "./TopBar.module.css";

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
        <img src="/console/assets/logo.png" alt="InferencePort AI" className={styles.brandLogo} />
        <div>
          <h1 id="app-name">
            <span className={styles.brandEmphasis}>{appName}</span>{" "}
            <span className={styles.brandDesktop}>Developer Console</span>
            <span className={styles.brandMobile}>Console</span>
          </h1>
          <p className={styles.brandDesktop}>
            <span className={styles.brandEmphasis}>{appName}</span> Pay-2-Go API dashboard
          </p>
        </div>
      </div>
      <div className={styles.topActions}>
        <button
          id="mobile-nav-toggle"
          className={`${styles.ghost} ${styles.mobileOnly}`}
          type="button"
          aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
          onClick={onMobileNavToggle}
        >
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
        </button>
        <a id="home-link" href={homeUrl} target="_blank" rel="noreferrer">Home</a>
        <a href="https://docs.inferenceport.ai" target="_blank" rel="noreferrer">Docs</a>
        <button
          id="theme-toggle"
          className={styles.ghost}
          type="button"
          aria-label="Toggle dark mode"
          onClick={onThemeToggle}
        >
          <span className={`${styles.themeIcon} ${theme === "dark" ? styles.hidden : ""}`}>&#9788;</span>
          <span className={`${styles.themeIcon} ${theme === "light" ? styles.hidden : ""}`}>&#9790;</span>
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
