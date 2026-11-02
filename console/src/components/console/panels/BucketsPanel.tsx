"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOrgContext } from "../OrgContext";
import styles from "./Panel.module.css";
import ui from "./BucketsPanel.module.css";
import BucketConnection from "./BucketConnection";
import BucketSettings from "./BucketSettings";
import BucketDialog from "./BucketDialog";

type Bucket = { id: string; name: string; bytes_used: number; bytes_reserved: number; quota_bytes: number; status: string };
type Entry = { entry: string; object_key: string; size_bytes: number; s3_etag: string };
type Credential = { id: string; access_key_id: string; expires_at: string; revoked_at: string | null; scopes?: { permissions?: string[]; key_prefixes?: string[] | null; bucket_ids?: string[] | null } };
type Catalog = { status: string; endpoint: string; object_writes_enabled?: boolean; pricing: { status?: string; rate_version?: string; meters?: Record<string, { name: string; unit: string; bands: string[][]; effective_at: string }>; offers?: unknown[] } };
const bytes = (value: number) => {
  const size = Number(value);
  if (!Number.isFinite(size)) return "—";
  if (size < 1024) return `${size.toLocaleString()} B`;
  const index = Math.min(4, Math.floor(Math.log(Math.abs(size)) / Math.log(1024)));
  return `${(size / 1024 ** index).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${["B", "KiB", "MiB", "GiB", "TiB"][index]}`;
};
const formatDate = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  const dateOnly = /^\\d{4}-\\d{2}-\\d{2}$/.test(value);
  return new Intl.DateTimeFormat(undefined, dateOnly ? { dateStyle: "medium", timeZone: "UTC" } : { dateStyle: "medium", timeStyle: "short" }).format(date);
};
const price = (value: string) => {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : value;
};
const unitLabel = (unit: string) => unit === "10K" ? "10,000 operations" : unit.replace(/^1\\s*/, "").replace(/GB\\/Month/i, "GB-month").trim();
const formatThreshold = (value: string, unit: string) => {
  const number = Number(value);
  const label = Number.isFinite(number) ? number.toLocaleString("en-US", { maximumFractionDigits: 2 }) : value;
  return `From ${label} ${unitLabel(unit)}`;
};
const xmlValue = (xml: string, tag: string) => new DOMParser().parseFromString(xml, "application/xml").getElementsByTagName(tag)[0]?.textContent ?? "";
const objectPath = (endpoint: string, bucket: string, key: string) => `${endpoint}${encodeURIComponent(bucket)}/${encodeURIComponent(key).replace(/\./g, "%2E")}`;

