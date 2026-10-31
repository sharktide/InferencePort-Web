"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import styles from "./Panel.module.css";
import ui from "./ShieldWorkbench.module.css";

type Mode = "analyze" | "scan" | "phishing" | "request" | "file" | "password" | "listing" | "review" | "domain" | "check";
type InputKind = "text" | "textarea" | "email" | "password" | "number";
type Field = { name: string; label: string; kind?: InputKind; placeholder?: string; help?: string };
type JsonObject = Record<string, any>;
type Capabilities = {
  version?: string;
  tasks?: Record<string, { description?: string; thresholds?: Record<string, number> }>;
  features?: Record<string, { default: boolean; description?: string }>;
  categories?: string[];
  check_types?: string[];
  endpoints?: Record<string, string>;
};

interface Props { session: any; config: any; apiBase: string }

const MODES: { id: Mode; title: string; description: string; endpoint: string }[] = [
  { id: "analyze", title: "Risk analysis", description: "Identity, signup, login, transaction, session and behavioral risk.", endpoint: "POST /ai-shield/analyze" },
  { id: "scan", title: "Content scan", description: "Prompt injection, unsafe content, secrets, PII and links.", endpoint: "POST /ai-shield/scan" },
  { id: "phishing", title: "Phishing", description: "Inspect suspicious email, SMS, messages and their links.", endpoint: "POST /ai-shield/detect-phishing" },
  { id: "request", title: "HTTP / WAF", description: "Inspect web requests for injection, SSRF, traversal and scanners.", endpoint: "POST /ai-shield/scan" },
  { id: "file", title: "File upload", description: "Inspect files for spoofed types, executable content, macros and scripts.", endpoint: "POST /ai-shield/scan" },
  { id: "password", title: "Password", description: "Check password strength and known breaches without logging credentials.", endpoint: "POST /ai-shield/scan" },
  { id: "listing", title: "Marketplace", description: "Assess a listing for counterfeit, prohibited or fraudulent content.", endpoint: "POST /ai-shield/scan" },
  { id: "review", title: "Reviews", description: "Detect fake or coordinated reviews and suspicious activity.", endpoint: "POST /ai-shield/scan" },
  { id: "domain", title: "Domains / wallets", description: "Inspect domain impersonation and wallet formats.", endpoint: "POST /ai-shield/scan" },
  { id: "check", title: "Indicator checks", description: "Bulk-check emails, IPs, links, JWTs, hashes and other indicators.", endpoint: "POST /ai-shield/check" },
];

