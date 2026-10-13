"use client";

/* Personal-mode landing page for organizations: my organizations (click = work in that org), create, plans and invitations.
   Everything inside one organization lives in OrgWorkspace; this page never shows org detail tabs. */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import styles from "./Panel.module.css";
import local from "./OrganizationsPanel.module.css";
import shared from "./orgs/orgs.module.css";
import { Badge, Callout, PLAN_LABELS, errorText } from "./orgs/shared";
import PlansModal from "./orgs/PlansModal";
import { useOrgContext } from "../OrgContext";
import { navigateConsole } from "../ContextSwitcher";
import { ROLE_LABELS, type OrgInvitationPreview, type OrgSummary } from "../../../lib/orgs";

interface Props {
  session: Session | null;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,37}[a-z0-9]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InviteState =
  | { kind: "loading"; token: string }
  | { kind: "preview"; token: string; data: OrgInvitationPreview }
  | { kind: "error"; message: string };

export default function OrganizationsPanel({ session }: Props) {
  const { api, activeOrg, activeSlug, setActiveSlug, refresh } = useOrgContext();
  const signedIn = !!session?.access_token;

  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);

  const [form, setForm] = useState({ slug: "", name: "", billing: "" });
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [invite, setInvite] = useState<InviteState | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    try {
      const { orgs: list } = await api.list();
      setOrgs(list);
      setListError(null);
    } catch (e) {
      setListError(errorText(e));
    }
  }, [api]);

  useEffect(() => {
    if (!signedIn) {
      setOrgs(null);
      return;
    }
    void loadOrgs();
  }, [signedIn, loadOrgs]);

  /* Switch into an organization and land on its Overview. Context is set first so the new section sees the org. */
  const openOrg = (slug: string) => {
    setActiveSlug(slug);
    navigateConsole("org-overview");
  };

  /* ---- Create organization ---- */
  const createOrg = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const slug = form.slug.trim().toLowerCase();
    const name = form.name.trim();
    const billing = form.billing.trim();
    if (!SLUG_RE.test(slug)) {
      return setCreateError("Slug must be 3-39 characters: lowercase letters, numbers and hyphens, starting and ending with a letter or number.");
    }
    if (!name) return setCreateError("Enter an organization name.");
    if (billing && !EMAIL_RE.test(billing)) return setCreateError("Enter a valid billing email, or leave it empty.");
    setCreateBusy(true);
    setCreateError(null);
    try {
      const { org } = await api.create({ slug, name, ...(billing ? { billing_email: billing } : {}) });
      setForm({ slug: "", name: "", billing: "" });
      await Promise.all([loadOrgs(), refresh()]);
      openOrg(org.slug);
    } catch (err) {
      setCreateError(errorText(err));
    } finally {
      setCreateBusy(false);
    }
  };

  /* ---- Invitation links: ?org_invite=TOKEN ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("org_invite");
    if (!inviteToken) return;
    params.delete("org_invite");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    setInvite({ kind: "loading", token: inviteToken });
    setInviteError(null);
    api
      .previewInvitation(inviteToken)
      .then((data) => setInvite({ kind: "preview", token: inviteToken, data }))
      .catch((e) => setInvite({ kind: "error", message: errorText(e) }));
  }, [api]);

  const acceptInvite = async (inviteToken: string) => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      const { org } = await api.acceptInvitation(inviteToken);
      setInvite(null);
      await Promise.all([loadOrgs(), refresh()]);
      openOrg(org.slug);
    } catch (e) {
      setInviteError(errorText(e));
    } finally {
      setInviteBusy(false);
    }
  };

  const closeInvite = () => {
    setInvite(null);
    setInviteError(null);
  };

  useEffect(() => {
    if (!invite) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !inviteBusy) closeInvite(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [invite, inviteBusy]);

  const inviteDialog = invite && (
    <div className={shared.overlay} role="presentation">
      <div className={shared.dialog} role="dialog" aria-modal="true" aria-labelledby="org-invite-title">
        <h2 id="org-invite-title" className={shared.dialogTitle}>Organization invitation</h2>
        {invite.kind === "loading" && <p className={shared.dialogBody}>Checking invitation…</p>}
        {invite.kind === "error" && <Callout tone="error">{invite.message}</Callout>}
        {invite.kind === "preview" && (
          <>
            <dl className={shared.dl}>
              <dt>Organization</dt>
              <dd>{invite.data.org_name} <span className={styles.muted}>({invite.data.org_slug})</span></dd>
              <dt>Role</dt>
              <dd>{ROLE_LABELS[invite.data.role as keyof typeof ROLE_LABELS] ?? invite.data.role}</dd>
              <dt>Invited email</dt>
              <dd>{invite.data.email}</dd>
              <dt>Expires</dt>
              <dd>{new Date(invite.data.expires_at).toLocaleString()}</dd>
            </dl>
            {signedIn ? (
              <p className={shared.dialogBody}>Accepting adds you to this organization with the role above. You will switch into it.</p>
            ) : (
              <Callout tone="info">
                Sign in as <strong>{invite.data.email}</strong> to accept this invitation. Then open the invite link again.
              </Callout>
            )}
            {inviteError && <Callout tone="error">{inviteError}</Callout>}
          </>
        )}
        <div className={shared.dialogActions}>
          {invite.kind === "preview" && signedIn && (
            <button type="button" onClick={() => acceptInvite(invite.token)} disabled={inviteBusy}>
              {inviteBusy ? "Accepting…" : "Accept"}
            </button>
          )}
          <button type="button" className="ghost" onClick={closeInvite} disabled={inviteBusy}>
            {invite.kind === "preview" && signedIn ? "Decline" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!signedIn) {
    return (
      <div className={`${styles.panel} ${styles.active}`}>
        <div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to create and manage organizations.</div>
        {inviteDialog}
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Organizations</div>
        <p className={`${styles.muted} ${styles.tiny}`}>
          Share agents, API keys and wallet credits with your team. Choose an organization to work in it: the playground,
          models and agents then bill to that organization.
        </p>
        {listError && (
          <Callout tone="error">
            {listError}
            <div className={shared.copyRow}>
              <button type="button" className="ghost" onClick={loadOrgs}>Try again</button>
            </div>
          </Callout>
        )}
        {!orgs && !listError && <p className={styles.muted}>Loading organizations…</p>}
        {orgs && orgs.length === 0 && (
          <div className={styles.lockedOverlay}>You are not in any organization yet. Create one below.</div>
        )}
        {orgs && orgs.length > 0 && (
          <ul className={local.orgList}>
            {orgs.map((o) => {
              const current = o.slug === activeSlug;
              return (
                <li key={o.id}>
                  <button type="button" className={local.orgButton} onClick={() => openOrg(o.slug)} aria-label={`Open ${o.name}`}>
                    <span className={local.orgMain}>
                      <span className={local.orgName}>{o.name}</span>
                      <span className={local.orgSlug}>{o.slug} · {o.member_count} member{o.member_count === 1 ? "" : "s"}</span>
                    </span>
                    <span className={local.orgMeta}>
                      {current && <Badge tone="ok">Working in</Badge>}
                      <Badge tone="brand">{PLAN_LABELS[o.effective_plan]}</Badge>
                      <Badge>{ROLE_LABELS[o.role]}</Badge>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Plans</div>
        <div className={local.plansRow}>
          <p className={`${styles.muted} ${styles.tiny}`}>
            Free, Starter ($7.99 per seat per month) and Team ($20 per seat per month). Seats follow your member list automatically.
          </p>
          <button type="button" className="ghost" onClick={() => setPlansOpen(true)}>Compare plans</button>
        </div>
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Create organization</div>
        <form onSubmit={createOrg} className={local.createForm}>
          <div className={shared.formGrid}>
            <label className={shared.field}>
              Slug
              <input
                required
                maxLength={39}
                placeholder="acme-labs"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                aria-describedby="org-slug-hint"
              />
            </label>
            <label className={shared.field}>
              Name
              <input required maxLength={80} placeholder="Acme Labs" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className={shared.field}>
              Billing email (optional)
              <input
                type="email"
                maxLength={254}
                value={form.billing}
                onChange={(e) => setForm({ ...form, billing: e.target.value })}
                aria-describedby="org-billing-hint"
              />
            </label>
          </div>
          <p id="org-slug-hint" className={`${styles.muted} ${styles.tiny}`}>
            The slug is the organization's address and cannot contain spaces or capitals.
          </p>
          <p id="org-billing-hint" className={`${styles.muted} ${styles.tiny}`}>
            Invoices and billing alerts go here. It can be any address; it does not change who owns the organization.
          </p>
          {createError && <Callout tone="error">{createError}</Callout>}
          <div className={shared.formRow}>
            <button type="submit" disabled={createBusy}>{createBusy ? "Creating…" : "Create organization"}</button>
          </div>
        </form>
      </section>

      {plansOpen && (
        <PlansModal api={api} currentPlan={activeOrg?.effective_plan ?? "free"} onClose={() => setPlansOpen(false)} />
      )}
      {inviteDialog}
    </div>
  );
}
