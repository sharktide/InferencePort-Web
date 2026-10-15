"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useModal } from "../../../Modal";
import { navigateConsole } from "../../ContextSwitcher";
import {
  type BillingDetails,
  type BillingDetailsInput,
  type BillingTaxId,
  type InvoiceStatus,
  type OrgApi,
  type OrgDetail,
  type OrgInvoice,
  type PaymentMethodSummary,
  type UpcomingInvoice,
} from "../../../../lib/orgs";
import shared from "./orgs.module.css";
import s from "./billing.module.css";
import styles from "./invoices.module.css";
import { Badge, Callout, errorText, formatDate } from "./shared";

interface Props {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
  userId?: string;
}

type Tone = "neutral" | "ok" | "warn" | "crit";
type Notice = { tone: "ok" | "error"; text: string } | null;

const PAGE_SIZE = 12;
const COUNTRY_RE = /^[A-Za-z]{2}$/;
const ADDRESS_MAX = 200;
const COMPANY_MAX = 120;
const PO_MAX = 60;
const FOOTER_MAX = 500;
const TAX_VALUE_MAX = 50;

const STATUS_BADGE: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "ok" },
  open: { label: "Open", tone: "warn" },
  void: { label: "Void", tone: "neutral" },
  uncollectible: { label: "Uncollectible", tone: "crit" },
  draft: { label: "Draft", tone: "neutral" },
};

const STATUS_FILTERS: { value: "" | InvoiceStatus; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "open", label: "Open" },
  { value: "void", label: "Void" },
  { value: "uncollectible", label: "Uncollectible" },
];

const TAX_TYPES: { value: string; label: string }[] = [
  { value: "eu_vat", label: "EU VAT" },
  { value: "gb_vat", label: "UK VAT" },
  { value: "us_ein", label: "US EIN" },
  { value: "ca_bn", label: "Canada business number" },
  { value: "au_abn", label: "Australia ABN" },
  { value: "in_gst", label: "India GST" },
  { value: "ch_vat", label: "Switzerland VAT" },
  { value: "no_vat", label: "Norway VAT" },
  { value: "nz_gst", label: "New Zealand GST" },
  { value: "sg_gst", label: "Singapore GST" },
  { value: "br_cnpj", label: "Brazil CNPJ" },
];

const taxTypeLabel = (type: string) => TAX_TYPES.find((t) => t.value === type)?.label ?? type;

/* Amounts arrive in major units (dollars, yen), so Intl formats them with the currency's own digits. */
function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(Number(amount));
  } catch {
    return `${Number(amount).toFixed(2)} ${code}`;
  }
}

function periodLabel(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  return `${formatDate(start)} to ${formatDate(end)}`;
}

function cardLabel(pm: PaymentMethodSummary | null): string {
  if (!pm) return "No card on file";
  const brand = pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : "Card";
  const last = pm.last4 ? ` •••• ${pm.last4}` : "";
  const exp = pm.exp_month && pm.exp_year ? `, expires ${String(pm.exp_month).padStart(2, "0")}/${pm.exp_year}` : "";
  return `${brand}${last}${exp}`;
}

/* ---------- Upcoming invoice ---------- */

type UpcomingState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; upcoming: UpcomingInvoice | null };

