"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./Panel.module.css";

interface Props { session: any; config: any; apiBase: string; supabase: any; }

function normalizeGrant(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const client = raw.client || raw.oauth_client || {};
  const grantId = raw.id || raw.grant_id || raw.grantId || null;
  const clientId = raw.client_id || raw.clientId || raw.oauth_client_id || client.id || client.client_id || null;
  const name = raw.client_name || raw.clientName || raw.app_name || client.name || client.client_name || "Unnamed application";
  const domain = raw.app_domain || raw.website || raw.homepage_url || client.homepage_url || client.website || "";
  const iconUrl = raw.app_icon || raw.logo_uri || raw.icon_url || client.logo_uri || client.icon_url || "";
  let scopes = raw.scopes || raw.granted_scopes || client.scopes;
  if (typeof scopes === "string") scopes = scopes.split(/\s+/).filter(Boolean);
  if (!Array.isArray(scopes)) scopes = [];
  const createdAt = raw.created_at || raw.createdAt || raw.authorized_at || raw.granted_at || "";
  if (!clientId && !grantId) return null;
  return { grantId, clientId, name, domain, iconUrl, scopes, createdAt };
}

function extractGrantsArray(data: any) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.grants)) return data.grants;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

const OAUTH_SCOPE_LABELS: Record<string, string> = {
  openid: "OpenID",
  profile: "Profile",
  email: "Email address",
  phone: "Phone number",
  "p2g:deduct": "P2G balance deduction",
  "gen:subscription": "Gen (Subscription) API Deduction",
};

const BILLING_SCOPES = ["p2g:deduct", "gen:subscription"];

