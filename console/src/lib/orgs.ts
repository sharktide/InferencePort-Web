/* Typed client for the /v1/orgs API (inferenceport-lightning). This file IS the contract for the console. */

export type OrgRole = "owner" | "admin" | "billing_manager" | "auditor" | "member";
export type AssignableRole = Exclude<OrgRole, "owner">;
export type OrgPlan = "free" | "starter" | "team" | "enterprise";
export type SelfServePlan = "starter" | "team";
export type Modality = "text" | "image" | "video" | "audio" | "3d" | "embedding" | "realtime" | "decision";
export const MODALITIES: Modality[] = ["text", "image", "video", "audio", "3d", "embedding", "realtime", "decision"];

/** Header that makes a request bill / apply policy as an organization (set automatically by OrgContext). */
export const ORG_HEADER = "X-InferencePort-Org";

export interface Entitlements {
  name: string;
  price_label: string;
  tagline: string;
  support: string;
  max_members: number | null;
  max_teams: number | null;
  max_api_keys: number | null;
  audit_retention_days: number;
  audit_export: boolean;
  audit_webhook: boolean;
  usage_export: boolean;
  usage_reports: boolean;
  domain_verification: boolean;
  invite_domain_restriction: boolean;
  sso_saml: boolean;
  enforce_sso: boolean;
  ip_allowlist: boolean;
  key_ip_allowlist: boolean;
  spend_limits: boolean;
  member_budgets: boolean;
  key_restrictions: boolean;
  model_policy: boolean;
  key_policies: boolean;
  member_suspension: boolean;
  auditor_role: boolean;
  email_notifications: boolean;
  budget_alerts: boolean;
  desktop_policy: boolean;           // desktop app controls (Lightning vs local, pullable models, hosting)
  desktop_server_presets: boolean;   // 1-click server access lists built from members / teams
  unlimited_verifications: boolean;  // unlimited token verifications for members in the desktop app
}
export interface PlanCatalogEntry extends Entitlements {
  key: OrgPlan;
  features: string[];
  sales_terms: string[];
  seat_price_usd: number | null;
}

export interface OrgSummary {
  id: string;
  slug: string;
  name: string;
  plan: OrgPlan;
  effective_plan: OrgPlan;
  role: OrgRole;
  member_count: number;
}

export interface OrgPolicies {
  allowed_models: string[] | null;         // null = any model. Patterns may end with "*"
  allowed_modalities: Modality[] | null;   // null = any modality
  require_key_expiry: boolean;
  max_key_lifetime_days: number | null;
  default_member_monthly_limit: number | null; // credits per member per month, null = unlimited
}

/** What members may do in the InferencePort desktop app. Needs no credits: it works for orgs that never buy any. */
export interface DesktopPolicy {
  lightning: "allow" | "local_only";
  lightning_billing: "personal" | "org";
  pull_mode: "any" | "allowlist" | "blocked";
  pull_models: string[] | null;
  allow_model_import: boolean;
  allow_custom_tools: boolean;
  server_hosting: "any" | "admins" | "disabled";
  server_access: "manual" | "org" | "teams";
  server_team_ids: string[];
  unlimited_verifications: boolean;
}

export interface NotificationSettings {
  member_changes: boolean;     // joins, removals, role changes -> owners & admins
  security_alerts: boolean;    // SSO / IP allowlist / domain / webhook changes -> owners
  billing_alerts: boolean;     // payment failed, seat changes, plan changes -> billing email
  budget_alerts: boolean;      // org spend limit and low balance -> billing email
  receipts: boolean;           // an email with the invoice/receipt links each time a payment succeeds -> billing recipients
  budget_alert_percents: number[];      // e.g. [80, 100]
  low_balance_threshold: number | null; // credits
  extra_recipients: string[];  // additional emails (max 5) that receive billing & budget alerts
  email_configured: boolean;   // false when the server has no mail provider key (read-only)
}

export interface OrgSettings {
  allowed_invite_domains?: string[];
  ip_allowlist?: string[];
  default_member_role?: AssignableRole;
  audit_webhook?: { url: string; has_secret: boolean } | null;
  policies?: Partial<OrgPolicies>;
}

