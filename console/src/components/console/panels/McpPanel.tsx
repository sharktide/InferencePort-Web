"use client";

import { useMemo, useState } from "react";
import styles from "./Panel.module.css";
import { useOptionalOrgContext } from "../OrgContext";
import { navigateConsole } from "../ContextSwitcher";

interface Props { session: any; config?: any; apiBase: string; }

type Auth = "oauth" | "key";
type Client = "claude-code" | "cursor" | "vscode" | "claude-desktop";

const CLIENTS: { id: Client; label: string }[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor / generic" },
  { id: "vscode", label: "VS Code" },
  { id: "claude-desktop", label: "Claude Desktop" },
];

const TOOLS: { name: string; text: string }[] = [
  { name: "council_reason", text: "Send a problem to a council of models. They answer in parallel, review each other, and judges synthesize one answer. Args: problem, tier, iteration_rounds (1-3), custom_models, custom_judges." },
  { name: "council_list_tiers", text: "List the tiers with their model counts, judge counts and flat surcharge in credits." },
  { name: "council_list_models", text: "List the council, judge and fallback models of one tier." },
];

/* Inline text-link look for in-sentence navigation buttons */
const LINK_BTN = { display: "inline", minHeight: 0, padding: 0, border: "none", background: "none", textDecoration: "underline", font: "inherit", color: "var(--brand)", cursor: "pointer" } as const;

const KEY_PLACEHOLDER = "ipa_live_YOUR_KEY";

function buildSnippet(client: Client, auth: Auth, url: string, orgSlug: string | null): { lang: string; text: string } {
  /* An org API key already belongs to its org. The org header only matters for OAuth sign-ins. */
  const headers: Record<string, string> = {};
  if (auth === "key") headers.Authorization = `Bearer ${KEY_PLACEHOLDER}`;
  if (auth === "oauth" && orgSlug) headers["X-InferencePort-Org"] = orgSlug;

  switch (client) {
    case "claude-code": {
      const h = Object.entries(headers).map(([k, v]) => ` \\\n  --header "${k}: ${v}"`).join("");
      const note = auth === "oauth" ? "\n\n# Then run /mcp inside Claude Code and choose council to sign in." : "";
      return { lang: "bash", text: `claude mcp add --transport http council ${url}${h}${note}` };
    }
    case "vscode": {
      const server: Record<string, unknown> = { type: "http", url };
      if (Object.keys(headers).length) server.headers = headers;
      return { lang: "json", text: JSON.stringify({ servers: { council: server } }, null, 2) };
    }
    case "claude-desktop": {
      const args = ["-y", "mcp-remote", url];
      for (const [k, v] of Object.entries(headers)) args.push("--header", `${k}:${v}`);
      return { lang: "json", text: JSON.stringify({ mcpServers: { council: { command: "npx", args } } }, null, 2) };
    }
    default: {
      const server: Record<string, unknown> = { url };
      if (Object.keys(headers).length) server.headers = headers;
      return { lang: "json", text: JSON.stringify({ mcpServers: { council: server } }, null, 2) };
    }
  }
}

