"use client";

import Icon from "../../Icon";
import type { OrgSummary } from "../../../lib/orgs";
import { SPENDING_ROLES } from "../OrgWorkspace";
import styles from "./HomePanel.module.css";

interface Props {
  session: { user?: { email?: string } } | null;
  activeOrg: OrgSummary | null;
  onNavigate: (tab: string) => void;
}

type Destination = { id: string; label: string; detail: string; icon: "sparkle" | "cube" | "key" | "gauge" | "chat-circle-text" | "shield-check" | "link" | "chart-bar" | "credit-card" | "user-circle" | "plugs-connected" };

export default function HomePanel({ session, activeOrg, onNavigate }: Props) {
  const canSpend = !activeOrg || SPENDING_ROLES.includes(activeOrg.role);
  const keyTab = activeOrg ? "org-keys" : "api-key";
  const usageTab = activeOrg ? "org-usage" : "usage";
  const billingTab = activeOrg ? "org-billing" : "billing";
  const start: Destination[] = canSpend ? [
    { id: "playground", label: "Playground", detail: "Experiment across text, image, audio, video, 3D and more.", icon: "sparkle" },
    { id: "models", label: "Model catalog", detail: "Explore capabilities, compare pricing, and run quick tests.", icon: "cube" },
    { id: keyTab, label: "API keys", detail: "Create and manage credentials for your applications.", icon: "key" },
  ] : [
    { id: "org-overview", label: "Organization overview", detail: "Check the current workspace and its settings.", icon: "gauge" },
    { id: usageTab, label: "Usage analytics", detail: "Review activity, requests and model spending.", icon: "chart-bar" },
    { id: "org-members", label: "Members", detail: "View the people in this organization.", icon: "user-circle" },
  ];
  const tools: Destination[] = canSpend ? [
    { id: "agents", label: "Agents", detail: "Build and manage hosted AI agents.", icon: "chat-circle-text" },
    { id: "buckets", label: "Buckets", detail: "Manage S3-compatible object storage.", icon: "cube" },
    { id: "deploy", label: "Deployments", detail: "Run dedicated model workloads.", icon: "gauge" },
    { id: "mcp", label: "MCP", detail: "Connect models to tools and integrations.", icon: "link" },
    { id: "shield", label: "AI Shield", detail: "Configure safeguards for production requests.", icon: "shield-check" },
  ] : [];
  const manage: Destination[] = [
    { id: usageTab, label: "Usage", detail: "Inspect requests, credits, and trends.", icon: "chart-bar" },
    ...(activeOrg ? [
      { id: "org-overview", label: "Organization overview", detail: "Workspace information and administration.", icon: "gauge" as const },
      { id: "org-members", label: "Members", detail: "Team membership and access.", icon: "user-circle" as const },
      ...(["owner", "admin", "billing_manager", "auditor"].includes(activeOrg.role)
        ? [{ id: billingTab, label: "Billing", detail: "Review workspace spend and invoices.", icon: "credit-card" as const }]
        : []),
    ] : [
      { id: billingTab, label: "Billing", detail: "Credits, plans, payments, and transactions.", icon: "credit-card" as const },
      { id: "organizations", label: "Organizations", detail: "Switch or create a team workspace.", icon: "plugs-connected" as const },
    ]),
  ];
  const renderCard = (item: Destination) => (
    <button key={item.id} type="button" className={styles.destination} onClick={() => onNavigate(item.id)}>
      <span className={styles.destinationIcon}><Icon name={item.icon} size={21} /></span>
      <span className={styles.destinationText}><strong>{item.label}</strong><small>{item.detail}</small></span>
      <Icon name="arrow-right" size={17} className={styles.arrow} />
    </button>
  );
  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <div className={styles.eyebrow}><span className={styles.dot} /> {activeOrg ? activeOrg.name : "Personal workspace"}</div>
        <h1>Welcome to your workspace.</h1>
        <p className={styles.lede}>Build, test and manage your AI applications from one place.</p>
        {session?.user?.email && <p className={styles.signedIn}>Signed in as {session.user.email}</p>}
      </header>

      <div className={styles.sections}>
        <section aria-labelledby="home-get-started">
          <div className={styles.sectionHeading}><h2 id="home-get-started">Quick access</h2><p>Pick up where you need to work.</p></div>
          <div className={styles.quickGrid}>{start.map(renderCard)}</div>
        </section>

        {tools.length > 0 && (
          <section aria-labelledby="home-build">
            <div className={styles.sectionHeading}><h2 id="home-build">Build and deploy</h2><p>Infrastructure and integrations for your next project.</p></div>
            <div className={styles.toolGrid}>{tools.map(renderCard)}</div>
          </section>
        )}

        <section aria-labelledby="home-manage">
          <div className={styles.sectionHeading}><h2 id="home-manage">Workspace management</h2><p>Usage, billing and team administration.</p></div>
          <div className={styles.manageGrid}>{manage.filter((item) => !start.some((quick) => quick.id === item.id)).map(renderCard)}</div>
        </section>
      </div>
    </div>
  );
}
