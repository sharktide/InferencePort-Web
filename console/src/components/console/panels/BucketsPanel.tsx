"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrgContext } from "../OrgContext";
import styles from "./Panel.module.css";

type Bucket = { id: string; name: string; bytes_used: number; bytes_reserved: number; quota_bytes: number; status: string };
type Entry = { entry: string; object_key: string; size_bytes: number; s3_etag: string };
type Credential = { id: string; access_key_id: string; expires_at: string; revoked_at: string | null };
type Catalog = { status: string; endpoint: string; pricing: { rate_version?: string; meters?: Record<string, { name: string; unit: string; bands: string[][]; effective_at: string }>; offers?: unknown[] } };
const bytes = (value: number) => `${(Number(value) / 1024 ** 2).toLocaleString(undefined, { maximumFractionDigits: 2 })} MiB`;
const xmlValue = (xml: string, tag: string) => new DOMParser().parseFromString(xml, "application/xml").getElementsByTagName(tag)[0]?.textContent ?? "";
const objectPath = (bucket: string, key: string) => `/s3/${encodeURIComponent(bucket)}/${encodeURIComponent(key).replace(/\./g, "%2E")}`;

export default function BucketsPanel({ apiBase, session }: { apiBase: string; session: { access_token?: string } | null }) {
  const { activeOrg, activeSlug } = useOrgContext();
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [usage, setUsage] = useState<{ meters: { meter: string; quantity: string }[]; settlements: { amount_credits: string }[]; held_credits: string; carried_credits: string; debited_credits: string } | null>(null);
  const canAdmin = !activeOrg || ["owner", "admin"].includes(activeOrg.role);
  const canWrite = !activeOrg || ["owner", "admin", "member"].includes(activeOrg.role);

  const call = useCallback(async (path: string, init: RequestInit = {}, raw = false) => {
    const headers = new Headers(init.headers);
    if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
    if (activeSlug) headers.set("X-InferencePort-Org", activeSlug);
    const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, { ...init, headers, cache: "no-store" });
    if (!response.ok) {
      const body = await response.text();
      let detail = "";
      try { detail = JSON.parse(body).detail; } catch { detail = xmlValue(body, "Message"); }
      throw new Error(detail || `Request failed (HTTP ${response.status}).`);
    }
    if (raw) return response;
    return response.status === 204 ? null : response.json();
  }, [apiBase, session?.access_token, activeSlug]);

  const refresh = useCallback(async () => {
    const status: Catalog = await call("/v1/buckets/status");
    setCatalog(status);
    if (status.status !== "not_available") {
      const list = await call("/v1/buckets?limit=1000");
      setBuckets(list.buckets); setBucketContinuation(list.continuation_token);
      if (canAdmin) { const keys = await call("/v1/buckets/s3-credentials"); setCredentials(keys.credentials); setCredentialContinuation(keys.continuation_token); }
    }
  }, [call, canAdmin]);

  useEffect(() => {
    let live = true;
    setBuckets([]); setSelected(null); setEntries([]); setSecret(null); setUsage(null); setCredentials([]);
    void refresh().catch((error) => { if (live) setMessage(error.message); });
    return () => { live = false; };
  }, [refresh]);

  async function act(work: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed."); }
    finally { setBusy(false); }
  }

  async function browse(bucket: Bucket, token: string | null = null, nextPrefix = prefix) {
    setSelected(bucket);
    const query = new URLSearchParams({ prefix: nextPrefix, max_keys: "100" });
    if (token) query.set("continuation_token", token);
    const result = await call(`/v1/buckets/${bucket.id}/objects?${query}`);
    setEntries(result.objects); setContinuation(result.continuation_token);
    setUsage(await call(`/v1/buckets/${bucket.id}/usage`));
  }

  async function upload(file: File) {
    if (!selected) return;
    const path = objectPath(selected.name, file.name);
    const initiated = await call(`${path}?uploads`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" } }, true);
    const uploadId = xmlValue(await initiated.text(), "UploadId");
    const parts: { number: number; etag: string }[] = [];
    try {
      for (let offset = 0, number = 1; offset < file.size || number === 1; offset += 8 * 1024 ** 2, number++) {
        const response = await call(`${path}?uploadId=${encodeURIComponent(uploadId)}&partNumber=${number}`, { method: "PUT", body: file.slice(offset, offset + 8 * 1024 ** 2) }, true);
        parts.push({ number, etag: response.headers.get("etag") || "" });
        setMessage(`Uploading ${file.name}: ${Math.min(file.size, offset + 8 * 1024 ** 2).toLocaleString()} / ${file.size.toLocaleString()} bytes`);
      }
      const doc = document.implementation.createDocument("", "CompleteMultipartUpload");
      for (const item of parts) {
        const part = doc.createElement("Part");
        const number = doc.createElement("PartNumber"); number.textContent = String(item.number); part.appendChild(number);
        const etag = doc.createElement("ETag"); etag.textContent = item.etag; part.appendChild(etag);
        doc.documentElement.appendChild(part);
      }
      await call(`${path}?uploadId=${encodeURIComponent(uploadId)}`, { method: "POST", body: new XMLSerializer().serializeToString(doc), headers: { "Content-Type": "application/xml" } }, true);
      setMessage(`Uploaded ${file.name}.`);
      await browse(selected); await refresh();
    } catch (error) {
      await call(`${path}?uploadId=${encodeURIComponent(uploadId)}`, { method: "DELETE" }, true).catch(() => undefined);
      throw error;
    }
  }

  async function download(entry: Entry) {
    if (!selected) return;
    if (Number(entry.size_bytes) > 256 * 1024 ** 2) throw new Error("Use ipx bucket download or an S3 client for files over 256 MiB.");
    const response = await call(objectPath(selected.name, entry.entry), {}, true);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = entry.entry.split("/").pop() || "download";
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return <div className={`${styles.panel} ${styles.active}`}>
    <section className={`${styles.card} ${styles.wide}`}>
      <h1 className={styles.heading}>Buckets</h1>
      <p>Workspace: {activeOrg?.name ?? "Personal"} · Private object storage</p>
      <p role="status" aria-live="polite">{message || (catalog ? catalog.status === "not_available" ? "Buckets is not available on this server yet." : "Private beta · Hot storage in East US" : "Loading…")}</p>
      <button type="button" disabled={busy} onClick={() => void act(refresh)}>Refresh</button>
      {catalog && catalog.status !== "not_available" && <>
        {canAdmin && <form onSubmit={(event) => { event.preventDefault(); void act(async () => {
          await call("/v1/buckets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, quota_bytes: Math.floor(Number(quota) * 1024 ** 3) }) });
          setName(""); await refresh();
        }); }}>
          <label>Bucket name <input aria-label="Bucket name" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={63} pattern="[a-z0-9][a-z0-9.-]+[a-z0-9]" /></label>{" "}
          <label>Quota (GiB) <input aria-label="Quota (GiB)" type="number" min="1" max="1024" value={quota} onChange={(e) => setQuota(e.target.value)} required /></label>{" "}
          <button disabled={busy} type="submit">Create bucket</button>
        </form>}
        <table><thead><tr><th>Name</th><th>Used / quota</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {buckets.map((bucket) => <tr key={bucket.id}><td>{bucket.name}</td><td>{bytes(bucket.bytes_used)} / {bytes(bucket.quota_bytes)}</td><td>{bucket.status}</td><td>
            <button type="button" disabled={busy} onClick={() => void act(() => browse(bucket))}>Browse</button>{" "}
            {canAdmin && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete empty bucket ${bucket.name}?`)) void act(async () => { await call(`/v1/buckets/${bucket.id}`, { method: "DELETE" }); if (selected?.id === bucket.id) setSelected(null); await refresh(); }); }}>Delete</button>}
          </td></tr>)}
        </tbody></table>
        {bucketContinuation && <button disabled={busy} onClick={() => void act(async () => { const page = await call(`/v1/buckets?limit=1000&continuation_token=${encodeURIComponent(bucketContinuation)}`); setBuckets((rows) => [...rows, ...page.buckets]); setBucketContinuation(page.continuation_token); })}>More buckets</button>}
      </>}
    </section>
    {selected && <section className={`${styles.card} ${styles.wide}`}>
      <h2 className={styles.heading}>{selected.name}</h2>
      <form onSubmit={(event) => { event.preventDefault(); void act(() => browse(selected)); }}>
        <label>Key prefix <input aria-label="Key prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} /></label>{" "}<button disabled={busy}>Search</button>
      </form>
      {canWrite && <label>Upload file <input aria-label="Upload file" type="file" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void act(() => upload(file)); e.target.value = ""; }} /></label>}
      <table><thead><tr><th>Key</th><th>Size</th><th>Actions</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.entry}>
        <td style={{ overflowWrap: "anywhere" }}>{entry.entry}</td><td>{bytes(entry.size_bytes)}</td><td><button disabled={busy} onClick={() => void act(() => download(entry))}>Download</button>{" "}
          {canWrite && <button disabled={busy} onClick={() => { if (window.confirm(`Delete ${entry.entry}?`)) void act(async () => { await call(objectPath(selected.name, entry.entry), { method: "DELETE" }, true); await browse(selected); await refresh(); }); }}>Delete</button>}</td>
      </tr>)}</tbody></table>
      {continuation && <button disabled={busy} onClick={() => void act(() => browse(selected, continuation))}>Next page</button>}
      {usage && <><h3>Measured usage</h3><ul>{usage.meters.map((meter) => <li key={meter.meter}>{meter.meter}: {meter.quantity}</li>)}</ul>
        <p>Debited credits: {usage.debited_credits} · Pending holds: {usage.held_credits} · Fractional carry: {usage.carried_credits}</p></>}
      <p>Only Hot storage is enabled. Azure retention can keep deleted data billable; insufficient credits pauses new writes and does not delete objects.</p>
    </section>}
    {canAdmin && catalog?.status === "private_beta" && <section className={`${styles.card} ${styles.wide}`}>
      <h2 className={styles.heading}>S3 credentials</h2>
      <label><input type="checkbox" checked={readOnlyKey} onChange={(event) => setReadOnlyKey(event.target.checked)} /> Read only</label>{" "}
      <label>Key prefix <input aria-label="Credential key prefix" value={keyPrefix} onChange={(event) => setKeyPrefix(event.target.value)} /></label>{" "}
      <label>Expires in <select aria-label="Credential expiry" value={keyTtl} onChange={(event) => setKeyTtl(event.target.value)}><option value="600">10 minutes</option><option value="86400">1 day</option><option value="2592000">30 days</option></select></label>
      <button disabled={busy} onClick={() => void act(async () => {
        const value = await call("/v1/buckets/s3-credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissions: readOnlyKey ? ["storage.read"] : ["storage.read", "storage.write"], bucket_ids: selected ? [selected.id] : null, key_prefixes: keyPrefix ? [keyPrefix] : null, expires_in: Number(keyTtl) }) });
        setSecret(value); await refresh();
      })}>Issue {selected ? `for ${selected.name}` : "workspace credential"}</button>
      {secret && <div role="status"><p>Copy this secret now. It will not be shown again.</p>
        <label>Access key ID <input readOnly value={secret.access_key_id} /></label>
        <label>Secret access key <input readOnly type="password" value={secret.secret_access_key} /></label>
        <button onClick={() => void navigator.clipboard.writeText(secret.secret_access_key)}>Copy secret</button>{" "}<button onClick={() => setSecret(null)}>Dismiss secret</button>
      </div>}
      <ul>{credentials.map((credential) => <li key={credential.id}>{credential.access_key_id} · expires {credential.expires_at} · {credential.revoked_at ? "revoked" : <button disabled={busy} onClick={() => void act(async () => { await call(`/v1/buckets/s3-credentials/${credential.id}`, { method: "DELETE" }); if (secret?.id === credential.id) setSecret(null); await refresh(); })}>Revoke</button>}{!credential.revoked_at && <button disabled={busy} onClick={() => void act(async () => {
        const value = await call(`/v1/buckets/s3-credentials/${credential.id}/rotate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revoke_previous: false }) });
        setSecret(value); await refresh(); setMessage("Rotation issued a new secret with the same scope. Revoke the old credential after updating your clients.");
      })}>Rotate</button>}</li>)}</ul>
      {credentialContinuation && <button disabled={busy} onClick={() => void act(async () => { const page = await call(`/v1/buckets/s3-credentials?continuation_token=${encodeURIComponent(credentialContinuation)}`); setCredentials((rows) => [...rows, ...page.credentials]); setCredentialContinuation(page.continuation_token); })}>More credentials</button>}
    </section>}
    <section className={`${styles.card} ${styles.wide}`}>
      <h2 className={styles.heading}>Azure retail rates</h2>
      {catalog?.pricing?.meters && Object.keys(catalog.pricing.meters).length > 0 ? <>
        <p>USD · East US · LRS · Hot · no markup</p><p>Rate version: <code style={{ overflowWrap: "anywhere" }}>{catalog.pricing.rate_version}</code></p>
        <table><thead><tr><th>Meter</th><th>Unit</th><th>Published bands (from / USD)</th><th>Effective date</th></tr></thead><tbody>{Object.entries(catalog.pricing.meters).map(([key, meter]) => <tr key={key}><td>{meter.name}</td><td>{meter.unit}</td><td>{meter.bands.map(([from, rate]) => `${from}: $${rate}`).join("; ")}</td><td>{meter.effective_at}</td></tr>)}</tbody></table>
      </> : <p>No verified Azure retail rates have been published on this server.</p>}
      <p>Charges include actual Azure calls, stored and retained data, retrieval and applicable transfer. Capacity and transfer bands are shared at the backing account level. Reserved-capacity discounts and independently funded promotions are unavailable.</p>
      <a href="https://docs.inferenceport.ai/api/buckets.html" target="_blank" rel="noreferrer">Buckets API and CLI guide</a>
    </section>
  </div>;
}
