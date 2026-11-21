"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Sidebar.module.css";
import Icon from "../Icon";
import ContextSwitcher from "./ContextSwitcher";
import { useOptionalOrgContext } from "./OrgContext";
import { isOrgSection, orgSectionAllowed, SPENDING_ROLES } from "./OrgWorkspace";
import {
  HOME_ITEM, PERSONAL_GROUPS, PERSONAL_MORE, ORG_WORK, ORG_MANAGE, ORG_BUILD, ORG_ACCOUNT, ORG_MORE,
  PERSONAL_DOCK, ORG_DOCK, ORG_READ_ONLY_DOCK, navHighlight,
  type NavGroup, type NavItem,
} from "../../lib/consoleNavigation";

interface SidebarProps {
  user: any;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSignOut: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  unclaimedRewards?: number;
}

export default function Sidebar({ user, isOpen, onOpen, onClose, onSignOut, activeTab, onTabChange, unclaimedRewards = 0 }: SidebarProps) {
  const ctx = useOptionalOrgContext();
  const activeOrg = ctx?.activeOrg ?? null;
  const canSpend = !activeOrg || SPENDING_ROLES.includes(activeOrg.role);
  const activeId = navHighlight(activeTab, !!activeOrg);
  const moreRef = useRef<HTMLButtonElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerOpenerRef = useRef<HTMLElement | null>(null);
  /* Keep off-canvas navigation out of the keyboard tab order on small screens. */
  useEffect(() => {
    const aside = sideRef.current;
    if (!aside) return;
    const media = window.matchMedia("(max-width: 960px)");
    const update = () => { aside.inert = media.matches && !isOpen; };
    update();
    media.addEventListener("change", update);
    return () => { aside.inert = false; media.removeEventListener("change", update); };
  }, [isOpen]);

  const allowed = (id: string) => !isOrgSection(id) || (!!activeOrg && orgSectionAllowed(id, activeOrg.role));
  const groups: NavGroup[] = activeOrg ? [
    ...(canSpend ? [{ title: `Work · billed to ${activeOrg.name}`, items: ORG_WORK }] : []),
    { title: activeOrg.name, items: ORG_MANAGE.filter((item) => allowed(item.id)) },
    ...(canSpend ? [{ title: "Build", items: ORG_BUILD }] : []),
    { title: "Account", items: ORG_ACCOUNT },
  ] : PERSONAL_GROUPS;
  const advanced = canSpend ? (activeOrg ? ORG_MORE : PERSONAL_MORE) : [];
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isAdvanced = advanced.some((item) => item.id === activeTab);
  useEffect(() => { if (isAdvanced) setAdvancedOpen(true); }, [isAdvanced]);

  useEffect(() => {
    if (isOpen && window.matchMedia("(max-width: 960px)").matches) {
      drawerOpenerRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement : null;
      drawerCloseRef.current?.focus();
    }
  }, [isOpen]);

  const closeFromDrawer = () => {
    onClose();
    /* Return focus to whichever trigger opened the drawer: top hamburger or bottom More. */
    window.requestAnimationFrame(() => {
      const opener = drawerOpenerRef.current;
      if (opener?.isConnected) opener.focus();
      else moreRef.current?.focus();
    });
  };

  const navigate = (id: string) => { onTabChange(id); onClose(); };
  const dock = activeOrg ? (canSpend ? ORG_DOCK : ORG_READ_ONLY_DOCK) : PERSONAL_DOCK;
  const dockActive = dock.some((item) => item.id === activeId);
  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFromDrawer();
        return;
      }
      if (event.key !== "Tab" || !window.matchMedia("(max-width: 960px)").matches) return;
      const focusable = Array.from(sideRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]'
      ) || []).filter((el) => el.getClientRects().length > 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onEscape);
    const oldOverflow = document.body.style.overflow;
    if (window.matchMedia("(max-width: 960px)").matches) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = oldOverflow;
    };
  }, [isOpen, onClose]);

  const navButton = (item: NavItem) => (
    <button key={item.id} type="button" className={"console-nav-tab " + styles.consoleNavTab + (activeId === item.id ? " " + styles.active : "")}
      data-console-tab={item.id} aria-current={activeId === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>
      <Icon name={item.icon} className={styles.navIcon} />
      <span className={styles.navLabel}>{item.label}</span>
      {item.id === "usage" && unclaimedRewards > 0 && !activeOrg && <span className={styles.rewardBadge} title="Rewards available">{unclaimedRewards}</span>}
    </button>
  );

  return (
    <>
      <div className={styles.mobileNavBackdrop + (isOpen ? " " + styles.visible : "")} onClick={closeFromDrawer} aria-hidden="true" />
      <aside id="console-sidebar-nav" ref={sideRef} className={styles.consoleNav + (isOpen ? " " + styles.mobileOpen : "")}
        aria-label="Console navigation">
        <div className={styles.drawerTitle}>
          <strong>Navigation</strong>
          <button ref={drawerCloseRef} type="button" className={styles.drawerClose} aria-label="Close navigation" onClick={closeFromDrawer}><Icon name="x" size={20} /></button>
        </div>
        <div className={styles.contextBlock}><ContextSwitcher variant="sidebar" className={styles.contextHeader} /></div>
        <div className={styles.navGroup}>{navButton(HOME_ITEM)}</div>
        {groups.map((group) => (
          <div className={styles.navGroup} role="group" aria-label={group.title} key={group.title}>
            <span className={styles.groupTitle} title={group.title}>{group.title}</span>
            {group.items.map(navButton)}
          </div>
        ))}
        {advanced.length > 0 && (
          <div className={styles.advancedGroup}>
            <button type="button" className={styles.expandButton} aria-expanded={advancedOpen}
              aria-controls="console-advanced-links" onClick={() => setAdvancedOpen((value) => !value)}>
              <span>API guides</span>
              <span className={styles.chevron + (advancedOpen ? " " + styles.chevronOpen : "")} aria-hidden="true" />
            </button>
            {advancedOpen && <div id="console-advanced-links" className={styles.navGroup}>{advanced.map(navButton)}</div>}
          </div>
        )}
        <div className={styles.sideBottom}>
          <a href="https://docs.inferenceport.ai" target="_blank" rel="noreferrer" className={styles.utilityLink}>
            <Icon name="question" className={styles.navIcon} /> Documentation
          </a>
          {user && (
            <div className={styles.sidebarUserTag}>
              <span className={styles.sidebarUserAvatar}>{user.email ? user.email[0].toUpperCase() : "?"}</span>
              <span className={styles.sidebarUserEmail}>{user.email}</span>
              <button type="button" className={styles.drawerSignOut} aria-label="Sign out" title="Sign out" onClick={() => { onClose(); onSignOut(); }}>
                <Icon name="sign-out" size={18} />
              </button>
            </div>
          )}
        </div>
      </aside>
      <nav className={styles.mobileDock} aria-label="Quick navigation" inert={isOpen}>
        {dock.map((item) => (
          <button key={item.id} type="button" className={styles.dockButton + (activeId === item.id ? " " + styles.dockActive : "")}
            aria-current={activeId === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>
            <Icon name={item.icon} size={20} />
            <span>{item.id === "org-overview" ? "Overview" : item.label === "API keys" ? "Keys" : item.label}</span>
          </button>
        ))}
        <button ref={moreRef} type="button" className={styles.dockButton + (!dockActive || isOpen ? " " + styles.dockActive : "")}
          aria-label={isOpen ? "Close full navigation" : "Open full navigation"} aria-expanded={isOpen} onClick={isOpen ? onClose : onOpen}>
          <Icon name={isOpen ? "x" : "list"} size={20} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
