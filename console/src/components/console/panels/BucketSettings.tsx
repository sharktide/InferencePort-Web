"use client";

import { useState } from "react";
import ui from "./BucketsPanel.module.css";

type Bucket = { id: string; name: string; quota_bytes: number; bytes_used: number; bytes_reserved: number; status: string; visibility?: "private" | "public" };
export default function BucketSettings({ bucket, busy, onCancel, onSave }: {
  bucket: Bucket;
  busy: boolean;
  onCancel: () => void;
  onSave: (changes: Partial<{ name: string; quota_bytes: number; status: string; visibility: "private" | "public" }>) => void;
}) {
  const [name, setName] = useState(bucket.name);
  const [quota, setQuota] = useState(String(Number(bucket.quota_bytes) / 1024 ** 3));
  const [readOnly, setReadOnly] = useState(bucket.status === "read_only");
  const [visibility, setVisibility] = useState<"private" | "public">(bucket.visibility || "private");
  const minimum = Math.max(1, Number(bucket.bytes_used) + Number(bucket.bytes_reserved));
  return <div className={ui.modalSection} aria-label="Bucket settings">
    <p>Renaming changes the bucket URL. Update your S3 clients to use the new name. Objects and bucket-scoped credentials stay attached.</p>
    <form className={ui.settingsForm} onSubmit={(event) => {
      event.preventDefault();
      const changes: Parameters<typeof onSave>[0] = {};
      if (name !== bucket.name) changes.name = name;
      const quotaBytes = Math.round(Number(quota) * 1024 ** 3);
      if (quotaBytes !== Number(bucket.quota_bytes)) changes.quota_bytes = quotaBytes;
      const status = readOnly ? "read_only" : "active";
      if (status !== bucket.status) changes.status = status;
      if (visibility !== (bucket.visibility || "private")) changes.visibility = visibility;
      if (Object.keys(changes).length) onSave(changes); else onCancel();
    }}>
      <label>Bucket name <input aria-label="New bucket name" value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={63} pattern="[a-z0-9][a-z0-9.-]+[a-z0-9]" required /></label>
      <label>Maximum size (GiB) <input aria-label="Maximum bucket size (GiB)" type="number" min={minimum / 1024 ** 3} max="1024" step="any" value={quota} onChange={(event) => setQuota(event.target.value)} required /></label>
      <p>The maximum must cover stored data and active upload reservations. Increasing it does not reserve or charge for unused space.</p>
      <label>Bucket access <select aria-label="Bucket access" value={visibility} onChange={(event) => setVisibility(event.target.value as "private" | "public")}><option value="private">Private</option><option value="public">Public</option></select></label>
      <p>{visibility === "public" ? "Anyone with a file URL can download it. Downloads are billed to this workspace. Listing, uploads and deletion still require permission." : "Downloads require an authorized account or S3 credential. Switching to private blocks new public downloads; files already downloaded cannot be recalled."}</p>
      <label className={ui.checkbox}><input type="checkbox" checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} /> Pause new uploads</label>
      <div className={ui.dialogActions}><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" disabled={busy}>Save settings</button></div>
    </form>
  </div>;
}
