"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./Panel.module.css";
import agentStyles from "./AgentsPanel.module.css";

interface Props { session: any; apiBase: string; }

interface AgentEntry {
  id: string;
  name?: string;
  description?: string;
  backing_model?: string;
  visibility?: string;
  registry?: string;
  payer?: string;
  payer_label?: string;
  caller_pays?: boolean;
  owned_by?: string;
  owner_username?: string;
  is_owner?: boolean;
  role?: string | null;
  in_catalog?: boolean;
  capabilities?: string[];
  mcp_servers?: McpServer[];
  mcp_server_count?: number;
  created_at?: string;
}

interface MemberEntry {
  user_id: string;
  email?: string;
  role: string;
  role_label?: string;
}

interface McpServer {
  name: string;
  url: string;
  transport: string;
  auth_type: string;
  auth_header: string;
  auth_token: string;
}

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;
const MCP_TOKEN_REDACTED = "********";
const MAX_MCP_SERVERS = 8;

const ROLE_OPTIONS = [
  { value: "user", label: "User — can call" },
  { value: "editor", label: "Editor — can edit" },
  { value: "inviter", label: "Inviter — can invite" },
  { value: "administrator", label: "Admin — full control" },
];

const emptyMcp = (): McpServer => ({
  name: "",
  url: "",
  transport: "auto",
  auth_type: "none",
  auth_header: "",
  auth_token: "",
});

function fromApiMcp(servers: McpServer[] | undefined): McpServer[] {
  return (servers || []).map((s) => ({
    name: s.name || "",
    url: s.url || "",
    transport: s.transport || "auto",
    auth_type: s.auth_type || "none",
    auth_header: s.auth_header || "",
    auth_token: s.auth_token || "",
  }));
}

interface ApiMcpServer {
  name: string;
  url: string;
  transport: string;
  auth_type: string;
  auth_header?: string;
  auth_token?: string;
}

function toApiMcp(servers: McpServer[]): ApiMcpServer[] {
  return servers
    .filter((s) => s.name.trim() || s.url.trim())
    .map((s) => ({
      name: s.name.trim(),
      url: s.url.trim(),
      transport: s.transport,
      auth_type: s.auth_type,
      ...(s.auth_type === "api_key" ? { auth_header: s.auth_header.trim() || "X-API-Key" } : {}),
      ...(s.auth_type !== "none" && s.auth_token ? { auth_token: s.auth_token } : {}),
    }));
}

