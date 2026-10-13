"use client";

import { useCallback, useEffect, useState } from "react";
import panel from "../Panel.module.css";
import s from "./security.module.css";
import { useModal } from "../../../Modal";
import type { OrgApi, OrgDetail, OrgDomain, OrgSso } from "@/lib/orgs";
// SAML SSO and enforced SSO are Team-plan features; gating always comes from org.entitlements.
import { CopyField, ErrorNote, LockedNote, ReadOnlyNote, errMsg, isHttpsUrl } from "./SecurityWidgets";

type SaveBody = Parameters<OrgApi["saveSso"]>[1];
type MetaMode = "url" | "xml";
type JitRole = OrgSso["jit_default_role"];

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  /** null while the domain list is still loading. */
  verifiedDomains: OrgDomain[] | null;
}

export default function SecuritySso({ api, org, onChanged, verifiedDomains }: Props) {
  const modal = useModal();
  const allowed = org.entitlements.sso_saml;
  const canSso = org.caps.includes("sso.manage");

  const [sso, setSso] = useState<OrgSso | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<MetaMode>("url");
  const [metaUrl, setMetaUrl] = useState("");
  const [metaXml, setMetaXml] = useState("");
  const [enforced, setEnforced] = useState(false);
  const [jit, setJit] = useState(false);
  const [jitRole, setJitRole] = useState<JitRole>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Draft fields are re-seeded from the server state whenever it is (re)loaded.
  const applyState = useCallback((next: OrgSso) => {
    setSso(next);
    setMetaUrl(next.idp_metadata_url ?? "");
    setMetaXml("");
    setEnforced(next.enforced);
    setJit(next.jit_provisioning);
    setJitRole(next.jit_default_role);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    api.sso(org.slug)
      .then((r) => { if (!cancelled) applyState(r.sso); })
      .catch((e: unknown) => { if (!cancelled) setLoadError(errMsg(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, org.slug, allowed, applyState]);

  if (!allowed) {
    return (
      <section className={panel.card} aria-labelledby="sec-sso">
        <h2 id="sec-sso" className={`${panel.heading} ${s.sectionTitle}`}>Single sign-on</h2>
        <LockedNote>
          <strong>Single sign-on is available on the Team plan.</strong>
          <br />Upgrade in Billing to enable it for this organization.
        </LockedNote>
      </section>
    );
  }

  const hasVerifiedDomain = (verifiedDomains?.length ?? 0) > 0;
  const configured = !!sso?.configured;

  const save = async () => {
    setError(null);
    setInfo(null);
    const url = metaUrl.trim();
    const xml = metaXml.trim();
    if (!configured && !url && !xml) {
      setError("Provide the identity provider metadata URL or XML.");
      return;
    }
    if (mode === "url" && url && !isHttpsUrl(url)) {
      setError("The metadata URL must start with https://.");
      return;
    }
    if (enforced && !sso?.enforced) {
      const ok = await modal.confirm(
        "Verified-domain members will have to sign in with SSO. The server only accepts this when your current session uses SSO.",
        "Require SSO for all members?",
      );
      if (!ok) return;
    }
    // Send exactly one metadata source, and only when one was entered.
    const body: SaveBody = { enforced, jit_provisioning: jit, jit_default_role: jitRole };
    if (mode === "url" && url) body.idp_metadata_url = url;
    if (mode === "xml" && xml) body.idp_metadata_xml = xml;

    setBusy(true);
    try {
      const r = await api.saveSso(org.slug, body);
      applyState(r.sso);
      setInfo("Single sign-on saved.");
      onChanged();
    } catch (e) {
      const msg = errMsg(e);
      // Lockout guard: owners may knowingly override when enforcing from a non-SSO session.
      if (body.enforced && org.role === "owner" && /sso/i.test(msg)) {
        const force = await modal.confirm(
          `${msg}

Enforcing SSO from a non-SSO session can lock members out if the identity provider is misconfigured. As owner you can still reach these settings to turn it off. Enable anyway?`,
          "Override lockout guard?",
        );
        if (force) {
          try {
            const r = await api.saveSso(org.slug, { ...body, force: true });
            applyState(r.sso);
            setInfo("Single sign-on saved.");
            onChanged();
            setBusy(false);
            return;
          } catch (e2) {
            setError(errMsg(e2));
            setBusy(false);
            return;
          }
        }
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await modal.confirm(
      "Members will sign in with their usual methods again. SSO for this organization's domains will stop working.",
      "Remove single sign-on?",
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.removeSso(org.slug);
      const r = await api.sso(org.slug);
      applyState(r.sso);
      setInfo("Single sign-on removed.");
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={panel.card} aria-labelledby="sec-sso">
      <h2 id="sec-sso" className={`${panel.heading} ${s.sectionTitle}`}>Single sign-on</h2>
      <p className={s.sectionIntro}>Let members of your verified domains sign in through your identity provider (SAML).</p>

      {loading ? (
        <div className={s.state} role="status"><span className={panel.spinner} aria-hidden="true" />Loading SSO settings…</div>
      ) : loadError ? (
        <ErrorNote message={loadError} />
      ) : (
        <div className={s.sectionCard}>
          {!canSso && <ReadOnlyNote cap="sso.manage" />}
          {verifiedDomains !== null && !hasVerifiedDomain && (
            <div className={`${s.callout} ${s.calloutWarn}`}>
              Verify a domain above before configuring SSO. SSO applies only to verified domains.
            </div>
          )}

          <div className={s.kvItem}>
            <span className={s.kvLabel}>Status</span>
            <span>
              <span className={`${s.chip} ${configured ? s.chipOk : s.chipOff}`}>{configured ? "Configured" : "Not configured"}</span>
              {sso?.enforced && <span className={s.hint} style={{ marginLeft: "0.6rem" }}>SSO required for members</span>}
            </span>
          </div>

          <div className={s.sectionCard}>
            <span className={s.kvLabel}>Service provider details (give these to your identity provider)</span>
            <CopyField label="ACS URL" value={sso?.sp.acs_url ?? ""} />
            <CopyField label="Entity ID" value={sso?.sp.entity_id ?? ""} />
            <CopyField label="Metadata URL" value={sso?.sp.metadata_url ?? ""} />
            {sso?.sp.sign_in_hint && <span className={s.hint}>{sso.sp.sign_in_hint}</span>}
          </div>

          <hr className={s.divider} />

          <div className={s.actions} role="group" aria-label="Identity provider metadata source">
            <button type="button" className={mode === "url" ? "" : "ghost"} aria-pressed={mode === "url"} onClick={() => setMode("url")} disabled={!canSso}>Metadata URL</button>
            <button type="button" className={mode === "xml" ? "" : "ghost"} aria-pressed={mode === "xml"} onClick={() => setMode("xml")} disabled={!canSso}>Metadata XML</button>
          </div>

          {mode === "url" ? (
            <label className={s.field}>
              Identity provider metadata URL
              <input type="url" inputMode="url" placeholder="https://idp.example.com/metadata" value={metaUrl}
                disabled={!canSso} onChange={(e) => setMetaUrl(e.target.value)} />
              {configured && <span className={s.hint}>Leave as is to keep the current metadata.</span>}
            </label>
          ) : (
            <label className={s.field}>
              Identity provider metadata XML
              <textarea rows={5} value={metaXml} disabled={!canSso} spellCheck={false}
                placeholder="<EntityDescriptor ...>" onChange={(e) => setMetaXml(e.target.value)} />
              {configured && <span className={s.hint}>Leave empty to keep the current metadata.</span>}
            </label>
          )}

          <label className={s.toggleRow}>
            <input type="checkbox" checked={jit} disabled={!canSso} onChange={(e) => setJit(e.target.checked)} />
            <span>
              Create accounts on first sign-in (just-in-time provisioning)
              <small>New users from a verified domain join this organization with the default role below.</small>
            </span>
          </label>
          <label className={s.field}>
            Default role for new members
            <select value={jitRole} disabled={!canSso || !jit} onChange={(e) => setJitRole(e.target.value as JitRole)}>
              <option value="member">Member</option>
              <option value="billing_manager">Billing manager</option>
              <option value="admin">Admin</option>
              {(org.entitlements.auditor_role || jitRole === "auditor") && <option value="auditor">Auditor (read-only)</option>}
            </select>
          </label>

          <label className={s.toggleRow}>
            <input type="checkbox" checked={enforced} disabled={!canSso || !org.entitlements.enforce_sso || !hasVerifiedDomain}
              onChange={(e) => setEnforced(e.target.checked)} />
            <span>
              Require SSO for all members
              <small>
                {org.entitlements.enforce_sso
                  ? "Members from verified domains must sign in with SSO. The server refuses this unless you are signed in with SSO, so you cannot lock yourself out."
                  : "Available on the Team plan."}
              </small>
            </span>
          </label>

          <ErrorNote message={error} />
          {info && <div className={`${s.callout} ${s.calloutSuccess}`} role="status">{info}</div>}

          {canSso && (
            <div className={s.actions}>
              <button disabled={busy || !hasVerifiedDomain} onClick={() => void save()}>{busy ? "Saving…" : "Save SSO"}</button>
              {configured && <button className="ghost danger" disabled={busy} onClick={() => void remove()}>Remove SSO</button>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