export interface OrgDetail extends OrgSummary {
  billing_email: string | null;        // where invoices, receipts & billing alerts go (independent of owner email)
  owner_email: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  seat_limit: number | null;           // mirrors the seat quantity billed by Stripe (== members for paid plans)
  settings: OrgSettings;
  created_at: string;
  caps: string[];
  entitlements: Entitlements;
  counts: { members: number; teams: number; api_keys: number };
  seat_cap: number | null;
}

export interface OrgMember {
  user_id: string;
  email: string | null;
  username: string | null;
  role: OrgRole;
  source: "creator" | "invite" | "sso_jit" | "admin";
  created_at: string;
  team_ids: string[];
  monthly_credit_limit: number | null;
  allowed_models: string[] | null;
  allowed_modalities: Modality[] | null;
  suspended_at: string | null;
  month_spend: number;
}
export interface MemberLimitsInput {
  monthly_credit_limit?: number | null;
  allowed_models?: string[] | null;
  allowed_modalities?: Modality[] | null;
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: AssignableRole;
  team_ids: string[];
  expires_at: string;
  created_at: string;
  invited_by_email: string | null;
}
export interface OrgInvitationCreated { invitation: OrgInvitation; invite_url: string; email_sent: boolean }
export interface OrgInvitationPreview { org_name: string; org_slug: string; email: string; role: string; expires_at: string }

export interface OrgTeam { id: string; slug: string; name: string; description: string | null; member_count: number; created_at: string }
export interface OrgTeamMember { user_id: string; email: string | null; username: string | null; role: "maintainer" | "member" }

export interface OrgApiKey {
  id: string; name: string; description: string | null; key_prefix: string; created_at: string;
  last_used_at: string | null; expires_at: string | null; revoked_at: string | null;
  created_by_email: string | null; created_by: string;
  monthly_credit_limit: number | null;
  allowed_models: string[] | null;
  allowed_modalities: Modality[] | null;
  ip_allowlist: string[] | null;
  rate_limit_rpm: number | null;
  month_spend: number;
}
export interface ApiKeyRestrictions {
  description?: string | null;
  monthly_credit_limit?: number | null;
  allowed_models?: string[] | null;
  allowed_modalities?: Modality[] | null;
  ip_allowlist?: string[] | null;
  rate_limit_rpm?: number | null;
}

/** A coupon / promotion code active on the org's subscription (or on its Stripe customer). */
export interface OrgDiscount {
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;           // major units, per invoice
  currency: string;
  duration: "forever" | "once" | "repeating" | string;
  duration_in_months: number | null;
  started_at: string | null;
  ends_at: string | null;              // only for repeating coupons
  source: "subscription" | "customer";
  description: string;                 // e.g. "100% off forever", "$200.00 off for 6 months (until Apr 02, 2027)"
}

export interface OrgBilling {
  plan: OrgPlan;
  effective_plan: OrgPlan;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_email: string | null;
  owner_email: string | null;
  seats: number;                        // == member count; billed seats follow membership automatically
  seat_price_usd: number | null;        // for the current paid plan
  monthly_estimate_usd: number | null;  // list price: seats * seat price
  next_invoice_usd: number | null;      // what the next renewal will actually charge, after discounts
  discount: OrgDiscount | null;
  has_payment_method: boolean | null;   // false for e.g. a 100%-off subscription that started without a card
  has_billing_account: boolean;         // a Stripe customer exists (portal available)
  wallet: { balance_credits: number; paid_credits: number; promotional_credits: number; lifetime_credits_purchased: number };
  monthly_spend_limit: number | null;
  month_spend: number;
  packs: { id: string; credits: number; price?: number; label?: string }[];
  can_manage: boolean;
  sales_contact: string;
}
export interface OrgLedgerEntry {
  id: string; delta_credits: number; balance_after: number; entry_type: string; usage_kind: string | null;
  model: string | null; actor_email: string | null; key_prefix: string | null; source: string | null; created_at: string;
}

export type UsageDimension = "user" | "key" | "model" | "day";
export interface UsageBucket { key: string; label: string; credits: number; requests: number }
export interface UsageBreakdown { by: UsageDimension; days: number; total_credits: number; total_requests: number; buckets: UsageBucket[] }

