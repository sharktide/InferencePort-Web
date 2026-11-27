"use client";

import Icon from "../Icon";
import { useOptionalOrgContext } from "./OrgContext";
import styles from "./ContextChip.module.css";

/* Read-only billing context indicator for work pages; the primary switcher lives in the shell. */
export default function ContextChip({ personal = false }: { personal?: boolean }) {
  const ctx = useOptionalOrgContext();
  if (!ctx) return null;
  const label = personal ? "Personal" : ctx.activeOrg?.name ?? (ctx.activeSlug ? "Loading workspace…" : "Personal");
  return <span className={styles.wrap} aria-label={`Billed to ${label}`}>
    <Icon name="credit-card" size={14} aria-hidden="true" />
    <span>Billing to</span>
    <strong>{label}</strong>
  </span>;
}
