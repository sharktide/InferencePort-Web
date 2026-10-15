"use client";

import ContextSwitcher from "./ContextSwitcher";
import styles from "./ContextChip.module.css";

/* "Billing to: Personal / Acme" pill for work pages (Playground, Agents). Same switcher as the top bar. */
export default function ContextChip() {
  return <ContextSwitcher variant="chip" className={styles.wrap} />;
}