function UpcomingSection({ api, slug }: { api: OrgApi; slug: string }) {
  const [state, setState] = useState<UpcomingState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api
      .upcomingInvoice(slug)
      .then(({ upcoming }) => { if (!cancelled) setState({ status: "ready", upcoming }); })
      .catch((e) => { if (!cancelled) setState({ status: "error", message: errorText(e) }); });
    return () => { cancelled = true; };
  }, [api, slug]);

  if (state.status === "loading") {
    return <div className={s.loading} role="status"><span className={s.spinner} aria-hidden="true" />Loading upcoming invoice…</div>;
  }
  if (state.status === "error") {
    return <Callout tone="error">Could not load the upcoming invoice. {state.message}</Callout>;
  }
  const up = state.upcoming;
  if (!up) {
    return <p className={s.hint}>No upcoming invoice. Organizations with an active paid subscription see their next invoice here.</p>;
  }

  return (
    <section className={s.card} aria-labelledby="inv-upcoming">
      <div className={s.cardHead}>
        <h2 id="inv-upcoming" className={s.cardTitle}>Upcoming invoice</h2>
      </div>
      <div className={s.stats}>
        <div className={s.stat}>
          <span className={s.statLabel}>Next billing date</span>
          <span className={s.statValue}>{formatDate(up.next_billing_date)}</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Seats</span>
          <span className={s.statValue}>{up.seats ?? "—"}</span>
          <span className={s.statHint}>Seats follow your member list</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Estimated total</span>
          <span className={s.statValue}>{money(up.total, up.currency)}</span>
          <span className={s.statHint}>Before tax changes and prorations are finalized</span>
        </div>
      </div>
      {up.lines.length > 0 && (
        <ul className={styles.lines} aria-label="Upcoming line items">
          {up.lines.map((l, i) => (
            <li key={i} className={styles.line}>
              <span>
                {l.description}
                {l.quantity != null && <span className={s.hint}> × {l.quantity}</span>}
              </span>
              <span className={styles.lineAmount}>{money(l.amount, up.currency)}</span>
            </li>
          ))}
          {up.discount > 0 && (
            <li className={styles.line}>
              <span>Discount</span>
              <span className={styles.lineAmount}>−{money(up.discount, up.currency)}</span>
            </li>
          )}
          <li className={`${styles.line} ${styles.totalLine}`} style={{ borderBottom: "none" }}>
            <span>Total</span>
            <span className={styles.lineAmount}>{money(up.total, up.currency)}</span>
          </li>
        </ul>
      )}
    </section>
  );
}

/* ---------- Invoices & receipts ---------- */

interface RowState {
  busy?: "receipt" | "email";
  error?: string;
  notice?: string;
}

