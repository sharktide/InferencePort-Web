import type { IconName } from "../components/Icon";

export interface NavItem { id: string; label: string; icon: IconName }
export interface NavGroup { title: string; items: NavItem[] }

/* Keep core tools directly accessible. These are views, not artificial "hub" pages. */
export const PERSONAL_GROUPS: NavGroup[] = [
  { title: "Explore", items: [
    { id: "playground", label: "Playground", icon: "sparkle" },
    { id: "models", label: "Models", icon: "cube" },
  ] },
  { title: "Build", items: [
    { id: "api-key", label: "API keys", icon: "key" },
    { id: "agents", label: "Agents", icon: "chat-circle-text" },
    { id: "deploy", label: "Deployments", icon: "gauge" },
    { id: "buckets", label: "Buckets", icon: "cube" },
    { id: "shield", label: "AI Shield", icon: "shield-check" },
  ] },
  { title: "Monitor", items: [
    { id: "usage", label: "Usage", icon: "chart-bar" },
    { id: "billing", label: "Billing", icon: "credit-card" },
  ] },
];
export const PERSONAL_MORE: NavItem[] = [
  { id: "mcp", label: "MCP", icon: "link" },
  { id: "payg-api", label: "Pay-as-you-go API", icon: "coins" },
  { id: "gen-api", label: "Generation API", icon: "chat-circle-text" },
];

export const ORG_WORK: NavItem[] = [
  { id: "playground", label: "Playground", icon: "sparkle" },
  { id: "models", label: "Models", icon: "cube" },
  { id: "agents", label: "Agents", icon: "chat-circle-text" },
  { id: "deploy", label: "Deployments", icon: "gauge" },
  { id: "buckets", label: "Buckets", icon: "cube" },
];
export const ORG_MANAGE: NavItem[] = [
  { id: "org-overview", label: "Overview", icon: "gauge" },
  { id: "org-keys", label: "API keys", icon: "key" },
  { id: "org-usage", label: "Usage", icon: "chart-bar" },
  { id: "org-billing", label: "Billing", icon: "credit-card" },
  { id: "org-members", label: "Members", icon: "user-circle" },
  { id: "org-teams", label: "Teams", icon: "chat-circle-text" },
];
export const ORG_MORE: NavItem[] = [
  { id: "shield", label: "AI Shield", icon: "shield-check" },
  { id: "mcp", label: "MCP", icon: "link" },
  { id: "payg-api", label: "Pay-as-you-go API", icon: "coins" },
  { id: "gen-api", label: "Generation API", icon: "chat-circle-text" },
  { id: "org-security", label: "Security", icon: "lock-simple" },
  { id: "org-policies", label: "Policies", icon: "shield-check" },
  { id: "org-invoices", label: "Invoices", icon: "credit-card" },
  { id: "org-audit", label: "Audit log", icon: "clock-countdown" },
  { id: "org-notifications", label: "Notifications", icon: "warning-circle" },
  { id: "org-desktop", label: "Desktop app", icon: "plugs-connected" },
];
export const PERSONAL_DOCK: NavItem[] = [
  PERSONAL_GROUPS[0].items[0], PERSONAL_GROUPS[0].items[1],
  PERSONAL_GROUPS[1].items[0], PERSONAL_GROUPS[2].items[0],
];
export const ORG_DOCK: NavItem[] = [
  ORG_WORK[0], ORG_WORK[1], ORG_MANAGE[1], ORG_MANAGE[2],
];
export const ORG_READ_ONLY_DOCK: NavItem[] = [
  ORG_MANAGE[0], ORG_MANAGE[1], ORG_MANAGE[2], ORG_MANAGE[4],
];

/* Old routes remain valid, but mark their closest useful navigation location. */
export function navHighlight(tab: string, org: boolean): string {
  if (tab === "home") return org ? "org-overview" : "models";
  if (tab === "build") return org ? "org-keys" : "api-key";
  if (tab === "settings") return "account";
  if (tab === "rewards") return org ? "org-usage" : "usage";
  if (tab === "org-invoices") return "org-billing";
  if (tab === "authorized-apps" || tab === "organizations") return "account";
  return tab;
}