const TASKS = ["general", "signup", "login", "payment", "content_moderation", "prompt_guard", "agent_tool_output", "phishing", "dlp", "api_request", "file_upload", "password", "marketplace", "reviews", "domain"];
const CHECK_TYPES = ["email", "domain", "url", "ip", "phone", "username", "user_agent", "wallet", "jwt", "hash", "secret"];
const SOURCES = ["user", "tool", "document", "web", "email", "retrieval"];
const FIELD_GROUPS: Record<Mode, Field[]> = {
  analyze: [
    { name: "email", label: "Email", kind: "email", placeholder: "name@example.com" },
    { name: "phone", label: "Phone", placeholder: "+1234567890" },
    { name: "ip", label: "IP address", placeholder: "203.0.113.12" },
    { name: "username", label: "Username", placeholder: "username" },
    { name: "device", label: "Device fingerprint" },
    { name: "content", label: "Content / user submission", kind: "textarea" },
    { name: "country", label: "Country (ISO-2)", placeholder: "US" },
    { name: "city", label: "City" },
    { name: "signupTime", label: "Signup time (ISO-8601)", placeholder: "2026-01-01T00:00:00Z" },
    { name: "sender", label: "Sender" },
    { name: "metadata", label: "Behavioral metadata (JSON object)", kind: "textarea", placeholder: '{"failed_logins":5,"user_agent":"Mozilla/5.0","account_age_days":1}' },
  ],
  scan: [
    { name: "content", label: "Content to scan", kind: "textarea", placeholder: "Paste text, a model prompt, tool output or a document excerpt." },
    { name: "urls", label: "Additional URLs (one per line)", kind: "textarea" },
  ],
  phishing: [
    { name: "sender", label: "Sender", placeholder: "Service <alerts@example.com>" },
    { name: "subject", label: "Subject" },
    { name: "replyTo", label: "Reply-to address" },
    { name: "content", label: "Email / SMS / message body", kind: "textarea" },
    { name: "urls", label: "Links (one per line)", kind: "textarea" },
  ],
  request: [
    { name: "url", label: "Request URL / path", placeholder: "/api/search?q=example" },
    { name: "headers", label: "Request headers (JSON object)", kind: "textarea", placeholder: '{"User-Agent":"Mozilla/5.0"}' },
    { name: "requestBody", label: "Request body (JSON or text)", kind: "textarea" },
  ],
  file: [{ name: "mime", label: "Claimed MIME type (optional)", placeholder: "application/pdf" }],
  password: [
    { name: "password", label: "Password to check", kind: "password", help: "Only transmitted over HTTPS to Shield; never saved in this console or shown in the result." },
    { name: "email", label: "Owner email (optional)", kind: "email" },
    { name: "username", label: "Owner username (optional)" },
  ],
  listing: [
    { name: "title", label: "Listing title" },
    { name: "description", label: "Description", kind: "textarea" },
    { name: "price", label: "Listed price", kind: "number" },
    { name: "marketPrice", label: "Typical market price", kind: "number" },
    { name: "brand", label: "Brand" },
    { name: "category", label: "Category" },
    { name: "sellerAge", label: "Seller age (days)", kind: "number" },
    { name: "imageCount", label: "Number of images", kind: "number" },
  ],
  review: [
    { name: "content", label: "Review text", kind: "textarea" },
    { name: "rating", label: "Rating", kind: "number" },
    { name: "reviews24h", label: "Author reviews (last 24h)", kind: "number" },
    { name: "similarity", label: "Similarity to other reviews (0–1)", kind: "number" },
  ],
  domain: [
    { name: "domains", label: "Domains (one per line)", kind: "textarea" },
    { name: "wallet", label: "Wallet address (optional)" },
  ],
  check: [
    { name: "values", label: "Values to check (one per line, up to 500)", kind: "textarea", help: "One indicator type per request. Blank lines and lines starting with # are ignored." },
  ],
};

const FEATURE_GROUPS: Record<string, string[]> = {
  Signals: ["heuristics", "historical_memory", "duplicate_detection", "campaign_detection"],
  Intelligence: ["email_intelligence", "ip_intelligence", "phone_intelligence", "username_intelligence", "device_intelligence", "behavior_intelligence", "content_intelligence", "prompt_intelligence", "url_intelligence", "sensitive_data_detection", "domain_intelligence", "wallet_analysis", "external_lookups"],
  Agents: ["identity_analysis", "fraud_analysis", "prompt_analysis", "content_analysis", "exfiltration_analysis", "llm_reasoning"],
  Inspection: ["request_inspection", "file_inspection", "password_analysis", "commerce_analysis", "custom_policy", "memory_update"],
};
const FALLBACK_FEATURES = Object.fromEntries(Object.values(FEATURE_GROUPS).flat().map((key) => [key, { default: !["duplicate_detection", "campaign_detection", "memory_update"].includes(key), description: "" }]));
const DECISION_CLASS: Record<string, string> = { allow: styles.decisionAllow, challenge: styles.decisionChallenge, rate_limit: styles.decisionRateLimit, review: styles.decisionReview, block: styles.decisionBlock };