export interface AuditEvent {
  id: number; actor_id: string | null; actor_email: string | null; actor_type: string; action: string;
  target_type: string | null; target_id: string | null; metadata: Record<string, any>;
  ip: string | null; user_agent: string | null; created_at: string;
}
export interface AuditPage { events: AuditEvent[]; next_before_id: number | null; retention_days: number }

export interface OrgDomain { id: string; domain: string; verified_at: string | null; txt_name: string; txt_value: string }
export interface OrgSso {
  configured: boolean;
  enabled_for_plan: boolean;
  enforced: boolean;
  jit_provisioning: boolean;
  jit_default_role: "admin" | "billing_manager" | "auditor" | "member";
  idp_metadata_url: string | null;
  idp_entity_id: string | null;
  supabase_provider_id: string | null;
  sp: { acs_url: string; entity_id: string; metadata_url: string; sign_in_hint: string };
}
export interface SsoDiscovery { sso: boolean; provider_id?: string; domain?: string; org_name?: string }


/* ---- invoices, receipts & billing details (amounts are in MAJOR units, e.g. dollars, never cents) ---- */
export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";
export interface OrgInvoice {
  id: string;                              // Stripe invoice id (in_...)
  number: string | null;                   // human invoice number, null while draft
  status: InvoiceStatus;
  kind: "subscription" | "credits" | "other";
  description: string;                     // e.g. "Team seats x 3" or "Credit pack"
  seats: number | null;                    // seat quantity for subscription invoices
  currency: string;                        // upper-case ISO code
  subtotal: number; discount: number; tax: number; total: number; amount_paid: number; amount_due: number;
  created: string;                         // ISO
  due_date: string | null;
  period_start: string | null; period_end: string | null;
  paid_at: string | null;
  billing_reason: string | null;           // subscription_create | subscription_update | subscription_cycle | manual | ...
  receipt_number: string | null;
  hosted_invoice_url: string | null;       // Stripe-hosted page: view, pay, download
  invoice_pdf: string | null;
}
export interface InvoicePage { invoices: OrgInvoice[]; has_more: boolean; next_cursor: string | null }
export interface UpcomingInvoice {
  total: number; discount: number; currency: string;
  next_billing_date: string | null;
  seats: number | null;
  lines: { description: string; amount: number; quantity: number | null }[];
}
export interface BillingAddress { line1: string; line2: string | null; city: string | null; state: string | null; postal_code: string | null; country: string }
export interface BillingTaxId { id: string; type: string; value: string; verification: string | null }
export interface PaymentMethodSummary { brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null }
export interface BillingDetails {
  has_billing_account: boolean;            // false until the org subscribes or buys credits
  company_name: string | null;             // legal name printed on invoices
  billing_email: string | null;            // where invoices & receipts are emailed (read-only here; edit in Billing)
  address: BillingAddress | null;
  tax_ids: BillingTaxId[];
  po_number: string | null;                // printed on every invoice as "PO number"
  invoice_footer: string | null;           // free text printed on invoices (e.g. VAT notice, bank reference)
  payment_method: PaymentMethodSummary | null;
}
export interface BillingDetailsInput {
  company_name?: string | null;
  address?: BillingAddress | null;
  po_number?: string | null;
  invoice_footer?: string | null;
  add_tax_id?: { type: string; value: string };
  remove_tax_id?: string;
}

export class OrgApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** FastAPI sends `detail` as a string, or as a list of {msg, loc} objects for 422 validation errors. */
function errorDetail(data: any): string {
  const d = data?.detail ?? data?.error;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    const first = d[0];
    const where = Array.isArray(first?.loc) ? String(first.loc[first.loc.length - 1]) : "";
    return first?.msg ? (where ? `${where}: ${first.msg}` : String(first.msg)) : "The request was not valid";
  }
  return d ? JSON.stringify(d) : "";
}

