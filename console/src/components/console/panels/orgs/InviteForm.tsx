"use client";

import { useState, type FormEvent } from "react";
import shared from "./orgs.module.css";
import manage from "./manage.module.css";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AssignableRole, type OrgApi, type OrgDetail, type OrgTeam } from "../../../../lib/orgs";
import { Callout, CopyButton, errorText } from "./shared";
import { EMAIL_RE, planHint } from "./LimitsEditor";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  teams: OrgTeam[];
  roles: AssignableRole[];
  onInvited: () => void;
}

type Result =
  | { kind: "emailed"; email: string; url: string }
  | { kind: "email_failed"; email: string; url: string }
  | { kind: "link_only"; email: string; url: string };

export default function InviteForm({ api, org, teams, roles, onInvited }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole | "">(() => {
    // Default to the org's default role, else the least privileged option (never silently the most privileged).
    const preferred = org.settings.default_member_role;
    if (preferred && roles.includes(preferred)) return preferred;
    return roles.includes("member") ? "member" : (roles[0] ?? "");
  });
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const toggleTeam = (id: string) =>
    setTeamIds((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) return setError("Enter a valid email address.");
    if (!role) return setError("Choose a role for this invitation.");
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const created = await api.invite(org.slug, {
        email: address,
        role,
        send_email: sendEmail,
        ...(teamIds.length > 0 ? { team_ids: teamIds } : {}),
      });
      const base = { email: created.invitation.email, url: created.invite_url };
      setResult(
        !sendEmail
          ? { kind: "link_only", ...base }
          : created.email_sent
            ? { kind: "emailed", ...base }
            : { kind: "email_failed", ...base },
      );
      setEmail("");
      setTeamIds([]);
      onInvited();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={shared.stack}>
      <form onSubmit={submit} className={shared.stack}>
        <div className={shared.formGrid}>
          <label className={shared.field}>
            Email
            <input
              type="email"
              required
              maxLength={254}
              placeholder="person@example.com"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className={shared.field}>
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AssignableRole)}
              disabled={roles.length === 0 || busy}
            >
              {roles.map((r) => {
                const locked = r === "auditor" && !org.entitlements.auditor_role;
                return (
                  <option key={r} value={r} disabled={locked}>
                    {ROLE_LABELS[r]}{locked ? " (Team plan)" : ""}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        {role && <p className={manage.hintText}>{ROLE_DESCRIPTIONS[role]}</p>}
        {role === "auditor" && !org.entitlements.auditor_role && (
          <p className={manage.hintText}>Auditor: {planHint("auditor_role")}</p>
        )}

        {teams.length > 0 && (
          <fieldset className={shared.fieldset}>
            <legend>Teams (optional)</legend>
            {teams.map((t) => (
              <label key={t.id} className={shared.checkItem}>
                <input type="checkbox" checked={teamIds.includes(t.id)} disabled={busy} onChange={() => toggleTeam(t.id)} />
                {t.name}
              </label>
            ))}
          </fieldset>
        )}

        <label className={manage.checkRow}>
          <input type="checkbox" checked={sendEmail} disabled={busy} onChange={(e) => setSendEmail(e.target.checked)} />
          Email the invitation
        </label>

        <div className={shared.formRow}>
          <button type="submit" disabled={busy || roles.length === 0}>{busy ? "Creating invitation…" : "Create invitation"}</button>
        </div>
      </form>

      {error && <Callout tone="error">{error}</Callout>}
      {result && result.kind === "emailed" && (
        <Callout tone="ok">
          <span>Invitation emailed to <strong>{result.email}</strong>. The link below also works if the email is missing.</span>
          <LinkRow url={result.url} />
        </Callout>
      )}
      {result && result.kind === "email_failed" && (
        <Callout tone="warn">
          <span>
            The invitation was created for <strong>{result.email}</strong>, but the email could not be sent. Share this link yourself.
          </span>
          <LinkRow url={result.url} />
        </Callout>
      )}
      {result && result.kind === "link_only" && (
        <Callout tone="ok">
          <span>Invitation created for <strong>{result.email}</strong>. No email was sent, so share this link yourself.</span>
          <LinkRow url={result.url} />
        </Callout>
      )}
      {result && (
        <p className={manage.hintText}>This link is shown once. If it is lost, resend or revoke the invitation to get a new one.</p>
      )}
    </div>
  );
}

function LinkRow({ url }: { url: string }) {
  return (
    <div className={shared.copyRow}>
      <code className={shared.secret}>{url}</code>
      <CopyButton text={url} label="Copy link" />
    </div>
  );
}
