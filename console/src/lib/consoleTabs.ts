/* Every top-level console section, including organization workspace tabs.
 * Next.js uses this list to statically export directly addressable routes. */
export const CONSOLE_TABS = [
  "account",
  "organizations",
  "billing",
  "models",
  "playground",
  "deploy",
  "agents",
  "rewards",
  "api-key",
  "usage",
  "gen-api",
  "payg-api",
  "mcp",
  "shield",
  "authorized-apps",
  "org-overview",
  "org-members",
  "org-teams",
  "org-keys",
  "org-usage",
  "org-billing",
  "org-invoices",
  "org-policies",
  "org-desktop",
  "org-audit",
  "org-security",
  "org-notifications",
] as const;

export type ConsoleTab = (typeof CONSOLE_TABS)[number];
const TAB_SET = new Set<string>(CONSOLE_TABS);

/* Support /model as a convenient legacy/singular alias for /models. */
export const CONSOLE_ROUTE_SLUGS = [...CONSOLE_TABS, "model"] as const;

export function normalizeConsoleTab(value: string | null): ConsoleTab | null {
  if (!value) return null;
  const slug = value.toLowerCase();
  if (slug === "model") return "models";
  return TAB_SET.has(slug) ? slug as ConsoleTab : null;
}

/* Recognize either /console/rewards or /rewards, with or without a trailing slash. */
export function consoleTabFromPath(pathname: string): ConsoleTab | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "console") segments.shift();
  return segments.length === 1 ? normalizeConsoleTab(segments[0]) : null;
}

/* The console subdomain omits /console in public URLs; the main domain keeps it. */
export function consoleTabHref(tab: ConsoleTab, hostname: string): string {
  const prefix = hostname === "console.inferenceport.ai" ? "" : "/console";
  return `${prefix}/${tab}/`;
}