function lines(value: string): string[] {
  return Array.from(new Set(value.split(/\r?\n/).map((v) => v.trim()).filter((v) => v && !v.startsWith("#"))));
}
function optionalNumber(value: string, label: string): number | undefined {
  if (value.trim() === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error(label + " must be a valid number.");
  return num;
}
function objectJson(value: string, label: string): JsonObject {
  if (!value.trim()) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(label + " must be valid JSON."); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(label + " must be a JSON object.");
  return parsed as JsonObject;
}
function withValues(source: Record<string, string>, keys: string[]): JsonObject {
  const result: JsonObject = {};
  for (const key of keys) if (source[key]?.trim()) result[key] = source[key].trim();
  return result;
}
async function encodeFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => resolve(String(reader.result || "").split(",", 2)[1] || "");
    reader.readAsDataURL(file);
  });
}
function safeError(data: JsonObject, status: number): string {
  const detail = data.detail ?? data.error ?? data.message;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => typeof e?.msg === "string" ? e.msg : "Invalid input").join("; ");
  return "Shield request failed (HTTP " + status + ").";
}
function riskColor(decision: string): string {
  return DECISION_CLASS[decision] || "";
}

export default function ShieldPanel({ session, apiBase }: Props) {
  const [mode, setMode] = useState<Mode>("analyze");
  const [fields, setFields] = useState<Record<string, string>>({ task: "general", scanTask: "prompt_guard", method: "GET", indicatorType: "email", lookup: "auto", verification: "unknown" });
  const [file, setFile] = useState<File | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [capsError, setCapsError] = useState(false);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [offline, setOffline] = useState(false);
  const [noLlm, setNoLlm] = useState(false);
  const [redact, setRedact] = useState(false);
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [disposableOnly, setDisposableOnly] = useState(false);
  const [remember, setRemember] = useState(false);
  const [adminExpected, setAdminExpected] = useState(false);
  const [sellerAuthor, setSellerAuthor] = useState(false);
  const [thresholds, setThresholds] = useState<Record<string, string>>({});
  const [policyJson, setPolicyJson] = useState("");
  const [result, setResult] = useState<JsonObject | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastEndpoint, setLastEndpoint] = useState("");
  const auth = session?.access_token as string | undefined;
  const value = (key: string) => fields[key] || "";
  const update = (key: string, v: string) => setFields((p) => ({ ...p, [key]: v }));
  const current = MODES.find((m) => m.id === mode)!;

  useEffect(() => {
    let alive = true;
    fetch(apiBase.replace(/\/$/, "") + "/ai-shield/capabilities")
      .then(async (r) => { if (!r.ok) throw new Error("Capability request failed"); return r.json(); })
      .then((data: Capabilities) => { if (alive) { setCaps(data); setCapsError(false); } })
      .catch(() => { if (alive) setCapsError(true); });
    return () => { alive = false; };
  }, [apiBase]);

  const availableFeatures = useMemo(() => caps?.features || FALLBACK_FEATURES, [caps]);
  const groupedFeatures = useMemo(() => {
    const known = new Set(Object.values(FEATURE_GROUPS).flat());
    const groups: Record<string, string[]> = {};
    for (const [group, names] of Object.entries(FEATURE_GROUPS)) groups[group] = names.filter((n) => n in availableFeatures);
    const other = Object.keys(availableFeatures).filter((n) => !known.has(n));
    if (other.length) groups.Other = other;
    return groups;
  }, [availableFeatures]);
  const taskNames = useMemo(() => Object.keys(caps?.tasks || {}).length ? Object.keys(caps!.tasks!) : TASKS, [caps]);
  const checkNames = caps?.check_types?.length ? caps.check_types : CHECK_TYPES;

  const changeMode = (next: Mode) => {
    if (mode === "password") update("password", "");
    if (mode === "check" && ["jwt", "secret"].includes(value("indicatorType"))) update("values", "");
    setMode(next);
    setResult(null);
    setError("");
    setLastEndpoint("");
  };

  const makeConfig = (): JsonObject => {
    const cfg = objectJson(policyJson, "Policy configuration");
    const mergedFeatures: Record<string, boolean> = { ...(cfg.features || {}) };
    for (const [name, setting] of Object.entries(features)) mergedFeatures[name] = setting;
    if (offline) mergedFeatures.external_lookups = false;
    if (noLlm || mode === "password") mergedFeatures.llm_reasoning = false;
    if (remember && mode === "analyze") mergedFeatures.memory_update = true;
    if (Object.keys(mergedFeatures).length) cfg.features = mergedFeatures;
    const t = { ...(cfg.thresholds || {}) };
    for (const [name, input] of Object.entries(thresholds)) if (input.trim()) t[name] = optionalNumber(input, name + " threshold");
    if (Object.keys(t).length) cfg.thresholds = t;
    if (redact) cfg.redact = true;
    cfg.include_evidence = includeEvidence;
    if (mode === "check") {
      if (value("lookup") === "yes") cfg.external_lookups = true;
      if (value("lookup") === "no" || offline) cfg.external_lookups = false;
    }
    return cfg;
  };

  const makePayload = async (): Promise<{ endpoint: string; body: JsonObject }> => {
    const cfg = makeConfig();
    const body: JsonObject = { config: cfg };
    let endpoint = "/ai-shield/scan";
    const number = (input: string, output: JsonObject, key: string) => {
      const n = optionalNumber(value(input), input);
      if (n !== undefined) output[key] = n;
    };

    if (mode === "analyze") {
      endpoint = "/ai-shield/analyze";
      Object.assign(body, withValues(fields, ["email", "phone", "ip", "username", "content", "sender"]));
      if (value("device")) body.device_fingerprint = value("device");
      if (value("signupTime")) body.signup_time = value("signupTime");
      if (value("country") || value("city")) body.geolocation = withValues(fields, ["country", "city"]);
      if (value("metadata")) body.metadata = objectJson(value("metadata"), "Behavioral metadata");
      body.task = value("task") || "general";
      if (Object.keys(body).filter((k) => !["task", "config"].includes(k)).length === 0) throw new Error("Enter at least one signal to analyze.");
    } else if (mode === "scan") {
      body.task = value("scanTask") || "prompt_guard";
      if (value("content")) body.content = value("content");
      if (lines(value("urls")).length) body.urls = lines(value("urls"));
      if (!body.content && !body.urls) throw new Error("Enter content or at least one URL.");
      if (value("source")) body.source = value("source");
    } else if (mode === "phishing") {
      endpoint = "/ai-shield/detect-phishing";
      Object.assign(body, withValues(fields, ["sender", "subject", "content"]));
      if (value("replyTo")) body.reply_to = value("replyTo");
      if (lines(value("urls")).length) body.urls = lines(value("urls"));
      const authentication = withValues(fields, ["spf", "dkim", "dmarc"]);
      if (Object.keys(authentication).length) body.authentication = authentication;
      if (!body.sender && !body.subject && !body.content && !body.urls) throw new Error("Provide a sender, subject, message or URL.");
    } else if (mode === "request") {
      if (!value("url")) throw new Error("Enter a request URL or path.");
      const request: JsonObject = { method: value("method") || "GET", url: value("url") };
      if (value("headers")) {
        const headers = objectJson(value("headers"), "HTTP headers");
        if (Object.values(headers).some((v) => typeof v !== "string")) throw new Error("HTTP header values must be strings.");
        request.headers = headers;
      }
      if (value("requestBody")) {
        try { request.body = JSON.parse(value("requestBody")); }
        catch { request.body = value("requestBody"); }
      }
      if (adminExpected) request.expected_admin = true;
      body.task = "api_request";
      body.request = request;
    } else if (mode === "file") {
      if (!file) throw new Error("Select a file to inspect.");
      if (file.size > 2_000_000) throw new Error("Maximum file size is 2 MB, matching the CLI inspection limit.");
      if (file.size === 0) throw new Error("Select a non-empty file.");
      body.task = "file_upload";
      body.file = { name: file.name, content_base64: await encodeFile(file), mime: value("mime") || file.type || undefined };
    } else if (mode === "password") {
      if (!value("password")) throw new Error("Enter a password to inspect.");
      body.task = "password";
      body.password = value("password");
      Object.assign(body, withValues(fields, ["email", "username"]));
    } else if (mode === "listing") {
      if (!value("title")) throw new Error("Enter a listing title.");
      body.task = "marketplace";
      const listing = withValues(fields, ["title", "description", "brand", "category"]);
      number("price", listing, "price");
      number("marketPrice", listing, "market_price");
      number("sellerAge", listing, "seller_account_age_days");
      number("imageCount", listing, "image_count");
      body.listing = listing;
    } else if (mode === "review") {
      if (!value("content")) throw new Error("Enter review text.");
      body.task = "reviews";
      const review: JsonObject = { text: value("content") };
      number("rating", review, "rating");
      number("reviews24h", review, "reviews_by_author_24h");
      number("similarity", review, "max_similarity_to_other_reviews");
      if (value("verification") !== "unknown") review.verified_purchase = value("verification") === "yes";
      if (sellerAuthor) review.author_is_seller = true;
      body.review = review;
    } else if (mode === "domain") {
      const domains = lines(value("domains"));
      if (domains.length) body.domains = domains;
      if (value("wallet")) body.wallet = value("wallet");
      if (!domains.length && !body.wallet) throw new Error("Enter a domain or a wallet address.");
      body.task = "domain";
    } else if (mode === "check") {
      endpoint = "/ai-shield/check";
      const items = lines(value("values"));
      if (!items.length) throw new Error("Enter at least one indicator.");
      if (items.length > 500) throw new Error("Maximum 500 values per request.");
      if (items.some((v) => v.length > 4096)) throw new Error("Individual values must be at most 4,096 characters.");
      body.type = value("indicatorType") || "email";
      body.values = items;
      // Disposable-email checks use the same /check endpoint, with lookups disabled.
      if (disposableOnly && body.type === "email") cfg.external_lookups = false;
    }
    return { endpoint, body };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { endpoint, body } = await makePayload();
      if ((mode === "password" || (mode === "check" && ["jwt", "secret"].includes(value("indicatorType")))) &&
          !/^https:\/\//i.test(apiBase) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(apiBase)) {
        throw new Error("A secure HTTPS API URL is required for credential inspection.");
      }
      const response = await fetch(apiBase.replace(/\/$/, "") + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + auth },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as JsonObject;
      if (!response.ok) throw new Error(safeError(data, response.status));
      setResult(data);
      setLastEndpoint(endpoint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shield request failed.");
    } finally {
      setBusy(false);
      if (mode === "password") update("password", "");
      if (mode === "check" && ["jwt", "secret"].includes(value("indicatorType"))) update("values", "");
    }
  };

  const renderField = (field: Field) => (
    <label key={field.name} className={field.kind === "textarea" ? ui.full : ""}>
      <span className={ui.fieldLabel}>{field.label}</span>
      {field.kind === "textarea"
        ? <textarea className={ui.field} rows={field.name === "content" || field.name === "values" ? 6 : 3} placeholder={field.placeholder} value={value(field.name)} onChange={(e) => update(field.name, e.target.value)} />
        : <input className={ui.field} type={field.kind || "text"} step={field.kind === "number" ? "any" : undefined} placeholder={field.placeholder} value={value(field.name)} onChange={(e) => update(field.name, e.target.value)} autoComplete={field.kind === "password" ? "off" : undefined} />
      }
      {field.help && <span className={ui.hint}>{field.help}</span>}
    </label>
  );

  const checkResults: JsonObject[] = Array.isArray(result?.results) ? result.results : [];
  const filteredChecks = checkResults.filter((r) => (!onlyFlagged || r.verdict !== "clean") &&
    (!disposableOnly || value("indicatorType") !== "email" || Boolean(r.facts?.disposable)));
  const reasons: string[] = Array.isArray(result?.reasons) ? result.reasons : Array.isArray(result?.indicators) ? result.indicators.map(String) : [];
  const categories: string[] = Array.isArray(result?.threat_categories) ? result.threat_categories : [];
  const status = result?.decision || (typeof result?.is_phishing === "boolean" ? (result.is_phishing ? "block" : "allow") : "");

  return (
    <div className={styles.panel + " " + styles.active}>
      <section className={styles.card + " " + styles.wide}>
        <div className={ui.header}>
          <div>
            <h2>AI Shield</h2>
            <p className={styles.muted}>Explore the same Shield APIs used by the IPX CLI: abuse prevention, prompt security, fraud, phishing, file inspection, WAF, and indicator intelligence.</p>
          </div>
          <span className={ui.version}>{caps?.version ? "Shield v" + caps.version : (capsError ? "Capabilities unavailable" : "Loading capabilities…")}</span>
        </div>
        <div className={ui.modeGrid} role="tablist" aria-label="Shield workflows">
          {MODES.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={ui.mode + (mode === item.id ? " " + ui.selected : "")} onClick={() => changeMode(item.id)}>
              {item.title}
            </button>
          ))}
        </div>
        <div className={ui.workHeading}>
          <div><h3>{current.title}</h3><p className={styles.muted}>{current.description}</p></div>
          <code className={ui.endpoint}>{current.endpoint}</code>
        </div>
        {!auth && <div className={styles.lockedOverlay + " " + styles.panelLock}>Sign in to run Shield checks. Endpoint and capability information is available without signing in.</div>}
        <form onSubmit={submit} className={ui.form}>
          <div className={ui.fields}>
            {(mode === "analyze" || mode === "scan") && (
              <label>
                <span className={ui.fieldLabel}>Task profile</span>
                <select className={ui.field} value={value(mode === "analyze" ? "task" : "scanTask")} onChange={(e) => update(mode === "analyze" ? "task" : "scanTask", e.target.value)}>
                  {taskNames.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </label>
            )}
            {mode === "scan" && (
              <label>
                <span className={ui.fieldLabel}>Source</span>
                <select className={ui.field} value={value("source")} onChange={(e) => update("source", e.target.value)}>
                  <option value="">Default</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}
            {mode === "request" && (
              <label>
                <span className={ui.fieldLabel}>HTTP method</span>
                <select className={ui.field} value={value("method")} onChange={(e) => update("method", e.target.value)}>
                  {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
            )}
            {mode === "check" && (
              <>
                <label>
                  <span className={ui.fieldLabel}>Indicator type</span>
                  <select className={ui.field} value={value("indicatorType")} onChange={(e) => update("indicatorType", e.target.value)}>
                    {checkNames.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </label>
                <label>
                  <span className={ui.fieldLabel}>External reputation lookups</span>
                  <select className={ui.field} value={value("lookup")} onChange={(e) => update("lookup", e.target.value)}>
                    <option value="auto">Automatic (up to 10 values)</option>
                    <option value="yes">On</option>
                    <option value="no">Off</option>
                  </select>
                </label>
              </>
            )}
            {mode === "file" && (
              <label className={ui.full}>
                <span className={ui.fieldLabel}>File (up to 2 MB)</span>
                <input className={ui.field} type="file" onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)} />
                <span className={ui.hint}>Files are read in the browser and submitted to Shield for inspection. They are not stored by this page.</span>
              </label>
            )}
            {FIELD_GROUPS[mode].map(renderField)}
            {mode === "phishing" && ["spf", "dkim", "dmarc"].map((name) => (
              <label key={name}>
                <span className={ui.fieldLabel}>{name.toUpperCase()} result (optional)</span>
                <select className={ui.field} value={value(name)} onChange={(e) => update(name, e.target.value)}>
                  <option value="">Not provided</option>
                  {(name === "dmarc" ? ["pass", "fail", "none"] : ["pass", "fail", "softfail", "none", "neutral"]).map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
            ))}
            {mode === "review" && (
              <label>
                <span className={ui.fieldLabel}>Verified purchase</span>
                <select className={ui.field} value={value("verification") || "unknown"} onChange={(e) => update("verification", e.target.value)}>
                  <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
                </select>
              </label>
            )}
          </div>
          {mode === "analyze" && <label className={ui.check}><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember this verdict in Shield memory (opt-in)</label>}
          {mode === "request" && <label className={ui.check}><input type="checkbox" checked={adminExpected} onChange={(e) => setAdminExpected(e.target.checked)} /> This caller is expected to access admin paths</label>}
          {mode === "review" && <label className={ui.check}><input type="checkbox" checked={sellerAuthor} onChange={(e) => setSellerAuthor(e.target.checked)} /> Reviewer is the seller or linked to the seller</label>}

          <details className={styles.shieldConfigDetails}>
            <summary className={styles.shieldConfigSummary}>Advanced configuration and policy</summary>
            <div className={ui.controls}>
              <label className={ui.check}><input type="checkbox" checked={offline} onChange={(e) => setOffline(e.target.checked)} /> Disable third-party lookups</label>
              <label className={ui.check}><input type="checkbox" checked={noLlm} onChange={(e) => setNoLlm(e.target.checked)} /> Skip LLM reviewer</label>
              <label className={ui.check}><input type="checkbox" checked={redact} onChange={(e) => setRedact(e.target.checked)} /> Return redacted content</label>
              <label className={ui.check}><input type="checkbox" checked={includeEvidence} onChange={(e) => setIncludeEvidence(e.target.checked)} /> Include evidence</label>
            </div>
            {mode !== "check" && (
              <div className={ui.thresholds}>
                {["challenge", "review", "block"].map((name) => (
                  <label key={name}><span className={ui.fieldLabel}>{name} threshold (0–100)</span>
                    <input className={ui.field} type="number" min={0} max={100} placeholder="Task default" value={thresholds[name] || ""} onChange={(e) => setThresholds((old) => ({ ...old, [name]: e.target.value }))} />
                  </label>
                ))}
              </div>
            )}
            <div className={ui.featureGroups}>
              {Object.entries(groupedFeatures).map(([group, list]) => list.length > 0 && (
                <div key={group} className={styles.shieldConfigGroup}>
                  <h4>{group}</h4>
                  {list.map((name) => <label key={name} className={styles.shieldToggle} title={availableFeatures[name]?.description}>
                    <input type="checkbox" checked={features[name] ?? availableFeatures[name]?.default ?? true} onChange={(e) => setFeatures((old) => ({ ...old, [name]: e.target.checked }))} />
                    <span>{name.replace(/_/g, " ")}</span>
                  </label>)}
                </div>
              ))}
            </div>
            <label className={ui.full}>
              <span className={ui.fieldLabel}>Optional policy configuration (JSON object)</span>
              <textarea className={ui.field} rows={5} value={policyJson} onChange={(e) => setPolicyJson(e.target.value)} placeholder='{"trusted_domains":["example.com"],"blocklists":{"ips":["192.0.2.0/24"]},"custom_rules":[]}' />
              <span className={ui.hint}>Supply blocklists, allowlists, custom rules, category weights or trusted domains. Feature switches and thresholds above override conflicting JSON settings.</span>
            </label>
          </details>
          {error && <div className={ui.error} role="alert">{error}</div>}
          <button type="submit" className={ui.run} disabled={busy || !auth}>{busy ? "Running Shield check…" : "Run " + current.title.toLowerCase()}</button>
        </form>
      </section>

      {result && (
        <section className={styles.card + " " + styles.wide} aria-live="polite">
          <div className={ui.workHeading}><h2>Shield result</h2><code className={ui.endpoint}>{lastEndpoint}</code></div>
          {mode === "check" ? (
            <>
              <div className={ui.stats}>
                {([["Checked", result.count], ["Clean", result.summary?.clean], ["Suspicious", result.summary?.suspicious], ["Malicious", result.summary?.malicious]] as const).map(([label, v]) => <div key={label} className={styles.shieldStat}><span className={styles.shieldStatLabel}>{label}</span><span className={styles.shieldStatValue}>{v ?? 0}</span></div>)}
              </div>
              <div className={ui.controls}>
                <label className={ui.check}><input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Show flagged only</label>
                {value("indicatorType") === "email" && <label className={ui.check}><input type="checkbox" checked={disposableOnly} onChange={(e) => setDisposableOnly(e.target.checked)} /> Disposable only</label>}
              </div>
              <div className={ui.tableScroll}>
                <table className={ui.table}>
                  <thead><tr><th>Indicator</th><th>Verdict</th><th>Risk</th><th>Rules / facts</th></tr></thead>
                  <tbody>{filteredChecks.map((r, i) => <tr key={i}>
                    <td className={ui.mono}>{r.value}</td>
                    <td><span className={riskColor(r.decision)}>{r.verdict}</span></td>
                    <td>{r.risk_score ?? "—"}</td>
                    <td><span>{(r.rules || []).join(", ") || "—"}</span><details><summary>Facts & reasons</summary><pre className={ui.compactJson}>{JSON.stringify({ facts: r.facts, reasons: r.reasons }, null, 2)}</pre></details></td>
                  </tr>)}</tbody>
                </table>
              </div>
              {!filteredChecks.length && <p className={styles.muted}>No indicators match the selected filters.</p>}
            </>
          ) : (
            <>
              <div className={ui.stats}>
                {([["Risk score", result.risk_score], ["Confidence", result.confidence], ["Decision", status], ["Recommended action", result.recommended_action || result.threat_level]] as const).map(([label, v]) => <div key={label} className={styles.shieldStat}>
                  <span className={styles.shieldStatLabel}>{label}</span>
                  <span className={styles.shieldStatValue + " " + (label === "Decision" ? riskColor(String(v)) : "")}>{v ?? "—"}</span>
                </div>)}
              </div>
              {typeof result.is_phishing === "boolean" && <p className={ui.answer}><strong>{result.is_phishing ? "Phishing indicators detected." : "No phishing indicators detected."}</strong> {result.explanation}</p>}
              {categories.length > 0 && <><h3>Threat categories</h3><div className={styles.shieldThreats}>{categories.map((x, i) => <span className={styles.shieldThreatTag} key={i}>{x}</span>)}</div></>}
              {reasons.length > 0 && <><h3>Reasons and indicators</h3><ul className={styles.shieldReasons}>{reasons.map((x, i) => <li key={i} className={styles.shieldReasonItem}>{x}</li>)}</ul></>}
              {result.redacted_content !== undefined && <><h3>Redacted content</h3><pre className={styles.output}>{String(result.redacted_content)}</pre></>}
              {result.category_scores && <details className={ui.details}><summary>Category scores</summary><pre className={styles.output}>{JSON.stringify(result.category_scores, null, 2)}</pre></details>}
              {result.evidence && <details className={ui.details}><summary>Evidence</summary><pre className={styles.output}>{JSON.stringify(result.evidence, null, 2)}</pre></details>}
              {result.investigation && <details className={ui.details}><summary>Investigation</summary><pre className={styles.output}>{JSON.stringify(result.investigation, null, 2)}</pre></details>}
            </>
          )}
          <details className={ui.details}>
            <summary>Full JSON response</summary>
            <pre className={styles.output}>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </section>
      )}

      <section className={styles.card + " " + styles.wide}>
        <h2>API reference</h2>
        <p className={styles.muted}>Four endpoints power all the Shield workflows. The tasks, features and categories below are read from the live capabilities endpoint whenever available.</p>
        <div className={ui.apiList}>{["POST /ai-shield/analyze", "POST /ai-shield/scan", "POST /ai-shield/detect-phishing", "POST /ai-shield/check", "GET /ai-shield/capabilities"].map((endpoint) => <code key={endpoint}>{endpoint}</code>)}</div>
        <details className={ui.details}>
          <summary>Task profiles ({taskNames.length})</summary>
          <div className={ui.profileGrid}>{taskNames.map((task) => <div key={task}><strong>{task}</strong><p className={styles.muted}>{caps?.tasks?.[task]?.description || "Shield task profile"}</p></div>)}</div>
        </details>
        <details className={ui.details}>
          <summary>Features ({Object.keys(availableFeatures).length}) and threat categories</summary>
          <div className={ui.profileGrid}>{Object.entries(availableFeatures).map(([name, entry]) => <div key={name}><strong>{name}</strong><p className={styles.muted}>{entry.description || (entry.default ? "Enabled by default" : "Disabled by default")}</p></div>)}</div>
          {!!caps?.categories?.length && <div className={styles.shieldThreats}>{caps.categories.map((category) => <span className={styles.shieldThreatTag} key={category}>{category}</span>)}</div>}
        </details>
        <p className={styles.muted + " " + styles.tiny}><a href="https://docs.inferenceport.ai/en/latest/api/shield.html" target="_blank" rel="noreferrer">Full Shield documentation</a> · See also <code>ipx shield tasks</code> and <code>ipx shield check</code> in the CLI.</p>
      </section>
    </div>
  );
}
