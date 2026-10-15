"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "../Panel.module.css";
import shared from "./orgs.module.css";
import manage from "./manage.module.css";
import type { DesktopPolicy, OrgApi, OrgDetail, OrgTeam } from "../../../../lib/orgs";
import { Callout, errorText } from "./shared";
import { planHint } from "./LimitsEditor";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
}

type Notice = { tone: "ok" | "error"; text: string } | null;
type Choice<T extends string> = { value: T; label: string };

const sameList = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const patternsToText = (v: string[] | null) => (v ?? []).join("\n");
const textToPatterns = (t: string): string[] | null => {
  const list = t.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  return list.length ? list : null;
};

function Segmented<T extends string>({
  label, value, options, onChange, disabled,
}: { label: string; value: T; options: Choice<T>[]; onChange: (v: T) => void; disabled: boolean }) {
  return (
    <div className={manage.segmented} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={manage.segment}
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, lock, hint, children }: { title: string; lock?: string; hint?: string; children: ReactNode }) {
  return (
    <div className={manage.policyRow}>
      <div className={manage.policyHead}>
        <span className={manage.policyTitle}>{title}</span>
        {lock && <span className={manage.lockHint}>{lock}</span>}
      </div>
      {children}
      {hint && <span className={manage.hintText}>{hint}</span>}
    </div>
  );
}

