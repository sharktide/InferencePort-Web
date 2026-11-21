"use client";

import type { IconName } from "../Icon";
import Icon from "../Icon";
import type { OrgSummary } from "../../lib/orgs";
import { orgSectionAllowed } from "../../lib/consoleSections";
import { SPENDING_ROLES } from "./OrgWorkspace";
import styles from "./WorkspaceHub.module.css";

type Destination = { id: string; label: string; description: string; icon: IconName };
type Group = { title: string; description?: string; items: Destination[] };
interface Props { kind: "build" | "settings"; activeOrg: OrgSummary | null; onNavigate: (tab: string) => void }

const integrate: Destination[] = [
  { id: "api-key", label: "API keys", description: "Create, revoke and restrict keys for your applications.", icon: "key" },
  { id: "payg-api", label: "Pay-as-you-go API", description: "OpenAI-compatible endpoints and quickstart examples.", icon: "coins" },
  { id: "gen-api", label: "Generation API", description: "Subscription endpoints and supported capabilities.", icon: "chat-circle-text" },
  { id: "mcp", label: "MCP", description: "Connect compatible tools and clients.", icon: "link" },
];
const operate: Destination[] = [
  { id: "agents", label: "Agents", description: "Create and manage AI agents.", icon: "chat-circle-text" },
  { id: "deploy", label: "Deployments", description: "Launch and manage dedicated model infrastructure.", icon: "gauge" },
  { id: "buckets", label: "Buckets", description: "Manage your S3-compatible object storage.", icon: "cube" },
];
const protect: Destination[] = [
  { id: "shield", label: "AI Shield", description: "Moderation, protection and content safety tools.", icon: "shield-check" },
];

export default function WorkspaceHub({ kind, activeOrg, onNavigate }: Props) {
  const canSpend = !activeOrg || SPENDING_ROLES.includes(activeOrg.role);
  const buildGroups: Group[] = [
    { title: "Connect", description: "Everything you need to call InferencePort from your application.", items: integrate.map((item) => item.id === "api-key" && activeOrg ? { ...item, id: "org-keys" } : item) },
    { title: "Create and run", description: "Resources that take your project from prototype to production.", items: operate },
    { title: "Protect", description: "Keep your applications and workloads secure.", items: protect },
  ];
  const settingsGroups: Group[] = [
    { title: "Your account", items: [
      { id: "account", label: "Account", description: "Profile, account details and sign-in.", icon: "user-circle" },
      ...(!activeOrg ? [{ id: "authorized-apps", label: "Authorized applications", description: "Manage connected applications and permissions.", icon: "plugs-connected" as IconName }] : []),
      { id: "organizations", label: "Organizations", description: "Create, join and switch between workspaces.", icon: "user-circle" },
    ] },
    ...(activeOrg ? [{ title: "Workspace administration", description: "Manage " + activeOrg.name + " without cluttering your main navigation.", items: ([
      { id: "org-members", label: "Members", description: "Invite and manage members.", icon: "user-circle" },
      { id: "org-teams", label: "Teams", description: "Organize members and access.", icon: "chat-circle-text" },
      { id: "org-policies", label: "Policies", description: "Configure organization policies.", icon: "shield-check" },
      { id: "org-security", label: "Security", description: "Sign-in and security controls.", icon: "lock-simple" },
      { id: "org-desktop", label: "Desktop", description: "Manage desktop application access.", icon: "plugs-connected" },
      { id: "org-audit", label: "Audit log", description: "Review events in your workspace.", icon: "clock-countdown" },
      { id: "org-notifications", label: "Notifications", description: "Manage workspace notifications.", icon: "warning-circle" },
    ] as Destination[]).filter((item) => orgSectionAllowed(item.id as import("../../lib/consoleSections").OrgSectionId, activeOrg.role)) }] : []),
  ];
  const groups = kind === "build" ? (canSpend ? buildGroups : []) : settingsGroups;
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.eyebrow}>Workspace</div>
        <h2>{kind === "build" ? "Build" : "Settings"}</h2>
        <p>{kind === "build"
          ? "Tools for integrating, deploying and protecting your AI applications. Everything is one step away."
          : "A quieter place for account preferences, security and workspace management."}</p>
      </header>
      {groups.map((group) => (
        <section key={group.title} className={styles.group}>
          <div className={styles.groupTitle}><h3>{group.title}</h3>{group.description && <p>{group.description}</p>}</div>
          <div className={styles.cardGrid}>
            {group.items.map((item) => (
              <button key={item.id} type="button" className={styles.destination} onClick={() => onNavigate(item.id)}>
                <span className={styles.destinationIcon}><Icon name={item.icon} size={22} /></span>
                <span className={styles.destinationText}><strong>{item.label}</strong><span>{item.description}</span></span>
                <span className={styles.arrow} aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {kind === "build" && (
        <div className={styles.tip}>New to the API? Start in <button type="button" onClick={() => onNavigate("playground")}>Playground</button>, then open an integration guide when you are ready to ship.</div>
      )}
    </div>
  );
}
