/* Shared navigation metadata, available to both Next's static-route build and client UI. */
import type { IconName } from "../components/Icon";
import type { OrgRole } from "./orgs";

/* Personal sections (ids are the panel keys in ConsoleLayout). */
export const PERSONAL_ITEMS = {
  account: { label: "Account management", icon: "user-circle" },
  organizations: { label: "Organizations", icon: "user-circle" },
  billing: { label: "Billing", icon: "credit-card" },
  models: { label: "Models", icon: "cube" },
  playground: { label: "Playground", icon: "sparkle" },
  deploy: { label: "Deploy (Featherless)", icon: "gauge" },
  agents: { label: "Agents", icon: "chat-circle-text" },
  buckets: { label: "Buckets (Preview)", icon: "cube" },
  rewards: { label: "Rewards", icon: "gift" },
  "api-key": { label: "API key", icon: "key" },
  usage: { label: "Usage", icon: "chart-bar" },
  "gen-api": { label: "Generation (Subscription)", icon: "chat-circle-text" },
  "payg-api": { label: "P2G API", icon: "coins" },
  mcp: { label: "MCP (Council)", icon: "link" },
  shield: { label: "Shield", icon: "shield-check" },
  "authorized-apps": { label: "Authorized Applications", icon: "plugs-connected" },
} satisfies Record<string, { label: string; icon: IconName }>;

/* Organization sections. In org mode they are top-level sidebar items (no nested tab bar). */
export type OrgSectionId =
  | "org-overview"
  | "org-members"
  | "org-teams"
  | "org-keys"
  | "org-usage"
  | "org-billing"
  | "org-invoices"
  | "org-policies"
  | "org-desktop"
  | "org-audit"
  | "org-security"
  | "org-notifications";

const ALL_ROLES: OrgRole[] = ["owner", "admin", "billing_manager", "auditor", "member"];

export const ORG_SECTION_META: Record<OrgSectionId, { label: string; icon: IconName; roles: OrgRole[] }> = {
  "org-overview": { label: "Overview", icon: "gauge", roles: ALL_ROLES },
  "org-members": { label: "Members", icon: "user-circle", roles: ALL_ROLES },
  "org-teams": { label: "Teams", icon: "chat-circle-text", roles: ALL_ROLES },
  "org-keys": { label: "API keys", icon: "key", roles: ALL_ROLES },
  "org-usage": { label: "Usage", icon: "chart-bar", roles: ALL_ROLES },
  "org-billing": { label: "Billing", icon: "credit-card", roles: ["owner", "admin", "billing_manager", "auditor"] },
  "org-invoices": { label: "Invoices", icon: "credit-card", roles: ["owner", "admin", "billing_manager", "auditor"] },
  "org-policies": { label: "Policies", icon: "shield-check", roles: ["owner", "admin"] },
  "org-desktop": { label: "Desktop app", icon: "plugs-connected", roles: ["owner", "admin"] },
  "org-audit": { label: "Audit log", icon: "clock-countdown", roles: ["owner", "admin", "auditor"] },
  "org-security": { label: "Security", icon: "lock-simple", roles: ["owner", "admin"] },
  "org-notifications": { label: "Notifications", icon: "warning-circle", roles: ["owner", "admin", "billing_manager"] },
};

export const ORG_SECTION_ORDER = Object.keys(ORG_SECTION_META) as OrgSectionId[];

export function isOrgSection(id: string): id is OrgSectionId {
  return Object.prototype.hasOwnProperty.call(ORG_SECTION_META, id);
}

/* Visibility is a UI convenience only: the server enforces every capability. */
export function orgSectionAllowed(id: OrgSectionId, role: OrgRole | null | undefined): boolean {
  return !!role && ORG_SECTION_META[id].roles.includes(role);
}

