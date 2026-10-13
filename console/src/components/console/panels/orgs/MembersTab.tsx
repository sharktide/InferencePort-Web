"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../Panel.module.css";
import shared from "./orgs.module.css";
import manage from "./manage.module.css";
import { useModal } from "../../../Modal";
import {
  ROLE_LABELS,
  type AssignableRole,
  type Entitlements,
  type MemberLimitsInput,
  type OrgApi,
  type OrgDetail,
  type OrgInvitation,
  type OrgMember,
  type OrgRole,
  type OrgTeam,
} from "../../../../lib/orgs";
import { Badge, Callout, Locked, assignableRoles, canManageMember, errorText, formatDate } from "./shared";
import LimitsEditor, { draftFrom, emptyDraft, fmtCredits, memberName, parseDraft, planHint, type FieldKey, type LimitsDraft, type LockMap } from "./LimitsEditor";
import InviteForm from "./InviteForm";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  userId?: string;
}

type Notice = { tone: "ok" | "error" | "warn"; text: string } | null;

const SOURCE_LABELS: Record<OrgMember["source"], string> = {
  creator: "Creator",
  invite: "Invited",
  sso_jit: "SSO",
  admin: "Added by staff",
};

/** Caller-assignable roles, including auditor (shown disabled when the plan does not include it). */
export function rolesFor(callerRole: OrgRole): AssignableRole[] {
  const base = assignableRoles(callerRole);
  if (base.length === 0) return [];
  const order: AssignableRole[] = ["admin", "billing_manager", "auditor", "member"];
  return order.filter((r) => r === "auditor" || base.includes(r));
}

/** Lock map for the member limits editor, derived from entitlements. */
function memberLocks(ent: Entitlements): LockMap {
  const locks: LockMap = {};
  if (!ent.member_budgets) locks.budget = planHint("member_budgets");
  if (!ent.model_policy) {
    locks.models = planHint("model_policy");
    locks.modalities = planHint("model_policy");
  }
  return locks;
}

