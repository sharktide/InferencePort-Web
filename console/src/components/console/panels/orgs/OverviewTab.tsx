"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useModal } from "../../../Modal";
import {
  CAP_LABELS,
  OrgApiError,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type OrgApi,
  type OrgDetail,
  type OrgMember,
} from "../../../../lib/orgs";
import shared from "./orgs.module.css";
import s from "./billing.module.css";
import { Badge, Callout, PLAN_LABELS, errorText, formatDate } from "./shared";
import PlansModal from "./PlansModal";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  userId?: string;
  /** Called after the caller leaves or the org is deleted. Falls back to onChanged when omitted. */
  onExit?: () => void;
  /** Opens another section of this organization (e.g. "org-billing"). Hides the link when omitted. */
  onNavigate?: (section: string) => void;
}

type Notice = { tone: "ok" | "error"; text: string } | null;

const memberName = (m: OrgMember) => m.email || (m.username ? `@${m.username}` : m.user_id);

export default function OverviewTab({ api, org, onChanged, userId, onExit, onNavigate }: Props) {
  const modal = useModal();
  const isOwner = org.role === "owner";
  const canEdit = org.caps.includes("org.update");
  const canSeeBilling = org.caps.includes("billing.manage") || org.caps.includes("billing.read");
  const ent = org.entitlements;

  const [name, setName] = useState(org.name);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [candidates, setCandidates] = useState<OrgMember[]>([]);
  const [transferTo, setTransferTo] = useState("");

  useEffect(() => { setName(org.name); }, [org.id, org.name]);

  useEffect(() => {
    if (!isOwner) return;
    api
      .members(org.slug)
      .then(({ members }) => {
        const others = members.filter((m) => m.role !== "owner");
        setCandidates(others);
        setTransferTo((cur) => cur || others[0]?.user_id || "");
      })
      .catch((e) => setNotice({ tone: "error", text: errorText(e) }));
  }, [api, org.slug, isOwner]);

  const exitOrg = () => (onExit ? onExit() : onChanged());

  const meters = [
    { label: "Members", value: org.counts.members, limit: org.seat_cap },
    { label: "Teams", value: org.counts.teams, limit: ent.max_teams },
    { label: "API keys", value: org.counts.api_keys, limit: ent.max_api_keys },
  ];

  const trimmedName = name.trim();
  const dirty = trimmedName !== org.name;

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!trimmedName) return setNotice({ tone: "error", text: "Enter an organization name." });
    setBusy(true);
    setNotice(null);
    try {
      await api.update(org.slug, { name: trimmedName });
      setNotice({ tone: "ok", text: "Organization saved." });
      onChanged();
    } catch (err) {
      setNotice({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!userId) return;
    const ok = await modal.confirm(`Leave ${org.name}? You will lose access to its agents, keys and billing.`, "Leave organization");
    if (!ok) return;
    setBusy(true);
    try {
      await api.removeMember(org.slug, userId);
      exitOrg();
    } catch (err) {
      setNotice({ tone: "error", text: errorText(err) });
      setBusy(false);
    }
  };

  const transfer = async () => {
    const target = candidates.find((m) => m.user_id === transferTo);
    if (!target) return;
    const ok = await modal.confirm(
      `Transfer ownership of ${org.name} to ${memberName(target)}? You will no longer be the owner.`,
      "Transfer ownership",
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.transfer(org.slug, target.user_id);
      setNotice({ tone: "ok", text: `Ownership transferred to ${memberName(target)}.` });
      onChanged();
    } catch (err) {
      setNotice({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const typed = await modal.prompt(
      `This permanently deletes ${org.name}. Type "${org.slug}" to confirm. This cannot be undone.`,
      "",
      "Delete organization",
    );
    if (typed === null) return;
    if (typed.trim() !== org.slug) {
      setNotice({ tone: "error", text: "The slug did not match. The organization was not deleted." });
      return;
    }
    setBusy(true);
    try {
      try {
        await api.remove(org.slug, typed.trim());
      } catch (err) {
        // The server refuses to silently forfeit a remaining credit balance (409): confirm, then forfeit.
        if (err instanceof OrgApiError && err.status === 409) {
          const ok = await modal.confirm(err.message, "Forfeit remaining credits?");
          if (!ok) { setBusy(false); return; }
          await api.remove(org.slug, typed.trim(), true);
        } else {
          throw err;
        }
      }
      exitOrg();
    } catch (err) {
      setNotice({ tone: "error", text: errorText(err) });
      setBusy(false);
    }
  };

  const capLabels = org.caps.map((c) => CAP_LABELS[c]).filter((x): x is string => Boolean(x));

  return (
    <div className={s.page}>
      {notice && <Callout tone={notice.tone === "error" ? "error" : "ok"}>{notice.text}</Callout>}

      {/* Details */}
      <section className={s.card} aria-labelledby="ov-details">
        <h2 id="ov-details" className={s.cardTitle}>Details</h2>
        <dl className={shared.dl}>
          <dt>Name</dt>
          <dd>{org.name}</dd>
          <dt>Slug</dt>
          <dd className={shared.mono}>{org.slug}</dd>
          <dt>Plan</dt>
          <dd>
            <Badge tone="brand">{PLAN_LABELS[org.effective_plan]}</Badge>
            {org.plan !== org.effective_plan && (
              <span className={s.hint}> Your {PLAN_LABELS[org.plan]} subscription is not active, so limits follow {PLAN_LABELS[org.effective_plan]}.</span>
            )}
          </dd>
          <dt>Owner</dt>
          <dd>{org.owner_email ?? "Unknown"}</dd>
          <dt>Billing email</dt>
          <dd>
            {org.billing_email ?? `${org.owner_email ?? "The owner"} (owner's email)`}
            <div style={{ marginTop: "0.35rem" }}>
              {onNavigate && canSeeBilling ? (
                <button type="button" className={s.linkBtn} onClick={() => onNavigate("org-billing")}>
                  Change in Billing
                </button>
              ) : (
                <span className={s.hint}>Change it in the Billing tab.</span>
              )}
            </div>
          </dd>
          <dt>Created</dt>
          <dd>{formatDate(org.created_at)}</dd>
        </dl>
      </section>

      {/* Access */}
      <section className={s.card} aria-labelledby="ov-access">
        <div className={s.cardHead}>
          <h2 id="ov-access" className={s.cardTitle}>Your access</h2>
          <Badge tone="neutral">{ROLE_LABELS[org.role]}</Badge>
        </div>
        <p className={s.lead}>{ROLE_DESCRIPTIONS[org.role]}</p>
        {capLabels.length > 0 ? (
          <>
            <span className={s.label}>You can</span>
            <ul className={s.capList}>
              {capLabels.map((label) => <li key={label}><Badge>{label}</Badge></li>)}
            </ul>
          </>
        ) : (
          <p className={s.hint}>You can use the organization wallet and create your own API keys within its limits.</p>
        )}
      </section>

      {/* Usage vs plan */}
      <section className={s.card} aria-labelledby="ov-usage">
        <div className={s.cardHead}>
          <h2 id="ov-usage" className={s.cardTitle}>Usage against plan limits</h2>
          <button type="button" className="ghost" onClick={() => setPlansOpen(true)}>Compare plans</button>
        </div>
        <div className={s.meters}>
          {meters.map((m) => {
            const pct = m.limit ? Math.min(100, Math.round((m.value / m.limit) * 100)) : 0;
            const warn = !!m.limit && pct >= 80;
            return (
              <article key={m.label} className={`${s.meter} ${warn ? s.meterWarn : ""}`}>
                <span className={s.statLabel}>{m.label}</span>
                <span className={s.statValue}>
                  {m.value}
                  {m.limit === null ? " (no limit)" : m.limit === 0 ? "" : ` of ${m.limit}`}
                </span>
                {m.limit === 0 && <span className={s.hint}>Not included on your plan</span>}
                {m.limit !== null && m.limit > 0 && (
                  <span className={s.meterTrack} aria-hidden="true">
                    <span className={s.meterFill} style={{ width: `${pct}%` }} />
                  </span>
                )}
              </article>
            );
          })}
        </div>
        {ent.max_teams === 0 && <p className={s.hint}>Teams are not included on your current plan. See Compare plans.</p>}
      </section>

      {/* Edit */}
      {canEdit && (
        <section className={s.card} aria-labelledby="ov-edit">
          <h2 id="ov-edit" className={s.cardTitle}>Edit details</h2>
          <form onSubmit={save} className={shared.stack}>
            <label className={shared.field} style={{ maxWidth: 420 }}>
              Organization name
              <input value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
            </label>
            <div className={shared.formRow}>
              <button type="submit" disabled={busy || !dirty || !trimmedName}>{busy ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
          <p className={s.hint}>To change the billing email, use the Billing tab.</p>
        </section>
      )}

      {/* Danger zone */}
      <section className={s.dangerZone} aria-labelledby="ov-danger">
        <h2 id="ov-danger" className={s.dangerTitle}>Danger zone</h2>
        {!isOwner && (
          <div className={s.dangerRow}>
            <span className={s.hint}>
              Leaving removes your membership and revokes API keys you created for this organization.
            </span>
            <button type="button" className={shared.danger} onClick={leave} disabled={busy || !userId}>
              Leave organization
            </button>
          </div>
        )}
        {isOwner && (
          <>
            <div className={s.dangerRow}>
              <div style={{ display: "grid", gap: "0.3rem", flex: "1 1 260px" }}>
                <label className={shared.field}>
                  Transfer ownership to
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    disabled={candidates.length === 0 || busy}
                  >
                    {candidates.length === 0 && <option value="">Invite a member first</option>}
                    {candidates.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {memberName(m)} ({ROLE_LABELS[m.role]})
                      </option>
                    ))}
                  </select>
                </label>
                <span className={s.hint}>The new owner controls billing and can delete the organization.</span>
              </div>
              <button type="button" className={shared.danger} onClick={transfer} disabled={busy || !transferTo}>
                Transfer ownership
              </button>
            </div>
            <div className={s.dangerRow}>
              <span className={s.hint}>Deleting is permanent. You will be asked to type the organization slug to confirm.</span>
              <button type="button" className={shared.danger} onClick={remove} disabled={busy}>
                Delete organization
              </button>
            </div>
          </>
        )}
      </section>

      {plansOpen && (
        <PlansModal api={api} currentPlan={org.effective_plan} onClose={() => setPlansOpen(false)} />
      )}
    </div>
  );
}
