"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Icon from "../Icon";
import { useOptionalOrgContext } from "./OrgContext";
import { ROLE_LABELS } from "../../lib/orgs";
import { PLAN_LABELS } from "./panels/orgs/shared";
import styles from "./ContextSwitcher.module.css";

/* Window event that asks the console to open a section (for example "organizations"). ConsoleLayout listens for it. */
export const CONSOLE_NAVIGATE_EVENT = "console:navigate";

export function navigateConsole(tab: string) {
  window.dispatchEvent(new CustomEvent<string>(CONSOLE_NAVIGATE_EVENT, { detail: tab }));
}

type Variant = "topbar" | "sidebar" | "chip";

interface ContextSwitcherProps {
  variant?: Variant;
  className?: string;
}

const MENU_ITEM_SELECTOR = '[role="menuitemradio"], [role="menuitem"]';

/* "Who am I working as": Personal or one of my organizations. Persisted by OrgProvider; renders nothing outside it. */
export default function ContextSwitcher({ variant = "topbar", className }: ContextSwitcherProps) {
  const ctx = useOptionalOrgContext();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  /* Close on a pointer press outside the switcher */
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  /* Opening moves focus into the menu (current item first), as the menu pattern expects */
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const target = menu?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR);
    target?.focus();
  }, [open]);

  if (!ctx) return null;
  const { orgs, activeOrg, setActiveSlug } = ctx;
  const label = activeOrg ? activeOrg.name : "Personal";

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const choose = (slug: string | null) => {
    setActiveSlug(slug);
    close(true);
  };

  const openConsoleSection = (tab: string) => {
    close(false);
    navigateConsole(tab);
  };

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []);

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === "Tab") {
      close(false);
      return;
    }
    const list = items();
    if (list.length === 0) return;
    const index = list.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % list.length;
    else if (e.key === "ArrowUp") next = index <= 0 ? list.length - 1 : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    if (next !== null) {
      e.preventDefault();
      list[next].focus();
    }
  };

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
    } else if (open && e.key === "Tab") {
      close(false);
    }
  };

  const triggerLabel = variant === "chip" ? `Billing to ${label}. Change billing context` : `Working as ${label}. Change context`;

  return (
    <div ref={rootRef} className={`${styles.root} ${styles[variant]} ${className ?? ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${activeOrg ? styles.isOrg : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
      >
        {variant === "sidebar" ? (
          <>
            <Icon name={activeOrg ? "plugs-connected" : "user-circle"} size={20} className={styles.leadIcon} aria-hidden="true" />
            <span className={styles.sideText}>
              <span className={styles.kicker}>Working as</span>
              <span className={styles.name}>{label}</span>
              <span className={styles.tags}>
                {activeOrg ? (
                  <>
                    <span className={styles.tag}>{ROLE_LABELS[activeOrg.role]}</span>
                    <span className={`${styles.tag} ${styles.tagBrand}`}>{PLAN_LABELS[activeOrg.effective_plan]}</span>
                  </>
                ) : (
                  <span className={styles.meta}>Your own account and wallet</span>
                )}
              </span>
            </span>
          </>
        ) : variant === "chip" ? (
          <>
            <span className={styles.kicker}>Billing to:</span>
            <span className={styles.name}>{label}</span>
          </>
        ) : (
          <>
            <Icon name={activeOrg ? "plugs-connected" : "user-circle"} size={18} className={styles.leadIcon} aria-hidden="true" />
            <span className={styles.kicker}>Working as</span>
            <span className={styles.name}>{label}</span>
          </>
        )}
        <span className={styles.caret} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Switch context"
          className={styles.menu}
          onKeyDown={onMenuKey}
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!activeOrg}
            className={styles.item}
            onClick={() => choose(null)}
          >
            <Icon name="user-circle" size={18} className={styles.itemIcon} aria-hidden="true" />
            <span className={styles.itemMain}>
              <span className={styles.itemName}>Personal</span>
              <span className={styles.itemMeta}>Your own account and wallet</span>
            </span>
            {!activeOrg && <Icon name="check" size={16} className={styles.check} aria-hidden="true" />}
          </button>

          <div className={styles.divider} role="separator" />
          <div className={styles.groupLabel} id={`${menuId}-orgs`}>Organizations</div>

          {orgs === null && <p className={styles.note}>Loading organizations…</p>}
          {orgs !== null && orgs.length === 0 && <p className={styles.note}>You are not in an organization yet.</p>}
          {orgs?.map((o) => {
            const selected = activeOrg?.id === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={styles.item}
                onClick={() => choose(o.slug)}
              >
                <Icon name="plugs-connected" size={18} className={styles.itemIcon} aria-hidden="true" />
                <span className={styles.itemMain}>
                  <span className={styles.itemName}>{o.name}</span>
                  <span className={styles.tags}>
                    <span className={styles.tag}>{ROLE_LABELS[o.role]}</span>
                    <span className={`${styles.tag} ${styles.tagBrand}`}>{PLAN_LABELS[o.effective_plan]}</span>
                  </span>
                </span>
                {selected && <Icon name="check" size={16} className={styles.check} aria-hidden="true" />}
              </button>
            );
          })}

          <div className={styles.divider} role="separator" />
          <button type="button" role="menuitem" className={`${styles.item} ${styles.footerItem}`} onClick={() => openConsoleSection("organizations")}>
            Manage organizations
          </button>
          <button type="button" role="menuitem" className={`${styles.item} ${styles.footerItem}`} onClick={() => openConsoleSection("organizations")}>
            Create organization
          </button>
        </div>
      )}
    </div>
  );
}
