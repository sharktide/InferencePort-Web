"use client";

import { useState } from "react";
import styles from "./Panel.module.css";
import ui from "./BucketsPanel.module.css";

type Bucket = { id: string; name: string; quota_bytes: number; bytes_used: number; bytes_reserved: number; status: string };
export default function BucketSettings({ bucket, busy, onCancel, onSave }: {
  bucket: Bucket;
  busy: boolean;
  onCancel: () => void;
  onSave: (changes: { name: string; quota_bytes: number; status: string }) => void;
}) {
  const [name, setName] = useState(bucket.name);
  const [quota, setQuota] = useState(String(Number(bucket.quota_bytes) / 1024 ** 3));
  const [readOnly, setReadOnly] = useState(bucket.status === "read_only");
  const minimum = Math.max(1, Number(bucket.bytes_used) + Number(bucket.bytes_reserved));
  return <section className={`${styles.card} ${styles.wide}`} aria-label="Bucket settings">
    <h2 className={styles.heading}>Settings for {bucket.name}</h2>
    <p>Renaming changes the bucket URL. Update your S3 clients to use the new name. Objects and bucket-scoped credentials stay attached.</p>
    <form className={ui.settingsForm} onSubmit={(event) => {
      event.preventDefault();
      onSave({ name, quota_bytes: Math.round(Number(quota) * 1024 ** 3), status: readOnly ? "read_only" : "active" });
    }}>
      <label>Bucket name <input aria-label="New bucket name" value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={63} pattern="[a-z0-9][a-z0-9.-]+[a-z0-9]" required /></label>
      <label>Maximum size (GiB) <input aria-label="Maximum bucket size (GiB)" type="number" min={minimum / 1024 ** 3} max="1024" step="any" value={quota} onChange={(event) => setQuota(event.target.value)} required /></label>
      <p>The maximum must cover stored data and active upload reservations. Increasing it does not reserve or charge for unused space.</p>
      <label className={ui.checkbox}><input type="checkbox" checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} /> Pause new uploads</label>
      <div><button type="submit" disabled={busy}>Save settings</button>{" "}<button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
    </form>
  </section>;
}
