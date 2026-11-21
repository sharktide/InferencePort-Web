"use client";

import { useEffect, useState } from "react";
import styles from "./Panel.module.css";
import PersonalUsageDashboard from "./PersonalUsageDashboard";

interface Props { session: { access_token?: string } | null; apiBase: string }
interface Meter { used?: number; limit?: number; remaining?: number }
type MeterState = { key: string; data: Record<string, Meter> | null; error: string };
const meterList = [
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

export default function UsagePanel({ session, apiBase }: Props) {
  const token = session?.access_token;
  const key = token ? apiBase + "|" + token : "";
  const [generationOpen, setGenerationOpen] = useState(false);
  const [meters, setMeters] = useState<MeterState | null>(null);
  const [reload, setReload] = useState(0);
  const meterState = meters?.key === key ? meters : null;

  /* Generation plan meters are optional: only fetch them when someone opens the disclosure. */
  useEffect(() => {
    if (!generationOpen || !token) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]);
    setMeters(null);
    fetch(apiBase + "/usage", { headers: { Authorization: "Bearer " + token }, signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "HTTP " + response.status);
        return data;
      })
      .then((data) => { if (!controller.signal.aborted) setMeters({ key, data: data.usage ?? {}, error: "" }); })
      .catch((err) => {
        if (!controller.signal.aborted) setMeters({ key, data: null, error: err instanceof Error ? err.message : "Unable to load generation usage." });
      });
    return () => controller.abort();
  }, [generationOpen, token, apiBase, key, reload]);

  if (!session || !token) return <div className={styles.panel + " " + styles.active}><div className={styles.lockedOverlay + " " + styles.panelLock}>Sign in to view your usage.</div></div>;

  return (
    <div className={styles.panel + " " + styles.active}>
      <section className={styles.card + " " + styles.wide}>
        <PersonalUsageDashboard session={session} apiBase={apiBase} />
      </section>
      <section className={styles.card + " " + styles.wide}>
        <button type="button" className={styles.usageSectionToggle} aria-expanded={generationOpen}
          aria-controls="generation-plan-usage" onClick={() => setGenerationOpen((v) => !v)}>
          <span><strong>Generation subscription limits</strong><small>Separate from pay-as-you-go model usage</small></span>
          <span className={styles.usageChevron + (generationOpen ? " " + styles.usageChevronOpen : "")} aria-hidden="true" />
        </button>
        {generationOpen && (
          <div id="generation-plan-usage" className={styles.usageDisclosure}>
            {meterState?.error && <p className={styles.muted} role="alert">Unable to load plan limits: {meterState.error}</p>}
            {!meterState ? <p className={styles.muted}>Loading plan limits…</p> : meterState.data ? (
              <div className={styles.statGrid}>
                {meterList.map(({ label, key: name }) => {
                  const meter = meterState.data?.[name];
                  const percent = meterPercent(meter);
                  return (
                    <div key={name} className={styles.statArticle + " " + styles.meterArticle}>
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
            ) : <p className={styles.muted}>Plan usage is unavailable.</p>}
            <button type="button" className="ghost" onClick={() => setReload((n) => n + 1)}>Refresh limits</button>
          </div>
        )}
      </section>
    </div>
  );
}