function InvoicesSection({ api, org, userId }: { api: OrgApi; org: OrgDetail; userId?: string }) {
  const [filter, setFilter] = useState<"" | InvoiceStatus>("");
  const [items, setItems] = useState<OrgInvoice[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const selfEmail = useRef<string | null>(null);

  const loadFirst = useCallback(async (status: "" | InvoiceStatus) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setListError(null);
    try {
      const page = await api.invoices(org.slug, { limit: PAGE_SIZE, status: status || undefined });
      if (seq !== requestSeq.current) return;
      setItems(page.invoices);
      setHasMore(page.has_more);
      setCursor(page.next_cursor);
    } catch (e) {
      if (seq === requestSeq.current) setListError(errorText(e));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [api, org.slug]);

  useEffect(() => {
    setRows({});
    void loadFirst(filter);
  }, [loadFirst, filter]);

  const loadMore = async () => {
    if (!cursor) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    setListError(null);
    try {
      const page = await api.invoices(org.slug, { limit: PAGE_SIZE, cursor, status: filter || undefined });
      if (seq !== requestSeq.current) return;
      setItems((prev) => [...(prev ?? []), ...page.invoices]);
      setHasMore(page.has_more);
      setCursor(page.next_cursor);
    } catch (e) {
      setListError(errorText(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const setRow = (id: string, patch: RowState) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const openReceipt = async (inv: OrgInvoice) => {
    setRow(inv.id, { busy: "receipt", error: undefined, notice: undefined });
    try {
      const { receipt_url } = await api.receiptUrl(org.slug, inv.id);
      if (!receipt_url) {
        setRow(inv.id, { busy: undefined, error: "The receipt is not ready yet. Try again in a few minutes." });
        return;
      }
      window.open(receipt_url, "_blank", "noopener,noreferrer");
      setRow(inv.id, { busy: undefined });
    } catch (e) {
      setRow(inv.id, { busy: undefined, error: errorText(e) });
    }
  };

  // Looks up the caller's own address from the member list so "Email me" goes to them, not the billing email.
  const resolveSelfEmail = async (): Promise<string | null> => {
    if (selfEmail.current) return selfEmail.current;
    if (!userId) return null;
    try {
      const { members } = await api.members(org.slug);
      selfEmail.current = members.find((m) => m.user_id === userId)?.email ?? null;
    } catch {
      return null;
    }
    return selfEmail.current;
  };

  const emailMe = async (inv: OrgInvoice) => {
    setRow(inv.id, { busy: "email", error: undefined, notice: undefined });
    try {
      const to = await resolveSelfEmail();
      const res = await api.emailInvoice(org.slug, inv.id, to ?? undefined);
      setRow(inv.id, { busy: undefined, notice: `Sent to ${res.sent_to}` });
    } catch (e) {
      setRow(inv.id, { busy: undefined, error: errorText(e) });
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await api.invoicesExport(org.slug);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${org.slug}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setExportError(errorText(e));
    } finally {
      setExporting(false);
    }
  };

  const openInvoices = (items ?? []).filter((i) => i.status === "open" && i.hosted_invoice_url);
  const list = items ?? [];

  let body: ReactNode;
  if (loading && items === null) {
    body = <div className={s.loading} role="status"><span className={s.spinner} aria-hidden="true" />Loading invoices…</div>;
  } else if (listError && items === null) {
    body = (
      <Callout tone="error">
        <strong>Could not load invoices.</strong>
        <span>{listError}</span>
        <div><button type="button" className="ghost" onClick={() => void loadFirst(filter)}>Try again</button></div>
      </Callout>
    );
  } else if (list.length === 0) {
    body = (
      <div className={styles.empty}>
        {filter ? "No invoices with this status." : "No invoices yet. Invoices appear here after the first charge."}
      </div>
    );
  } else {
    body = (
      <div className={shared.tableWrap}>
        <table className={`${shared.table} ${shared.tableWide}`}>
          <caption className={`${s.hint} ${styles.tableCaption}`}>Invoices, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Number</th>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Period</th>
              <th scope="col">Status</th>
              <th scope="col" className={styles.num}>Total</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((inv) => {
              const rs = rows[inv.id] ?? {};
              const st = STATUS_BADGE[inv.status] ?? { label: inv.status, tone: "neutral" as Tone };
              const busy = rs.busy !== undefined;
              return (
                <tr key={inv.id}>
                  <td data-label="Number" className={shared.mono}>{inv.number ?? "—"}</td>
                  <td data-label="Date">{formatDate(inv.created)}</td>
                  <td data-label="Description">
                    <span>{inv.description}</span>
                    {inv.seats != null && (
                      <span className={styles.sub}>{inv.seats} seat{inv.seats === 1 ? "" : "s"}</span>
                    )}
                    {rs.notice && <span className={styles.rowNotice} role="status">{rs.notice}</span>}
                    {rs.error && <span className={styles.rowError} role="alert">{rs.error}</span>}
                  </td>
                  <td data-label="Period">{periodLabel(inv.period_start, inv.period_end)}</td>
                  <td data-label="Status">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {inv.status === "paid" && inv.paid_at && (
                      <span className={styles.sub}>Paid {formatDate(inv.paid_at)}</span>
                    )}
                  </td>
                  <td data-label="Total" className={`${shared.mono} ${styles.num}`}>
                    {money(inv.total, inv.currency)}
                    {inv.discount > 0 && <span className={styles.sub}>Discount −{money(inv.discount, inv.currency)}</span>}
                  </td>
                  <td className="actions">
                    <div className={styles.rowActions}>
                      {inv.status === "open" && inv.hosted_invoice_url && (
                        <a
                          className={styles.payLink}
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Pay now
                        </a>
                      )}
                      {inv.hosted_invoice_url && (
                        <a
                          className={styles.actionLink}
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View invoice ${inv.number ?? inv.id} (opens in a new tab)`}
                        >
                          View
                        </a>
                      )}
                      {inv.invoice_pdf && (
                        <a
                          className={styles.actionLink}
                          href={inv.invoice_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Download PDF for invoice ${inv.number ?? inv.id} (opens in a new tab)`}
                        >
                          PDF
                        </a>
                      )}
                      <button
                        type="button"
                        className="ghost"
                        disabled={inv.status !== "paid" || busy}
                        onClick={() => void openReceipt(inv)}
                        aria-label={`Receipt for invoice ${inv.number ?? inv.id}`}
                        title={inv.status === "paid" ? undefined : "Receipts are available once the invoice is paid"}
                      >
                        {rs.busy === "receipt" && <span className={s.spinner} aria-hidden="true" />}
                        Receipt
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={busy}
                        onClick={() => void emailMe(inv)}
                        aria-label={`Email invoice ${inv.number ?? inv.id} to me`}
                      >
                        {rs.busy === "email" && <span className={s.spinner} aria-hidden="true" />}
                        Email me
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className={s.card} aria-labelledby="inv-list">
      <div className={s.cardHead}>
        <div>
          <h2 id="inv-list" className={s.cardTitle}>Invoices &amp; receipts</h2>
          <p className={s.hint}>
            A new invoice is issued at each renewal and when you buy credits. Receipts are available once an invoice is paid.
          </p>
        </div>
      </div>

      {openInvoices.length > 0 && (
        <Callout tone="warn">
          <div className={styles.openBox}>
            <strong>
              {openInvoices.length === 1 ? "You have an open invoice." : `You have ${openInvoices.length} open invoices.`}
            </strong>
            {openInvoices.map((inv) => (
              <div key={inv.id} className={styles.openRow}>
                <span>
                  {inv.number ?? "Invoice"} · {money(inv.amount_due || inv.total, inv.currency)} due
                  {inv.due_date ? ` by ${formatDate(inv.due_date)}` : ""}
                </span>
                <a className={styles.payLink} href={inv.hosted_invoice_url ?? undefined} target="_blank" rel="noopener noreferrer">
                  Pay now
                </a>
              </div>
            ))}
          </div>
        </Callout>
      )}

      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <label className={`${shared.field} ${styles.touch}`}>
            Status
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "" | InvoiceStatus)}
              disabled={loading && items === null}
            >
              {STATUS_FILTERS.map((o) => <option key={o.value || "all"} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div className={styles.toolbarGroup}>
          <button type="button" className="ghost" onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>
      {exportError && <Callout tone="error">Could not export invoices. {exportError}</Callout>}

      {listError && items !== null && <Callout tone="error">{listError}</Callout>}
      {loading && items !== null && (
        <div className={s.loading} role="status"><span className={s.spinner} aria-hidden="true" />Updating…</div>
      )}

      {body}

      {hasMore && (
        <div className={styles.moreRow}>
          <button type="button" className="ghost" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- Billing details ---------- */

interface DetailsForm {
  company_name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  po_number: string;
  invoice_footer: string;
}

const EMPTY_FORM: DetailsForm = {
  company_name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  po_number: "",
  invoice_footer: "",
};

function formFrom(d: BillingDetails): DetailsForm {
  return {
    company_name: d.company_name ?? "",
    line1: d.address?.line1 ?? "",
    line2: d.address?.line2 ?? "",
    city: d.address?.city ?? "",
    state: d.address?.state ?? "",
    postal_code: d.address?.postal_code ?? "",
    country: d.address?.country ?? "",
    po_number: d.po_number ?? "",
    invoice_footer: d.invoice_footer ?? "",
  };
}

const trimOrNull = (v: string) => (v.trim() === "" ? null : v.trim());

function addressFilled(f: DetailsForm): boolean {
  return [f.line1, f.line2, f.city, f.state, f.postal_code, f.country].some((v) => v.trim() !== "");
}

function validateForm(f: DetailsForm): string | null {
  if (f.company_name.trim().length > COMPANY_MAX) return `Company legal name must be ${COMPANY_MAX} characters or fewer.`;
  if (f.po_number.trim().length > PO_MAX) return `PO number must be ${PO_MAX} characters or fewer.`;
  if (f.invoice_footer.trim().length > FOOTER_MAX) return `Invoice footer must be ${FOOTER_MAX} characters or fewer.`;
  const lengthFields: [string, string][] = [
    ["Address line 1", f.line1], ["Address line 2", f.line2], ["City", f.city], ["State or region", f.state], ["Postal code", f.postal_code],
  ];
  for (const [label, value] of lengthFields) {
    if (value.trim().length > ADDRESS_MAX) return `${label} must be ${ADDRESS_MAX} characters or fewer.`;
  }
  if (addressFilled(f)) {
    if (!f.line1.trim()) return "Address line 1 is required when you enter an address.";
    if (!COUNTRY_RE.test(f.country.trim())) return "Country must be a two-letter code, such as US or DE.";
  }
  return null;
}

function buildPayload(f: DetailsForm): BillingDetailsInput {
  return {
    company_name: trimOrNull(f.company_name),
    address: addressFilled(f)
      ? {
          line1: f.line1.trim(),
          line2: trimOrNull(f.line2),
          city: trimOrNull(f.city),
          state: trimOrNull(f.state),
          postal_code: trimOrNull(f.postal_code),
          country: f.country.trim().toUpperCase(),
        }
      : null,
    po_number: trimOrNull(f.po_number),
    invoice_footer: trimOrNull(f.invoice_footer),
  };
}

function BillingDetailsSection({ api, org, canEdit }: { api: OrgApi; org: OrgDetail; canEdit: boolean }) {
  const modal = useModal();
  const [details, setDetails] = useState<BillingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<DetailsForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<DetailsForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [taxType, setTaxType] = useState(TAX_TYPES[0].value);
  const [taxValue, setTaxValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { details: d } = await api.billingDetails(org.slug);
      setDetails(d);
      const f = formFrom(d);
      setForm(f);
      setSaved(f);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [api, org.slug]);

  useEffect(() => { void load(); }, [load]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const save = async () => {
    const problem = validateForm(form);
    if (problem) {
      setNotice({ tone: "error", text: problem });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const { details: d } = await api.saveBillingDetails(org.slug, buildPayload(form));
      setDetails(d);
      const f = formFrom(d);
      setForm(f);
      setSaved(f);
      setNotice({ tone: "ok", text: "Billing details saved." });
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  // Tax IDs are saved on their own, so they do not touch unsaved form edits.
  const addTaxId = async () => {
    const value = taxValue.trim();
    if (!value) return;
    setBusy(true);
    setNotice(null);
    try {
      const { details: d } = await api.saveBillingDetails(org.slug, { add_tax_id: { type: taxType, value } });
      setDetails(d);
      setTaxValue("");
      setNotice({ tone: "ok", text: `${taxTypeLabel(taxType)} tax ID added.` });
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const removeTaxId = async (t: BillingTaxId) => {
    const ok = await modal.confirm(
      `Remove the ${taxTypeLabel(t.type)} tax ID ${t.value}? It will stop appearing on future invoices.`,
      "Remove tax ID",
    );
    if (!ok) return;
    setBusy(true);
    setNotice(null);
    try {
      const { details: d } = await api.saveBillingDetails(org.slug, { remove_tax_id: t.id });
      setDetails(d);
      setNotice({ tone: "ok", text: "Tax ID removed." });
    } catch (e) {
      setNotice({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof DetailsForm) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  let body: ReactNode;
  if (loading) {
    body = <div className={s.loading} role="status"><span className={s.spinner} aria-hidden="true" />Loading billing details…</div>;
  } else if (!details) {
    body = (
      <Callout tone="error">
        <strong>Could not load billing details.</strong>
        <span>{loadError}</span>
        <div><button type="button" className="ghost" onClick={() => void load()}>Try again</button></div>
      </Callout>
    );
  } else {
    const d = details;
    body = (
      <>
        {!d.has_billing_account && (
          <Callout tone="info">
            Details are saved when you subscribe or buy credits. You can save them now too; that creates the billing account.
          </Callout>
        )}
        {!canEdit && (
          <Callout tone="info">Read-only. You need the billing permission to change these details.</Callout>
        )}

        <div className={s.fieldGrid}>
          <label className={`${shared.field} ${styles.fullSpan} ${styles.touch}`}>
            Company legal name
            <input
              type="text"
              value={form.company_name}
              maxLength={COMPANY_MAX}
              disabled={!canEdit || busy}
              onChange={set("company_name")}
              autoComplete="organization"
              aria-describedby="inv-company-hint"
            />
            <span id="inv-company-hint" className={s.hint}>Printed on every invoice. Use the name your accounts team expects.</span>
          </label>

          <fieldset className={styles.addressGroup} disabled={!canEdit || busy}>
            <legend>Billing address</legend>
            <label className={`${shared.field} ${styles.addressWide} ${styles.touch}`}>
              Address line 1
              <input type="text" value={form.line1} maxLength={ADDRESS_MAX} onChange={set("line1")} autoComplete="address-line1" />
            </label>
            <label className={`${shared.field} ${styles.addressWide} ${styles.touch}`}>
              Address line 2
              <input type="text" value={form.line2} maxLength={ADDRESS_MAX} onChange={set("line2")} autoComplete="address-line2" />
            </label>
            <label className={`${shared.field} ${styles.touch}`}>
              City
              <input type="text" value={form.city} maxLength={ADDRESS_MAX} onChange={set("city")} autoComplete="address-level2" />
            </label>
            <label className={`${shared.field} ${styles.touch}`}>
              State or region
              <input type="text" value={form.state} maxLength={ADDRESS_MAX} onChange={set("state")} autoComplete="address-level1" />
            </label>
            <label className={`${shared.field} ${styles.touch}`}>
              Postal code
              <input type="text" value={form.postal_code} maxLength={ADDRESS_MAX} onChange={set("postal_code")} autoComplete="postal-code" />
            </label>
            <label className={`${shared.field} ${styles.touch}`}>
              Country (2-letter code)
              <input
                type="text"
                value={form.country}
                maxLength={2}
                placeholder="US"
                autoCapitalize="characters"
                autoComplete="country"
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setForm((prev) => ({ ...prev, country: value }));
                }}
                aria-describedby="inv-country-hint"
              />
              <span id="inv-country-hint" className={s.hint}>ISO 3166 code, for example US, GB or DE.</span>
            </label>
          </fieldset>

          <label className={`${shared.field} ${styles.touch}`}>
            PO number
            <input type="text" value={form.po_number} maxLength={PO_MAX} onChange={set("po_number")} />
          </label>

          <label className={`${shared.field} ${styles.fullSpan} ${styles.touch}`}>
            Invoice footer
            <textarea
              value={form.invoice_footer}
              maxLength={FOOTER_MAX}
              rows={3}
              onChange={set("invoice_footer")}
              aria-describedby="inv-footer-hint"
            />
            <span id="inv-footer-hint" className={s.hint}>Free text printed at the bottom of invoices, for example a VAT notice or bank reference.</span>
          </label>
        </div>

        {canEdit && (
          <div className={styles.formActions}>
            <button type="button" disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? "Saving…" : "Save billing details"}
            </button>
            <button type="button" className="ghost" disabled={busy || !dirty} onClick={() => { setForm(saved); setNotice(null); }}>
              Discard changes
            </button>
          </div>
        )}

        <div style={{ display: "grid", gap: "0.6rem" }}>
          <h3 className={s.cardTitle}>Tax IDs</h3>
          {d.tax_ids.length === 0 ? (
            <p className={s.hint}>No tax IDs. Add one if your invoices need to show a VAT, GST or similar number.</p>
          ) : (
            <ul className={styles.taxList} aria-label="Tax IDs">
              {d.tax_ids.map((t) => (
                <li key={t.id} className={styles.taxRow}>
                  <span className={styles.taxType}>{taxTypeLabel(t.type)}</span>
                  <span className={styles.taxValue}>{t.value}</span>
                  {t.verification && <Badge>{t.verification}</Badge>}
                  {canEdit && (
                    <button
                      type="button"
                      className={`${shared.danger} ${styles.touch}`}
                      disabled={busy}
                      onClick={() => void removeTaxId(t)}
                      aria-label={`Remove ${taxTypeLabel(t.type)} ${t.value}`}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <>
              <div className={styles.addRow}>
                <label className={`${shared.field} ${styles.touch}`}>
                  Tax ID type
                  <select value={taxType} disabled={busy} onChange={(e) => setTaxType(e.target.value)}>
                    {TAX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <label className={`${shared.field} ${styles.touch}`}>
                  Tax ID number
                  <input
                    type="text"
                    value={taxValue}
                    maxLength={TAX_VALUE_MAX}
                    disabled={busy}
                    onChange={(e) => setTaxValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addTaxId(); } }}
                  />
                </label>
                <button type="button" className="ghost" disabled={busy || !taxValue.trim()} onClick={() => void addTaxId()}>
                  Add tax ID
                </button>
              </div>
              <p className={s.hint}>Tax IDs are saved as soon as you add or remove them.</p>
            </>
          )}
        </div>

        <div className={s.fieldGrid}>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <span className={s.label}>Payment method</span>
            <div className={s.readonly}>{cardLabel(d.payment_method)}</div>
            <span className={s.hint}>To change the card, use Update payment method in Billing.</span>
          </div>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <span className={s.label}>Billing email</span>
            <div className={s.readonly}>{d.billing_email ?? "Owner's email"}</div>
            <div className={s.actions}>
              <span className={s.hint}>Invoices and receipts go here. Edit it in Billing.</span>
            </div>
            <div>
              <button type="button" className="ghost" onClick={() => navigateConsole("org-billing")}>
                Change in Billing
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <section className={s.card} aria-labelledby="inv-details">
      <div className={s.cardHead}>
        <div>
          <h2 id="inv-details" className={s.cardTitle}>Billing details</h2>
          <p className={s.hint}>These details are printed on every invoice for this organization.</p>
        </div>
      </div>
      {notice && <Callout tone={notice.tone === "ok" ? "ok" : "error"}>{notice.text}</Callout>}
      {body}
    </section>
  );
}

/* ---------- Tab ---------- */

export default function InvoicesTab({ api, org, userId }: Props) {
  const canEdit = org.caps.includes("billing.manage");
  return (
    <div className={styles.stack}>
      <UpcomingSection api={api} slug={org.slug} />
      <InvoicesSection api={api} org={org} userId={userId} />
      <BillingDetailsSection api={api} org={org} canEdit={canEdit} />
    </div>
  );
}