function splitAgentId(id: string): [string, string] {
  const parts = id.replace(/^agent\//, "").split("/");
  return [parts[0] || "", parts[1] || ""];
}

function McpEditor({ servers, onChange }: { servers: McpServer[]; onChange: (s: McpServer[]) => void }) {
  const update = (i: number, patch: Partial<McpServer>) =>
    onChange(servers.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  return (
    <div className={agentStyles.mcpList}>
      {servers.map((s, i) => (
        <div key={i} className={agentStyles.mcpRow}>
          <div className={agentStyles.mcpMain}>
            <input
              placeholder="Name"
              maxLength={64}
              title="Server name"
              value={s.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              placeholder="https://host/gradio_api/mcp/http or .../mcp/sse"
              maxLength={500}
              title="Server URL"
              value={s.url}
              onChange={(e) => update(i, { url: e.target.value })}
            />
            <select value={s.transport} onChange={(e) => update(i, { transport: e.target.value })} title="Transport">
              <option value="auto">Auto</option>
              <option value="http">HTTP</option>
              <option value="sse">SSE</option>
            </select>
            <select value={s.auth_type} onChange={(e) => update(i, { auth_type: e.target.value })} title="Auth">
              <option value="none">No auth</option>
              <option value="bearer">Bearer token</option>
              <option value="api_key">API key header</option>
            </select>
            <button
              type="button"
              className="text-btn"
              title="Remove server"
              onClick={() => onChange(servers.filter((_, idx) => idx !== i))}
            >
              ✕
            </button>
          </div>
          {s.auth_type !== "none" && (
            <div className={agentStyles.mcpAuth}>
              {s.auth_type === "api_key" && (
                <input
                  placeholder="Header name (default X-API-Key)"
                  value={s.auth_header}
                  onChange={(e) => update(i, { auth_header: e.target.value })}
                />
              )}
              <input
                type="password"
                autoComplete="new-password"
                placeholder={s.auth_token === MCP_TOKEN_REDACTED ? "Saved — type to replace" : "Token / API key"}
                value={s.auth_token}
                onChange={(e) => update(i, { auth_token: e.target.value })}
              />
            </div>
          )}
        </div>
      ))}
      {servers.length < MAX_MCP_SERVERS && (
        <button type="button" className={`ghost ${agentStyles.mcpAdd}`} onClick={() => onChange([...servers, emptyMcp()])}>
          + Add MCP server
        </button>
      )}
      <p className={`${styles.muted} ${styles.tiny}`}>
        HTTP or SSE MCP endpoints. Tokens are stored server-side and never shown again after saving.
      </p>
    </div>
  );
}

type InviteDialogState =
  | { kind: "loading" }
  | { kind: "prompt"; data: any }
  | { kind: "accepted"; data: any }
  | { kind: "denied" }
  | { kind: "error"; message: string };

type Expanded = { id: string; kind: "invite" | "members" | "edit" } | null;

export default function AgentsPanel({ session, apiBase }: Props) {
  const [tab, setTab] = useState<"mine" | "create" | "catalog" | "discover" | "invites">("mine");
  const [profile, setProfile] = useState<{ username: string | null; has_username: boolean }>({ username: null, has_username: false });
  const [usernameDraft, setUsernameDraft] = useState("");
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [registryAgents, setRegistryAgents] = useState<AgentEntry[]>([]);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [invites, setInvites] = useState<any[]>([]);
  const [models, setModels] = useState<{ id: string; name?: string; supportedFeatures: string[] }[]>([]);
  const [settings, setSettings] = useState<{ include_in_models: boolean }>({ include_in_models: false });
  const [status, setStatus] = useState("Sign in to manage your agents.");
  const [busy, setBusy] = useState(false);

  const [expanded, setExpanded] = useState<Expanded>(null);
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviteResult, setInviteResult] = useState<{ agentId: string; url: string; role: string } | null>(null);
  const [membersData, setMembersData] = useState<{ agentId: string; members: MemberEntry[]; invites: any[] } | null>(null);
  const [editForm, setEditForm] = useState<(AgentEntry & { form: any }) | null>(null);
  const [inviteDialog, setInviteDialog] = useState<InviteDialogState | null>(null);
  const [inviteTokenSeen, setInviteTokenSeen] = useState<string | null>(null);

  const [form, setForm] = useState({
    agentId: "",
    name: "",
    description: "",
    model: "",
    systemPrompt: "",
    visibility: "private",
    registry: "published",
    payer: "caller",
    mcpServers: [] as McpServer[],
  });

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(`${apiBase}${path}`, opts);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const errMsg = d.detail || (typeof d.error === "object" ? d.error?.message : d.error) || `HTTP ${r.status}`;
      throw new Error(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
    }
    return d;
  };

  const refresh = useCallback(async () => {
    if (!session?.access_token) {
      setProfile({ username: null, has_username: false });
      setAgents([]);
      setInvites([]);
      setStatus("Sign in to manage your agents.");
      return;
    }
    try {
      const [prof, list, inv, cfg, registry] = await Promise.all([
        fj("/v1/agents/profile", { headers: authH() }),
        fj("/v1/agents/models", { headers: authH() }),
        fj("/v1/agents/invites", { headers: authH() }),
        fj("/v1/agents/settings", { headers: authH() }),
        fj("/v1/agents/registry", { headers: authH() }).catch(() => ({ data: [] })),
      ]);
      setProfile({ username: prof.username || null, has_username: !!prof.has_username });
      setAgents(list.data || []);
      setRegistryAgents(registry.data || []);
      setInvites(inv.invites || []);
      setSettings(cfg.settings || { include_in_models: false });
      setStatus(prof.has_username ? `Signed in as @${prof.username}.` : "Set a username to publish agents.");
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  }, [session, apiBase]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!apiBase) return;
    fetch(`${apiBase}/v1/models`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.data || [])
          .filter((m: any) => {
            const id = String(m.id || "");
            if (!id || id.startsWith("hf/") || id.startsWith("agent/")) return false;
            if (m.managed_by === "inferenceport") return false;
            const mods = m.output_modalities || m.modalities || ["text"];
            return Array.isArray(mods) && mods.includes("text");
          })
          .map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            supportedFeatures: Array.isArray(m.supported_features) ? m.supported_features : [],
          }));
        setModels(list);
        setForm((f) => (f.model ? f : { ...f, model: list[0]?.id || "" }));
      })
      .catch(() => {});
  }, [apiBase]);

  const modelSupportsTools = (modelId: string) => {
    const entry = models.find((m) => m.id === modelId);
    return !!entry && entry.supportedFeatures.includes("tools");
  };

  const mcpNeedsTools = (servers: McpServer[], modelId: string) =>
    servers.some((s) => s.name.trim() || s.url.trim()) && !modelSupportsTools(modelId);

  const mcpToolWarning = (modelId: string) =>
    `MCP servers need a backing model that supports tool calling. ${
      modelId ? `"${modelId}" does not support tools.` : "Select a tool-capable model."
    } Pick a tool-capable model or remove the MCP servers.`;

  const modelOptionLabel = (m: { id: string; name?: string; supportedFeatures: string[] }) =>
    m.supportedFeatures.includes("tools")
      ? `${m.name} (${m.id})`
      : `${m.name} (${m.id}) — no tool support`;

  /* Invite links point at the console root: https://console.inferenceport.ai?invite=TOKEN.
     Preview the invite, then accept or deny — access is never automatic. */
  useEffect(() => {
    if (typeof window === "undefined" || !apiBase) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (!token || token === inviteTokenSeen) return;
    setInviteTokenSeen(token);
    params.delete("invite");
    const nextQuery = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`,
    );
    setInviteDialog({ kind: "loading" });
    (async () => {
      try {
        const d = await fj(`/v1/agents/invite/${encodeURIComponent(token)}`, session?.access_token ? { headers: authH() } : {});
        if (d.status === "accepted") {
          setInviteDialog({ kind: "error", message: "This invite was already accepted. The agent should be in your catalog." });
          await refresh();
        } else if (d.status === "denied") {
          setInviteDialog({ kind: "error", message: "This invite was already denied." });
        } else if (d.status === "revoked") {
          setInviteDialog({ kind: "error", message: "This invite was revoked by the agent owner. Ask them for a new link." });
        } else if (!session?.access_token) {
          setInviteDialog({ kind: "prompt", data: { ...d, needsSignIn: true } });
        } else if (d.signed_in && d.matches_invited_user === false) {
          setInviteDialog({ kind: "error", message: "This invite was issued to a different account. Sign in with the invited account to accept it." });
        } else {
          setInviteDialog({ kind: "prompt", data: d });
        }
      } catch (e: any) {
        setInviteDialog({ kind: "error", message: e.message || "This invite link is not valid. It may have been revoked or the agent was deleted." });
      }
    })();
  }, [apiBase, session, inviteTokenSeen, refresh]);

  const respondInvite = async (token: string, action: "accept" | "deny") => {
    if (!session?.access_token) {
      setInviteDialog({ kind: "error", message: "Sign in first, then open the invite link again." });
      return;
    }
    setBusy(true);
    try {
      const r = await fj(`/v1/agents/invite/${encodeURIComponent(token)}/${action}`, {
        method: "POST",
        headers: authH(),
      });
      if (action === "accept") {
        setInviteDialog({ kind: "accepted", data: r });
        setStatus(`Added ${r.agent?.id || "agent"} to your catalog as ${r.role_label || r.role}.`);
      } else {
        setInviteDialog({ kind: "denied" });
        setStatus("Invite declined.");
      }
      await refresh();
    } catch (e: any) {
      setInviteDialog({ kind: "error", message: e.message });
    }
    setBusy(false);
  };

  const toggleExpand = (id: string, kind: "invite" | "members" | "edit") => {
    setInviteResult((r) => (r && r.agentId !== id ? null : r));
    setExpanded((cur) => (cur && cur.id === id && cur.kind === kind ? null : { id, kind }));
  };

  const saveUsername = async () => {
    if (!session?.access_token) return;
    const value = usernameDraft.trim().toLowerCase();
    if (!USERNAME_RE.test(value)) {
      setStatus("Username must be 3-30 characters: lowercase letters, numbers, hyphens or underscores, starting and ending with a letter or number.");
      return;
    }
    setBusy(true);
    try {
      await fj("/v1/agents/profile", { method: "PUT", headers: authH(), body: JSON.stringify({ username: value }) });
      setUsernameDraft("");
      setStatus(`Username set to @${value}.`);
      await refresh();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
    setBusy(false);
  };

  const createAgent = async () => {
    if (!session?.access_token) return;
    if (!profile.has_username) {
      setStatus("Set a username first — it is required to publish agents.");
      setTab("mine");
      return;
    }
    if (!form.agentId.trim() || !form.name.trim() || !form.model) {
      setStatus("Agent id, name and backing model are required.");
      return;
    }
    if (mcpNeedsTools(form.mcpServers, form.model)) {
      setStatus(mcpToolWarning(form.model));
      return;
    }
    setBusy(true);
    setStatus("Creating agent…");
    try {
      const r = await fj("/v1/agents", {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({
          agent_id: form.agentId.trim().toLowerCase(),
          name: form.name.trim(),
          description: form.description.trim(),
          model: form.model,
          system_prompt: form.systemPrompt,
          visibility: form.visibility,
          registry: form.registry,
          payer: form.payer,
          mcp_servers: toApiMcp(form.mcpServers),
        }),
      });
      setForm({ agentId: "", name: "", description: "", model: form.model, systemPrompt: "", visibility: "private", registry: "published", payer: "caller", mcpServers: [] });
      setStatus(`Created ${r.model_id}. ${r.payer_label}.`);
      setTab("mine");
      await refresh();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
    setBusy(false);
  };

  const deleteAgent = async (agent: AgentEntry) => {
    const [username, agentId] = splitAgentId(agent.id);
    if (!window.confirm(`Delete @${username}/${agentId}? This cannot be undone and revokes everyone's access.`)) return;
    try {
      await fj(`/v1/agents/${encodeURIComponent(username)}/${encodeURIComponent(agentId)}`, { method: "DELETE", headers: authH() });
      setStatus(`Deleted ${agent.id}.`);
      setExpanded(null);
      await refresh();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const startEdit = (agent: AgentEntry) => {
    if (expanded?.id === agent.id && expanded.kind === "edit") {
      setExpanded(null);
      setEditForm(null);
      return;
    }
    const [username, agentId] = splitAgentId(agent.id);
    setExpanded({ id: agent.id, kind: "edit" });
    setEditForm({
      ...agent,
      form: {
        username,
        agentId,
        name: agent.name || "",
        description: agent.description || "",
        model: agent.backing_model || "",
        systemPrompt: "",
        visibility: agent.visibility || "private",
        registry: agent.registry || "published",
        payer: agent.payer || "caller",
        mcpServers: fromApiMcp(agent.mcp_servers),
      },
    });
  };

  const saveEdit = async () => {
    if (!editForm) return;
    const f = editForm.form;
    if (mcpNeedsTools(f.mcpServers, f.model)) {
      setStatus(mcpToolWarning(f.model));
      return;
    }
    setBusy(true);
    try {
      await fj(`/v1/agents/${encodeURIComponent(f.username)}/${encodeURIComponent(f.agentId)}`, {
        method: "PATCH",
        headers: authH(),
        body: JSON.stringify({
          name: f.name,
          description: f.description,
          model: f.model,
          system_prompt: f.systemPrompt,
          visibility: f.visibility,
          registry: f.registry,
          payer: f.payer,
          mcp_servers: toApiMcp(f.mcpServers),
        }),
      });
      setStatus(`Updated ${f.username}/${f.agentId}.`);
      setExpanded(null);
      setEditForm(null);
      await refresh();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
    setBusy(false);
  };

  const loadMembers = async (agent: AgentEntry) => {
    const [username, agentId] = splitAgentId(agent.id);
    try {
      const r = await fj(`/v1/agents/${encodeURIComponent(username)}/${encodeURIComponent(agentId)}/members`, { headers: authH() });
      setMembersData({ agentId: agent.id, members: r.members || [], invites: r.invites || [] });
    } catch (e: any) {
      setMembersData({ agentId: agent.id, members: [], invites: [] });
      setStatus(`Error: ${e.message}`);
    }
  };

  const toggleMembers = async (agent: AgentEntry) => {
    if (expanded?.id === agent.id && expanded.kind === "members") {
      setExpanded(null);
      return;
    }
    setExpanded({ id: agent.id, kind: "members" });
    await loadMembers(agent);
  };

  const changeMemberRole = async (agent: AgentEntry, userId: string, role: string) => {
    const [username, agentId] = splitAgentId(agent.id);
    try {
      await fj(`/v1/agents/${encodeURIComponent(username)}/${encodeURIComponent(agentId)}/members/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: authH(),
        body: JSON.stringify({ role }),
      });
      setStatus(`Role updated to ${role}.`);
      await loadMembers(agent);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const revokeMember = async (agent: AgentEntry, userId: string, email?: string) => {
    if (!window.confirm(`Revoke ${email || userId}'s access to this agent? They will lose call access and it will leave their catalog.`)) return;
    const [username, agentId] = splitAgentId(agent.id);
    try {
      await fj(`/v1/agents/${encodeURIComponent(username)}/${encodeURIComponent(agentId)}/members/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: authH(),
      });
      setStatus("Access revoked.");
      await loadMembers(agent);
      await refresh();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const revokePendingInvite = async (agent: AgentEntry, token: string) => {
    try {
      await fj(`/v1/agents/invite/${encodeURIComponent(token)}`, { method: "DELETE", headers: authH() });
      setStatus("Pending invite revoked.");
      await loadMembers(agent);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const sendInvite = async (agent: AgentEntry) => {
    const [username, agentId] = splitAgentId(agent.id);
    if (!inviteIdentifier.trim()) {
      setStatus("Enter the invitee's email or user id.");
      return;
    }
    setBusy(true);
    try {
      const r = await fj(`/v1/agents/invite/${encodeURIComponent(username)}/${encodeURIComponent(agentId)}`, {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({ email: inviteIdentifier.trim(), role: inviteRole }),
      });
      setInviteResult({ agentId: agent.id, url: r.invite_url, role: r.role_label || r.role });
      setInviteIdentifier("");
      setStatus(`Invite created for ${r.role_label || r.role}. They must open the link and accept.`);
      await refresh();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
    setBusy(false);
  };

  const respondFromList = async (token: string, action: "accept" | "deny") => {
    setBusy(true);
    try {
      await fj(`/v1/agents/invite/${encodeURIComponent(token)}/${action}`, { method: "POST", headers: authH() });
      setStatus(action === "accept" ? "Invite accepted — agent added to your catalog." : "Invite declined.");
      await refresh();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
    setBusy(false);
  };

  const toggleIncludeInModels = async (checked: boolean) => {
    setBusy(true);
    try {
      const r = await fj("/v1/agents/settings", {
        method: "PUT",
        headers: authH(),
        body: JSON.stringify({ include_in_models: checked }),
      });
      setSettings(r.settings || { include_in_models: checked });
      setStatus(checked ? "Your catalog agents now appear in /v1/models." : "Agents removed from /v1/models.");
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
    setBusy(false);
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setStatus(`Copied ${label}.`);
  };

  const owned = agents.filter((a) => a.is_owner || (a.capabilities || []).includes("edit") || (a.capabilities || []).includes("invite"));
  const catalog = agents.filter((a) => a.in_catalog && !a.is_owner);
  const discoverQueryNorm = discoverQuery.trim().toLowerCase();
  const discovered = registryAgents.filter((a) => {
    if (!discoverQueryNorm) return true;
    const haystack = `${a.name || ""} ${a.id} ${a.description || ""} ${a.owner_username || a.owned_by || ""}`.toLowerCase();
    return haystack.includes(discoverQueryNorm);
  });
  const can = (a: AgentEntry, cap: string) => a.is_owner || (a.capabilities || []).includes(cap);
  const createMcpBlocked = mcpNeedsTools(form.mcpServers, form.model);

  const payerBadge = (a: { payer?: string }) => (
    <span className={`${agentStyles.badge} ${a.payer === "owner" ? agentStyles.badgeOwnerPays : agentStyles.badgeCallerPays}`}>
      {a.payer === "owner" ? "Owner pays" : "Caller pays"}
    </span>
  );

  const registryBadge = (a: { visibility?: string; registry?: string }) =>
    a.visibility === "public" ? (
      <span className={`${agentStyles.badge} ${a.registry === "unlisted" ? agentStyles.badgeUnlisted : agentStyles.badgePublished}`}>
        {a.registry === "unlisted" ? "Unlisted" : "Published"}
      </span>
    ) : (
      <span className={`${agentStyles.badge} ${agentStyles.badgePrivate}`}>Private</span>
    );

  const inviteDialogNode = inviteDialog && (
    <div className={agentStyles.inviteOverlay} role="dialog" aria-modal="true" aria-label="Agent invite">
      <div className={agentStyles.inviteDialog}>
        {inviteDialog.kind === "loading" && (
          <>
            <div className={agentStyles.inviteDialogTitle}>Checking invite…</div>
            <div className={agentStyles.inviteSpinner} aria-hidden="true" />
          </>
        )}

        {inviteDialog.kind === "prompt" && (
          <>
            <div className={agentStyles.inviteDialogTitle}>You&apos;ve been invited to an agent</div>
            <div className={agentStyles.inviteDialogMeta}>
              <div className={agentStyles.inviteDialogMetaRow}>
                <span className={agentStyles.inviteDialogMetaKey}>Agent</span>
                <span>{inviteDialog.data.agent_name || inviteDialog.data.agent_id}</span>
              </div>
              <div className={agentStyles.inviteDialogMetaRow}>
                <span className={agentStyles.inviteDialogMetaKey}>Owner</span>
                <span>@{inviteDialog.data.owner_username}</span>
              </div>
              <div className={agentStyles.inviteDialogMetaRow}>
                <span className={agentStyles.inviteDialogMetaKey}>Role</span>
                <span>{inviteDialog.data.role_label}</span>
              </div>
              <div className={agentStyles.inviteDialogMetaRow}>
                <span className={agentStyles.inviteDialogMetaKey}>Billing</span>
                <span>{inviteDialog.data.payer_label}</span>
              </div>
            </div>
            <p className={agentStyles.inviteDialogBody}>
              {inviteDialog.data.role === "administrator"
                ? "This role has full control over the agent, including the ability to delete it."
                : inviteDialog.data.role === "editor"
                  ? "This role can edit the agent's configuration."
                  : inviteDialog.data.role === "inviter"
                    ? "This role can invite other people but cannot edit the agent."
                    : "This role can call the agent. "}
              {inviteDialog.data.payer === "owner"
                ? " The agent owner pays for every call."
                : inviteDialog.data.payer === "caller"
                  ? " You will be charged per token when you call it."
                  : ""}
              {" "}Accepting adds the agent to your catalog.
            </p>
            {inviteDialog.data.needsSignIn ? (
              <p className={agentStyles.inviteDialogBody}>Sign in to the console, then open this invite link again to accept or deny.</p>
            ) : (
              <div className={agentStyles.inviteDialogActions}>
                <button onClick={() => respondInvite(inviteDialog.data.invite_token, "accept")} disabled={busy}>
                  {busy ? "Working…" : "Accept"}
                </button>
                <button className="ghost" onClick={() => respondInvite(inviteDialog.data.invite_token, "deny")} disabled={busy}>
                  Deny
                </button>
              </div>
            )}
            <div className={agentStyles.inviteDialogActions}>
              <button className="ghost" onClick={() => setInviteDialog(null)}>Close</button>
            </div>
          </>
        )}

        {inviteDialog.kind === "accepted" && (
          <>
            <div className={agentStyles.inviteDialogTitle}>Invite accepted</div>
            <p className={agentStyles.inviteDialogBody}>
              {inviteDialog.data.agent?.id ? `${inviteDialog.data.agent.id} is` : "The agent is"} now in your catalog
              {inviteDialog.data.role ? ` as ${inviteDialog.data.role_label || inviteDialog.data.role}` : ""}.
            </p>
            <div className={agentStyles.inviteDialogActions}>
              <button onClick={() => { setInviteDialog(null); setTab("catalog"); }}>View catalog</button>
              <button className="ghost" onClick={() => setInviteDialog(null)}>Close</button>
            </div>
          </>
        )}

        {inviteDialog.kind === "denied" && (
          <>
            <div className={agentStyles.inviteDialogTitle}>Invite declined</div>
            <p className={agentStyles.inviteDialogBody}>Nothing was added to your catalog. You can accept a new invite later.</p>
            <div className={agentStyles.inviteDialogActions}>
              <button className="ghost" onClick={() => setInviteDialog(null)}>Close</button>
            </div>
          </>
        )}

        {inviteDialog.kind === "error" && (
          <>
            <div className={agentStyles.inviteDialogTitle}>Invite unavailable</div>
            <p className={agentStyles.inviteDialogBody}>{inviteDialog.message}</p>
            <div className={agentStyles.inviteDialogActions}>
              <button className="ghost" onClick={() => setInviteDialog(null)}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (!session && !inviteDialog) {
    return (
      <div className={`${styles.panel} ${styles.active}`}>
        <div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to create and manage InferencePort Agents.</div>
        {inviteDialogNode}
      </div>
    );
  }

  const renderInviteSection = (a: AgentEntry) => (
    <div className={agentStyles.detailSection}>
      <p className={`${styles.muted} ${styles.tiny}`}>
        Invite by email or user id. The link only grants access after the person signs in and accepts —
        it never grants anything on its own.
        {a.payer === "owner" ? " You keep paying for their usage." : " They pay per token when they call it."}
      </p>
      <div className={styles.row}>
        <input
          type="text"
          placeholder="email@example.com or user id"
          value={inviteIdentifier}
          onChange={(e) => setInviteIdentifier(e.target.value)}
          style={{ flex: 1, minWidth: "200px" }}
        />
        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ minHeight: 40 }}>
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button onClick={() => sendInvite(a)} disabled={busy}>Create invite link</button>
      </div>
      {inviteResult && inviteResult.agentId === a.id && (
        <div className={agentStyles.inviteLinkRow}>
          <input className={agentStyles.inviteLink} readOnly value={inviteResult.url} onFocus={(e) => e.currentTarget.select()} />
          <button className="ghost" onClick={() => copy(inviteResult.url, "invite link")}>Copy</button>
        </div>
      )}
    </div>
  );

  const renderMembersSection = (a: AgentEntry) => {
    const data = membersData?.agentId === a.id ? membersData : null;
    return (
      <div className={agentStyles.detailSection}>
        <div className={agentStyles.memberList}>
          {!data ? (
            <p className={`${styles.muted} ${styles.tiny}`}>Loading members…</p>
          ) : (
            <>
              {data.members.length === 0 && <p className={`${styles.muted} ${styles.tiny}`}>No members yet.</p>}
              {data.members.map((m) => (
                <div key={m.user_id} className={agentStyles.memberRow}>
                  <div className={agentStyles.memberWho}>
                    <div className={agentStyles.memberEmail}>{m.email || m.user_id}</div>
                    <div className={agentStyles.memberUserId}>{m.user_id}</div>
                  </div>
                  <select
                    className={agentStyles.memberRoleSelect}
                    value={m.role}
                    onChange={(e) => changeMemberRole(a, m.user_id, e.target.value)}
                  >
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.value}</option>)}
                  </select>
                  <button className="ghost" onClick={() => revokeMember(a, m.user_id, m.email)}>Revoke</button>
                </div>
              ))}
              {data.invites.length > 0 && (
                <>
                  <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "0.5rem" }}>Pending invites</p>
                  {data.invites.map((inv) => (
                    <div key={inv.invite_token} className={agentStyles.memberRow}>
                      <div className={agentStyles.memberWho}>
                        <div className={agentStyles.memberEmail}>{inv.invited_email || inv.invited_user_id}</div>
                        <div className={agentStyles.memberUserId}>{inv.role} · pending</div>
                      </div>
                      <button className="ghost" onClick={() => revokePendingInvite(a, inv.invite_token)}>Revoke invite</button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderEditSection = () => {
    if (!editForm) return null;
    const f = editForm.form;
    const setF = (patch: any) => setEditForm({ ...editForm, form: { ...f, ...patch } });
    const mcpBlocked = mcpNeedsTools(f.mcpServers, f.model);
    return (
      <div className={agentStyles.detailSection}>
        <div className={agentStyles.formGrid}>
          <label>Name<input value={f.name} onChange={(e) => setF({ name: e.target.value })} /></label>
          <label>Backing model
            <select value={f.model} onChange={(e) => setF({ model: e.target.value })}>
              {models.map((m) => <option key={m.id} value={m.id}>{modelOptionLabel(m)}</option>)}
            </select>
          </label>
          <label className={agentStyles.formFull}>Description
            <input value={f.description} onChange={(e) => setF({ description: e.target.value })} />
          </label>
          <label className={agentStyles.formFull}>System prompt
            <textarea rows={4} value={f.systemPrompt} placeholder="Leave blank to keep the current prompt" onChange={(e) => setF({ systemPrompt: e.target.value })} />
          </label>
          <label>Visibility
            <select value={f.visibility} onChange={(e) => setF({ visibility: e.target.value })}>
              <option value="private">Private (invite required)</option>
              <option value="public">Public (any signed-in user)</option>
            </select>
          </label>
          {f.visibility === "public" && (
            <label>Registry
              <select value={f.registry} onChange={(e) => setF({ registry: e.target.value })}>
                <option value="published">Published (listed in Discover)</option>
                <option value="unlisted">Unlisted (public, link only)</option>
              </select>
            </label>
          )}
          <label>Who pays
            <select value={f.payer} onChange={(e) => setF({ payer: e.target.value })}>
              <option value="caller">Caller pays per token</option>
              <option value="owner">Owner pays for every call</option>
            </select>
          </label>
          <div className={agentStyles.formFull}>
            <div className={agentStyles.subLabel}>MCP servers</div>
            <McpEditor servers={f.mcpServers} onChange={(servers) => setF({ mcpServers: servers })} />
            {mcpBlocked && (
              <div className={`${agentStyles.payerNote} ${agentStyles.payerNoteStrong}`} role="alert">
                {mcpToolWarning(f.model)}
              </div>
            )}
          </div>
        </div>
        <div className={`${agentStyles.payerNote} ${f.payer === "owner" ? agentStyles.payerNoteStrong : ""}`}>
          {f.payer === "owner"
            ? "You will be charged for every call to this agent at InferencePort's standard per-token rates. Callers never pay."
            : "Callers are charged per token at InferencePort's standard rates on every call to this agent."}
        </div>
        <div className={styles.row}>
          <button onClick={saveEdit} disabled={busy || mcpBlocked}>{busy ? "Saving…" : "Save changes"}</button>
          <button className="ghost" onClick={() => { setExpanded(null); setEditForm(null); }}>Cancel</button>
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      {inviteDialogNode}
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={agentStyles.headerRow}>
          <div>
            <div className={styles.heading}>InferencePort Agents</div>
            <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "0.25rem", maxWidth: "72ch" }}>
              Your own chatbots on InferencePort models — called through <code>/v1/chat/completions</code> with model id{" "}
              <code>agent/&lt;username&gt;/&lt;agent-id&gt;</code>.
            </p>
          </div>
          {profile.has_username && (
            <span className={agentStyles.usernamePill}>@{profile.username}</span>
          )}
        </div>

        {!profile.has_username && (
          <div className={agentStyles.usernameGate}>
            <span className={agentStyles.usernameMissing}>Set a username to publish agents</span>
            <input
              type="text"
              maxLength={30}
              placeholder="3–30 chars: lowercase, digits, - _"
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value)}
            />
            <button onClick={saveUsername} disabled={busy}>Save username</button>
          </div>
        )}

        <div className={agentStyles.settingsRow}>
          <input
            id="agents-include-in-models"
            type="checkbox"
            checked={settings.include_in_models}
            onChange={(e) => toggleIncludeInModels(e.target.checked)}
            disabled={busy}
          />
          <div>
            <label htmlFor="agents-include-in-models" className={agentStyles.settingsLabel}>Show my catalog agents in /v1/models</label>
            <div className={agentStyles.settingsHint}>
              Agents in your catalog appear in your authenticated <code>/v1/models</code> with <code>type: &quot;agent&quot;</code>,
              the backing model&apos;s publisher URL and pricing.
            </div>
          </div>
        </div>

        <div className={agentStyles.agentsTabs}>
          {([["mine", `My agents (${owned.length})`], ["create", "Create agent"], ["discover", `Discover (${registryAgents.length})`], ["catalog", `Catalog (${catalog.length})`], ["invites", `Invites (${invites.filter((i) => i.status === "pending").length})`]] as const).map(([id, label]) => (
            <button key={id} type="button" className={`${agentStyles.agentsTab} ${tab === id ? agentStyles.active : ""}`} onClick={() => { setTab(id); setExpanded(null); }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "mine" && (
          <div className={agentStyles.agentList}>
            {owned.length === 0 ? (
              <div className={styles.lockedOverlay}>No agents yet — create one from the Create agent tab.</div>
            ) : (
              owned.map((a) => {
                const [, agentId] = splitAgentId(a.id);
                const isOpen = expanded?.id === a.id;
                return (
                  <div key={a.id} className={agentStyles.agentRow}>
                    <div className={agentStyles.agentRowHead}>
                      <div className={agentStyles.agentRowTitle}>
                        <div className={agentStyles.agentName}>{a.name || agentId}</div>
                        <div className={agentStyles.agentModelId}>{a.id}</div>
                      </div>
                      <div className={agentStyles.agentBadges}>
                        {payerBadge(a)}
                        {registryBadge(a)}
                        {a.is_owner ? <span className={agentStyles.badge}>Owner</span> : a.role && <span className={agentStyles.badge}>{a.role}</span>}
                      </div>
                    </div>
                    {a.description && <p className={agentStyles.catalogDesc}>{a.description}</p>}
                    <p className={`${styles.muted} ${styles.tiny}`}>
                      <code>{a.backing_model}</code>
                      {(a.mcp_servers?.length || 0) > 0 ? ` · ${a.mcp_servers!.length} MCP` : ""}
                      {" · "}
                      {a.caller_pays ? "callers pay per token" : "you pay for every call"}
                    </p>
                    <div className={styles.row}>
                      <button className="ghost" onClick={() => copy(a.id, "model id")}>Copy id</button>
                      {can(a, "invite") && (
                        <button className="ghost" onClick={() => toggleExpand(a.id, "invite")}>
                          {isOpen && expanded!.kind === "invite" ? "Close" : "Invite"}
                        </button>
                      )}
                      {can(a, "manage_members") && (
                        <button className="ghost" onClick={() => toggleMembers(a)}>
                          {isOpen && expanded!.kind === "members" ? "Close" : "Members"}
                        </button>
                      )}
                      {can(a, "edit") && (
                        <button className="ghost" onClick={() => startEdit(a)}>
                          {isOpen && expanded!.kind === "edit" ? "Close" : "Edit"}
                        </button>
                      )}
                      {can(a, "delete") && <button className={styles.dangerBtn} onClick={() => deleteAgent(a)}>Delete</button>}
                    </div>
                    {isOpen && expanded!.kind === "invite" && renderInviteSection(a)}
                    {isOpen && expanded!.kind === "members" && renderMembersSection(a)}
                    {isOpen && expanded!.kind === "edit" && renderEditSection()}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "create" && (
          <div className={styles.stack}>
            {!profile.has_username && (
              <div className={`${agentStyles.payerNote} ${agentStyles.payerNoteStrong}`}>
                Set a username first — it is required to publish agents.
              </div>
            )}
            <div className={agentStyles.formGrid}>
              <label>Agent id
                <input maxLength={40} placeholder="support-bot" value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} />
              </label>
              <label>Name
                <input maxLength={80} placeholder="Support Bot" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className={agentStyles.formFull}>Description
                <input maxLength={500} placeholder="What does this agent do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label>Backing model
                <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
                  {models.length === 0 && <option value="">Loading models…</option>}
                  {models.map((m) => <option key={m.id} value={m.id}>{modelOptionLabel(m)}</option>)}
                </select>
              </label>
              <label>Visibility
                <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                  <option value="private">Private (invite required)</option>
                  <option value="public">Public (any signed-in user)</option>
                </select>
              </label>
              {form.visibility === "public" && (
                <label>Registry
                  <select value={form.registry} onChange={(e) => setForm({ ...form, registry: e.target.value })}>
                    <option value="published">Published (listed in Discover)</option>
                    <option value="unlisted">Unlisted (public, link only)</option>
                  </select>
                </label>
              )}
              <label className={agentStyles.formFull}>System prompt
                <textarea rows={5} placeholder="You are a helpful support agent…" value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} />
              </label>
              <label>Who pays
                <select value={form.payer} onChange={(e) => setForm({ ...form, payer: e.target.value })}>
                  <option value="caller">Caller pays per token</option>
                  <option value="owner">Owner pays for every call</option>
                </select>
              </label>
              <div className={agentStyles.formFull}>
                <div className={agentStyles.subLabel}>MCP servers (optional)</div>
                <McpEditor servers={form.mcpServers} onChange={(mcpServers) => setForm({ ...form, mcpServers })} />
                {createMcpBlocked && (
                  <div className={`${agentStyles.payerNote} ${agentStyles.payerNoteStrong}`} role="alert">
                    {mcpToolWarning(form.model)}
                  </div>
                )}
              </div>
            </div>
            <div className={`${agentStyles.payerNote} ${form.payer === "owner" ? agentStyles.payerNoteStrong : ""}`}>
              {form.payer === "owner"
                ? "You will be charged for every call to this agent at InferencePort's standard per-token rates. Callers never pay."
                : "Callers are charged per token at InferencePort's standard rates on every call to this agent."}
            </div>
            <div className={styles.row}>
              <button
                onClick={createAgent}
                disabled={busy || !profile.has_username || createMcpBlocked}
              >
                {busy ? "Creating…" : "Create agent"}
              </button>
            </div>
          </div>
        )}

        {tab === "discover" && (
          <div className={styles.stack}>
            <input
              placeholder="Search published agents…"
              value={discoverQuery}
              onChange={(e) => setDiscoverQuery(e.target.value)}
              style={{ maxWidth: "22rem" }}
            />
            <div className={agentStyles.catalogGrid}>
              {discovered.length === 0 ? (
                <div className={styles.lockedOverlay}>
                  {discoverQueryNorm
                    ? "No published agents match your search."
                    : "No published agents yet — public agents appear here once their owner publishes them to the registry."}
                </div>
              ) : (
                discovered.map((a) => (
                  <div key={a.id} className={agentStyles.catalogCard}>
                    <div className={agentStyles.agentName}>{a.name || a.id}</div>
                    <div className={agentStyles.agentModelId}>{a.id}</div>
                    {a.description && <p className={agentStyles.catalogDesc}>{a.description}</p>}
                    <div className={agentStyles.agentBadges}>
                      {payerBadge(a)}
                      <span className={`${agentStyles.badge} ${agentStyles.badgePublished}`}>Published</span>
                      {a.is_owner && <span className={agentStyles.badge}>Yours</span>}
                    </div>
                    <p className={`${styles.muted} ${styles.tiny}`}>
                      by @{a.owner_username || a.owned_by}
                      {(a.mcp_server_count || 0) > 0 ? ` · ${a.mcp_server_count} MCP` : ""}
                    </p>
                    <p className={`${styles.muted} ${styles.tiny}`}>
                      {a.caller_pays ? "Callers pay per token." : "Owner pays for every call."}
                    </p>
                    <div className={styles.row}>
                      <button className="ghost" onClick={() => copy(a.id, "model id")}>Copy id</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "catalog" && (
          <div className={agentStyles.catalogGrid}>
            {catalog.length === 0 ? (
              <div className={styles.lockedOverlay}>Your catalog is empty — accepted invites show up here.</div>
            ) : (
              catalog.map((a) => (
                <div key={a.id} className={agentStyles.catalogCard}>
                  <div className={agentStyles.agentName}>{a.name || a.id}</div>
                  <div className={agentStyles.agentModelId}>{a.id}</div>
                  {a.description && <p className={agentStyles.catalogDesc}>{a.description}</p>}
                  <div className={agentStyles.agentBadges}>
                    {payerBadge(a)}
                    {registryBadge(a)}
                    {a.role && <span className={agentStyles.badge}>{a.role}</span>}
                  </div>
                  <p className={`${styles.muted} ${styles.tiny}`}>
                    {a.caller_pays ? "You pay per token when you call this agent." : `@${a.owned_by} pays for every call.`}
                  </p>
                  <div className={styles.row}>
                    <button className="ghost" onClick={() => copy(a.id, "model id")}>Copy id</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "invites" && (
          <div className={agentStyles.agentList}>
            {invites.length === 0 ? (
              <div className={styles.lockedOverlay}>No invites — open an invite link someone shared with you to accept it here.</div>
            ) : (
              invites.map((inv) => (
                <div key={inv.invite_token} className={agentStyles.agentRow}>
                  <div className={agentStyles.agentRowHead}>
                    <div className={agentStyles.agentRowTitle}>
                      <div className={agentStyles.agentName}>{inv.agent_name || `${inv.owner_username}/${inv.agent_id}`}</div>
                      <div className={agentStyles.agentModelId}>agent/{inv.owner_username}/{inv.agent_id}</div>
                    </div>
                    <div className={agentStyles.agentBadges}>
                      <span className={`${agentStyles.badge} ${inv.payer === "owner" ? agentStyles.badgeOwnerPays : agentStyles.badgeCallerPays}`}>
                        {inv.payer === "owner" ? "Owner pays" : "Caller pays"}
                      </span>
                      <span className={agentStyles.badge}>{inv.role || "user"}</span>
                      <span className={`${agentStyles.badge} ${inv.status === "pending" ? "" : agentStyles.badgePrivate}`}>{inv.status}</span>
                    </div>
                  </div>
                  <p className={`${styles.muted} ${styles.tiny}`}>Invited to {inv.invited_email || "your account"}</p>
                  <div className={styles.row}>
                    {inv.status === "pending" && (
                      <>
                        <button onClick={() => respondFromList(inv.invite_token, "accept")} disabled={busy}>Accept</button>
                        <button className="ghost" onClick={() => respondFromList(inv.invite_token, "deny")} disabled={busy}>Deny</button>
                      </>
                    )}
                    <button className="ghost" onClick={() => copy(`agent/${inv.owner_username}/${inv.agent_id}`, "model id")}>Copy id</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "1.25rem" }} role="status">{status}</p>
      </section>
    </div>
  );
}
