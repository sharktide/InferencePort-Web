"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../Panel.module.css";
import shared from "./orgs.module.css";
import { useModal } from "../../../Modal";
import type { OrgApi, OrgMember, OrgTeam, OrgTeamMember } from "../../../../lib/orgs";
import { Badge, Callout, errorText } from "./shared";
import { memberName } from "./LimitsEditor";

interface Props {
  api: OrgApi;
  slug: string;
  team: OrgTeam;
  orgMembers: OrgMember[];
  canManage: boolean;
  userId: string | null;
  onChanged: () => void;
}

type TeamRole = OrgTeamMember["role"];
type Notice = { tone: "ok" | "error"; text: string } | null;

/** Member list and editor for one team (rendered when a team row is expanded). */
export default function TeamMembers({ api, slug, team, orgMembers, canManage, userId, onChanged }: Props) {
  const modal = useModal();
  const [members, setMembers] = useState<OrgTeamMember[] | null>(null);
  const [addId, setAddId] = useState("");
  const [addRole, setAddRole] = useState<TeamRole>("member");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    try {
      const { members: list } = await api.teamMembers(slug, team.id);
      setMembers(list);
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    }
  }, [api, slug, team.id]);

  useEffect(() => { load(); }, [load]);

  const inTeam = new Set((members ?? []).map((m) => m.user_id));
  const candidates = orgMembers.filter((m) => !inTeam.has(m.user_id));

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await work();
      setNotice({ tone: "ok", text: success });
      await load();
      onChanged();
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const target = orgMembers.find((m) => m.user_id === addId);
    if (!target) return;
    run(() => api.setTeamMember(slug, team.id, target.user_id, addRole), `Added ${memberName(target)} to ${team.name}.`);
    setAddId("");
  };

  const setRole = (m: OrgTeamMember, role: TeamRole) =>
    run(() => api.setTeamMember(slug, team.id, m.user_id, role), `Set ${memberName(m)} to ${role}.`);

  const remove = async (m: OrgTeamMember) => {
    const ok = await modal.confirm(`Remove ${memberName(m)} from ${team.name}?`, "Remove from team");
    if (ok) run(() => api.removeTeamMember(slug, team.id, m.user_id), `Removed ${memberName(m)} from ${team.name}.`);
  };

  return (
    <div className={shared.stack}>
      {notice && <Callout tone={notice.tone === "error" ? "error" : "ok"}>{notice.text}</Callout>}
      {!members && !notice && <p className={styles.muted}>Loading team members…</p>}
      {members && members.length === 0 && <p className={`${styles.muted} ${styles.tiny}`}>No members yet.</p>}
      {members && members.length > 0 && (
        <div className={shared.tableWrap}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Team role</th>
                <th scope="col"><span className={shared.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td className={shared.wrapAnywhere}>
                    {memberName(m)} {m.user_id === userId && <Badge tone="brand">You</Badge>}
                  </td>
                  <td>
                    {canManage ? (
                      <select
                        aria-label={`Team role for ${memberName(m)}`}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => setRole(m, e.target.value as TeamRole)}
                      >
                        <option value="maintainer">Maintainer</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <Badge>{m.role === "maintainer" ? "Maintainer" : "Member"}</Badge>
                    )}
                  </td>
                  <td className="actions">
                    {canManage && (
                      <button
                        type="button"
                        className={shared.danger}
                        disabled={busy}
                        aria-label={`Remove ${memberName(m)} from ${team.name}`}
                        onClick={() => remove(m)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <div className={shared.formRow}>
          <label className={shared.field} style={{ flex: "1 1 220px" }}>
            Add organization member
            <select value={addId} onChange={(e) => setAddId(e.target.value)} disabled={busy || candidates.length === 0}>
              <option value="">{candidates.length === 0 ? "Everyone is already in this team" : "Choose a member"}</option>
              {candidates.map((m) => (
                <option key={m.user_id} value={m.user_id}>{memberName(m)}</option>
              ))}
            </select>
          </label>
          <label className={shared.field}>
            Team role
            <select value={addRole} onChange={(e) => setAddRole(e.target.value as TeamRole)} disabled={busy}>
              <option value="member">Member</option>
              <option value="maintainer">Maintainer</option>
            </select>
          </label>
          <button type="button" onClick={add} disabled={busy || !addId}>Add to team</button>
        </div>
      )}
    </div>
  );
}