export default function MembersTab({ api, org, onChanged, userId }: Props) {
  const modal = useModal();
  const has = (cap: string) => org.caps.includes(cap);
  const ent = org.entitlements;
  const canInvite = has("members.invite");
  const canRemove = has("members.remove");
  const canSetRole = has("members.set_role");
  const canLimits = has("members.limits");
  const roles = rolesFor(org.role);

  const [members, setMembers] = useState<OrgMember[] | null>(null);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [teams, setTeams] = useState<OrgTeam[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrgMember | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.members(org.slug);
      const invited = canInvite ? await api.invitations(org.slug) : { invitations: [] as OrgInvitation[] };
      const teamList = canInvite && org.counts.teams > 0 ? await api.teams(org.slug) : { teams: [] as OrgTeam[] };
      setMembers(list.members);
      setInvitations(invited.invitations);
      setTeams(teamList.teams);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [api, org.slug, org.counts.teams, canInvite]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, run: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    setNotice(null);
    try {
      await run();
      setNotice({ tone: "ok", text: success });
      await load();
      onChanged();
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = (m: OrgMember, role: AssignableRole) => {
    if (role === m.role) return;
    act(m.user_id, () => api.setMemberRole(org.slug, m.user_id, role), `Updated ${memberName(m)} to ${ROLE_LABELS[role]}.`);
  };

  const suspend = async (m: OrgMember) => {
    const ok = await modal.confirm(
      `Suspend ${memberName(m)}? They cannot spend organization credits or use organization API keys until they are unsuspended.`,
      "Suspend member",
    );
    if (ok) act(m.user_id, () => api.suspendMember(org.slug, m.user_id), `Suspended ${memberName(m)}.`);
  };

  const unsuspend = (m: OrgMember) =>
    act(m.user_id, () => api.unsuspendMember(org.slug, m.user_id), `Unsuspended ${memberName(m)}.`);

  const removeMember = async (m: OrgMember) => {
    const ok = await modal.confirm(
      `Remove ${memberName(m)} from ${org.name}? Their organization API keys will be revoked.`,
      "Remove member",
    );
    if (ok) act(m.user_id, () => api.removeMember(org.slug, m.user_id), `Removed ${memberName(m)}.`);
  };

  const revokeInvite = async (inv: OrgInvitation) => {
    const ok = await modal.confirm(`Revoke the invitation for ${inv.email}? Its link will stop working.`, "Revoke invitation");
    if (ok) act(inv.id, () => api.revokeInvitation(org.slug, inv.id), `Revoked the invitation for ${inv.email}.`);
  };

  const resendInvite = async (inv: OrgInvitation) => {
    setBusyId(inv.id);
    setNotice(null);
    try {
      const res = await api.resendInvitation(org.slug, inv.id);
      if (!res.email_sent) {
        try { await navigator.clipboard.writeText(res.invite_url); } catch { /* clipboard unavailable */ }
      }
      setNotice(
        res.email_sent
          ? { tone: "ok", text: `Emailed a new invitation link to ${inv.email}. The previous link no longer works.` }
          : {
              tone: "warn",
              text: `The invitation was renewed but the email to ${inv.email} could not be sent (the previous link no longer works). Share this new link with them: ${res.invite_url}`,
            },
      );
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusyId(null);
    }
  };

  const pending = invitations.length;
  const used = org.counts.members + pending;
  const cap = org.seat_cap;
  const full = cap !== null && used >= cap;
  const upgradeHint =
    org.effective_plan === "free"
      ? "Upgrade to the Team plan to add more seats."
      : org.effective_plan === "team"
        ? "Ask a billing manager to add seats."
        : "Contact sales to raise your seat limit.";
  const limitsLocked = !ent.member_budgets && !ent.model_policy;

  return (
    <div className={styles.stack}>
      <div className={shared.sectionHead}>
        <span className={shared.sectionTitle}>Members</span>
        <span className={`${styles.muted} ${styles.tiny}`}>
          Seats used: {used}{cap !== null ? ` of ${cap}` : ""} ({org.counts.members} members, {pending} pending)
        </span>
      </div>

      {loadError && <Callout tone="error">{loadError}</Callout>}
      {notice && <Callout tone={notice.tone}>{notice.text}</Callout>}
      {limitsLocked && (
        <p className={manage.planNote}>Per-member budgets and model limits: {planHint("member_budgets")}</p>
      )}
      {!members && !loadError && <p className={styles.muted}>Loading members…</p>}

      {members && members.length === 0 && <p className={styles.muted}>No members yet.</p>}
      {members && members.length > 0 && (
        <div className={shared.tableWrap}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Spend this month</th>
                <th scope="col">Source</th>
                <th scope="col">Joined</th>
                <th scope="col"><span className={shared.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const manageable = canManageMember(org.role, m, userId ?? null);
                const options = Array.from(new Set<string>([m.role, ...roles])).filter((r) => r !== "owner");
                const overBudget = m.monthly_credit_limit != null && m.month_spend >= m.monthly_credit_limit;
                return (
                  <tr key={m.user_id}>
                    <td className={shared.wrapAnywhere}>
                      {memberName(m)}{" "}
                      {m.user_id === userId && <Badge tone="brand">You</Badge>}
                    </td>
                    <td>
                      {canSetRole && manageable ? (
                        <select
                          aria-label={`Role for ${memberName(m)}`}
                          value={m.role}
                          disabled={busyId === m.user_id}
                          onChange={(e) => changeRole(m, e.target.value as AssignableRole)}
                        >
                          {options.map((r) => {
                            const locked = r === "auditor" && !ent.auditor_role && m.role !== "auditor";
                            return (
                              <option key={r} value={r} disabled={locked}>
                                {ROLE_LABELS[r as OrgRole]}{locked ? " (Team plan)" : ""}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{ROLE_LABELS[m.role]}</Badge>
                      )}
                    </td>
                    <td>
                      {m.suspended_at ? (
                        <span className={`${manage.chip} ${manage.chipCrit}`} title={formatDate(m.suspended_at, true)}>Suspended</span>
                      ) : (
                        <span className={`${manage.chip} ${manage.chipOk}`}>Active</span>
                      )}
                    </td>
                    <td>
                      <div className={manage.progress}>
                        <span>
                          {fmtCredits(m.month_spend)} / {m.monthly_credit_limit != null ? fmtCredits(m.monthly_credit_limit) : "no limit"}
                        </span>
                        {overBudget && <span className={`${manage.chip} ${manage.chipWarn}`}>At limit</span>}
                      </div>
                    </td>
                    <td><Badge>{SOURCE_LABELS[m.source] ?? m.source}</Badge></td>
                    <td>{formatDate(m.created_at)}</td>
                    <td className="actions">
                      <div className={manage.rowActions}>
                        {canLimits && manageable && (
                          <button
                            type="button"
                            className="ghost"
                            disabled={busyId === m.user_id}
                            aria-label={`Edit limits for ${memberName(m)}`}
                            onClick={() => setEditing(m)}
                          >
                            Limits
                          </button>
                        )}
                        {canLimits && manageable && m.suspended_at && (
                          <button
                            type="button"
                            className="ghost"
                            disabled={busyId === m.user_id}
                            aria-label={`Unsuspend ${memberName(m)}`}
                            onClick={() => unsuspend(m)}
                          >
                            Unsuspend
                          </button>
                        )}
                        {canLimits && manageable && !m.suspended_at && (
                          <button
                            type="button"
                            className="ghost"
                            disabled={busyId === m.user_id || !ent.member_suspension}
                            title={ent.member_suspension ? undefined : planHint("member_suspension")}
                            aria-label={`Suspend ${memberName(m)}`}
                            onClick={() => suspend(m)}
                          >
                            Suspend
                          </button>
                        )}
                        {canRemove && manageable && (
                          <button
                            type="button"
                            className={shared.danger}
                            disabled={busyId === m.user_id}
                            aria-label={`Remove ${memberName(m)}`}
                            onClick={() => removeMember(m)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {canLimits && manageable && !m.suspended_at && !ent.member_suspension && (
                        <span className={manage.hintText}>Suspend: {planHint("member_suspension")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {members && (
        <p className={`${styles.muted} ${styles.tiny}`}>
          Ownership changes only through Transfer ownership on the Overview tab.
        </p>
      )}

      {canInvite ? (
        <>
          <div className={shared.sectionHead}>
            <span className={shared.sectionTitle}>Invite member</span>
          </div>
          {full ? (
            <Locked>
              Seat limit reached ({used} of {cap}). {upgradeHint}
            </Locked>
          ) : (
            <InviteForm
              api={api}
              org={org}
              teams={teams}
              roles={roles}
              onInvited={() => { load(); onChanged(); }}
            />
          )}

          {invitations.length > 0 && (
            <>
              <div className={shared.sectionHead}>
                <span className={shared.sectionTitle}>Pending invitations</span>
              </div>
              <div className={shared.tableWrap}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Invited by</th>
                      <th scope="col">Expires</th>
                      <th scope="col"><span className={shared.srOnly}>Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id}>
                        <td className={shared.wrapAnywhere}>{inv.email}</td>
                        <td>{ROLE_LABELS[inv.role]}</td>
                        <td className={shared.wrapAnywhere}>{inv.invited_by_email ?? "—"}</td>
                        <td>{formatDate(inv.expires_at)}</td>
                        <td className="actions">
                          <div className={manage.rowActions}>
                            <button
                              type="button"
                              className="ghost"
                              disabled={busyId === inv.id}
                              aria-label={`Resend invitation to ${inv.email}`}
                              onClick={() => resendInvite(inv)}
                            >
                              Resend
                            </button>
                            <button
                              type="button"
                              className={shared.danger}
                              disabled={busyId === inv.id}
                              aria-label={`Revoke invitation for ${inv.email}`}
                              onClick={() => revokeInvite(inv)}
                            >
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={`${styles.muted} ${styles.tiny}`}>Resending issues a new link and emails it. The old link stops working.</p>
            </>
          )}
        </>
      ) : (
        <p className={`${styles.muted} ${styles.tiny}`}>Your role cannot invite members.</p>
      )}

      {editing && (
        <LimitsDialog
          api={api}
          org={org}
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            setNotice({ tone: "ok", text: `Saved limits for ${name}.` });
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function LimitsDialog({
  api,
  org,
  member,
  onClose,
  onSaved,
}: {
  api: OrgApi;
  org: OrgDetail;
  member: OrgMember;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const locks = memberLocks(org.entitlements);
  const [draft, setDraft] = useState<LimitsDraft>(() =>
    draftFrom({
      monthly_credit_limit: member.monthly_credit_limit,
      allowed_models: member.allowed_models,
      allowed_modalities: member.allowed_modalities,
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editable: FieldKey[] = (["budget", "models", "modalities"] as FieldKey[]).filter((f) => !locks[f]);
  const fields: FieldKey[] = ["budget", "models", "modalities"];

  const save = async () => {
    const res = parseDraft(draft, editable);
    if ("error" in res) return setError(res.error);
    const body: MemberLimitsInput = {};
    if (editable.includes("budget")) body.monthly_credit_limit = res.value.monthly_credit_limit;
    if (editable.includes("models")) body.allowed_models = res.value.allowed_models;
    if (editable.includes("modalities")) body.allowed_modalities = res.value.allowed_modalities;
    setBusy(true);
    setError(null);
    try {
      await api.setMemberLimits(org.slug, member.user_id, body);
      onSaved(memberName(member));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={shared.overlay} role="presentation" onClick={onClose}>
      <div
        className={`${shared.dialog} ${shared.dialogWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-limits-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        <h2 id="member-limits-title" className={shared.dialogTitle}>Limits for {memberName(member)}</h2>
        <p className={manage.dialogIntro}>
          Effective access is the most restrictive of the organization policy, this member&apos;s limits and the key&apos;s restrictions.
          This month: {fmtCredits(member.month_spend)} credits spent.
        </p>
        <LimitsEditor
          idPrefix="member-limits"
          draft={draft}
          onChange={setDraft}
          fields={fields}
          locks={locks}
          disabled={busy}
          budgetLabel="Monthly credit limit"
        />
        {error && <Callout tone="error">{error}</Callout>}
        <div className={shared.dialogActions}>
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" onClick={save} disabled={busy || editable.length === 0}>
            {busy ? "Saving…" : "Save limits"}
          </button>
        </div>
      </div>
    </div>
  );
}
