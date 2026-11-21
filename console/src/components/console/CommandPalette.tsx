"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { OrgSummary } from "../../lib/orgs";
import { MAIN_NAV } from "../../lib/consoleNavigation";
import { orgSectionAllowed, type OrgSectionId } from "../../lib/consoleSections";
import { SPENDING_ROLES } from "./OrgWorkspace";
import Icon from "../Icon";
import styles from "./CommandPalette.module.css";

interface Props {
  open: boolean;
  activeOrg: OrgSummary | null;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

type Command = { id: string; label: string; section: string; keywords?: string };
const personalCommands: Command[] = [
  { id: "api-key", label: "API keys", section: "Build", keywords: "tokens credentials" },
  { id: "payg-api", label: "Pay-as-you-go API", section: "Build", keywords: "openai requests p2g" },
  { id: "gen-api", label: "Generation API", section: "Build", keywords: "subscription" },
  { id: "mcp", label: "MCP", section: "Build", keywords: "tools council" },
  { id: "agents", label: "Agents", section: "Build" },
  { id: "deploy", label: "Deployments", section: "Build", keywords: "featherless" },
  { id: "buckets", label: "Buckets", section: "Build", keywords: "storage s3" },
  { id: "shield", label: "AI Shield", section: "Build", keywords: "moderation safety" },
  { id: "billing", label: "Billing", section: "Usage", keywords: "balance credits" },
  { id: "rewards", label: "Rewards", section: "Usage", keywords: "credits" },
  { id: "account", label: "Account", section: "Settings" },
  { id: "organizations", label: "Organizations", section: "Settings" },
  { id: "authorized-apps", label: "Authorized applications", section: "Settings", keywords: "access oauth" },
];
const orgCommands: Command[] = [
  { id: "org-keys", label: "Organization API keys", section: "Build" },
  { id: "org-billing", label: "Organization billing", section: "Usage" },
  { id: "org-invoices", label: "Invoices", section: "Usage" },
  { id: "org-members", label: "Members", section: "Settings" },
  { id: "org-teams", label: "Teams", section: "Settings" },
  { id: "org-policies", label: "Policies", section: "Settings" },
  { id: "org-security", label: "Security", section: "Settings" },
  { id: "org-desktop", label: "Desktop application", section: "Settings" },
  { id: "org-audit", label: "Audit log", section: "Settings" },
  { id: "org-notifications", label: "Notifications", section: "Settings" },
  { id: "organizations", label: "Manage organizations", section: "Settings" },
  { id: "account", label: "Account", section: "Settings" },
];

export default function CommandPalette({ open, activeOrg, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canSpend = !activeOrg || SPENDING_ROLES.includes(activeOrg.role);
  const commands = useMemo(() => {
    const primary: Command[] = MAIN_NAV
      .filter((item) => canSpend || !["playground", "models", "build"].includes(item.id))
      .map((item) => ({ id: activeOrg && item.id === "usage" ? "org-usage" : item.id, label: item.label, section: "Navigate" }));
    primary.push({ id: "settings", label: "Settings", section: "Navigate" });
    const secondary = activeOrg
      ? [
          ...personalCommands.filter((item) => canSpend && ["agents", "deploy", "buckets", "payg-api", "gen-api", "mcp", "shield"].includes(item.id)),
          ...orgCommands.filter((item) => !item.id.startsWith("org-") || orgSectionAllowed(item.id as OrgSectionId, activeOrg.role)),
        ]
      : personalCommands;
    return [...primary, ...secondary];
  }, [activeOrg, canSpend]);

  const matches = commands.filter((item) =>
    (item.label + " " + item.section + " " + (item.keywords || "")).toLowerCase().includes(query.trim().toLowerCase())
  ).slice(0, 15);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;
  const choose = (id: string) => { onClose(); onNavigate(id); };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setSelected((i) => Math.min(matches.length - 1, i + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setSelected((i) => Math.max(0, i - 1)); }
    else if (event.key === "Enter" && event.target === inputRef.current && matches[selected]) { event.preventDefault(); choose(matches[selected].id); }
    else if (event.key === "Tab") {
      const elements = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('input:not([disabled]),button:not([disabled])') || []);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  return (
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={rootRef} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Search the console" onKeyDown={onKeyDown}>
        <div className={styles.searchRow}>
          <Icon name="sparkle" size={21} />
          <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} aria-label="Search pages and actions" placeholder="Find a page or action…" />
          <button type="button" className={styles.close} aria-label="Close search" onClick={onClose}>Esc</button>
        </div>
        <div className={styles.results} role="listbox" aria-label="Matching destinations">
          {matches.length ? matches.map((item, index) => (
            <button type="button" key={item.id + item.label} className={styles.result + (index === selected ? " " + styles.selected : "")}
              role="option" aria-selected={index === selected} onMouseEnter={() => setSelected(index)} onClick={() => choose(item.id)}>
              <span>{item.label}</span><small>{item.section}</small>
            </button>
          )) : <p className={styles.empty}>No matching pages. Try another name or feature.</p>}
        </div>
        <div className={styles.footer}><span>↑ ↓ Navigate</span><span>↵ Open</span><span>Esc Close</span></div>
      </div>
    </div>
  );
}
