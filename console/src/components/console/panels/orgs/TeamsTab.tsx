"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import styles from "../Panel.module.css";
import shared from "./orgs.module.css";
import { useModal } from "../../../Modal";
import type { OrgApi, OrgDetail, OrgMember, OrgTeam } from "../../../../lib/orgs";
import { Callout, Locked, errorText, formatDate } from "./shared";
import TeamMembers from "./TeamMembers";

interface OwnTabProps {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  userId?: string | null;
}

const TEAM_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,37}[a-z0-9]$/;

type Notice = { tone: "ok" | "error"; text: string } | null;

export default function TeamsTab({ api, org, onChanged, userId }: OwnTabProps) {
  const modal = useModal();
  const ent = org.entitlements;
  const locked = ent.max_teams === 0;
  const canManage = org.caps.includes("teams.manage");
  const atLimit = ent.max_teams !== null && org.counts.teams >= ent.max_teams;

  const [teams, setTeams] = useState<OrgTeam[] | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", description: "" });

  const load = useCallback(async () => {
    try {
      const { teams: list } = await api.teams(org.slug);
      setTeams(list);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [api, org.slug]);

  useEffect(() => {
    if (locked) return;
    load();
  }, [load, locked]);

  useEffect(() => {
    if (locked || !canManage) return;
    api
      .members(org.slug)
      .then(({ members }) => setOrgMembers(members))
      .catch(() => setOrgMembers([]));
  }, [api, org.slug, locked, canManage]);

  if (locked) {
    return (
      <Locked>
        Teams are available on the Team plan.
        <span className={`${styles.muted} ${styles.tiny}`}>Upgrade from the Overview tab to group members and share access by team.</span>
      </Locked>
    );
  }

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const slug = form.slug.trim().toLowerCase();
    const name = form.name.trim();
    const description = form.description.trim();
    if (!TEAM_SLUG_RE.test(slug)) {
      return setNotice({ tone: "error", text: "Team slug: lowercase letters, numbers and hyphens, 2-39 characters, starting and ending with a letter or number." });
    }
    if (!name) return setNotice({ tone: "error", text: "Enter a team name." });
    setBusy(true);
    setNotice(null);
    try {
      await api.createTeam(org.slug, { slug, name, ...(description ? { description } : {}) });
      setForm({ slug: "", name: "", description: "" });
      setNotice({ tone: "ok", text: `Created team ${name}.` });
      await load();
      onChanged();
    } catch (err) {
      setNotice({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: OrgTeam) => {
    const ok = await modal.confirm(`Delete the team ${t.name}? Organization members stay in the organization.`, "Delete team");
    if (!ok) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.deleteTeam(org.slug, t.id);
      if (expanded === t.id) setExpanded(null);
      setNotice({ tone: "ok", text: `Deleted team ${t.name}.` });
      await load();
      onChanged();
    } catch (err) {
      setNotice({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.stack}>
      <div className={shared.sectionHead}>
        <span className={shared.sectionTitle}>Teams</span>
        <span className={`${styles.muted} ${styles.tiny}`}>
          {org.counts.teams}{ent.max_teams !== null ? ` of ${ent.max_teams}` : ""} teams
        </span>
      </div>

      {!canManage && <p className={`${styles.muted} ${styles.tiny}`}>Your role can view teams but cannot change them.</p>}
      {notice && <Callout tone={notice.tone === "error" ? "error" : "ok"}>{notice.text}</Callout>}
      {loadError && <Callout tone="error">{loadError}</Callout>}
      {!teams && !loadError && <p className={styles.muted}>Loading teams…</p>}

      {teams && teams.length === 0 && (
        <p className={`${styles.muted} ${styles.tiny}`}>No teams yet.{canManage ? " Create one below." : ""}</p>
      )}

      {teams && teams.length > 0 && (
        <div className={shared.tableWrap}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col">Members</th>
                <th scope="col">Created</th>
                <th scope="col"><span className={shared.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const open = expanded === t.id;
                return (
                  <TeamRow key={t.id} team={t} open={open} busy={busy} canManage={canManage} onToggle={() => setExpanded(open ? null : t.id)} onDelete={() => remove(t)}>
                    <TeamMembers
                      api={api}
                      slug={org.slug}
                      team={t}
                      orgMembers={orgMembers}
                      canManage={canManage}
                      userId={userId ?? null}
                      onChanged={() => { load(); onChanged(); }}
                    />
                  </TeamRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        atLimit ? (
          <Callout tone="warn">
            Your plan allows {ent.max_teams} team{ent.max_teams === 1 ? "" : "s"}. Remove a team to create another.
          </Callout>
        ) : (
          <form onSubmit={create} className={shared.stack}>
            <div className={shared.sectionHead}>
              <span className={shared.sectionTitle}>New team</span>
            </div>
            <div className={shared.formGrid}>
              <label className={shared.field}>
                Name
                <input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className={shared.field}>
                Slug
                <input
                  required
                  maxLength={39}
                  placeholder="platform-team"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                />
              </label>
              <label className={shared.field}>
                Description (optional)
                <input maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>
            <div className={shared.formRow}>
              <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create team"}</button>
            </div>
          </form>
        )
      )}
    </div>
  );
}

/** One team row plus, when expanded, a full-width row holding the member editor. */
function TeamRow({
  team,
  open,
  busy,
  canManage,
  onToggle,
  onDelete,
  children,
}: {
  team: OrgTeam;
  open: boolean;
  busy: boolean;
  canManage: boolean;
  onToggle: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <tr>
        <td>
          <div className={shared.wrapAnywhere}>{team.name}</div>
          <div className={`${shared.mono} ${styles.muted}`}>{team.slug}</div>
          {team.description && <div className={`${styles.muted} ${styles.tiny}`}>{team.description}</div>}
        </td>
        <td>{team.member_count}</td>
        <td>{formatDate(team.created_at)}</td>
        <td className="actions">
          <button type="button" className="ghost" aria-expanded={open} onClick={onToggle}>
            {open ? "Hide members" : "Members"}
          </button>{" "}
          {canManage && (
            <button type="button" className={shared.danger} disabled={busy} aria-label={`Delete team ${team.name}`} onClick={onDelete}>
              Delete
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4} style={{ background: "var(--surface-2)" }}>{children}</td>
        </tr>
      )}
    </>
  );
}
