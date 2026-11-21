import type { IconName } from "../components/Icon";
import { ORG_SECTION_META, ORG_SECTION_ORDER } from "./consoleSections";

export interface NavItem { id: string; label: string; icon: IconName }
export interface NavGroup { title: string; items: NavItem[] }

/* Keep the original Account / Organization / Explore / Build / Access hierarchy.
   Only the duplicate API-reference destinations are tucked into a disclosure. */
export const PERSONAL_GROUPS: NavGroup[] = [
  { title: "Account", items: [
    { id: "account", label: "Account", icon: "user-circle" },
    { id: "billing", label: "Billing", icon: "credit-card" },
  ] },
  { title: "Organization", items: [
    { id: "organizations", label: "Organizations", icon: "user-circle" },
  ] },
  { title: "Explore", items: [
    { id: "models", label: "Models", icon: "cube" },
    { id: "playground", label: "Playground", icon: "sparkle" },
    { id: "deploy", label: "Deployments", icon: "gauge" },
    { id: "rewards", label: "Rewards", icon: "gift" },
  ] },
  { title: "Build", items: [
    { id: "agents", label: "Agents", icon: "chat-circle-text" },
    { id: "buckets", label: "Buckets", icon: "cube" },
    { id: "api-key", label: "API keys", icon: "key" },
    { id: "usage", label: "Usage", icon: "chart-bar" },
    { id: "mcp", label: "MCP", icon: "link" },
    { id: "shield", label: "AI Shield", icon: "shield-check" },
  ] },
  { title: "Access", items: [
    { id: "authorized-apps", label: "Authorized apps", icon: "plugs-connected" },
  ] },
];

/* These are reference pages; users typically arrive via the API keys page. */
export const PERSONAL_MORE: NavItem[] = [
  { id: "payg-api", label: "Pay-as-you-go API", icon: "coins" },
  { id: "gen-api", label: "Generation API", icon: "chat-circle-text" },
];

/* Organization sections follow the original role-filtered order instead of an
   arbitrary subset or a generic "More workspace tools" section. */
export const ORG_WORK: NavItem[] = [
  { id: "models", label: "Models", icon: "cube" },
  { id: "playground", label: "Playground", icon: "sparkle" },
  { id: "agents", label: "Agents", icon: "chat-circle-text" },
  { id: "buckets", label: "Buckets", icon: "cube" },
];
export const ORG_MANAGE: NavItem[] = ORG_SECTION_ORDER.map((id) => ({
  id, label: ORG_SECTION_META[id].label, icon: ORG_SECTION_META[id].icon,
}));
export const ORG_BUILD: NavItem[] = [
  { id: "deploy", label: "Deployments", icon: "gauge" },
  { id: "mcp", label: "MCP", icon: "link" },
  { id: "shield", label: "AI Shield", icon: "shield-check" },
];
export const ORG_ACCOUNT: NavItem[] = PERSONAL_GROUPS
  .flatMap((group) => group.items)
  .filter((item) => item.id === "account" || item.id === "organizations");
export const ORG_MORE: NavItem[] = PERSONAL_MORE;

const findPersonal = (id: string): NavItem => {
  const match = PERSONAL_GROUPS.flatMap((g) => g.items).find((item) => item.id === id);
  if (!match) throw new Error("Missing console navigation item: " + id);
  return match;
};
const findOrg = (id: string): NavItem => {
  const match = [...ORG_WORK, ...ORG_MANAGE].find((item) => item.id === id);
  if (!match) throw new Error("Missing organization navigation item: " + id);
  return match;
};
export const PERSONAL_DOCK: NavItem[] = ["playground", "models", "api-key", "usage"].map(findPersonal);
export const ORG_DOCK: NavItem[] = ["playground", "models", "org-keys", "org-usage"].map(findOrg);
export const ORG_READ_ONLY_DOCK: NavItem[] = ["org-overview", "org-keys", "org-usage", "org-members"].map(findOrg);

/* Historical paths still point to useful real pages. */
export function navHighlight(tab: string, org: boolean): string {
  if (tab === "home") return org ? "org-overview" : "models";
  if (tab === "build") return org ? "org-keys" : "api-key";
  if (tab === "settings") return "account";
  return tab;
}
