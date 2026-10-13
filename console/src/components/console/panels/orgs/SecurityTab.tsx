"use client";

import { useCallback, useEffect, useState } from "react";
import panel from "../Panel.module.css";
import s from "./security.module.css";
import { useModal } from "../../../Modal";
import type { OrgApi, OrgDetail, OrgDomain } from "@/lib/orgs";
import SecuritySso from "./SecuritySso";
import {
  CopyField, DOMAIN_RE, ErrorNote, LockedNote, ReadOnlyNote, errMsg,
  isHttpsUrl, isIpOrCidr, splitLines,
} from "./SecurityWidgets";

interface Props { api: OrgApi; org: OrgDetail; onChanged: () => void }

const MAX_IP_ENTRIES = 100;

export default function SecurityTab({ api, org, onChanged }: Props) {
  const ent = org.entitlements;
  const [domains, setDomains] = useState<OrgDomain[] | null>(null);
  const [domainsError, setDomainsError] = useState<string | null>(null);

  const loadDomains = useCallback(async () => {
    setDomainsError(null);
    try {
      const r = await api.domains(org.slug);
      setDomains(r.domains);
    } catch (e) {
      setDomainsError(errMsg(e));
    }
  }, [api, org.slug]);

  useEffect(() => {
    if (ent.domain_verification) void loadDomains();
  }, [ent.domain_verification, loadDomains]);

  const verifiedDomains = domains ? domains.filter((d) => d.verified_at) : null;
  const canSecurity = org.caps.includes("security.manage");

  return (
    <div className={s.tab}>
      <DomainsCard api={api} org={org} onChanged={onChanged} domains={domains} error={domainsError} reload={loadDomains} />
      <SecuritySso api={api} org={org} onChanged={onChanged} verifiedDomains={verifiedDomains} />
      <IpAllowlistCard api={api} org={org} onChanged={onChanged} canSecurity={canSecurity} />
      <WebhookCard api={api} org={org} onChanged={onChanged} canSecurity={canSecurity} />
      <InviteRestrictionsCard api={api} org={org} onChanged={onChanged} canSecurity={canSecurity} />
    </div>
  );
}

/* Verified domains */

interface DomainsCardProps {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  domains: OrgDomain[] | null;
  error: string | null;
  reload: () => Promise<void>;
}

