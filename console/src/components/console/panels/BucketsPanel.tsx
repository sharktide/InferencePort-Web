"use client";

import { useEffect, useState } from "react";
import { useOrgContext } from "../OrgContext";
import styles from "./Panel.module.css";

type Catalog = {
  status: string;
  pricing: { status: string; rate_version: string | null };
};

export default function BucketsPanel({ apiBase }: { apiBase: string }) {
  const { activeOrg } = useOrgContext();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCatalog(null);
    setError("");
    void (async () => {
      try {
        // Availability is public and contains no tenant data or credentials.
        const response = await fetch(`${apiBase.replace(/\/$/, "")}/v1/buckets/status`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          throw new Error("Buckets is not available on this server yet.");
        }
        if (!response.ok) throw new Error(`Could not check Buckets availability (HTTP ${response.status}).`);
        const value: unknown = await response.json();
        if (!value || typeof value !== "object" || !("status" in value) || value.status !== "not_available") {
          throw new Error("This console version cannot manage Buckets on this server yet.");
        }
        if (!controller.signal.aborted) setCatalog(value as Catalog);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not check Buckets availability.");
      }
    })();
    return () => controller.abort();
  }, [apiBase, attempt]);

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <h1 className={styles.heading}>Buckets</h1>
        <p>Private object storage for model weights, datasets, checkpoints and generated artifacts.</p>
        <p className={styles.muted}>Workspace: {activeOrg?.name ?? "Personal"}</p>
        {error ? <p role="alert">{error} <button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button></p>
          : <p role="status">{catalog ? "Buckets is not available yet." : "Checking availability…"}</p>}
        <p>Bucket creation, uploads and S3 credentials will become available after the storage service launches.</p>
      </section>
      <section className={`${styles.card} ${styles.wide}`}>
        <h2 className={styles.heading}>Pricing and availability</h2>
        <p>Verified Azure retail rates have not been published. Storage tiers, discounts and promotional offers are unavailable.</p>
        <p>Pricing will include applicable storage, operations, retrieval, transfer and retained-data charges. Archive storage requires rehydration before download.</p>
        <a href="https://docs.inferenceport.ai/api/buckets.html" target="_blank" rel="noreferrer">Read about Buckets availability</a>
      </section>
    </div>
  );
}
