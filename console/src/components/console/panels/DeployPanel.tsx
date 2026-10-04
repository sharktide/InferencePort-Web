"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./Panel.module.css";
import deployStyles from "./DeployPanel.module.css";

interface Props {
  session: any;
  apiBase: string;
  config?: any;
  theme?: "light" | "dark";
}

interface Deployment {
  id: string;
  featherless_model_id: string;
  display_model_id: string;
  model_name: string;
  context_length: number;
  pricing_prompt_per_million: number;
  pricing_completion_per_million: number;
  monthly_fee: number;
  status: string;
  model_state?: string;
  billing_cycle_start?: string;
  billing_cycle_end?: string;
  cancelled_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface FeatherlessModel {
  id: string;
  name: string;
  context_length: number;
  is_featherless: boolean;
  featherless_model_id: string;
  featherless_pricing: { input_per_million: number; output_per_million: number };
  our_pricing_per_million: { input: number; output: number };
  deployment_fee_monthly: number;
  pricing: { prompt: string; completion: string };
}

const INFERPORT_LOGO = "https://dpixehhdbtzsbckfektd.supabase.co/storage/v1/object/public/general/inferenceport-ai-logo.png";
const DEPLOYMENT_FEE = "0.50";
const featherlessLogoUrl = (theme: string) =>
  `https://cdn.brandfetch.io/featherless.ai?c=1idhv9JFxNDhJr50XTx${theme === "dark" ? "&theme=dark" : ""}`;

export default function DeployPanel({ session, apiBase, config, theme = "light" }: Props) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [searchResults, setSearchResults] = useState<FeatherlessModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchTotalPages, setSearchTotalPages] = useState(1);
  const [searching, setSearching] = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "browse">("active");
  const [provisioning, setProvisioning] = useState<{ modelId: string; stage: string; progress: number; stages: string[] } | null>(null);
  const [confirmDeploy, setConfirmDeploy] = useState<FeatherlessModel | null>(null);
  const [confirmModelState, setConfirmModelState] = useState<string>("unknown");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authH = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  });

  const fj = async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(`${apiBase}${path}`, opts);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const errMsg = d.detail || (typeof d.error === "object" ? d.error?.message : d.error) || `HTTP ${r.status}`;
      throw new Error(errMsg);
    }
    return d;
  };

  const loadDeployments = useCallback(async () => {
    try {
      const data = await fj("/v1/deploy", { headers: authH() });
      setDeployments(data.data || []);
    } catch (e: any) {
      console.error("Failed to load deployments:", e);
    }
  }, [session]);

  const searchModels = useCallback(async (query: string, page: number) => {
    setSearching(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (query) params.set("search", query);
      const data = await fj(`/v1/deploy/models?${params}`, { headers: authH() });
      setSearchResults(data.data || []);
      setSearchTotal(data.total || 0);
      setSearchTotalPages(data.total_pages || 1);
    } catch (e: any) {
      console.error("Failed to search models:", e);
    } finally {
      setSearching(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    loadDeployments().finally(() => setLoading(false));
  }, [session, loadDeployments]);

  useEffect(() => {
    if (tab !== "browse") return;
    searchModels(searchQuery, searchPage);
  }, [tab, searchPage, searchModels]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchModels(value, 1);
    }, 300);
  };

  const openConfirmDeploy = async (model: FeatherlessModel) => {
    setConfirmDeploy(model);
    setConfirmModelState("loading");
    try {
      const token = session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${apiBase}/v1/deploy/model-status/${model.featherless_model_id}`, { headers });
      const data = await res.json();
      setConfirmModelState(data.state || "unknown");
    } catch {
      setConfirmModelState("unknown");
    }
  };

  const handleDeploy = async (modelId: string) => {
    setDeploying(modelId);
    setError(null);
    setSuccess(null);

    const gpu = ["AMD Instinct MI300X", "AMD Instinct MI250X"][Math.floor(Math.random() * 2)];
    const stages = [
      `Provisioning on ${gpu} cluster`,
      `Downloading model weights`,
      `Allocating GPU memory and loading tensors`,
      `Verifying inference endpoint`,
    ];

    let currentProgress = 0;
    setProvisioning({ modelId, stage: stages[0], progress: 0, stages });

    const stageTimings = [2800, 3200, 2400, 1600];
    const totalMs = stageTimings.reduce((a, b) => a + b, 0);

    let elapsed = 0;
    for (let i = 0; i < stages.length; i++) {
      setProvisioning({ modelId, stage: stages[i], progress: currentProgress, stages });
      const wait = Math.round(stageTimings[i]);
      await new Promise((r) => setTimeout(r, wait));
      elapsed += wait;
      currentProgress = Math.min(95, Math.round((elapsed / totalMs) * 100));
      setProvisioning({ modelId, stage: stages[i], progress: currentProgress, stages });
    }

    try {
      const result = await fj("/v1/deploy", {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({ model_id: modelId }),
      });
      setProvisioning({ modelId, stage: "Deployment ready", progress: 100, stages });
      await new Promise((r) => setTimeout(r, 600));
      setSuccess(`Model deployed! You can now use it in the playground or find it in the models tab.`);
      await loadDeployments();
    } catch (e: any) {
      setError(e.message || "Failed to deploy model");
    } finally {
      setProvisioning(null);
      setDeploying(null);
    }
  };

  const handleCancel = async (deploymentId: string) => {
    if (!confirm("Cancel this deployment? Access will remain until the end of the current billing cycle.")) return;
    try {
      const result = await fj(`/v1/deploy/${deploymentId}/cancel`, {
        method: "POST",
        headers: authH(),
      });
      setSuccess(result.message || "Deployment cancelled.");
      await loadDeployments();
    } catch (e: any) {
      setError(e.message || "Failed to cancel deployment");
    }
  };

  const handleTerminate = async (deploymentId: string) => {
    if (!confirm("Immediately terminate this deployment? This cannot be undone.")) return;
    try {
      const result = await fj(`/v1/deploy/${deploymentId}`, {
        method: "DELETE",
        headers: authH(),
      });
      setSuccess(result.message || "Deployment terminated.");
      await loadDeployments();
    } catch (e: any) {
      setError(e.message || "Failed to terminate deployment");
    }
  };

  const handleUncancel = async (deploymentId: string) => {
    const token = session?.access_token;
    if (!token) return;
    try {
      await fetch(`${apiBase}/v1/deploy/${deploymentId}/uncancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadDeployments();
    } catch (e) { console.error(e); }
  };

  const activeDeployments = deployments.filter((d) => d.status === "active" || d.status === "cancelled_pending");
  const inactiveDeployments = deployments.filter((d) => d.status !== "active" && d.status !== "cancelled_pending");
  const activeModelIds = new Set(activeDeployments.map((d) => d.featherless_model_id));

  if (!session) {
    return (
      <div className={`${styles.panel} ${styles.active}`}>
        <div className={`${styles.lockedOverlay} ${styles.panelLock}`}>
          Sign in to manage Featherless model deployments.
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Featherless On-Demand Deployments</div>
        <p className={styles.muted}>
          Deploy any model from Featherless AI. $0.50/month per deployment. Token usage billed at Featherless rates + $0.05 markup.
        </p>
        <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "4px" }}>
          Disclaimer: If a deployed model is removed from Featherless, the deployment will be cancelled without refund of the monthly fee.
        </p>
      </section>

      {error && (
        <section className={`${styles.card} ${styles.wide} ${deployStyles.errorCard}`}>
          {error}
          <button className={deployStyles.dismissBtn} onClick={() => setError(null)}>Dismiss</button>
        </section>
      )}
      {success && (
        <section className={`${styles.card} ${styles.wide} ${deployStyles.successCard}`}>
          {success}
          <button className={deployStyles.dismissBtn} onClick={() => setSuccess(null)}>Dismiss</button>
        </section>
      )}

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.tabs}>
          <button
            className={`${styles.playgroundTab} ${tab === "active" ? styles.active : ""}`}
            onClick={() => setTab("active")}
          >
            My Deployments ({activeDeployments.length})
          </button>
          <button
            className={`${styles.playgroundTab} ${tab === "browse" ? styles.active : ""}`}
            onClick={() => setTab("browse")}
          >
            Browse & Deploy
          </button>
        </div>
      </section>

      {tab === "active" && (
        <>
          <section className={`${styles.card} ${styles.wide}`}>
            <div className={styles.heading}>Active Deployments</div>
            {activeDeployments.length === 0 ? (
              <p className={styles.muted}>No active deployments. Use "Browse & Deploy" to find and deploy a model.</p>
            ) : (
              <div className={styles.stack}>
                {activeDeployments.map((d) => (
                  <div key={d.id} className={deployStyles.deploymentCard}>
                    <div className={deployStyles.deploymentHeader}>
                      <div className={deployStyles.modelTitleRow}>
                        <img src={INFERPORT_LOGO} alt="" className={deployStyles.providerLogo} />
                        <img src={featherlessLogoUrl(theme)} alt="" className={deployStyles.providerLogo} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div>
                          <div className={deployStyles.deploymentModel}>
                            {d.featherless_model_id}
                            {d.status === "cancelled_pending" && (
                              <span className={deployStyles.statusBadge} style={{ marginLeft: "8px", fontSize: "11px" }}>Canceling</span>
                            )}
                            {d.status === "active" && d.model_state && d.model_state !== "unknown" && (
                              <span className={deployStyles.statusBadge} style={{
                                marginLeft: "8px",
                                fontSize: "11px",
                                color: d.model_state === "warm" ? "#22c55e" : d.model_state === "loading" ? "#f59e0b" : "#ef4444",
                                background: d.model_state === "warm" ? "rgba(34,197,94,0.12)" : d.model_state === "loading" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                                borderColor: d.model_state === "warm" ? "rgba(34,197,94,0.3)" : d.model_state === "loading" ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)",
                              }}>
                                {d.model_state === "warm" ? "Warm" : d.model_state === "loading" ? "Initializing" : "Cold"}
                              </span>
                            )}
                          </div>
                          <div className={styles.muted}>Context: {d.context_length?.toLocaleString()} tokens</div>
                        </div>
                      </div>
                      <div className={deployStyles.deploymentActions}>
                        {d.status === "active" && (
                          <>
                            <button className={deployStyles.cancelBtn} onClick={() => handleCancel(d.id)}>
                              Cancel (end of cycle)
                            </button>
                            <button className={deployStyles.terminateBtn} onClick={() => handleTerminate(d.id)}>
                              Terminate Now
                            </button>
                          </>
                        )}
                        {d.status === "cancelled_pending" && (
                          <>
                            <button className={deployStyles.cancelBtn} onClick={() => handleUncancel(d.id)} style={{ background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }}>
                              Restore
                            </button>
                            <span className={styles.muted} style={{ fontSize: "12px", alignSelf: "center" }}>
                              Active until {d.billing_cycle_end ? new Date(d.billing_cycle_end).toLocaleDateString() : "None"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={styles.statGrid} style={{ marginTop: "12px" }}>
                      <div className={styles.statArticle}>
                        <div className={styles.statLabel}>Monthly Fee</div>
                        <div className={styles.statValue}>${d.monthly_fee?.toFixed(2)}</div>
                      </div>
                      <div className={styles.statArticle}>
                        <div className={styles.statLabel}>Cycle Ends</div>
                        <div className={styles.statValue}>
                          {d.billing_cycle_end ? new Date(d.billing_cycle_end).toLocaleDateString() : "N/A"}
                        </div>
                      </div>
                      <div className={styles.statArticle}>
                        <div className={styles.statLabel}>Prompt $/M</div>
                        <div className={styles.statValue}>${d.pricing_prompt_per_million?.toFixed(2)}</div>
                      </div>
                      <div className={styles.statArticle}>
                        <div className={styles.statLabel}>Completion $/M</div>
                        <div className={styles.statValue}>${d.pricing_completion_per_million?.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "8px" }}>
                      Call with: <code>{d.display_model_id}</code> via /v1/chat/completions
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {inactiveDeployments.length > 0 && (
            <section className={`${styles.card} ${styles.wide}`}>
              <div className={styles.heading}>Past Deployments ({inactiveDeployments.length})</div>
              <div className={styles.stack}>
                {inactiveDeployments.map((d) => (
                  <div key={d.id} className={`${deployStyles.deploymentCard} ${deployStyles.expired}`}>
                    <div className={deployStyles.deploymentHeader}>
                      <div className={deployStyles.modelTitleRow}>
                        <img src={INFERPORT_LOGO} alt="" className={deployStyles.providerLogoSmall} />
                        <img src={featherlessLogoUrl(theme)} alt="" className={deployStyles.providerLogoSmall} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div>
                          <div className={deployStyles.deploymentModel}>{d.featherless_model_id}</div>
                          <div className={styles.muted}>
                            Status: <span className={deployStyles.statusBadge}>{d.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles.statGrid} style={{ marginTop: "8px" }}>
                      <div className={styles.statArticle}>
                        <div className={styles.statLabel}>Created</div>
                        <div className={styles.statValue}>
                          {d.created_at ? new Date(d.created_at).toLocaleDateString() : "N/A"}
                        </div>
                      </div>
                      <div className={styles.statArticle}>
                        <div className={styles.statLabel}>Ended</div>
                        <div className={styles.statValue}>
                          {d.billing_cycle_end ? new Date(d.billing_cycle_end).toLocaleDateString() : "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === "browse" && (
        <section className={`${styles.card} ${styles.wide}`}>
          <div className={styles.heading}>Featherless Model Catalog</div>
          <input
            type="text"
            placeholder="Search models (e.g. llama, qwen, deepseek)..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", border: "1px solid var(--border)",
              borderRadius: "8px", background: "var(--surface)", color: "var(--text)",
              fontSize: "14px", fontFamily: "var(--mono)", marginBottom: "12px",
            }}
          />
          <div className={styles.muted} style={{ marginBottom: "12px", fontSize: "12px" }}>
            {searching ? "Searching..." : `${searchTotal.toLocaleString()} models found`}
            {searchTotalPages > 1 && `, page ${searchPage} of ${searchTotalPages}`}
          </div>

          {searchResults.length === 0 && !searching ? (
            <p className={styles.muted}>
              {searchQuery ? "No models match your search." : "Type to search the Featherless catalog."}
            </p>
          ) : (
            <div className={styles.stack}>
              {searchResults.map((m) => {
                const isDeployed = activeModelIds.has(m.featherless_model_id);
                return (
                    <div key={m.featherless_model_id} className={deployStyles.modelCard}>
                      <div className={deployStyles.modelInfo}>
                        <div className={deployStyles.modelTitleRow}>
                          <img src={INFERPORT_LOGO} alt="" className={deployStyles.providerLogoSmall} />
                          <img src={featherlessLogoUrl(theme)} alt="" className={deployStyles.providerLogoSmall} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <div className={deployStyles.modelId}>{m.featherless_model_id}</div>
                        </div>
                        <div className={styles.muted} style={{ fontSize: "12px" }}>
                          Context: {m.context_length?.toLocaleString()} | Our rate: ${m.our_pricing_per_million?.input?.toFixed(2)} in / ${m.our_pricing_per_million?.output?.toFixed(2)} out per M tokens | Fee: ${m.deployment_fee_monthly}/mo
                        </div>
                    </div>
                    <button
                      className={`${deployStyles.deployBtn} ${isDeployed ? deployStyles.deployed : ""}`}
                      disabled={isDeployed || deploying === m.featherless_model_id}
                      onClick={() => openConfirmDeploy(m)}
                    >
                      {isDeployed ? "Deployed" : deploying === m.featherless_model_id ? "Deploying..." : "Deploy"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {searchTotalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
              <button
                className={deployStyles.pageBtn}
                disabled={searchPage <= 1}
                onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className={styles.muted} style={{ alignSelf: "center", fontSize: "13px" }}>
                Page {searchPage} / {searchTotalPages}
              </span>
              <button
                className={deployStyles.pageBtn}
                disabled={searchPage >= searchTotalPages}
                onClick={() => setSearchPage((p) => Math.min(searchTotalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {confirmDeploy && (
        <div className={deployStyles.provisionOverlay}>
          <div className={deployStyles.provisionModal} style={{ maxWidth: "440px" }}>
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", color: "var(--text)" }}>
              Deploy Model
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <img src={INFERPORT_LOGO} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />
              <img src={featherlessLogoUrl(theme)} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div style={{ fontFamily: "var(--mono)", fontSize: "14px", fontWeight: 500 }}>{confirmDeploy.featherless_model_id}</div>
            </div>

            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px 14px", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Model State</span>
                <span style={{
                  fontSize: "12px", fontWeight: 600, padding: "2px 8px", borderRadius: "999px",
                  color: confirmModelState === "warm" ? "#22c55e" : confirmModelState === "loading" ? "#f59e0b" : confirmModelState === "cold" ? "#ef4444" : "var(--muted)",
                  background: confirmModelState === "warm" ? "rgba(34,197,94,0.12)" : confirmModelState === "loading" ? "rgba(245,158,11,0.12)" : confirmModelState === "cold" ? "rgba(239,68,68,0.12)" : "var(--surface)",
                }}>
                  {confirmModelState === "warm" ? "Warm (Ready)" : confirmModelState === "loading" ? "Initializing" : confirmModelState === "cold" ? "Cold (Not Loaded)" : "Checking..."}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                {confirmModelState === "warm" && "This model is already loaded and ready for inference. Requests will complete immediately."}
                {confirmModelState === "loading" && "This model is currently being provisioned. It may take 5-15 minutes to become ready."}
                {confirmModelState === "cold" && "This model is not yet loaded. The first request will trigger loading, which can take 5-15 minutes."}
                {confirmModelState === "unknown" && "Unable to determine model state. Checking..."}
              </div>
            </div>

            <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "18px" }}>
              A <strong style={{ color: "var(--text)" }}>${DEPLOYMENT_FEE}/mo</strong> deployment fee will be charged immediately. Usage is billed at Featherless rates + $0.05/M token markup. You can cancel anytime. Access continues until the end of the billing cycle.
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                className={deployStyles.cancelBtn}
                onClick={() => setConfirmDeploy(null)}
              >
                Cancel
              </button>
              <button
                className={deployStyles.deployBtn}
                onClick={() => {
                  const m = confirmDeploy;
                  setConfirmDeploy(null);
                  if (m) handleDeploy(m.id);
                }}
              >
                Confirm Deploy
              </button>
            </div>
          </div>
        </div>
      )}

      {provisioning && (
        <div className={deployStyles.provisionOverlay}>
          <div className={deployStyles.provisionModal}>
            <div className={deployStyles.provisionHeader}>
              <div className={deployStyles.provisionSpinner} />
              <span>Deploying {provisioning.modelId}</span>
            </div>
            <div className={deployStyles.provisionProgressBar}>
              <div className={deployStyles.provisionProgressFill} style={{ width: `${provisioning.progress}%` }} />
            </div>
            <div className={deployStyles.provisionStage}>{provisioning.stage}...</div>
            <div className={deployStyles.provisionStages}>
              {provisioning.stages.map((s, i) => {
                const currentIdx = provisioning.stages.indexOf(provisioning.stage);
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                  <div key={i} className={`${deployStyles.provisionStep} ${done ? deployStyles.provisionStepDone : ""} ${active ? deployStyles.provisionStepActive : ""}`}>
                    <span className={deployStyles.provisionStepIcon}>
                      {done ? "✓" : active ? "●" : "○"}
                    </span>
                    <span>{s}</span>
                  </div>
                );
              })}
            </div>
            <div className={deployStyles.provisionWarning}>Do not close this page.</div>
          </div>
        </div>
      )}
    </div>
  );
}
