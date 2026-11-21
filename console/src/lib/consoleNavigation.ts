import type { IconName } from "../components/Icon";

/* A small, task-oriented navigation layer over the existing, bookmarkable routes. */
export type MainSection = "home" | "playground" | "models" | "build" | "usage" | "settings";
export const MAIN_NAV: { id: MainSection; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "gauge" },
  { id: "playground", label: "Playground", icon: "sparkle" },
  { id: "models", label: "Models", icon: "cube" },
  { id: "build", label: "Build", icon: "plugs-connected" },
  { id: "usage", label: "Usage", icon: "chart-bar" },
];

/* Keep old URLs working: they belong to a top-level destination, not the sidebar. */
export function mainSectionForTab(tab: string): MainSection {
  if (tab === "home" || tab === "org-overview") return "home";
  if (tab === "models" || tab === "playground") return tab;
  if (["build", "agents", "buckets", "deploy", "api-key", "gen-api", "payg-api", "mcp", "shield", "org-keys"].includes(tab)) return "build";
  if (["usage", "billing", "rewards", "org-usage", "org-billing", "org-invoices"].includes(tab)) return "usage";
  return "settings";
}