function DomainsCard({ api, org, onChanged, domains, error, reload }: DomainsCardProps) {
  const modal = useModal();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const canManage = org.caps.includes("domains.manage");
  const allowed = org.entitlements.domain_verification;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFormError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setFormError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const add = () => run(async () => {
    const value = draft.trim().toLowerCase();
    if (!DOMAIN_RE.test(value)) throw new Error("Enter a domain such as example.com.");
    await api.addDomain(org.slug, value);
    setDraft("");
    setInfo(`${value} added. Add the TXT record below, then verify.`);
    await reload();
    onChanged();
  });

  const verify = (d: OrgDomain) => run(async () => {
    const r = await api.verifyDomain(org.slug, d.id);
    setInfo(r.verified
      ? `${d.domain} is verified.`
      : "The TXT record was not found yet. DNS changes can take a few minutes to propagate.");
    await reload();
    if (r.verified) onChanged();
  });

  const remove = async (d: OrgDomain) => {
    const ok = await modal.confirm(
      `Remove ${d.domain} from this organization? Single sign-on for this domain may stop working.`,
      "Remove domain",
    );
    if (!ok) return;
    await run(async () => {
      await api.removeDomain(org.slug, d.id);
      await reload();
      onChanged();
    });
  };

  return (
    <section className={panel.card} aria-labelledby="sec-domains">
      <h2 id="sec-domains" className={`${panel.heading} ${s.sectionTitle}`}>Verified domains</h2>
      <p className={s.sectionIntro}>
        Prove you own a domain with a DNS TXT record. Verified domains are required for single sign-on
        and can be used for invite restrictions.
      </p>

      {!allowed ? (
        <LockedNote>
          <strong>Domain verification is not included in your current plan.</strong>
          <br />Upgrade in Billing to verify domains.
        </LockedNote>
      ) : (
        <div className={s.sectionCard}>
          {!canManage && <ReadOnlyNote cap="domains.manage" />}
          <ErrorNote message={error} />
          <ErrorNote message={formError} />
          {info && <div className={`${s.callout} ${s.calloutInfo}`} role="status">{info}</div>}

          {domains === null && !error ? (
            <div className={s.state} role="status"><span className={panel.spinner} aria-hidden="true" />Loading domains…</div>
          ) : domains && domains.length === 0 ? (
            <div className={panel.lockedOverlay} style={{ minHeight: 60 }}>No domains yet.</div>
          ) : (
            <div className={s.itemList}>
              {(domains ?? []).map((d) => {
                const verified = !!d.verified_at;
                return (
                  <div key={d.id} className={s.item}>
                    <div className={s.itemMain}>
                      <span className={s.itemTitle}>{d.domain}</span>
                      <span className={s.hint}>
                        {verified ? `Verified ${new Date(d.verified_at as string).toLocaleDateString()}` : "Pending verification"}
                      </span>
                      {!verified && (
                        <div className={s.dnsBox}>
                          <span className={s.hint}>Create this TXT record at your DNS provider:</span>
                          <CopyField label="TXT name" value={d.txt_name} />
                          <CopyField label="TXT value" value={d.txt_value} />
                        </div>
                      )}
                    </div>
                    <div className={s.itemActions}>
                      <span className={`${s.chip} ${verified ? s.chipOk : s.chipPending}`}>{verified ? "Verified" : "Pending"}</span>
                      {canManage && !verified && (
                        <button className="ghost" disabled={busy} onClick={() => void verify(d)}>Verify</button>
                      )}
                      {canManage && (
                        <button className="ghost danger" disabled={busy} onClick={() => void remove(d)} aria-label={`Remove ${d.domain}`}>Remove</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {canManage && (
            <div className={s.formRow}>
              <label className={`${s.field} ${s.fieldWide}`}>
                Add a domain
                <input type="text" inputMode="url" autoComplete="off" placeholder="example.com" value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} />
              </label>
              <button disabled={busy || !draft.trim()} onClick={() => void add()}>Add domain</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* IP allowlist */

function IpAllowlistCard({ api, org, onChanged, canSecurity }: { api: OrgApi; org: OrgDetail; onChanged: () => void; canSecurity: boolean }) {
  const allowed = org.entitlements.ip_allowlist;
  const seed = (org.settings.ip_allowlist ?? []).join("\n");
  const [text, setText] = useState(seed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => { setText(seed); }, [seed]);

  const save = async () => {
    const lines = splitLines(text);
    const bad = lines.filter((l) => !isIpOrCidr(l));
    setError(null);
    setInfo(null);
    if (bad.length > 0) {
      setError(`Not an IP address or CIDR range: ${bad.slice(0, 3).join(", ")}`);
      return;
    }
    if (lines.length > MAX_IP_ENTRIES) {
      setError(`At most ${MAX_IP_ENTRIES} entries are allowed.`);
      return;
    }
    setBusy(true);
    try {
      await api.update(org.slug, { settings: { ip_allowlist: lines } });
      setInfo(lines.length ? "IP allowlist saved." : "IP allowlist removed. Sign-in is allowed from any address.");
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={panel.card} aria-labelledby="sec-ip">
      <h2 id="sec-ip" className={`${panel.heading} ${s.sectionTitle}`}>IP allowlist</h2>
      <p className={s.sectionIntro}>One IP address or CIDR range per line, such as 203.0.113.0/24. Leave empty to allow all addresses.</p>
      {!allowed ? (
        <LockedNote>
          <strong>IP allowlists are available on the Team plan.</strong>
          <br />Upgrade in Billing to enable them for this organization.
        </LockedNote>
      ) : (
        <div className={s.sectionCard}>
          {!canSecurity && <ReadOnlyNote cap="security.manage" />}
          <div className={`${s.callout} ${s.calloutWarn}`}>
            The server refuses a list that excludes your current IP address, so you cannot lock yourself out.
          </div>
          <label className={s.field}>
            Allowed addresses
            <textarea rows={5} value={text} disabled={!canSecurity} spellCheck={false}
              onChange={(e) => setText(e.target.value)} placeholder={"203.0.113.0/24\n2001:db8::/32"} />
          </label>
          <ErrorNote message={error} />
          {info && <div className={`${s.callout} ${s.calloutSuccess}`} role="status">{info}</div>}
          {canSecurity && (
            <div className={s.actions}>
              <button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save allowlist"}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* Audit log streaming (webhook) */

function WebhookCard({ api, org, onChanged, canSecurity }: { api: OrgApi; org: OrgDetail; onChanged: () => void; canSecurity: boolean }) {
  const modal = useModal();
  const hook = org.settings.audit_webhook ?? null;
  const allowed = org.entitlements.audit_webhook;
  const [url, setUrl] = useState(hook?.url ?? "");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => { setUrl(hook?.url ?? ""); }, [hook?.url]);

  const save = async () => {
    setError(null);
    setInfo(null);
    if (!isHttpsUrl(url.trim())) {
      setError("Enter an https:// URL that the server can reach.");
      return;
    }
    setBusy(true);
    try {
      await api.setAuditWebhook(org.slug, secret ? { url: url.trim(), secret } : { url: url.trim() });
      setSecret("");
      setInfo("Audit streaming saved.");
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await modal.confirm("Audit events will stop being sent to this endpoint.", "Remove audit streaming?");
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await api.setAuditWebhook(org.slug, null);
      setUrl("");
      setSecret("");
      setInfo("Audit streaming removed.");
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={panel.card} aria-labelledby="sec-webhook">
      <h2 id="sec-webhook" className={`${panel.heading} ${s.sectionTitle}`}>Audit log streaming</h2>
      <p className={s.sectionIntro}>Send each audit event to your SIEM as a signed JSON POST (X-InferencePort-Signature).</p>
      {!allowed ? (
        <LockedNote>
          <strong>Audit log streaming is available on the Team plan.</strong>
          <br />Upgrade in Billing to enable it.
        </LockedNote>
      ) : (
        <div className={s.sectionCard}>
          {!canSecurity && <ReadOnlyNote cap="security.manage" />}
          <div className={s.kvItem}>
            <span className={s.kvLabel}>Status</span>
            <span>
              <span className={`${s.chip} ${hook ? s.chipOk : s.chipOff}`}>{hook ? "Streaming" : "Not configured"}</span>
              {hook && <span className={s.hint} style={{ marginLeft: "0.6rem" }}>Signing secret {hook.has_secret ? "is set" : "is not set"}</span>}
            </span>
          </div>
          <div className={s.formRow}>
            <label className={`${s.field} ${s.fieldWide}`}>
              Endpoint URL
              <input type="url" inputMode="url" placeholder="https://siem.example.com/hooks/inferenceport" value={url}
                disabled={!canSecurity} onChange={(e) => setUrl(e.target.value)} />
            </label>
          </div>
          <div className={s.formRow}>
            <label className={`${s.field} ${s.fieldWide}`}>
              Signing secret (optional)
              <input type="password" autoComplete="new-password" value={secret} disabled={!canSecurity}
                onChange={(e) => setSecret(e.target.value)} />
              <span className={s.hint}>Used to compute the HMAC signature. It is write-only and never shown again.</span>
            </label>
          </div>
          <ErrorNote message={error} />
          {info && <div className={`${s.callout} ${s.calloutSuccess}`} role="status">{info}</div>}
          {canSecurity && (
            <div className={s.actions}>
              <button disabled={busy || !url.trim()} onClick={() => void save()}>Save</button>
              {hook && <button className="ghost danger" disabled={busy} onClick={() => void remove()}>Remove streaming</button>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* Invite restrictions */

function InviteRestrictionsCard({ api, org, onChanged, canSecurity }: { api: OrgApi; org: OrgDetail; onChanged: () => void; canSecurity: boolean }) {
  const allowed = org.entitlements.invite_domain_restriction;
  const seed = (org.settings.allowed_invite_domains ?? []).join("\n");
  const [text, setText] = useState(seed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => { setText(seed); }, [seed]);

  const save = async () => {
    const lines = splitLines(text).map((l) => l.toLowerCase());
    const bad = lines.filter((l) => !DOMAIN_RE.test(l));
    setError(null);
    setInfo(null);
    if (bad.length > 0) {
      setError(`Not a valid domain: ${bad.slice(0, 3).join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      await api.update(org.slug, { settings: { allowed_invite_domains: [...new Set(lines)] } });
      setInfo(lines.length ? "Invite restrictions saved." : "Invite restrictions removed.");
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={panel.card} aria-labelledby="sec-invites">
      <h2 id="sec-invites" className={`${panel.heading} ${s.sectionTitle}`}>Invite restrictions</h2>
      <p className={s.sectionIntro}>Limit invitations to these email domains, one per line. Leave empty for no restriction.</p>
      {!allowed ? (
        <LockedNote>
          <strong>Invite domain restrictions are not included in your current plan.</strong>
          <br />Upgrade in Billing to restrict invitations.
        </LockedNote>
      ) : (
        <div className={s.sectionCard}>
          {!canSecurity && <ReadOnlyNote cap="security.manage" />}
          <label className={s.field}>
            Allowed invite domains
            <textarea rows={4} value={text} disabled={!canSecurity} spellCheck={false}
              onChange={(e) => setText(e.target.value)} placeholder={"example.com\npartner.org"} />
          </label>
          <ErrorNote message={error} />
          {info && <div className={`${s.callout} ${s.calloutSuccess}`} role="status">{info}</div>}
          {canSecurity && (
            <div className={s.actions}>
              <button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save restrictions"}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
