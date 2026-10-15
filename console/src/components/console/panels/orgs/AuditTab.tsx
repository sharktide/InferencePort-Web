"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import panel from "../Panel.module.css";
import s from "./security.module.css";
import Icon from "../../../Icon";
import type { AuditEvent, AuditPage, OrgApi, OrgDetail } from "@/lib/orgs";

interface Props { api: OrgApi; org: OrgDetail; onChanged: () => void }

interface Filters { action: string; actor: string; since: string }

const PAGE_SIZE = 50;
const EMPTY: Filters = { action: "", actor: "", since: "" };
const ACTION_GROUPS: { prefix: string; label: string }[] = [
  { prefix: "org.", label: "Organization" },
  { prefix: "member.", label: "Members" },
  { prefix: "team.", label: "Teams" },
  { prefix: "apikey.", label: "API keys" },
  { prefix: "billing.", label: "Billing" },
  { prefix: "domain.", label: "Domains" },
  { prefix: "sso.", label: "SSO" },
  { prefix: "security.", label: "Security" },
  { prefix: "audit.", label: "Audit log" },
];

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const when = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
};

export default function AuditTab({ api, org }: Props) {
  const canRead = org.caps.includes("audit.read");
  const canExport = org.caps.includes("audit.export");
  const exportAllowed = org.entitlements.audit_export;

  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [page, setPage] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Each query gets an id; responses from superseded queries are discarded.
  const reqId = useRef(0);

  const runQuery = useCallback(async (f: Filters) => {
    const id = ++reqId.current;
    setApplied(f);
    setLoading(true);
    setError(null);
    setLoadingMore(false);
    try {
      const res = await api.audit(org.slug, {
        limit: PAGE_SIZE,
        action: f.action || undefined,
        actor: f.actor.trim() || undefined,
        since: f.since || undefined,
      });
      if (id !== reqId.current) return;
      setPage(res);
      setEvents(res.events);
      setExpanded(new Set());
    } catch (e) {
      if (id === reqId.current) setError(errMsg(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [api, org.slug]);

  useEffect(() => {
    if (canRead) void runQuery(EMPTY);
  }, [canRead, runQuery]);

  const loadMore = async () => {
    if (!page?.next_before_id) return;
    const id = ++reqId.current;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await api.audit(org.slug, {
        limit: PAGE_SIZE,
        before_id: page.next_before_id,
        action: applied.action || undefined,
        actor: applied.actor.trim() || undefined,
        since: applied.since || undefined,
      });
      if (id !== reqId.current) return;
      setPage(res);
      setEvents((prev) => [...prev, ...res.events]);
    } catch (e) {
      if (id === reqId.current) setError(errMsg(e));
    } finally {
      if (id === reqId.current) setLoadingMore(false);
    }
  };

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exportAs = async (format: "csv" | "json") => {
    setExporting(format);
    setExportError(null);
    try {
      const body = await api.auditExport(org.slug, format);
      const type = format === "csv" ? "text/csv" : "application/json";
      const url = URL.createObjectURL(new Blob([body], { type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${org.slug}-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setExportError(errMsg(e));
    } finally {
      setExporting(null);
    }
  };

  if (!canRead) {
    return (
      <div className={s.lockedCard}>
        <strong>The audit log is restricted.</strong>
        <span>Your role does not include the audit.read capability. Ask an owner or admin for access.</span>
      </div>
    );
  }

  const retention = page?.retention_days ?? org.entitlements.audit_retention_days;
  const upgradeable = org.effective_plan !== "enterprise";

  return (
    <div className={s.tab}>
      <section className={panel.card} aria-labelledby="audit-log">
        <div className={s.calloutRow} style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 id="audit-log" className={`${panel.heading} ${s.sectionTitle}`} style={{ marginBottom: 0 }}>Audit log</h2>
          {exportAllowed ? (
            <div className={s.actions}>
              <button className="ghost" disabled={!canExport || exporting !== null} title={canExport ? undefined : "Requires the audit.export capability"} onClick={() => void exportAs("csv")}>
                <Icon name="download" /> {exporting === "csv" ? "Exporting…" : "Export CSV"}
              </button>
              <button className="ghost" disabled={!canExport || exporting !== null} title={canExport ? undefined : "Requires the audit.export capability"} onClick={() => void exportAs("json")}>
                <Icon name="download" /> {exporting === "json" ? "Exporting…" : "Export JSON"}
              </button>
            </div>
          ) : (
            <span className={s.hint}>Export is not included in your current plan. Upgrade in Billing to export.</span>
          )}
        </div>

        <div className={`${s.callout} ${s.calloutInfo}`} role="note">
          {upgradeable
            ? <>Showing last {retention} days. Upgrade for longer retention.</>
            : <>Showing last {retention} days.</>}
        </div>

        {exportError && <div className={`${s.callout} ${s.calloutDanger}`} role="alert" style={{ marginTop: "0.75rem" }}>{exportError}</div>}

        <form
          className={s.filters}
          style={{ marginTop: "1rem" }}
          onSubmit={(e) => { e.preventDefault(); void runQuery(draft); }}
          aria-label="Filter audit events"
        >
          <label className={s.field}>
            Action
            <select value={draft.action} onChange={(e) => { const next = { ...draft, action: e.target.value }; setDraft(next); void runQuery(next); }}>
              <option value="">All actions</option>
              {ACTION_GROUPS.map((g) => <option key={g.prefix} value={g.prefix}>{g.label} ({g.prefix}*)</option>)}
            </select>
          </label>
          <label className={s.field}>
            Actor email
            <input type="text" inputMode="email" autoComplete="off" placeholder="name@company.com" value={draft.actor}
              onChange={(e) => setDraft({ ...draft, actor: e.target.value })} />
          </label>
          <label className={s.field}>
            Since
            <input type="date" value={draft.since} onChange={(e) => setDraft({ ...draft, since: e.target.value })} />
          </label>
          <div className={s.actions} style={{ alignSelf: "end" }}>
            <button type="submit" disabled={loading}>Apply filters</button>
            <button type="button" className="ghost" disabled={loading} onClick={() => { setDraft(EMPTY); void runQuery(EMPTY); }}>Reset</button>
          </div>
        </form>

        {error && <div className={`${s.callout} ${s.calloutDanger}`} role="alert" style={{ marginTop: "1rem" }}>{error}</div>}

        <div style={{ marginTop: "1rem" }}>
          {loading && events.length === 0 ? (
            <div className={s.state} role="status"><span className={panel.spinner} aria-hidden="true" />Loading events…</div>
          ) : events.length === 0 ? (
            <div className={panel.lockedOverlay} style={{ minHeight: 60 }}>No events match these filters.</div>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table} aria-busy={loading}>
                <caption className={s.hint} style={{ textAlign: "left", padding: "0.6rem 0.8rem" }}>
                  {events.length} event{events.length === 1 ? "" : "s"} loaded
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Action</th>
                    <th scope="col">Target</th>
                    <th scope="col">IP</th>
                    <th scope="col"><span className={s.hint}>Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => {
                    const open = expanded.has(ev.id);
                    return (
                      <Fragment key={ev.id}>
                        <tr>
                          <td className={s.mono}>{when(ev.created_at)}</td>
                          <td data-label="Actor">{ev.actor_email ?? ev.actor_type}<span className={s.cellSub}>{ev.actor_type}</span></td>
                          <td data-label="Action" className={s.mono}>{ev.action}</td>
                          <td data-label="Target">{ev.target_type ?? "None"}{ev.target_id && <span className={`${s.cellSub} ${s.mono}`}>{ev.target_id}</span>}</td>
                          <td data-label="IP" className={s.mono}>{ev.ip ?? "None"}</td>
                          <td data-label="Details">
                            <button className="ghost" style={{ minHeight: 0, padding: "0.15rem 0.5rem", fontSize: "0.75rem" }}
                              aria-expanded={open} aria-controls={`audit-detail-${ev.id}`} onClick={() => toggle(ev.id)}>
                              {open ? "Hide" : "Show"}
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr id={`audit-detail-${ev.id}`}>
                            <td colSpan={6} className={s.detailCell}>
                              <div className={s.sectionCard}>
                                <div>
                                  <span className={s.kvLabel}>Metadata</span>
                                  <pre className={s.detailPre}>{JSON.stringify(ev.metadata ?? {}, null, 2)}</pre>
                                </div>
                                <div>
                                  <span className={s.kvLabel}>User agent</span>
                                  <div className={s.mono}>{ev.user_agent ?? "None"}</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {page?.next_before_id != null && (
          <div className={s.actions} style={{ marginTop: "1rem" }}>
            <button className="ghost" disabled={loadingMore || loading} onClick={() => void loadMore()}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