export default function McpPanel({ session, apiBase }: Props) {
  const org = useOptionalOrgContext()?.activeOrg ?? null;
  const [auth, setAuth] = useState<Auth>("oauth");
  const [client, setClient] = useState<Client>("claude-code");
  const [copied, setCopied] = useState("");
  const [test, setTest] = useState<{ state: "idle" | "running" | "ok" | "error"; text: string }>({ state: "idle", text: "" });

  const url = useMemo(() => `${apiBase.replace(/\/$/, "")}/mcp/council/`, [apiBase]);
  const snippet = useMemo(() => buildSnippet(client, auth, url, org?.slug ?? null), [client, auth, url, org]);
  const canSpend = !org || ["owner", "admin", "member"].includes(org.role);
  const billedTo = org ? org.name : "your personal wallet";

  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(""), 1800); } catch { setCopied(""); }
  };

  /* Sends the MCP "initialize" handshake with your current sign-in, exactly as an MCP client would. */
  const runTest = async () => {
    if (!session?.access_token) return;
    setTest({ state: "running", text: "Connecting…" });
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      };
      if (org) headers["X-InferencePort-Org"] = org.slug;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "inferenceport-console", version: "1.0.0" } } }),
      });
      const body = await res.text();
      if (res.status === 401) throw new Error("The server rejected your sign-in (401). Sign out and back in, then retry.");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const name = /"name"\s*:\s*"([^"]+)"/.exec(body.slice(body.indexOf("serverInfo")))?.[1] ?? "council-of-llms";
      setTest({ state: "ok", text: `Connected to ${name}. Authenticated as ${session.user?.email ?? "you"}${org ? `, working as ${org.name}` : ""}.` });
    } catch (e: any) {
      setTest({ state: "error", text: e?.message || "Could not reach the MCP server." });
    }
  };

  const toggle = (active: boolean) => `${styles.playgroundTab} ${active ? styles.active : ""}`;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Council MCP server</div>
        <p className={styles.muted}>
          Give any MCP-compatible assistant (Claude, Cursor, VS Code, your own agent) a <strong>council of LLMs</strong>.
          One tool call fans your problem out to many models, has them critique each other, and returns a single synthesized answer.
        </p>
        <div className={styles.stack} style={{ marginTop: "1rem" }}>
          <label>
            Server URL
            <div className={styles.row}>
              <input type="text" readOnly value={url} style={{ flex: 1, minWidth: 0 }} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="ghost" onClick={() => copy("url", url)}>{copied === "url" ? "Copied" : "Copy"}</button>
            </div>
          </label>
          <p className={`${styles.muted} ${styles.tiny}`}>
            Transport: Streamable HTTP. Auth: sign in with OAuth, or send an InferencePort API key as a Bearer token.
          </p>
        </div>
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>{org ? `Billing: ${org.name}` : "Billing"}</div>
        <p className={styles.muted}>
          Each council member and judge call is billed per token, plus a flat council surcharge, all to <strong>{billedTo}</strong>.
          {org
            ? " Your organization's model and modality policies, spend limits, IP allowlist and key restrictions apply to every council call."
            : " Switch to an organization in the context switcher to bill an organization instead."}
        </p>
        {!canSpend && org && (
          <p className={styles.threeError} role="alert">
            Your role ({org.role.replace("_", " ")}) cannot spend {org.name}'s credits, so council calls billed to it will be refused.
          </p>
        )}
        {org && (
          <ul className={styles.rateList} style={{ marginTop: "0.75rem" }}>
            <li className={styles.rateListItem}><strong>Org API key:</strong> bills {org.name} automatically. No extra header needed. Create one under <button type="button" style={LINK_BTN} onClick={() => navigateConsole("org-keys")}>API keys</button>.</li>
            <li className={styles.rateListItem}><strong>OAuth sign-in:</strong> add the header <code>X-InferencePort-Org: {org.slug}</code> (included in the snippets below) to bill {org.name}. Without it you are billed personally.</li>
          </ul>
        )}
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Connect a client</div>
        <div className={styles.tabs} role="tablist" aria-label="Authentication method">
          <button type="button" role="tab" aria-selected={auth === "oauth"} className={toggle(auth === "oauth")} onClick={() => setAuth("oauth")}>OAuth sign-in</button>
          <button type="button" role="tab" aria-selected={auth === "key"} className={toggle(auth === "key")} onClick={() => setAuth("key")}>API key</button>
        </div>
        {auth === "oauth" ? (
          <p className={`${styles.muted} ${styles.tiny}`}>
            The client opens a browser window, you sign in to InferencePort and approve access. Nothing to copy or store. Approved clients appear under{" "}
            <button type="button" style={LINK_BTN} onClick={() => navigateConsole("authorized-apps")}>Authorized Applications</button>, where you can revoke them.
          </p>
        ) : (
          <p className={`${styles.muted} ${styles.tiny}`}>
            Replace <code>{KEY_PLACEHOLDER}</code> with a key from{" "}
            <button type="button" style={LINK_BTN} onClick={() => navigateConsole(org ? "org-keys" : "api-key")}>{org ? "this organization's API keys" : "API key"}</button>.
            {org ? " An organization key bills the organization." : " A personal key bills your personal wallet."} Keep keys secret and never commit them.
          </p>
        )}
        <div className={styles.tabs} role="tablist" aria-label="Client" style={{ marginTop: "0.5rem" }}>
          {CLIENTS.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={client === c.id} className={toggle(client === c.id)} onClick={() => setClient(c.id)}>{c.label}</button>
          ))}
        </div>
        <pre className={styles.apiKeySecret} style={{ margin: "0 0 0.75rem" }} data-lang={snippet.lang}>{snippet.text}</pre>
        <div className={styles.row}>
          <button type="button" onClick={() => copy("snippet", snippet.text)}>{copied === "snippet" ? "Copied" : "Copy snippet"}</button>
        </div>
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Test the connection</div>
        <p className={`${styles.muted} ${styles.tiny}`}>
          Runs the MCP handshake against the server with your current sign-in{org ? ` as ${org.name}` : ""}. It does not run the council and costs nothing.
        </p>
        <div className={styles.row} style={{ marginTop: "0.5rem" }}>
          <button type="button" onClick={runTest} disabled={!session || test.state === "running"}>{test.state === "running" ? "Testing…" : "Test connection"}</button>
          {!session && <span className={`${styles.muted} ${styles.tiny}`}>Sign in to test.</span>}
        </div>
        {test.state !== "idle" && (
          <p className={test.state === "error" ? styles.threeError : `${styles.muted} ${styles.tiny}`} role="status" style={{ marginTop: "0.75rem" }}>{test.text}</p>
        )}
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Tools</div>
        <ul className={styles.rateList}>
          {TOOLS.map((t) => (
            <li key={t.name} className={styles.rateListItem}><code>{t.name}</code>: {t.text}</li>
          ))}
        </ul>
        <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "0.75rem" }}>
          Try it: ask your assistant <em>&ldquo;Use the council to decide whether this migration is safe.&rdquo;</em> Higher tiers use more and stronger models and cost a higher surcharge.
          Runs time out after a few minutes, and each user can run only a few councils at once.
        </p>
      </section>
    </div>
  );
}