export function createOrgApi(apiBase: string, getToken: () => string | undefined) {
  async function call<T>(method: string, path: string, body?: unknown, raw = false): Promise<T> {
    const token = getToken();
    const res = await fetch(`${apiBase}/v1/orgs${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (raw) {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new OrgApiError(errorDetail(data) || `HTTP ${res.status}`, res.status);
      }
      return (await res.text()) as unknown as T;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new OrgApiError(errorDetail(data) || `HTTP ${res.status}`, res.status);
    return data as T;
  }
  const o = (slug: string) => `/${encodeURIComponent(slug)}`;
  const qs = (q: Record<string, unknown>) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== "" && v !== null && p.set(k, String(v)));
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  return {
    plans: () => call<{ plans: PlanCatalogEntry[] }>("GET", "/plans"),
    list: () => call<{ orgs: OrgSummary[] }>("GET", ""),
    create: (b: { slug: string; name: string; billing_email?: string }) => call<{ org: OrgSummary }>("POST", "", b),
    get: (slug: string) => call<{ org: OrgDetail }>("GET", o(slug)),
    update: (slug: string, b: { name?: string; billing_email?: string; settings?: Partial<OrgSettings> }) => call<{ org: OrgDetail }>("PATCH", o(slug), b),
    remove: (slug: string, confirm: string, forfeit_credits = false) => call<{ success: true }>("DELETE", o(slug), { confirm, forfeit_credits }),
    transfer: (slug: string, user_id: string) => call<{ success: true }>("POST", `${o(slug)}/transfer`, { user_id }),

    members: (slug: string) => call<{ members: OrgMember[] }>("GET", `${o(slug)}/members`),
    setMemberRole: (slug: string, userId: string, role: AssignableRole) => call<{ success: true }>("PATCH", `${o(slug)}/members/${userId}`, { role }),
    removeMember: (slug: string, userId: string) => call<{ success: true }>("DELETE", `${o(slug)}/members/${userId}`),
    setMemberLimits: (slug: string, userId: string, b: MemberLimitsInput) => call<{ success: true }>("PATCH", `${o(slug)}/members/${userId}/limits`, b),
    suspendMember: (slug: string, userId: string) => call<{ success: true }>("POST", `${o(slug)}/members/${userId}/suspend`, {}),
    unsuspendMember: (slug: string, userId: string) => call<{ success: true }>("POST", `${o(slug)}/members/${userId}/unsuspend`, {}),

    invitations: (slug: string) => call<{ invitations: OrgInvitation[] }>("GET", `${o(slug)}/invitations`),
    invite: (slug: string, b: { email: string; role: AssignableRole; team_ids?: string[]; send_email?: boolean }) => call<OrgInvitationCreated>("POST", `${o(slug)}/invitations`, b),
    resendInvitation: (slug: string, id: string) => call<{ email_sent: boolean; invite_url: string }>("POST", `${o(slug)}/invitations/${id}/resend`, {}),
    revokeInvitation: (slug: string, id: string) => call<{ success: true }>("DELETE", `${o(slug)}/invitations/${id}`),
    previewInvitation: (token: string) => call<OrgInvitationPreview>("GET", `/invitations/preview?token=${encodeURIComponent(token)}`),
    acceptInvitation: (token: string) => call<{ org: OrgSummary }>("POST", "/invitations/accept", { token }),

    teams: (slug: string) => call<{ teams: OrgTeam[] }>("GET", `${o(slug)}/teams`),
    createTeam: (slug: string, b: { slug: string; name: string; description?: string }) => call<{ team: OrgTeam }>("POST", `${o(slug)}/teams`, b),
    updateTeam: (slug: string, id: string, b: { name?: string; description?: string }) => call<{ team: OrgTeam }>("PATCH", `${o(slug)}/teams/${id}`, b),
    deleteTeam: (slug: string, id: string) => call<{ success: true }>("DELETE", `${o(slug)}/teams/${id}`),
    teamMembers: (slug: string, id: string) => call<{ members: OrgTeamMember[] }>("GET", `${o(slug)}/teams/${id}/members`),
    setTeamMember: (slug: string, id: string, userId: string, role: "maintainer" | "member") => call<{ success: true }>("PUT", `${o(slug)}/teams/${id}/members/${userId}`, { role }),
    removeTeamMember: (slug: string, id: string, userId: string) => call<{ success: true }>("DELETE", `${o(slug)}/teams/${id}/members/${userId}`),

    apiKeys: (slug: string) => call<{ items: OrgApiKey[] }>("GET", `${o(slug)}/api-keys`),
    createApiKey: (slug: string, b: { name: string; expiresAt?: string | null } & ApiKeyRestrictions) => call<{ apiKey: OrgApiKey; rawKey: string }>("POST", `${o(slug)}/api-keys`, b),
    updateApiKey: (slug: string, id: string, b: ApiKeyRestrictions) => call<{ apiKey: OrgApiKey }>("PATCH", `${o(slug)}/api-keys/${id}`, b),
    revokeApiKey: (slug: string, id: string) => call<{ success: true }>("DELETE", `${o(slug)}/api-keys/${id}`),

    policies: (slug: string) => call<{ policies: OrgPolicies }>("GET", `${o(slug)}/policies`),
    setPolicies: (slug: string, b: Partial<OrgPolicies>) => call<{ policies: OrgPolicies }>("PUT", `${o(slug)}/policies`, b),
    desktopPolicy: (slug: string) => call<{ desktop: DesktopPolicy }>("GET", `${o(slug)}/desktop-policy`),
    setDesktopPolicy: (slug: string, b: Partial<DesktopPolicy>) => call<{ desktop: DesktopPolicy }>("PUT", `${o(slug)}/desktop-policy`, b),
    usage: (slug: string, q: { days?: number; by?: UsageDimension } = {}) => call<UsageBreakdown>("GET", `${o(slug)}/usage/breakdown${qs({ days: q.days ?? 30, by: q.by ?? "user" })}`),
    usageExport: (slug: string, days = 30, format: "csv" | "json" = "csv") => call<string>("GET", `${o(slug)}/usage/export${qs({ days, format })}`, undefined, true),
    sendUsageReport: (slug: string, b: { days?: number; to?: string } = {}) => call<{ success: true; sent_to: string }>("POST", `${o(slug)}/usage/report`, b),

    billing: (slug: string) => call<{ billing: OrgBilling }>("GET", `${o(slug)}/billing`),
    ledger: (slug: string, limit = 100) => call<{ entries: OrgLedgerEntry[] }>("GET", `${o(slug)}/billing/ledger?limit=${limit}`),
    subscribe: (slug: string, plan: SelfServePlan) => call<{ url: string }>("POST", `${o(slug)}/billing/checkout`, { plan }),
    changePlan: (slug: string, plan: SelfServePlan) => call<{ plan: OrgPlan }>("POST", `${o(slug)}/billing/plan`, { plan }),
    redeemPromo: (slug: string, code: string) => call<{ discount: OrgDiscount }>("POST", `${o(slug)}/billing/promo`, { code }),
    portal: (slug: string) => call<{ url: string }>("POST", `${o(slug)}/billing/portal`, {}),
    buyCredits: (slug: string, pack_id: string) => call<{ url: string }>("POST", `${o(slug)}/billing/credits/checkout`, { pack_id }),
    setSpendLimit: (slug: string, monthly_spend_limit: number | null) => call<{ success: true }>("PATCH", `${o(slug)}/billing`, { monthly_spend_limit }),
    invoices: (slug: string, q: { limit?: number; cursor?: string | null; status?: InvoiceStatus } = {}) =>
      call<InvoicePage>("GET", `${o(slug)}/billing/invoices${qs(q)}`),
    upcomingInvoice: (slug: string) => call<{ upcoming: UpcomingInvoice | null }>("GET", `${o(slug)}/billing/invoices/upcoming`),
    invoicesExport: (slug: string) => call<string>("GET", `${o(slug)}/billing/invoices/export?format=csv`, undefined, true),
    receiptUrl: (slug: string, invoiceId: string) => call<{ receipt_url: string | null }>("GET", `${o(slug)}/billing/invoices/${invoiceId}/receipt`),
    emailInvoice: (slug: string, invoiceId: string, to?: string) => call<{ success: true; sent_to: string }>("POST", `${o(slug)}/billing/invoices/${invoiceId}/send`, { to }),
    billingDetails: (slug: string) => call<{ details: BillingDetails }>("GET", `${o(slug)}/billing/details`),
    saveBillingDetails: (slug: string, b: BillingDetailsInput) => call<{ details: BillingDetails }>("PUT", `${o(slug)}/billing/details`, b),
    contactSales: (slug: string, message?: string) => call<{ success: true; mailto: string }>("POST", `${o(slug)}/billing/contact-sales`, { message }),

    notifications: (slug: string) => call<{ notifications: NotificationSettings }>("GET", `${o(slug)}/notifications`),
    setNotifications: (slug: string, b: Partial<Omit<NotificationSettings, "email_configured">>) => call<{ notifications: NotificationSettings }>("PUT", `${o(slug)}/notifications`, b),
    sendTestEmail: (slug: string) => call<{ success: boolean; sent_to: string }>("POST", `${o(slug)}/notifications/test`, {}),

    audit: (slug: string, q: { limit?: number; before_id?: number; action?: string; actor?: string; since?: string } = {}) =>
      call<AuditPage>("GET", `${o(slug)}/audit${qs(q)}`),
    auditExport: (slug: string, format: "csv" | "json") => call<string>("GET", `${o(slug)}/audit/export?format=${format}`, undefined, true),
    setAuditWebhook: (slug: string, b: { url: string; secret?: string } | null) => call<{ success: true }>("PUT", `${o(slug)}/audit/webhook`, b ?? { url: "" }),

    domains: (slug: string) => call<{ domains: OrgDomain[] }>("GET", `${o(slug)}/domains`),
    addDomain: (slug: string, domain: string) => call<{ domain: OrgDomain }>("POST", `${o(slug)}/domains`, { domain }),
    verifyDomain: (slug: string, id: string) => call<{ domain: OrgDomain; verified: boolean }>("POST", `${o(slug)}/domains/${id}/verify`, {}),
    removeDomain: (slug: string, id: string) => call<{ success: true }>("DELETE", `${o(slug)}/domains/${id}`),

    sso: (slug: string) => call<{ sso: OrgSso }>("GET", `${o(slug)}/sso`),
    saveSso: (slug: string, b: { idp_metadata_url?: string; idp_metadata_xml?: string; enforced?: boolean; jit_provisioning?: boolean; jit_default_role?: "admin" | "billing_manager" | "auditor" | "member"; force?: boolean }) => call<{ sso: OrgSso }>("PUT", `${o(slug)}/sso`, b),
    removeSso: (slug: string) => call<{ success: true }>("DELETE", `${o(slug)}/sso`),
    ssoDiscover: (email: string) => call<SsoDiscovery>("POST", "/sso/discover", { email }),
    ssoJit: () => call<{ joined: OrgSummary[] }>("POST", "/sso/jit", {}),
  };
}
export type OrgApi = ReturnType<typeof createOrgApi>;

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner", admin: "Admin", billing_manager: "Billing manager", auditor: "Auditor", member: "Member",
};
export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Full control, including billing, deletion and ownership transfer.",
  admin: "Manage members, teams, keys, policies and security. Cannot manage billing or delete the org.",
  billing_manager: "Manage billing, invoices and notifications. Cannot spend credits.",
  auditor: "Read-only access to audit logs, usage and members. Cannot spend credits.",
  member: "Use the org wallet and create their own API keys within the org's limits.",
};

export const CAP_LABELS: Record<string, string> = {
  "org.update": "Edit organization", "members.invite": "Invite members", "members.remove": "Remove members",
  "members.set_role": "Change roles", "members.limits": "Set member limits", "teams.manage": "Manage teams",
  "keys.revoke_any": "Revoke any API key", "keys.restrict_any": "Restrict any API key",
  "billing.manage": "Manage billing", "audit.read": "View audit log", "audit.export": "Export audit log",
  "sso.manage": "Manage SSO", "domains.manage": "Manage domains", "security.manage": "Manage security settings",
  "policies.manage": "Manage usage and desktop policies", "notifications.manage": "Manage notifications",
  "usage.read_all": "View org usage", "usage.export": "Export usage",
};