export default function BucketsPanel({ apiBase, session }: { apiBase: string; session: { access_token?: string } | null }) {
  const { activeOrg, activeSlug, workspaceReady, workspaceError, setActiveSlug, refresh: refreshOrgs } = useOrgContext();
  const refreshId = useRef(0);
  const [editing, setEditing] = useState<Bucket | null>(null);
  const [creating, setCreating] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const browseId = useRef(0);
  const credentialAttempt = useRef<{ path: string; body: string; key: string } | null>(null);
  const [tab, setTab] = useState("files");
  const [workspace, setWorkspace] = useState<{ owner_kind: string; owner_id: string; endpoint: string; selection: string } | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selected, setSelected] = useState<Bucket | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [secret, setSecret] = useState<Record<string, string> | null>(null);
  const [prefix, setPrefix] = useState("");
  const [bucketContinuation, setBucketContinuation] = useState<string | null>(null);
  const [credentialContinuation, setCredentialContinuation] = useState<string | null>(null);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [quota, setQuota] = useState("10");
  const [readOnlyKey, setReadOnlyKey] = useState(true);
  const [keyPrefix, setKeyPrefix] = useState("");
  const [keyTtl, setKeyTtl] = useState("86400");
  const [credentialBucketId, setCredentialBucketId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [usage, setUsage] = useState<{ meters: { meter: string; quantity: string }[]; settlements: { amount_credits: string }[]; held_credits: string; carried_credits: string; debited_credits: string } | null>(null);
  const canAdmin = !activeOrg || ["owner", "admin"].includes(activeOrg.role);
  const pricingReady = catalog?.pricing?.status === "verified" && catalog?.object_writes_enabled !== false;
  const canWrite = !activeOrg || ["owner", "admin", "member"].includes(activeOrg.role);

  const contextKey = JSON.stringify([apiBase, workspaceReady, activeOrg ? `org:${activeOrg.id}` : "user:personal", session?.access_token || ""]);
  const contextRef = useRef(contextKey);
  contextRef.current = contextKey;
  const s3Path = workspace?.endpoint || "";
  const mounted = useRef(true);
  const isCurrent = () => contextRef.current === contextKey && mounted.current;
  const call = useCallback(async (path: string, init: RequestInit = {}, raw = false, detached = false) => {
    if (!detached && (!workspaceReady || !mounted.current || contextRef.current !== contextKey)) throw new Error("Wait for the selected workspace to load.");
    const epoch = refreshId.current;
    const headers = new Headers(init.headers);
    if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
    if (activeSlug) headers.set("X-InferencePort-Org", activeSlug);
    const timeout = AbortSignal.timeout(90_000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const response = await fetch(path.startsWith("https://") ? path : `${apiBase.replace(/\/$/, "")}${path}`, { ...init, headers, signal, cache: "no-store" });
    if (!detached && (!mounted.current || contextRef.current !== contextKey || epoch !== refreshId.current)) throw new Error("Workspace changed; retry in the current workspace.");
    if (!response.ok) {
      const body = await response.text();
      let detail = "";
      try { detail = JSON.parse(body).detail; } catch { detail = xmlValue(body, "Message"); }
      throw new Error(detail || `Request failed (HTTP ${response.status}).`);
    }
    if (raw) return response;
    const value = response.status === 204 ? null : await response.json();
    if (!detached && (!mounted.current || contextRef.current !== contextKey || epoch !== refreshId.current)) throw new Error("Workspace changed; retry in the current workspace.");
    return value;
  }, [apiBase, session?.access_token, activeSlug, workspaceReady, contextKey]);

  const refresh = useCallback(async () => {
    const requestId = ++refreshId.current;
    const [status, scope]: [Catalog, { owner_kind: string; owner_id: string; endpoint: string }] = await Promise.all([call("/v1/buckets/status"), call("/v1/buckets/workspace")]);
    const endpoint = new URL(scope.endpoint);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== `/${scope.owner_id}/s3/`) throw new Error("The server returned an invalid workspace S3 endpoint.");
    if (requestId !== refreshId.current) return;
    setCatalog(status);
    setWorkspace({ ...scope, selection: contextKey });
    if (status.status !== "not_available") {
      const list = await call("/v1/buckets?limit=1000");
      if (requestId !== refreshId.current) return;
      setBuckets(list.buckets); setBucketContinuation(list.continuation_token);
      if (canAdmin) { const keys = await call("/v1/buckets/s3-credentials"); if (requestId === refreshId.current) { setCredentials(keys.credentials); setCredentialContinuation(keys.continuation_token); } }
    }
  }, [call, canAdmin, contextKey]);

  useEffect(() => {
    let live = true; mounted.current = true;
    setEditing(null); setCreating(false); browseId.current++; setFilesLoading(false); setCredentialBucketId(""); credentialAttempt.current = null; setBucketContinuation(null); setCredentialContinuation(null); setContinuation(null);
    setWorkspace(null); setBusy(false); setMessage(""); setPrefix(""); setKeyPrefix(""); setReadOnlyKey(true); setName(""); setTab("files");
    setBuckets([]); setSelected(null); setEntries([]); setSecret(null); setUsage(null); setCredentials([]);
    if (workspaceReady) void refresh().catch((error) => { if (live) setMessage(error.message); });
    return () => { live = false; mounted.current = false; refreshId.current++; };
  }, [refresh, workspaceReady]);

  const tabs = [
    { id: "files", label: "Files" }, { id: "connect", label: "Connect" },
    ...(canAdmin ? [{ id: "credentials", label: "Credentials" }] : []), { id: "pricing", label: "Pricing" },
  ];
  function selectTab(id: string) {
    if (id !== "credentials") setSecret(null);
    if (id !== "files") { browseId.current++; setSelected(null); setEditing(null); setCreating(false); }
    setTab(id);
  }

  async function act(work: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await work(); } catch (error) { if (contextRef.current === contextKey) setMessage(error instanceof Error ? error.message : "Request failed."); }
    finally { if (contextRef.current === contextKey) setBusy(false); }
  }

  function closeBrowse() {
    browseId.current++;
    setSelected(null); setEntries([]); setUsage(null); setContinuation(null); setPrefix(""); setFilesLoading(false);
  }

  async function browse(bucket: Bucket, token: string | null = null, nextPrefix = prefix) {
    const requestId = ++browseId.current;
    setSelected(bucket); setFilesLoading(true);
    if (!token) { setEntries([]); setContinuation(null); setUsage(null); }
    const query = new URLSearchParams({ prefix: nextPrefix, max_keys: "100" });
    if (token) query.set("continuation_token", token);
    try {
      const result = await call(`/v1/buckets/${bucket.id}/objects?${query}`);
      if (requestId !== browseId.current || !isCurrent()) return;
      setEntries(result.objects); setContinuation(result.continuation_token);
      const nextUsage = await call(`/v1/buckets/${bucket.id}/usage`);
      if (requestId === browseId.current && isCurrent()) setUsage(nextUsage);
    } finally {
      if (requestId === browseId.current && isCurrent()) setFilesLoading(false);
    }
  }

  async function issueCredential(path: string, body: string) {
    if (credentialAttempt.current && (credentialAttempt.current.path !== path || credentialAttempt.current.body !== body)) throw new Error("Retry the pending credential request with its original options before issuing another.");
    const attempt = credentialAttempt.current || { path, body, key: crypto.randomUUID() };
    credentialAttempt.current = attempt;
    const request = () => call(path, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key }, body }, false, true);
    let value;
    try { value = await request(); }
    catch (first) {
      // A committed request can lose its response. Its UUID safely recovers the same secret.
      try { value = await request(); }
      catch {
        if (isCurrent()) { try { await refresh(); } catch {} }
        throw first;
      }
    }
    if (!isCurrent()) {
      await call(`/v1/buckets/s3-credentials/${value.id}`, { method: "DELETE" }, false, true);
      return;
    }
    credentialAttempt.current = null;
    setSecret(value);
    try { await refresh(); } catch { setMessage("Credential issued. Copy its secret now; refresh the credential list when the connection recovers."); }
  }

  async function upload(file: File) {
    if (!selected) return;
    const path = objectPath(s3Path, selected.name, file.name);
    const requestKey = crypto.randomUUID();
    let uploadId = "";
    const initiate = async () => {
      const response = await call(`${path}?uploads`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "Idempotency-Key": requestKey } }, true, true);
      const identifier = xmlValue(await response.text(), "UploadId");
      if (!identifier) throw new Error("Upload initiation returned no upload ID.");
      return identifier;
    };
    const parts: { number: number; etag: string }[] = [];
    let completed = false;
    try {
      uploadId = await initiate();
      if (!isCurrent()) throw new Error("Workspace changed; upload cancelled.");
      for (let offset = 0, number = 1; offset < file.size || number === 1; offset += 8 * 1024 ** 2, number++) {
        const response = await call(`${path}?uploadId=${encodeURIComponent(uploadId)}&partNumber=${number}`, { method: "PUT", body: file.slice(offset, offset + 8 * 1024 ** 2) }, true);
        const etag = response.headers.get("etag");
        if (!etag) throw new Error("The upload response is missing its part receipt. The server must expose the ETag response header before this upload can complete.");
        parts.push({ number, etag });
        if (isCurrent()) setMessage(`Uploading ${file.name}: ${Math.min(file.size, offset + 8 * 1024 ** 2).toLocaleString()} / ${file.size.toLocaleString()} bytes`);
      }
      const doc = document.implementation.createDocument("", "CompleteMultipartUpload");
      for (const item of parts) {
        const part = doc.createElement("Part");
        const number = doc.createElement("PartNumber"); number.textContent = String(item.number); part.appendChild(number);
        const etag = doc.createElement("ETag"); etag.textContent = item.etag; part.appendChild(etag);
        doc.documentElement.appendChild(part);
      }
      if (!isCurrent()) throw new Error("Workspace changed; upload cancelled.");
      await call(`${path}?uploadId=${encodeURIComponent(uploadId)}`, { method: "POST", body: new XMLSerializer().serializeToString(doc), headers: { "Content-Type": "application/xml" } }, true, true);
      completed = true;
    } catch (error) {
      try {
        // Repeating native initiation reconciles an unreadable or lost response.
        if (!uploadId) uploadId = await initiate();
        await call(`${path}?uploadId=${encodeURIComponent(uploadId)}`, { method: "DELETE" }, true, true);
      } catch { throw new Error(`${error instanceof Error ? error.message : "Upload failed"}; cleanup also failed. The server expires incomplete uploads; retry when the connection recovers.`); }
      throw error;
    }
    if (completed && isCurrent()) {
      setMessage(`Uploaded ${file.name}.`);
      try { await browse(selected); await refresh(); }
      catch { if (isCurrent()) setMessage(`Uploaded ${file.name}, but refreshing the listing failed. Use Refresh rather than uploading again.`); }
    }
  }

  async function download(entry: Entry) {
    if (!selected) return;
    const downloadEpoch = refreshId.current;
    if (Number(entry.size_bytes) > 256 * 1024 ** 2) throw new Error("Use ipx bucket download or an S3 client for files over 256 MiB.");
    const response = await call(`/v1/buckets/${selected.id}/object?${new URLSearchParams({ key: entry.entry })}`, {}, true);
    const declared = Number(response.headers.get("content-length"));
    if (declared > 256 * 1024 ** 2) { await response.body?.cancel(); throw new Error("File is now over 256 MiB. Use ipx or an S3 client."); }
    if (!response.body) throw new Error("Download stream unavailable.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      if (contextRef.current !== contextKey || refreshId.current !== downloadEpoch) { await reader.cancel(); throw new Error("Workspace changed; download cancelled."); }
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 256 * 1024 ** 2) { await reader.cancel(); throw new Error("File exceeded the browser download limit. Use ipx or an S3 client."); }
      chunks.push(value);
    }
    if (contextRef.current !== contextKey || refreshId.current !== downloadEpoch) throw new Error("Workspace changed; download cancelled.");
    const url = URL.createObjectURL(new Blob(chunks as BlobPart[]));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = entry.entry.split("/").pop() || "download";
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  if (!workspaceReady) return <section className={styles.card}><h1>Buckets</h1><p role="status">{workspaceError || "Waiting for the selected organization. No personal workspace is used while it loads."}</p><button onClick={() => void refreshOrgs()}>Retry workspace</button><button onClick={() => setActiveSlug(null)}>Use personal workspace</button></section>;
  if (!workspace || workspace.selection !== contextKey) return <section className={styles.card}><h1>Buckets</h1><p role="status">{message || "Loading workspace…"}</p><button onClick={() => void act(refresh)}>Retry</button></section>;
  return <div className={`${styles.panel} ${styles.active} ${ui.panel}`}>
    <section className={`${styles.card} ${styles.wide}`}>
      <div className={ui.header}><div className={ui.intro}>
      <h1 className={styles.heading}>Buckets</h1>
      <p>Workspace: {activeOrg?.name ?? "Personal"} · Private object storage</p>
      <p role="status" aria-live="polite">{message || (catalog?.status === "not_available" ? "Buckets is not available on this server yet." : "Standard storage · Private by default")}</p>
      </div><button type="button" disabled={busy} onClick={() => void act(refresh)}>Refresh</button></div>
      <div role="tablist" aria-label="Bucket tools" className={ui.tabs}>
        {tabs.map((item, index) => <button key={item.id} type="button" role="tab" id={`bucket-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`bucket-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => selectTab(item.id)} onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); selectTab(tabs[next].id); document.getElementById(`bucket-tab-${tabs[next].id}`)?.focus(); }
        }}>{item.label}</button>)}
      </div>
    </section>
    <div role="tabpanel" id="bucket-panel-files" aria-labelledby="bucket-tab-files" hidden={tab !== "files"} className={ui.tabPanel}>
    <section className={`${styles.card} ${styles.wide}`}>
      <h2 className={styles.heading}>Your buckets</h2>
      {catalog && catalog.status !== "not_available" && <>
        <p>Bucket names are unique within this workspace. Other users and organizations can use the same name; your credentials select which workspace you access.</p>
        {canAdmin && <details className={ui.createBucket}><summary>Create a bucket</summary><form className={ui.createForm} onSubmit={(event) => { event.preventDefault(); void act(async () => {
          await call("/v1/buckets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, quota_bytes: Math.floor(Number(quota) * 1024 ** 3) }) });
          setName(""); await refresh();
        }); }}>
          <label>Bucket name <input aria-label="Bucket name" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={63} pattern="[a-z0-9][a-z0-9.-]+[a-z0-9]" /></label>{" "}
          <label>Quota (GiB) <input aria-label="Quota (GiB)" type="number" min="1" max="1024" value={quota} onChange={(e) => setQuota(e.target.value)} required /></label>{" "}
          <button disabled={busy} type="submit">Create bucket</button>
        </form></details>}
        <div className={ui.tableScroll} tabIndex={0}><table><thead><tr><th>Name</th><th>Used / quota</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {buckets.length === 0 && <tr><td colSpan={4} className={ui.empty}>No buckets yet. Create a bucket to start storing files.</td></tr>}
          {buckets.map((bucket) => <tr key={bucket.id}><td>{bucket.name}</td><td>{bytes(bucket.bytes_used)} / {bytes(bucket.quota_bytes)}</td><td>{bucket.status}</td><td>
            <button type="button" disabled={busy} onClick={() => void act(() => browse(bucket))}>Browse</button>{" "}
            {canAdmin && <button type="button" disabled={busy} onClick={() => setEditing(bucket)}>Settings</button>}{" "}
            {canAdmin && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete empty bucket ${bucket.name}?`)) void act(async () => { await call(`/v1/buckets/${bucket.id}`, { method: "DELETE" }); if (selected?.id === bucket.id) setSelected(null); await refresh(); }); }}>Delete</button>}
          </td></tr>)}
        </tbody></table></div>
        {bucketContinuation && <button disabled={busy} onClick={() => void act(async () => { const page = await call(`/v1/buckets?limit=1000&continuation_token=${encodeURIComponent(bucketContinuation)}`); setBuckets((rows) => [...rows, ...page.buckets]); setBucketContinuation(page.continuation_token); })}>More buckets</button>}
      </>}
    </section>
    {editing && canAdmin && <BucketSettings key={editing.id} bucket={editing} busy={busy} onCancel={() => setEditing(null)} onSave={(changes) => void act(async () => {
      const updated = await call(`/v1/buckets/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      if (selected?.id === updated.id) setSelected(updated);
      setBuckets((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      setEditing(null); setMessage("Bucket settings saved."); await refresh();
    })} />}
    {selected && <section className={`${styles.card} ${styles.wide}`}>
      <h2 className={styles.heading}>{selected.name}</h2>
      <form className={ui.searchForm} onSubmit={(event) => { event.preventDefault(); void act(() => browse(selected)); }}>
        <label>Key prefix <input aria-label="Key prefix" value={prefix} onChange={(e) => { setPrefix(e.target.value); setContinuation(null); }} /></label>{" "}<button disabled={busy}>Search</button>
      </form>
      {canWrite && <label>Upload file <input aria-label="Upload file" type="file" disabled={busy || !pricingReady || selected.status !== "active"} onChange={(e) => { const file = e.target.files?.[0]; if (file) void act(() => upload(file)); e.target.value = ""; }} /></label>}
      {canWrite && selected.status === "read_only" && <p role="status">Uploads are paused for this bucket. {canAdmin ? "Open Settings to resume uploads." : "Ask a workspace owner or administrator to resume uploads."}</p>}
      {canWrite && selected.status === "active" && !pricingReady && <p role="status">Uploads are paused while verified pricing is unavailable. Use Refresh to retry.</p>}
      <div className={ui.tableScroll} tabIndex={0}><table><thead><tr><th>Key</th><th>Size</th><th>Actions</th></tr></thead><tbody>{entries.length === 0 && <tr><td colSpan={3} className={ui.empty}>No objects match this prefix.</td></tr>}{entries.map((entry) => <tr key={entry.entry}>
        <td style={{ overflowWrap: "anywhere" }}>{entry.entry}</td><td>{bytes(entry.size_bytes)}</td><td><button disabled={busy} onClick={() => void act(() => download(entry))}>Download</button>{" "}
          {canWrite && <button disabled={busy} onClick={() => { if (window.confirm(`Delete ${entry.entry}?`)) void act(async () => { await call(`/v1/buckets/${selected.id}/object?${new URLSearchParams({ key: entry.entry })}`, { method: "DELETE" }, true); await browse(selected); await refresh(); }); }}>Delete</button>}</td>
      </tr>)}</tbody></table></div>
      {continuation && <button disabled={busy} onClick={() => void act(() => browse(selected, continuation))}>Next page</button>}
      {usage && <details className={ui.usage}><summary>Usage and retention</summary><ul>{usage.meters.map((meter) => <li key={meter.meter}>{meter.meter}: {meter.quantity}</li>)}</ul>
        <p>Debited credits: {usage.debited_credits} · Pending holds: {usage.held_credits} · Fractional carry: {usage.carried_credits}</p>
      <p>Retained versions and pending data can remain billable after deletion; insufficient credits pauses new writes and does not delete objects.</p></details>}
    </section>}
    </div>
    <div role="tabpanel" id="bucket-panel-connect" aria-labelledby="bucket-tab-connect" hidden={tab !== "connect"} className={ui.tabPanel}>
      {catalog && catalog.status !== "not_available" && <BucketConnection endpoint={workspace.endpoint} buckets={buckets} selectedName={selected?.name} workspaceId={workspace.owner_id} workspaceKind={workspace.owner_kind} canAdmin={canAdmin} onCredentials={() => selectTab("credentials")} />}
    </div>
    <div role="tabpanel" id="bucket-panel-credentials" aria-labelledby="bucket-tab-credentials" hidden={tab !== "credentials"} className={ui.tabPanel}>
    {canAdmin && catalog && catalog.status !== "not_available" && <section id="bucket-s3-credentials" className={`${styles.card} ${styles.wide}`}>
      <h2 className={styles.heading}>S3 credentials</h2>
      <div className={ui.credentialForm}>
      <label className={ui.checkbox}><input type="checkbox" checked={readOnlyKey} onChange={(event) => setReadOnlyKey(event.target.checked)} /> Read only</label>{" "}
      <label>Object key prefix (optional) <input placeholder="e.g. models/" aria-label="Credential key prefix" value={keyPrefix} onChange={(event) => setKeyPrefix(event.target.value)} /></label>{" "}
      <label>Expires in <select aria-label="Credential expiry" value={keyTtl} onChange={(event) => setKeyTtl(event.target.value)}><option value="600">10 minutes</option><option value="86400">1 day</option><option value="2592000">30 days</option></select></label>
      </div>
      <p>Leave the object key prefix blank for the whole bucket. A prefix restricts file access and root listings. This credential allows {readOnlyKey ? "listing and downloads" : "listing, downloads and uploads"} in {selected ? selected.name : "this workspace"}.</p>
      <button disabled={busy} onClick={() => void act(async () => {
        await issueCredential("/v1/buckets/s3-credentials", JSON.stringify({ permissions: readOnlyKey ? ["storage.read"] : ["storage.read", "storage.write"], bucket_ids: selected ? [selected.id] : null, key_prefixes: keyPrefix ? [keyPrefix] : null, expires_in: Number(keyTtl) }));
      })}>Issue {selected ? `for ${selected.name}` : "workspace credential"}</button>
      {secret && <div className={ui.secret} role="status"><p>Copy this secret now. It will not be shown again.</p>
        <label>Access key ID <input readOnly value={secret.access_key_id} /></label>
        <label>Secret access key <input readOnly type="password" value={secret.secret_access_key} /></label>
        <button onClick={() => void navigator.clipboard.writeText(secret.secret_access_key)}>Copy secret</button>{" "}<button onClick={() => setSecret(null)}>Dismiss secret</button>
      </div>}
      {credentialAttempt.current && !busy && <button onClick={() => void act(async () => {
        const attempt = credentialAttempt.current;
        if (!attempt) return;
        // Resolve the original operation before abandoning its request UUID.
        try { await call(attempt.path, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key }, body: attempt.body }, false, true); } catch {}
        const receipt = await call(`/v1/buckets/s3-credentials/requests/${attempt.key}`);
        if (receipt.credential && !receipt.credential.revoked_at) await call(`/v1/buckets/s3-credentials/${receipt.credential.id}`, { method: "DELETE" });
        credentialAttempt.current = null; await refresh();
      })}>Cancel pending credential request</button>}
      <ul className={ui.credentials}>{credentials.length === 0 && <li className={ui.empty}>No S3 credentials issued for this workspace.</li>}{credentials.map((credential) => <li key={credential.id}>{credential.access_key_id} · expires {credential.expires_at}<p>{credential.scopes?.permissions?.join(", ") || "Permissions not reported"} · {credential.scopes?.key_prefixes?.length ? `Restricted prefixes: ${credential.scopes.key_prefixes.join(", ")}` : "All object prefixes"} · {credential.scopes?.bucket_ids?.length ? `${credential.scopes.bucket_ids.length} selected bucket(s)` : "Workspace buckets"}</p>{credential.revoked_at ? "revoked" : <button disabled={busy} onClick={() => void act(async () => { await call(`/v1/buckets/s3-credentials/${credential.id}`, { method: "DELETE" }); if (secret?.id === credential.id) setSecret(null); await refresh(); })}>Revoke</button>}{!credential.revoked_at && <button disabled={busy} onClick={() => void act(async () => {
        await issueCredential(`/v1/buckets/s3-credentials/${credential.id}/rotate`, JSON.stringify({ revoke_previous: false }));
        if (isCurrent()) setMessage("Rotation issued a new secret with the same scope. Revoke the old credential after updating your clients.");
      })}>Rotate</button>}</li>)}</ul>
      {credentialContinuation && <button disabled={busy} onClick={() => void act(async () => { const page = await call(`/v1/buckets/s3-credentials?continuation_token=${encodeURIComponent(credentialContinuation)}`); setCredentials((rows) => [...rows, ...page.credentials]); setCredentialContinuation(page.continuation_token); })}>More credentials</button>}
    </section>}
    </div>
    <div role="tabpanel" id="bucket-panel-pricing" aria-labelledby="bucket-tab-pricing" hidden={tab !== "pricing"} className={ui.tabPanel}>
    <section className={`${styles.card} ${styles.wide}`}>
      <h2 className={styles.heading}>Storage pricing</h2>
      {catalog?.pricing?.meters && Object.keys(catalog.pricing.meters).length > 0 ? <>
        <p>USD · Standard storage · Billed from the first unit</p><p>Rate version: <code style={{ overflowWrap: "anywhere" }}>{catalog.pricing.rate_version}</code></p>
        <div className={ui.tableScroll} tabIndex={0}><table><thead><tr><th>Meter</th><th>Unit</th><th>Volume bands (from / USD)</th><th>Effective date</th></tr></thead><tbody>{Object.entries(catalog.pricing.meters).map(([key, meter]) => <tr key={key}><td>{meter.name}</td><td>{meter.unit}</td><td>{meter.bands.map(([from, rate]) => `${from}: $${rate}`).join("; ")}</td><td>{meter.effective_at}</td></tr>)}</tbody></table></div>
      </> : <p>Verified pricing is unavailable. Refresh to retry loading the current rates. Uploads are paused until pricing is verified.</p>}
      <p>Charges cover stored and retained data, operations, and data transfer. Capacity and transfer volume bands are shared across the service. There is no free usage allowance.</p>
      <a href="https://docs.inferenceport.ai/api/buckets.html" target="_blank" rel="noreferrer">Buckets API and CLI guide</a>
    </section>
    </div>
  </div>;
}
