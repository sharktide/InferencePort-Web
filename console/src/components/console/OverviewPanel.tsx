"use client";

import { useEffect, useState } from "react";
import Icon from "../Icon";
import { PERSONAL_ITEMS } from "../../lib/consoleSections";
import { consoleTabHref } from "../../lib/consoleTabs";
import { navigateConsole } from "./ContextSwitcher";
import { useOptionalOrgContext } from "./OrgContext";
import styles from "./OverviewPanel.module.css";

const LINKS = [
  { group: "Build", ids: ["models", "agents", "mcp"] },
  { group: "Infrastructure", ids: ["deploy", "buckets", "shield"] },
  { group: "Manage", ids: ["usage", "billing", "organizations"] },
  { group: "Integration guides", ids: ["gen-api", "payg-api"] },
] as const;

interface Props { session: { access_token?: string } | null; apiBase: string; }
export default function OverviewPanel({ session, apiBase }: Props) {
  const [reload, setReload] = useState(0);
  const [summary, setSummary] = useState<{ owner: string; balance?: number; used?: number; error?: string } | null>(null);
  const token = session?.access_token;
  const owner = apiBase + ":" + (token ?? "");
  const current = summary?.owner === owner ? summary : null;
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void fetch(apiBase + "/v1/me", { headers: { Authorization: "Bearer " + token }, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load your account summary.");
        const data = await response.json();
        const finite = (value: unknown) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : undefined;
        if (!controller.signal.aborted) setSummary({ owner, balance: finite(data.wallet?.balance_credits), used: finite(data.usage_summary?.totalCreditsUsed) });
      }).catch((error) => {
        if (!controller.signal.aborted) setSummary({ owner, error: error.message || "Unable to load your account summary." });
      });
    return () => controller.abort();
  }, [token, apiBase, owner, reload]);
  const credits = (value?: number) => value === undefined ? "Unavailable" : value.toLocaleString(undefined, { maximumFractionDigits: 4 });

  const ctx = useOptionalOrgContext();
  const workspaceName = ctx?.activeOrg?.name ?? "Personal";
  return (
    <section className={styles.overview} aria-labelledby="overview-title">
      <header className={styles.heading}>
        <h2 id="overview-title">Overview</h2>
        <p>Build with models, manage your resources, and keep track of spending.</p>
      </header>
      <div className={styles.context}>
        <Icon name="user-circle" size={18} aria-hidden="true" />
        <span>Current workspace</span>
        <strong>{workspaceName}</strong>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => navigateConsole("playground")}>Open Playground</button>
        <button type="button" className="ghost" onClick={() => navigateConsole("api-key")}>Create API key</button>
      </div>
      {token && <section className={styles.summary} aria-label="Account summary">
        {!current ? <p role="status">Loading account summary…</p> : current.error ? <div role="alert"><p>{current.error}</p><button className="ghost" onClick={() => setReload((value) => value + 1)}>Retry summary</button></div> : <>
          <div><span>Available API credits</span><strong>{credits(current.balance)}</strong><button className="text-btn" onClick={() => navigateConsole("billing")}>Add credits</button></div>
          <div><span>Credits used</span><strong>{credits(current.used)}</strong><button className="text-btn" onClick={() => navigateConsole("usage")}>View usage</button></div>
        </>}
      </section>}
      <div className={styles.groups}>
        {LINKS.map(({ group, ids }) => (
          <section className={styles.group} key={group} aria-labelledby={`overview-${group.replaceAll(" ", "-")}`}>
            <h3 id={`overview-${group.replaceAll(" ", "-")}`}>{group}</h3>
            <div className={styles.links}>
              {ids.map((id) => {
                const item = PERSONAL_ITEMS[id as keyof typeof PERSONAL_ITEMS];
                return (
                  <a className={styles.link} href={consoleTabHref(id, typeof window === "undefined" ? "" : window.location.hostname)} key={id} onClick={(event) => {
                    event.preventDefault();
                    navigateConsole(id);
                  }}>
                    <Icon name={item.icon} size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    <span className={styles.arrow} aria-hidden="true">↗</span>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
