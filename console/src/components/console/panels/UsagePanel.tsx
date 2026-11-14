"use client";

import { useEffect, useState } from "react";
import styles from "./Panel.module.css";
import PersonalUsageDashboard from "./PersonalUsageDashboard";
import { creditsLabel } from "./UsageBreakdownView";

interface Props { session: { access_token?: string } | null; apiBase: string }
interface Meter { used?: number; limit?: number; remaining?: number }
interface LedgerEntry {
  id?: string;
  entry_type?: string;
  delta_credits?: number;
  usage_kind?: string;
  units?: number;
  unit_label?: string;
  created_at?: string;
}
const meterList: { label: string; key: string }[] = [
  { label: "Chat · Daily", key: "cloudChatDaily" },
  { label: "Images · Daily", key: "imagesDaily" },
  { label: "Videos · Daily", key: "videosDaily" },
  { label: "Audio · Weekly", key: "audioWeekly" },
  { label: "AI Shield · Daily", key: "aiShieldDaily" },
  { label: "Server token checks · Daily", key: "verifyTokenWithEmailDaily" },
];
function formatMeter(meter?: Meter) {
  if (!meter || !Number.isFinite(meter.limit) || !Number.isFinite(meter.used)) return "No plan meter reported";
  return String(meter.used) + " / " + String(meter.limit) + " (" + String(meter.remaining ?? Math.max(0, (meter.limit || 0) - (meter.used || 0))) + " remaining)";
}
function meterPercent(meter?: Meter) {
  return meter && typeof meter.used === "number" && typeof meter.limit === "number" && meter.limit > 0
    ? Math.max(0, Math.min(100, meter.used / meter.limit * 100)) : null;
}
function formatDate(value?: string) {
  const t = Date.parse(value || "");
  return Number.isFinite(t) ? new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Unknown date";
}

export default function UsagePanel({ session, apiBase }: Props) {
  const token = session?.access_token;
  const [genUsage, setGenUsage] = useState<Record<string, Meter> | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loadingMeters, setLoadingMeters] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setGenUsage(null);
    setLedger([]);
    setError("");
    setLoadingMeters(true);
    if (!token) { setLoadingMeters(false); return () => controller.abort(); }
    const get = async (path: string) => {
      const response = await fetch(apiBase + path, {
        headers: { Authorization: "Bearer " + token }, signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "HTTP " + response.status);
      return data;
    };
    void Promise.allSettled([get("/usage"), get("/v1/credits/ledger?limit=30")]).then(([meterResult, ledgerResult]) => {
      if (controller.signal.aborted) return;
      if (meterResult.status === "fulfilled") setGenUsage(meterResult.value.usage ?? {});
      else setError("Could not load generation limits: " + (meterResult.reason instanceof Error ? meterResult.reason.message : "Unknown error"));
      if (ledgerResult.status === "fulfilled") setLedger(Array.isArray(ledgerResult.value.entries) ? ledgerResult.value.entries : []);
      else setError((prev) => prev + (prev ? " " : "") + "Could not load wallet transactions.");
      setLoadingMeters(false);
    });
    return () => controller.abort();
  }, [token, apiBase, reload]);

  if (!session) return <div className={styles.panel + " " + styles.active}><div className={styles.lockedOverlay + " " + styles.panelLock}>Sign in to view your usage.</div></div>;

  return (
    <div className={styles.panel + " " + styles.active}>
      <section className={styles.card + " " + styles.wide}>
        <PersonalUsageDashboard session={session} apiBase={apiBase} />
      </section>

      <section className={styles.card + " " + styles.wide}>
        <div className={styles.heading}>Generation plan limits <button type="button" className="ghost" style={{ float: "right" }} onClick={() => setReload((n) => n + 1)}>Refresh</button></div>
        <p className={styles.muted}>Subscription generation allowances are separate from pay-as-you-go credits.</p>
        {error && <p className={styles.muted} role="alert">{error}</p>}
        {loadingMeters ? <p className={styles.muted}>Loading plan usage…</p> : genUsage ? (
          <div className={styles.statGrid}>
            {meterList.map(({ label, key }) => {
              const meter = genUsage[key];
              const percent = meterPercent(meter);
              return (
                <div key={key} className={styles.statArticle + " " + styles.meterArticle}>
                  <span className={styles.statLabel}>{label}</span>
                  <strong className={styles.meterValue}>{formatMeter(meter)}</strong>
                  {percent !== null && (
                    <span className={styles.meterTrack + " " + (percent >= 80 ? styles.meterWarn : "")} aria-hidden="true">
                      <span className={styles.meterFill} style={{ width: percent + "%" }} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : <p className={styles.muted}>Plan usage is unavailable. Refresh to try again.</p>}
      </section>

      <section className={styles.card + " " + styles.wide}>
        <div className={styles.heading}>Wallet transactions <span className={styles.muted} style={{ fontSize: "0.8rem", fontWeight: 400 }}>Recent credits, charges and adjustments</span></div>
        <p className={styles.muted}>The latest 30 wallet entries, including purchases and credits added. For model-level charges, use the personal usage breakdown above.</p>
        <div className={styles.ledger}>
          <div className={styles.ledgerHeader}><span>Transaction</span><span>Credit change</span><span>Units</span><span>Date</span></div>
          {ledger.length === 0 ? <p className={styles.muted}>No recent wallet entries.</p> : ledger.map((entry, index) => (
            <div key={entry.id || index} className={styles.ledgerRow}>
              <div><strong>{entry.entry_type || "Transaction"}</strong><div className={styles.muted}>{entry.usage_kind || "—"}</div></div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>
                {Number(entry.delta_credits || 0) > 0 ? "+" : Number(entry.delta_credits || 0) < 0 ? "−" : ""}
                {creditsLabel(Math.abs(Number(entry.delta_credits || 0)))}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>{entry.units == null ? "—" : entry.units} {entry.unit_label || ""}</div>
              <div className={styles.muted}>{formatDate(entry.created_at)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