function humanizeScope(scope: string) {
  return OAUTH_SCOPE_LABELS[scope] || scope;
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function AuthorizedAppsPanel({ session, config, apiBase, supabase }: Props) {
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<any>(null);
  const [usingRpcFallback, setUsingRpcFallback] = useState(false);

  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };
  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });

  const load = useCallback(async () => {
    if (!session?.access_token || !supabase) return;
    setLoading(true);
    setError("");
    try {
      if (supabase.auth?.oauth?.listGrants) {
        setUsingRpcFallback(false);
        const { data, error: err } = await supabase.auth.oauth.listGrants();
        if (err) throw err;
        setGrants(extractGrantsArray(data).map(normalizeGrant).filter(Boolean));
      } else {
        setUsingRpcFallback(true);
        const { data, error: err } = await supabase.rpc("get_oauth_user_grants");
        if (err) throw err;
        setGrants(extractGrantsArray(data).map(normalizeGrant).filter(Boolean));
      }
    } catch (e: any) {
      const hint = !supabase.auth?.oauth?.listGrants
        ? " (supabase.auth.oauth.listGrants not available - see code comments for RPC fallback setup)"
        : "";
      setError((e?.message || "Could not load authorized applications.") + hint);
    }
    setLoading(false);
  }, [session, supabase]);

  useEffect(() => { load(); }, [load]);

  const revokeGrant = async (grant: any) => {
    try {
      if (!usingRpcFallback && supabase?.auth?.oauth?.revokeGrant) {
        const attempts = [
          () => supabase.auth.oauth.revokeGrant({ clientId: grant.clientId }),
          () => supabase.auth.oauth.revokeGrant({ client_id: grant.clientId }),
          () => supabase.auth.oauth.revokeGrant(grant.clientId),
          () => supabase.auth.oauth.revokeGrant({ grantId: grant.grantId }),
          () => supabase.auth.oauth.revokeGrant({ grant_id: grant.grantId }),
        ].filter((_, idx) => idx <= 2 ? !!grant.clientId : !!grant.grantId);

        let lastError: any = null;
        let succeeded = false;
        for (const attempt of attempts) {
          try {
            const result = await attempt();
            if (result?.error) { lastError = result.error; continue; }
            succeeded = true;
            break;
          } catch (e) { lastError = e; }
        }
        if (!succeeded) throw lastError || new Error("Could not revoke access");
      } else {
        if (!grant.clientId) throw new Error("Missing client ID for this grant.");
        await supabase.rpc("revoke_oauth_grant", { p_client_id: grant.clientId });
      }
      setGrants((prev) => prev.filter((g) =>
        !((grant.clientId && g.clientId === grant.clientId) || (grant.grantId && g.grantId === grant.grantId))
      ));
    } catch (e: any) {
      alert(e?.message || "Could not revoke access. Please try again.");
    }
    setRevokeTarget(null);
  };

  const term = search.trim().toLowerCase();
  const filtered = grants
    .filter((g) => !term || g.name.toLowerCase().includes(term))
    .sort((a, b) => {
      const pa = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const pb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return pb - pa;
    });

  if (!session) return <div className={`${styles.panel} ${styles.active}`}><div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to view applications you&apos;ve authorized.</div></div>;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2>Authorized Applications</h2>
        <div className={styles.oauthWarning}><span className={styles.oauthWarningIcon} aria-hidden="true">&#9888;&#65039;</span><p>Applications with access to your account can act according to the permissions you&apos;ve granted. Revoke access for apps you no longer trust.</p></div>
        <div className={styles.oauthToolbar}><input type="search" placeholder="Search authorized applications..." aria-label="Search authorized applications" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 340 }} /></div>

        {loading && <div className={styles.oauthStateBlock}><div className={styles.spinner} /><p className={`${styles.muted} ${styles.tiny}`}>Loading authorized applications&hellip;</p></div>}
        {error && <div className={`${styles.card} ${styles.oauthErrorCard}`}><h3 style={{ marginTop: 0 }}>Couldn&apos;t load authorized applications</h3><p className={`${styles.muted} ${styles.tiny}`}>{error}</p><button className="ghost" onClick={load}>Try again</button></div>}
        {!loading && !error && grants.length === 0 && <div className={styles.oauthStateBlock}><div className={styles.oauthEmptyIcon} aria-hidden="true">&#128279;</div><p>You haven&apos;t authorized any applications yet.</p><p className={`${styles.muted} ${styles.tiny}`}>When you sign in to a third-party app using your account, it will show up here.</p></div>}

        <div className={styles.oauthGrantsList}>
          {!loading && !error && grants.length > 0 && filtered.length === 0 && <p className={`${styles.muted} ${styles.tiny}`}>No applications match &quot;{search}&quot;.</p>}
          {filtered.map((grant) => (
            <div key={grant.clientId || grant.grantId} className={styles.oauthGrantCard}>
              <div className={styles.oauthGrantHead}>
                {grant.iconUrl ? (
                  <img className={styles.oauthGrantIcon} src={grant.iconUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className={styles.oauthGrantIcon}>{grant.name?.[0]?.toUpperCase() || "?"}</div>
                )}
                <div className={styles.oauthGrantInfo}>
                  <div className={styles.oauthGrantName}>{grant.name}</div>
                  {grant.domain && <div className={styles.oauthGrantDomain}>{grant.domain}</div>}
                  <div className={styles.oauthGrantDate}>Authorized {formatDateTime(grant.createdAt)}</div>
                </div>
              </div>
              <div className={styles.oauthScopeList}>
                {grant.scopes.length > 0 ? grant.scopes.map((s: string, i: number) => <span key={i} className={styles.oauthScopeChip}>{humanizeScope(s)}</span>) : <span className={`${styles.muted} ${styles.tiny}`}>No scopes reported</span>}
                {BILLING_SCOPES.filter((s) => !grant.scopes.includes(s)).map((s) => <span key={s} className={styles.oauthScopeChip}>{humanizeScope(s)}</span>)}
              </div>
              <div className={styles.oauthGrantFooter}>
                <details className="oauth-advanced-details">
                  <summary>Advanced Details</summary>
                  <div style={{ padding: "0.5rem 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                    <div style={{ marginBottom: 4 }}><strong>Client ID:</strong> {grant.clientId || "\u2014"}</div>
                    <div><strong>Grant ID:</strong> {grant.grantId || "\u2014"}</div>
                  </div>
                </details>
                <button type="button" className={styles.dangerBtn} onClick={() => setRevokeTarget(grant)}>Revoke Access</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {revokeTarget && (
        <div className={styles.oauthModalOverlay} role="dialog" aria-modal="true" aria-labelledby="oauth-revoke-modal-title" onClick={(e) => { if (e.target === e.currentTarget) setRevokeTarget(null); }}>
          <div className={`${styles.oauthModal} ${styles.card}`}>
            <h3 id="oauth-revoke-modal-title" style={{ marginTop: 0, marginBottom: "0.5rem" }}>Revoke access?</h3>
            <p className={`${styles.muted} ${styles.tiny}`}>Revoking access will immediately invalidate this application&apos;s authorization. It will no longer be able to act on your behalf, and it may lose access to any data or features it was granted.</p>
            <div className={styles.row} style={{ justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button className="ghost" onClick={() => setRevokeTarget(null)}>Cancel</button>
              <button className={styles.dangerBtn} onClick={() => revokeGrant(revokeTarget)}>Revoke Access</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
