"use client";

import Icon from "../../Icon";
import { navigateConsole } from "../ContextSwitcher";
import { useState, useEffect, useCallback } from "react";
import styles from "./Panel.module.css";
import {
  formatDiscountedPrice,
  formatModelPrice,
  formatPricing,
  modelStartingPrice,
  matchesModelPriceRange,
  compareModelPrice,
  modelType,
} from "../../../lib/modelPricing";

interface Props { config: any; session: any; apiBase: string; theme?: "light" | "dark"; }

export default function ModelsPanel({ session, apiBase, theme = "light" }: Props) {
  const [allModels, setAllModels] = useState<any[]>([]);
  const [genModels, setGenModels] = useState<any[]>([]);
  const [source, setSource] = useState<"p2g" | "gen">("p2g");
  const [selectedDetailModel, setSelectedDetailModel] = useState<any | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [priceRange, setPriceRange] = useState("all");
  const [priceSort, setPriceSort] = useState<"default" | "asc" | "desc">("default");
  const [modelDiscounts, setModelDiscounts] = useState<Record<string, number>>({});
  const [fixedPrices, setFixedPrices] = useState<Record<string, number>>({});

  const isTextModel = (m: any) => { const i = Array.isArray(m?.input_modalities) ? m.input_modalities : []; const o = Array.isArray(m?.output_modalities) ? m.output_modalities : []; return modelType(m).toLowerCase() === "text" && i.includes("text") && o.includes("text"); };
  const slug = (m: any) => m?.id || m?.upstream_id || m?.openrouter?.slug || "";
  const modelDisplayName = (m: any) => {
    const name = m?.name || m?.id || "Unnamed model";
    if ((m?.type === "agent" || m?.managed_by === "inferenceport-agents") && m?.owned_by) return `@${m.owned_by}/${name}`;
    return name;
  };
  const modalities = (m: any) => { const arr = Array.isArray(m?.input_modalities) ? m.input_modalities : []; return arr.length ? arr.map((v: string) => v.toUpperCase()).join(" / ") : "Configured model"; };
  const configPillClass = (m: any) => {
    const t = modelType(m);
    if (t === "image") return styles.isConfigImage;
    if (t === "3d" || t === "3D") return styles.isConfig3d;
    if (t === "audio") return styles.isConfigAudio;
    if (t === "embedding") return styles.isConfigEmbedding;
    if (t === "decision") return styles.isConfigDecision;
    if (t === "realtime") return styles.isConfigRealtime;
    return styles.isConfigVideo;
  };

  const modelImageUrl = (m: any) => {
    const name = m?.name || m?.id || "";
    const modelId = (slug(m) || name).toLowerCase().replace(/\//g, "_");
    return `https://huggingface.co/buckets/inferenceport-ai/model-info/resolve/compressed/${encodeURIComponent(modelId)}.webp?download=true`;
  };

  const publisherLogoUrl = (publisherUrl: string | undefined) => {
    if (!publisherUrl) return "";
    if (publisherUrl === "inferenceport.ai") return "https://dpixehhdbtzsbckfektd.supabase.co/storage/v1/object/public/general/inferenceport-ai-logo.png";
    const themeParam = theme === "dark" ? "&theme=dark" : "";
    return `https://cdn.brandfetch.io/${encodeURIComponent(publisherUrl)}?c=1idhv9JFxNDhJr50XTx${themeParam}`;
  };

  const modelLogoUrl = (m: any) => {
    const explicit = typeof m?.logo === "string" ? m.logo.trim() : "";
    if (explicit) return explicit;
    return publisherLogoUrl(m?.publisher_url);
  };

  const textModels = useCallback(() => {
    const textOnly = allModels.filter((m: any) => isTextModel(m) && m.is_ready !== false);
    const seen = new Set();
    return textOnly.filter((m: any) => { const k = slug(m) || m.name; if (!k || seen.has(k)) return false; seen.add(k); return true; });
  }, [allModels]);

  const nonTextConfigModels = useCallback(() => {
    return allModels.filter((m: any) => !isTextModel(m) && m.is_ready !== false);
  }, [allModels]);

  const getModelDiscount = (m: any) => {
    const id = m?.id || "";
    if (fixedPrices[id]) return { type: "fixed" as const, fixedPrice: fixedPrices[id], percent: 0 };
    if (modelDiscounts[id]) return { type: "percent" as const, percent: modelDiscounts[id], fixedPrice: 0 };
    if (modelDiscounts["__all_models__"]) return { type: "percent" as const, percent: modelDiscounts["__all_models__"], fixedPrice: 0 };
    for (const [pattern, pct] of Object.entries(modelDiscounts)) {
      if (pattern.startsWith("__")) continue;
      if (pattern.endsWith("-*") && id.startsWith(pattern.slice(0, -2))) return { type: "percent" as const, percent: pct as number, fixedPrice: 0 };
      if (pattern === id) return { type: "percent" as const, percent: pct as number, fixedPrice: 0 };
    }
    return { type: "none" as const, percent: 0, fixedPrice: 0 };
  };

  const loadModels = useCallback(async () => {
    try {
      if (source === "p2g") {
        const headers: Record<string, string> = {};
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const r = await fetch(`${apiBase}/v1/models`, { headers });
        const d = await r.json().catch(() => ({}));
        const remoteModels = (Array.isArray(d.data) ? d.data : []).filter((m: any) => m.is_ready !== false);
        setAllModels(remoteModels);
      } else {
        const r = await fetch(`${apiBase}/gen/models`);
        const d = await r.json().catch(() => ({}));
        setGenModels(Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : []);
      }
    } catch { /* ignore */ }
  }, [source, apiBase, session]);

  useEffect(() => { loadModels(); }, [loadModels]);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${apiBase}/v1/rewards`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        const optedOut = d.opted_out || false;
        if (optedOut) {
          setModelDiscounts({});
          setFixedPrices({});
          return;
        }
        const raw = d.active_discounts || {};
        const pctDiscounts: Record<string, number> = {};
        const fixed: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw)) {
          if (k.startsWith("__fixed_")) {
            const modelId = k.replace("__fixed_", "").replace("__", "");
            fixed[modelId] = v as number;
          } else if (!k.startsWith("__")) {
            pctDiscounts[k] = v as number;
          } else if (k === "__all_models__") {
            pctDiscounts[k] = v as number;
          }
        }
        setModelDiscounts(pctDiscounts);
        setFixedPrices(fixed);
      })
      .catch(() => {});
  }, [session, apiBase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedDetailModel(null); };
    if (selectedDetailModel) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDetailModel]);

  const query = modelSearch.trim().toLowerCase();
  const matchesSearch = (m: any) => {
    if (!query) return true;
    const haystack = [m?.name, m?.id, m?.upstream_id, m?.description, m?.publisher_url, modelType(m), (m?.type === "agent" || m?.managed_by === "inferenceport-agents") && m?.owned_by ? `@${m.owned_by}` : ""]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  };
  // Price browsing applies to P2G list rates only. Gen API models use multipliers.
  const catalogModels = (source === "p2g" ? [...textModels(), ...nonTextConfigModels()] : genModels)
    .filter(matchesSearch)
    .filter((m: any) => source !== "p2g" || matchesModelPriceRange(modelStartingPrice(m), priceRange));
  if (source === "p2g" && priceSort !== "default") {
    catalogModels.sort((a: any, b: any) => compareModelPrice(a, b, priceSort));
  }
  const visibleCount = catalogModels.length;

  if (!session) return <div className={`${styles.panel} ${styles.active}`}><div className={`${styles.lockedOverlay} ${styles.panelLock}`}>Sign in to browse available models.</div></div>;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.catalogHeader}>
          <div><h2>Models</h2><p>Explore capabilities and pricing, then try a model in Playground.</p></div>
          <button type="button" className={styles.catalogPlaygroundLink} onClick={() => navigateConsole("playground")}>Open Playground <span aria-hidden="true">→</span></button>
        </div>
        <div className={styles.tabs}>
          <button className={`playground-tab ${styles.playgroundTab} ${source === "p2g" ? styles.active : ""}`} onClick={() => setSource("p2g")}>P2G API</button>
          <button className={`playground-tab ${styles.playgroundTab} ${source === "gen" ? styles.active : ""}`} onClick={() => setSource("gen")}>Gen API</button>
        </div>
        <input
          type="search"
          placeholder="Search models by name, slug or publisher..."
          aria-label="Search models"
          value={modelSearch}
          onChange={(e) => setModelSearch(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", border: "1px solid var(--border)",
            borderRadius: "8px", background: "var(--surface)", color: "var(--text)",
            fontSize: "14px", fontFamily: "var(--mono)", marginBottom: "12px",
          }}
        />
        <div className={styles.modelPriceControls}>
          <label htmlFor="models-price-range">Starting price
            <select id="models-price-range" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} disabled={source !== "p2g"}>
              <option value="all">All prices</option>
              <option value="zero">$0 rate</option>
              <option value="lt1">Under $1</option>
              <option value="1to5">$1–$5</option>
              <option value="5to20">$5–$20</option>
              <option value="gte20">$20+</option>
            </select>
          </label>
          <label htmlFor="models-price-sort">Sort by
            <select id="models-price-sort" value={priceSort} onChange={(e) => setPriceSort(e.target.value as "default" | "asc" | "desc")} disabled={source !== "p2g"}>
              <option value="default">Default order</option>
              <option value="asc">Price: low to high</option>
              <option value="desc">Price: high to low</option>
            </select>
          </label>
        </div>
        <p className={styles.modelPriceHint}>
          {source === "p2g"
            ? "Uses the lowest published list rate per model (before rewards). Billing units vary by modality; models without prices sort last and are excluded from price ranges."
            : "Gen API uses credit multipliers rather than comparable USD model rates. Price controls are available for P2G API."}
        </p>
        <div className={styles.muted} style={{ marginBottom: "12px", fontSize: "12px" }} aria-live="polite">
          {query ? `${visibleCount} model${visibleCount === 1 ? "" : "s"} match "${modelSearch.trim()}"` : `${visibleCount} models`}
        </div>
        <div className={styles.modelsGrid}>
          {visibleCount === 0 && (
            <p className={styles.muted} style={{ gridColumn: "1 / -1" }}>
              {query ? `No models match "${modelSearch.trim()}".` : "No models available."}
            </p>
          )}
          {catalogModels.map((m: any, i: number) => {
            const isConfigModel = source === "p2g" && !isTextModel(m);
            const dynamicPrice = formatModelPrice(m);
            const label = source === "gen" ? "1x multiplier" : dynamicPrice || (isConfigModel ? "Existing configuration" : formatPricing(m) || "Pricing unavailable");
            const disc = source === "p2g" ? getModelDiscount(m) : { type: "none", percent: 0, fixedPrice: 0 };
            const discountedLabel = source === "p2g" ? formatDiscountedPrice(m, disc) : null;
            return (
              <div key={`${slug(m) || "model"}-${i}`} className={styles.modelCard} role="button" tabIndex={0}
                aria-label={`View details for ${modelDisplayName(m)}`}
                onClick={() => setSelectedDetailModel(m)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDetailModel(m); }
                }}>
                {modelLogoUrl(m) && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                    <img
                      src={modelLogoUrl(m)}
                      alt=""
                      style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0, objectFit: "contain", border: "1px solid var(--border)" }}
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
                <div className={styles.modelCardTop}>
                  <span className={styles.modelCardName}>{modelDisplayName(m)}</span>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {!isConfigModel && m.model_state && (
                      <span className={styles.modelPill} style={{
                        color: m.model_state === "warm" ? "#22c55e" : "#f59e0b",
                        background: m.model_state === "warm" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                        borderColor: m.model_state === "warm" ? "rgba(34,197,94,0.22)" : "rgba(245,158,11,0.22)",
                      }}>{m.model_state === "warm" ? "Warm" : "Loading"}</span>
                    )}
                    <span className={`${styles.modelPill} ${isConfigModel ? configPillClass(m) : isTextModel(m) ? styles.isText : styles.isConfig}`}>
                      {String(modelType(m)).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className={styles.modelMeta}><span className={styles.modelKey}>Slug</span><span className={styles.modelValue}>{slug(m) || "None"}</span></div>
                <div className={styles.modelMeta}>
                  <span className={styles.modelKey}>Pricing</span>
                  <span className={styles.modelValue}>
                    {disc.type === "fixed" ? (
                      <>
                        <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: "0.4rem" }}>{label}</span>
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>${disc.fixedPrice.toFixed(2)}/M tokens</span>
                      </>
                    ) : disc.type === "percent" && disc.percent > 0 && discountedLabel ? (
                      <>
                        <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: "0.4rem" }}>{label}</span>
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>{discountedLabel}</span>
                      </>
                    ) : (
                      label
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {selectedDetailModel && (
        <div className={styles.modelDetailOverlay} onClick={() => setSelectedDetailModel(null)}>
          <div className={styles.modelDetailTray} role="dialog" aria-modal="true" aria-label="Model details" onClick={(e) => e.stopPropagation()}>
            <button className={styles.modelDetailClose} onClick={() => setSelectedDetailModel(null)} aria-label="Close"><Icon name="x" size={18} /></button>
            <div className={styles.modelDetailImageWrap}>
              <img
                className={styles.modelDetailImage}
                src={modelImageUrl(selectedDetailModel)}
                alt={modelDisplayName(selectedDetailModel)}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                onLoad={(e) => { const img = e.target as HTMLImageElement; img.classList.add(styles.loaded); const ph = img.nextElementSibling as HTMLElement; if (ph) ph.style.display = "none"; }}
              />
              <div className={styles.modelDetailImagePlaceholder}>
                {modelDisplayName(selectedDetailModel)}
              </div>
            </div>
            <div className={styles.modelDetailContent}>
              {modelLogoUrl(selectedDetailModel) && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.25rem" }}>
                  <img
                    src={modelLogoUrl(selectedDetailModel)}
                    alt=""
                    style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, objectFit: "contain", border: "1px solid var(--border)" }}
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <div className={styles.modelDetailHeader}>
                <span className={styles.modelDetailName}>{modelDisplayName(selectedDetailModel)}</span>
                <span className={`${styles.modelPill} ${isTextModel(selectedDetailModel) ? styles.isText : styles.isConfig}`}>
                  {String(modelType(selectedDetailModel)).toUpperCase()}
                </span>
              </div>
              <div className={styles.modelMeta}><span className={styles.modelKey}>Slug</span><span className={styles.modelValue}>{slug(selectedDetailModel) || "None"}</span></div>
              <div className={styles.modelMeta}>
                <span className={styles.modelKey}>Pricing</span>
                <span className={styles.modelValue}>
                  {(() => {
                    const d = getModelDiscount(selectedDetailModel);
                    const dp = formatDiscountedPrice(selectedDetailModel, d);
                    const base = formatModelPrice(selectedDetailModel) || formatPricing(selectedDetailModel);
                    if (d.type === "fixed") {
                      return <>
                        <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: "0.4rem" }}>{base}</span>
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>${d.fixedPrice.toFixed(2)}/M tokens</span>
                      </>;
                    }
                    if (d.type === "percent" && d.percent > 0 && dp) {
                      return <>
                        <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: "0.4rem" }}>{base}</span>
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>{dp}</span>
                      </>;
                    }
                    return base;
                  })()}
                </span>
              </div>
              <div className={styles.modelMeta}><span className={styles.modelKey}>Modalities</span><span className={styles.modelValue}>{modalities(selectedDetailModel)}</span></div>
              {selectedDetailModel.output_modalities && (
                <div className={styles.modelMeta}><span className={styles.modelKey}>Output</span><span className={styles.modelValue}>{selectedDetailModel.output_modalities.map((v: string) => v.toUpperCase()).join(" / ")}</span></div>
              )}
              <button type="button" className={styles.modelDetailTry} onClick={() => {
                const type = String(modelType(selectedDetailModel)).toLowerCase();
                const mode = type === "3d" ? "3d" : type === "embedding" ? "embedding"
                  : type === "decision" ? "decision" : type === "realtime" ? "realtime"
                  : type === "image" ? "image" : type === "video" ? "video"
                  : type === "audio" ? "audio" : "text";
                try {
                  sessionStorage.setItem("console-playground-selected-model", JSON.stringify({
                    id: slug(selectedDetailModel), source, mode,
                  }));
                } catch { /* Storage is optional; still open the playground. */ }
                setSelectedDetailModel(null);
                navigateConsole("playground");
              }}>
                {isTextModel(selectedDetailModel) ? "Try this model" : "Open in Playground"} <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
