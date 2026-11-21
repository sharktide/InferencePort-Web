"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { OrgSummary } from "../../lib/orgs";
import { PERSONAL_GROUPS, PERSONAL_MORE, ORG_WORK, ORG_MANAGE, ORG_MORE } from "../../lib/consoleNavigation";
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
const KEYWORDS: Record<string, string> = {
  playground: "test try chat image audio video realtime 3d embeddings decisions",
  models: "catalog discover pricing capabilities compare",
  "api-key": "credential token limits sdk integrate",
  "org-keys": "credential token limits sdk integrate",
  agents: "managed assistant automation",
  deploy: "featherless dedicated server models hosting",
  buckets: "storage s3 files",
  shield: "safety moderation protect",
  usage: "analytics requests tokens costs credits chart",
  "org-usage": "analytics requests tokens costs credits chart",
  billing: "wallet buy credits payment subscription plans",
  "org-billing": "wallet spend payment subscription plans",
  "org-invoices": "billing payment receipts",
  "payg-api": "p2g openai compatible api guide",
  "gen-api": "subscription generation api guide",
  mcp: "council tools integration",
  "authorized-apps": "oauth connections permissions",
  "org-audit": "activity history compliance",
  "org-security": "sso login access",
};

export default function CommandPalette({ open, activeOrg, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canSpend = !activeOrg || SPENDING_ROLES.includes(activeOrg.role);
  const commands = useMemo(() => {
    const direct = activeOrg
      ? [
          ...(canSpend ? ORG_WORK : []),
          ...ORG_MANAGE.filter((item) => !item.id.startsWith("org-") || orgSectionAllowed(item.id as OrgSectionId, activeOrg.role)),
        ]
      : PERSONAL_GROUPS.flatMap((group) => group.items);
    const more = activeOrg
      ? ORG_MORE.filter((item) => canSpend || item.id.startsWith("org-"))
        .filter((item) => !item.id.startsWith("org-") || orgSectionAllowed(item.id as OrgSectionId, activeOrg.role))
      : PERSONAL_MORE;
    const extra: Command[] = activeOrg
      ? [{ id: "account", label: "Account", section: "Account" }, { id: "organizations", label: "Organizations", section: "Account" }]
      : [
          { id: "rewards", label: "Rewards", section: "Billing" },
          { id: "authorized-apps", label: "Connected applications", section: "Account" },
          { id: "account", label: "Account", section: "Account" },
          { id: "organizations", label: "Organizations", section: "Account" },
        ];
    const built: Command[] = [...direct.map((item) => ({ id: item.id, label: item.label, section: "Workspace", keywords: KEYWORDS[item.id] })),
      ...more.map((item) => ({ id: item.id, label: item.label, section: "More tools", keywords: KEYWORDS[item.id] })), ...extra];
    return built.filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
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