export default function DesktopTab({ api, org, onChanged }: Props) {
  const ent = org.entitlements;
  const canEdit = org.caps.includes("policies.manage");

  const [saved, setSaved] = useState<DesktopPolicy | null>(null);
  const [draft, setDraft] = useState<DesktopPolicy | null>(null);
  const [teams, setTeams] = useState<OrgTeam[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ desktop }, t] = await Promise.all([
        api.desktopPolicy(org.slug),
        api.teams(org.slug).catch(() => ({ teams: [] as OrgTeam[] })),
      ]);
      setSaved(desktop);
      setDraft(desktop);
      setTeams(t.teams);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [api, org.slug]);

  useEffect(() => { void load(); }, [load]);

  const locks = useMemo(() => ({
    policy: ent.desktop_policy ? undefined : planHint("desktop_policy"),
    presets: ent.desktop_server_presets ? undefined : planHint("desktop_server_presets"),
    verify: ent.unlimited_verifications ? undefined : planHint("unlimited_verifications"),
  }), [ent]);

  const changes = useMemo(() => {
    if (!saved || !draft) return {} as Partial<DesktopPolicy>;
    const out: Record<string, unknown> = {};
    (Object.keys(draft) as (keyof DesktopPolicy)[]).forEach((k) => {
      if (!sameList(draft[k], saved[k])) out[k] = draft[k];
    });
    return out as Partial<DesktopPolicy>;
  }, [saved, draft]);
  const pending = Object.keys(changes).length;

  const save = async () => {
    if (!draft || pending === 0) return;
    if (draft.server_access === "teams" && draft.server_team_ids.length === 0) {
      return setNotice({ tone: "error", text: "Choose at least one team, or pick a different server access mode." });
    }
    if (draft.pull_mode === "allowlist" && !draft.pull_models?.length) {
      return setNotice({ tone: "error", text: "Add at least one model pattern for the allowlist, or choose another pull setting." });
    }
    setBusy(true);
    setNotice(null);
    try {
      const { desktop } = await api.setDesktopPolicy(org.slug, changes);
      setSaved(desktop);
      setDraft(desktop);
      setNotice({ tone: "ok", text: "Desktop app settings saved. Members pick them up the next time the app refreshes (within a few minutes, or on restart)." });
      onChanged();
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className={styles.stack}>
        <Callout tone="error">{loadError}</Callout>
        <div><button type="button" className="ghost" onClick={() => { setLoadError(null); void load(); }}>Retry</button></div>
      </div>
    );
  }
  if (!saved || !draft) return <p className={styles.muted}>Loading desktop app settings…</p>;

  const set = (patch: Partial<DesktopPolicy>) => setDraft({ ...draft, ...patch });
  const ro = !canEdit || busy;
  const toggleTeam = (id: string) =>
    set({ server_team_ids: draft.server_team_ids.includes(id) ? draft.server_team_ids.filter((t) => t !== id) : [...draft.server_team_ids, id] });

  return (
    <div className={styles.stack}>
      <div className={shared.sectionHead}>
        <span className={shared.sectionTitle}>Desktop app controls</span>
        <span className={`${styles.muted} ${styles.tiny}`}>{canEdit ? "Applies to members signed in to the InferencePort desktop app" : "Read-only for your role"}</span>
      </div>

      <div className={manage.precedence}>
        <strong>No credits required.</strong> These controls work whether or not your organization uses the credit wallet, and they follow
        members into the desktop app as soon as they sign in. Model and modality limits from the Policies page also apply to cloud models used from the app.
        The desktop app enforces these settings on the device; they guard against accidents and casual changes, not a determined user with direct access to their own machine.
      </div>

      {notice && <Callout tone={notice.tone}>{notice.text}</Callout>}

      <Row
        title="Lightning (cloud) models"
        lock={locks.policy}
        hint="Local only hides every cloud model and cloud generation tool in the app, so prompts never leave the member's machine."
      >
        <Segmented
          label="Lightning access"
          value={draft.lightning}
          disabled={ro || !!locks.policy}
          onChange={(v) => set({ lightning: v })}
          options={[{ value: "allow", label: "Lightning and local" }, { value: "local_only", label: "Local only" }]}
        />
        {draft.lightning === "allow" && (
          <>
            <Segmented
              label="Who pays for Lightning usage from the app"
              value={draft.lightning_billing}
              disabled={ro || !!locks.policy}
              onChange={(v) => set({ lightning_billing: v })}
              options={[{ value: "personal", label: "Member's own plan" }, { value: "org", label: "Organization wallet" }]}
            />
            <span className={manage.hintText}>
              {draft.lightning_billing === "org"
                ? "Cloud usage from the app is billed to the organization wallet and counted against member budgets."
                : "Cloud usage uses each member's personal plan and limits. Nothing is billed to the organization."}
            </span>
          </>
        )}
      </Row>

      <Row
        title="Pulling models"
        lock={locks.policy}
        hint="Controls which Ollama models members can download from the app's marketplace."
      >
        <Segmented
          label="Model pulls"
          value={draft.pull_mode}
          disabled={ro || !!locks.policy}
          onChange={(v) => set({ pull_mode: v })}
          options={[{ value: "any", label: "Any model" }, { value: "allowlist", label: "Approved list" }, { value: "blocked", label: "Nothing" }]}
        />
        {draft.pull_mode === "allowlist" && (
          <label className={shared.field} htmlFor="desktop-pull-models">
            Approved models (one per line, a trailing * matches a prefix)
            <textarea
              id="desktop-pull-models"
              rows={4}
              placeholder={"llama3.2*\nqwen2.5-coder:7b"}
              value={patternsToText(draft.pull_models)}
              disabled={ro || !!locks.policy}
              onChange={(e) => set({ pull_models: textToPatterns(e.target.value) })}
            />
          </label>
        )}
      </Row>

      <Row title="Imports and custom tools" lock={locks.policy} hint="Importing a GGUF or Modelfile, and creating or installing custom tools, runs code and weights your organization has not reviewed.">
        <label className={manage.checkRow}>
          <input type="checkbox" checked={draft.allow_model_import} disabled={ro || !!locks.policy} onChange={(e) => set({ allow_model_import: e.target.checked })} />
          Members can import their own models (GGUF / Modelfile)
        </label>
        <label className={manage.checkRow}>
          <input type="checkbox" checked={draft.allow_custom_tools} disabled={ro || !!locks.policy} onChange={(e) => set({ allow_custom_tools: e.target.checked })} />
          Members can create and install custom tools
        </label>
      </Row>

      <Row
        title="Hosting a server"
        lock={locks.policy}
        hint="Lets a member share their machine's models with colleagues through an InferencePort server."
      >
        <Segmented
          label="Who can host a server"
          value={draft.server_hosting}
          disabled={ro || !!locks.policy}
          onChange={(v) => set({ server_hosting: v })}
          options={[{ value: "any", label: "Any member" }, { value: "admins", label: "Admins only" }, { value: "disabled", label: "Nobody" }]}
        />
      </Row>

      <Row
        title="One-click server access"
        lock={locks.presets}
        hint="Hosts see a one-click button that fills the server's allowed users from your directory, so nobody pastes email lists. Org owners and admins get host rights on the server; everyone else is a regular user."
      >
        <Segmented
          label="Server access list"
          value={draft.server_access}
          disabled={ro || !!locks.presets || draft.server_hosting === "disabled"}
          onChange={(v) => set({ server_access: v })}
          options={[{ value: "manual", label: "Manual" }, { value: "org", label: "Everyone in the org" }, { value: "teams", label: "Selected teams" }]}
        />
        {draft.server_access === "teams" && (
          teams.length === 0 ? (
            <span className={manage.hintText}>This organization has no teams yet. Create one on the Teams page, then come back.</span>
          ) : (
            <fieldset className={manage.policyFieldset} disabled={ro || !!locks.presets}>
              <legend className={`${manage.policyTitle} ${manage.policyLegend}`}>Teams that can reach hosted servers</legend>
              <div className={manage.checkGrid}>
                {teams.map((t) => (
                  <label key={t.id} className={manage.checkItem}>
                    <input type="checkbox" checked={draft.server_team_ids.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                    {t.name} <span className={manage.hintText}>({t.member_count})</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )
        )}
      </Row>

      <Row
        title="Token verifications"
        lock={locks.verify}
        hint="Hosted servers verify each visitor's token. Unlimited verifications lift the daily cap for members of this organization, with no credits involved."
      >
        <label className={manage.checkRow}>
          <input
            type="checkbox"
            checked={draft.unlimited_verifications && !locks.verify}
            disabled={ro || !!locks.verify}
            onChange={(e) => set({ unlimited_verifications: e.target.checked })}
          />
          Unlimited token verifications for members
        </label>
      </Row>

      {canEdit && (
        <div className={shared.formRow}>
          <button type="button" onClick={save} disabled={busy || pending === 0}>
            {busy ? "Saving…" : pending === 0 ? "No changes" : `Save ${pending} change${pending === 1 ? "" : "s"}`}
          </button>
          <button type="button" className="ghost" disabled={busy || pending === 0} onClick={() => { setDraft(saved); setNotice(null); }}>
            Discard changes
          </button>
        </div>
      )}
    </div>
  );
}
