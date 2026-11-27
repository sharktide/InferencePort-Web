"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Panel.module.css";
import { navigateConsole } from "../ContextSwitcher";
import { useOptionalOrgContext } from "../OrgContext";
import { formatModelPrice, formatPricing, modelType, modelStartingPrice, matchesModelPriceRange, compareModelPrice, formatDiscountedPrice } from "../../../lib/modelPricing";

interface Props { config: any; session: any; apiBase: string; theme?: "light" | "dark"; }
type Source = "p2g" | "gen";
type Mode = "text" | "image" | "video" | "audio" | "3d" | "embedding" | "realtime" | "decision";

function modelId(model: any) { return model?.id || model?.upstream_id || model?.openrouter?.slug || ""; }
function displayName(model: any) {
  const name = model?.name || modelId(model) || "Unnamed model";
  return (model?.type === "agent" || model?.managed_by === "inferenceport-agents") && model?.owned_by ? "@" + model.owned_by + "/" + name : name;
}
function ModelArtwork({ model }: { model: any }) {
  const [status, setStatus] = useState("loading");
  const normalized = String(modelId(model) || model?.name || "").toLowerCase().replace(/\//g, "_");
  const url = `https://huggingface.co/buckets/inferenceport-ai/model-info/resolve/compressed/${encodeURIComponent(normalized)}.webp?download=true`;
  return <div className={styles.modelDetailImageWrap}>
    {status !== "error" && <img className={styles.modelDetailImage} src={url} alt={displayName(model)} onLoad={() => setStatus("loaded")} onError={() => setStatus("error")} />}
    {status !== "loaded" && <div className={styles.modelDetailImagePlaceholder}>{displayName(model)}</div>}
  </div>;
}
function isTextModel(model: any) {
  return Array.isArray(model?.input_modalities) && model.input_modalities.includes("text") && Array.isArray(model?.output_modalities) && model.output_modalities.includes("text");
}
function getMode(model: any, source: Source): Mode {
  const type = String(modelType(model)).toLowerCase();
  if (["text", "image", "video", "audio", "3d", "embedding", "realtime", "decision"].includes(type)) {
    if (source === "gen" && !["text", "image", "audio"].includes(type)) return "text";
    return type as Mode;
  }
  return "text";
}
function launchPlayground(source: Source, mode: Mode, id: string) {
  const launch = { source, mode, ...(id ? { modelId: id } : {}) };
  try { sessionStorage.setItem("console-playground-launch", JSON.stringify(launch)); } catch { /* storage can be unavailable */ }
  window.dispatchEvent(new CustomEvent("console-playground-launch", { detail: launch }));
  navigateConsole("playground");
}

export default function ModelsPanel({ session, apiBase }: Props) {
  const [source, setSource] = useState<Source>("p2g");
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [modality, setModality] = useState("all");
  const [priceRange, setPriceRange] = useState("all");
  const [priceSort, setPriceSort] = useState<"default" | "asc" | "desc">("default");
  const [rewards, setRewards] = useState<{ owner: string; discounts: Record<string, number> }>({ owner: "", discounts: {} });
  const [catalogOwner, setCatalogOwner] = useState("");
  const ctx = useOptionalOrgContext();
  const owner = [apiBase, session?.access_token ?? "", ctx?.activeOrg?.id ?? "personal", source].join(":");
  const request = useRef<AbortController | null>(null);
  const detailRef = useRef<HTMLElement>(null);


  const loadModels = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = "Bearer " + session.access_token;
      const endpoint = source === "p2g" ? "/v1/models" : "/gen/models";
      const response = await fetch(apiBase + endpoint, { headers, signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.detail || body?.error || "Unable to load models (" + response.status + ")");
      const data = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      if (controller.signal.aborted) return;
      setCatalogOwner(owner);
      setModels(data.filter((model: any) => model?.is_ready !== false));
    } catch (e: any) {
      if (controller.signal.aborted) return;
      setModels([]);
      setError(e?.message || "Unable to load models.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [apiBase, session?.access_token, source, owner]);

  useEffect(() => { void loadModels(); return () => request.current?.abort(); }, [loadModels]);
  useEffect(() => { setSelected(null); }, [owner]);
  useEffect(() => {
    if (!session?.access_token) return;
    const controller = new AbortController();
    void fetch(apiBase + "/v1/rewards", { headers: { Authorization: "Bearer " + session.access_token }, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) setRewards({ owner, discounts: data.opted_out ? {} : data.active_discounts || {} });
      }).catch(() => {});
    return () => controller.abort();
  }, [apiBase, session?.access_token, owner]);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    detailRef.current?.querySelector<HTMLElement>("button")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
      if (event.key !== "Tab") return;
      const controls = Array.from(detailRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [selected]);

  const visibleModels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (catalogOwner !== owner) return [];
    const filtered = models.filter((model) => (modality === "all" || getMode(model, source) === modality) &&
      (!needle || [model?.name, model?.id, model?.upstream_id, model?.description, model?.publisher_url, modelType(model), model?.owned_by]
        .filter(Boolean).join(" ").toLowerCase().includes(needle)) &&
      (source !== "p2g" || matchesModelPriceRange(modelStartingPrice(model), priceRange)));
    return source === "p2g" && priceSort !== "default" ? [...filtered].sort((a, b) => compareModelPrice(a, b, priceSort)) : filtered;
  }, [models, query, modality, priceRange, priceSort, source, catalogOwner, owner]);

  const price = (model: any) => {
    if (source === "gen") return "1× subscription multiplier";
    const listPrice = formatModelPrice(model) || formatPricing(model) || "Pricing varies";
    const discounts = rewards.owner === owner ? rewards.discounts : {};
    const id = modelId(model);
    const fixed = discounts["__fixed_" + id + "__"];
    if (typeof fixed === "number" && Number.isFinite(fixed) && fixed >= 0) return listPrice + " · Your rate $" + fixed.toFixed(2) + "/M tokens";
    const match = Object.entries(discounts).find(([pattern]) => !pattern.startsWith("__") && pattern.endsWith("-*") && id.startsWith(pattern.slice(0, -2)));
    const percent = discounts[id] ?? discounts.__all_models__ ?? match?.[1] ?? 0;
    const discounted = formatDiscountedPrice(model, { type: "percent", percent, fixedPrice: 0 });
    return discounted ? listPrice + " · Your rate " + discounted : listPrice;
  };
  const detailMode = selected ? getMode(selected, source) : "text";

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Model catalog</div>
        <p className={`${styles.muted} ${styles.tiny}`}>Browse models, check their capabilities and pricing, then open one in Playground.</p>
        <div className={styles.tabs} role="tablist" aria-label="Model API source">
          {(["p2g", "gen"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={source === value} className={`playground-tab ${styles.playgroundTab} ${source === value ? styles.active : ""}`} onClick={() => { setSource(value); setModality("all"); setSelected(null); }}>{value === "p2g" ? "P2G API" : "Gen API"}</button>)}
        </div>
        <input type="search" placeholder="Search by model, slug or publisher" aria-label="Search models" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: "100%", marginBottom: "1rem" }} />
        <div className={styles.modelPriceControls}>
          <label>Model type<select value={modality} onChange={(event) => setModality(event.target.value)}>
            <option value="all">All types</option>
            {(source === "gen" ? ["text", "image", "audio"] : ["text", "image", "video", "audio", "3d", "embedding", "realtime", "decision"]).map((value) => <option key={value} value={value}>{value === "3d" ? "3D" : value[0].toUpperCase() + value.slice(1)}</option>)}
          </select></label>
          <label>Starting price<select value={priceRange} onChange={(event) => setPriceRange(event.target.value)} disabled={source !== "p2g"}>
            <option value="all">All prices</option><option value="zero">$0 rate</option><option value="lt1">Under $1</option><option value="1to5">$1–$5</option><option value="5to20">$5–$20</option><option value="gte20">$20+</option>
          </select></label>
          <label>Sort by<select value={priceSort} onChange={(event) => setPriceSort(event.target.value as "default" | "asc" | "desc")} disabled={source !== "p2g"}>
            <option value="default">Default order</option><option value="asc">Price: low to high</option><option value="desc">Price: high to low</option>
          </select></label>
        </div>
        <p className={styles.modelPriceHint}>{source === "p2g" ? "Starting prices use published list rates before rewards. Billing units vary by model; unpriced models sort last." : "Generation uses subscription allowances. USD price controls apply to the P2G API."}</p>
        <p className={`${styles.muted} ${styles.tiny}`} aria-live="polite">{loading ? "Loading models…" : error || visibleModels.length + " model" + (visibleModels.length === 1 ? "" : "s")}</p>
        {!session && <p className={`${styles.muted} ${styles.tiny}`}>Sign in to view your available models and use Playground.</p>}
        {error && <button type="button" className="ghost" onClick={() => void loadModels()}>Retry models</button>}
        <div className={styles.modelsGrid}>
          {!loading && !error && visibleModels.length === 0 && <p className={styles.muted}>No matching models.</p>}
          {visibleModels.map((model, index) => {
            const id = modelId(model);
            const mode = getMode(model, source);
            const modalities = [...new Set([...(Array.isArray(model?.input_modalities) ? model.input_modalities : []), ...(Array.isArray(model?.output_modalities) ? model.output_modalities : [])])];
            return <article className={styles.modelCard} key={(id || "model") + "-" + index} role="button" tabIndex={0} aria-label={`Open ${displayName(model)} details`} aria-haspopup="dialog" onClick={() => setSelected(model)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(model); } }}>
              <div className={styles.modelCardTop}>
                <span className={styles.modelCardName}>{displayName(model)}</span>
                <span className={`${styles.modelPill} ${isTextModel(model) ? styles.isText : styles.isConfig}`}>{String(modelType(model) || model?.type || mode).toUpperCase()}</span>
              </div>
              <div className={styles.modelMeta}><span className={styles.modelKey}>Model ID</span><span className={styles.modelValue}>{id || "Not listed"}</span></div>
              <div className={styles.modelMeta}><span className={styles.modelKey}>Pricing</span><span className={styles.modelValue}>{price(model)}</span></div>
              {modalities.length > 0 && <div className={styles.modelMeta}><span className={styles.modelKey}>Modalities</span><span className={styles.modelValue}>{modalities.join(" / ")}</span></div>}

            </article>;
          })}
        </div>
      </section>

      {selected && catalogOwner === owner && <div className={styles.modelDetailOverlay} onClick={() => setSelected(null)}>
        <section ref={detailRef} className={styles.modelDetailTray} role="dialog" aria-modal="true" aria-labelledby="model-detail-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className={styles.modelDetailClose} onClick={() => setSelected(null)} aria-label="Close model details">×</button>
          <ModelArtwork key={modelId(selected)} model={selected} />
          <div className={styles.modelDetailContent}>
            <div className={styles.modelDetailHeader}><h2 className={styles.modelDetailName} id="model-detail-title">{displayName(selected)}</h2><span className={styles.modelPill}>{String(modelType(selected) || selected?.type || detailMode).toUpperCase()}</span></div>
            {typeof selected.description === "string" && selected.description.trim() && <p className={styles.modelDetailDescription}>{selected.description.trim()}</p>}
            <div className={styles.modelMeta}><span className={styles.modelKey}>Model ID</span><span className={styles.modelValue}>{modelId(selected) || "Not listed"}</span></div>
            <div className={styles.modelMeta}><span className={styles.modelKey}>Pricing</span><span className={styles.modelValue}>{price(selected)}</span></div>
            <div className={styles.modelMeta}><span className={styles.modelKey}>Input</span><span className={styles.modelValue}>{selected.input_modalities?.join(" / ") || "Not specified"}</span></div>
            <div className={styles.modelMeta}><span className={styles.modelKey}>Output</span><span className={styles.modelValue}>{selected.output_modalities?.join(" / ") || "Not specified"}</span></div>
            <div className={styles.row}><button type="button" onClick={() => launchPlayground(source, detailMode, modelId(selected))} disabled={!session || !modelId(selected)}>Try in Playground</button></div>
          </div>
        </section>
      </div>}
    </div>
  );
}
