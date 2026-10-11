"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../Icon";
import shared from "./Playground.module.css";
import styles from "./ThreeDStudio.module.css";
import { Advanced, Button, Dropzone, EmptyStage, ErrorNote, Field, IconButton, ModelSelect, Range, Segmented, cx } from "./ui";
import { apiJson, b64ToBlobUrl, bearer, downloadHref, errorMessage, fileToDataUrl, jsonHeaders, uid } from "./api";
import { displayName, slug, threeDModels } from "./models";
import type { StudioProps } from "./types";

type Resolution = "low" | "medium" | "high";
type SourceMode = "upload" | "url";
type EnvPreset = "neutral" | "studio" | "none";
type BgPreset = "auto" | "light" | "dark" | "brand";
type ViewTab = "model" | "video";
type JobStatus = "submitting" | "polling" | "completed" | "failed" | "stopped";

interface Job {
  id: string;
  serverId?: string;
  model: string;
  modelLabel: string;
  prompt?: string;
  resolution?: Resolution;
  /** Small preview of the source image, so the job list does not hold the full image. */
  thumb: string;
  status: JobStatus;
  statusText: string;
  error?: string;
  startedAt: number;
  endedAt?: number;
  glbUrl?: string;
  plyUrl?: string;
  videoUrl?: string;
  credits?: number;
}

interface Poller {
  ctrl: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  failures: number;
}

const POLL_MS = 5000;
const MAX_POLL_FAILURES = 3;
const MAX_EDGE = 1536;
const MAX_PASSTHROUGH_BYTES = 3 * 1024 * 1024;

/** Used only when the catalog has no 3D models yet. */
const FALLBACK_MODELS = [
  { id: "tripoSR", name: "TripoSR" },
  { id: "sv3d", name: "SF3D" },
  { id: "trellis2", name: "Trellis 2" },
  { id: "asset-harvester", name: "Asset Harvester" },
];

const MODEL_HINTS: Record<string, string> = {
  "asset-harvester": "Asset Harvester produces GLB + PLY + orbit video. Requires a prompt.",
  tripoSR: "TripoSR produces a GLB model from a single image.",
  sv3d: "SF3D produces a GLB model from a single image.",
  trellis2: "Trellis 2 produces a GLB model. Higher resolution keeps more detail and costs more.",
};

const RESOLUTION_PRICE: Record<Resolution, string> = { low: "$0.24", medium: "$0.29", high: "$0.35" };
const RESOLUTION_OPTIONS: { value: Resolution; label: string; title: string }[] = [
  { value: "low", label: "Low", title: "Low: $0.24 per job" },
  { value: "medium", label: "Medium", title: "Medium: $0.29 per job" },
  { value: "high", label: "High", title: "High: $0.35 per job" },
];

const ENV_OPTIONS: { value: EnvPreset; label: string; title: string }[] = [
  { value: "neutral", label: "Neutral", title: "Neutral image based lighting" },
  { value: "studio", label: "Studio", title: "Classic model-viewer lighting" },
  { value: "none", label: "None", title: "No environment lighting" },
];

const BG_COLORS: Record<BgPreset, string> = {
  auto: "transparent",
  light: "#f4f5f7",
  dark: "#15171c",
  brand: "color-mix(in srgb, var(--brand) 16%, var(--surface))",
};
const BG_LABELS: Record<BgPreset, string> = { auto: "Auto", light: "Light", dark: "Dark", brand: "Brand tint" };

/* ---------- Module-level helpers ---------- */

let modelViewerLoad: Promise<void> | null = null;

/** Loads the model-viewer bundle once, on the client only. A failed load can be retried. */
function loadModelViewer(): Promise<void> {
  if (!modelViewerLoad) {
    modelViewerLoad = (async () => {
      // @ts-ignore
      await import("@google/model-viewer/dist/model-viewer");
    })().catch((e) => {
      modelViewerLoad = null;
      throw e;
    });
  }
  return modelViewerLoad;
}

const isImageSource = (u: string) => /^(https?:\/\/|data:image\/)/i.test(u.trim());

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode that image."));
    img.src = src;
  });
}

function drawScaled(img: HTMLImageElement, maxEdge: number, fillWhite: boolean): HTMLCanvasElement {
  const long = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const k = Math.min(1, maxEdge / long);
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  if (fillWhite) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/** Downscales the upload so its long edge is at most MAX_EDGE, keeping the request small. */
async function prepareImage(file: File): Promise<{ dataUrl: string; thumb: string }> {
  const src = await fileToDataUrl(file);
  const img = await loadImage(src);
  const thumb = drawScaled(img, 160, true).toDataURL("image/jpeg", 0.8);
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (long <= MAX_EDGE && file.size <= MAX_PASSTHROUGH_BYTES) return { dataUrl: src, thumb };
  const isPng = file.type === "image/png";
  const canvas = drawScaled(img, MAX_EDGE, !isPng);
  const dataUrl = isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92);
  return { dataUrl, thumb };
}

function revokeJobUrls(j: Job) {
  for (const u of [j.glbUrl, j.plyUrl, j.videoUrl]) if (u) URL.revokeObjectURL(u);
}

const fmtElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const fmtCredits = (c: number) => `$${c < 0.01 ? c.toFixed(4) : c.toFixed(2)}`;

/* ---------- Component ---------- */

export default function ThreeDStudio(props: StudioProps) {
  const { session, apiBase, apiPrefix, models, theme } = props;

  const catalog: any[] = useMemo(() => {
    const list = threeDModels(models);
    return list.length ? list : FALLBACK_MODELS;
  }, [models]);

  /* Request settings */
  const [model, setModel] = useState("");
  const [resolution, setResolution] = useState<Resolution>("medium");
  const [prompt, setPrompt] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [url, setUrl] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [formError, setFormError] = useState("");

  /* Jobs and results */
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [viewTab, setViewTab] = useState<ViewTab>("model");
  const [now, setNow] = useState(() => Date.now());

  /* Viewer controls */
  const [autoRotate, setAutoRotate] = useState(true);
  const [shadow, setShadow] = useState(1);
  const [exposure, setExposure] = useState(1);
  const [env, setEnv] = useState<EnvPreset>("neutral");
  const [bg, setBg] = useState<BgPreset>("auto");
  const [mvReady, setMvReady] = useState(false);
  const [mvError, setMvError] = useState(false);

  const viewerRef = useRef<any>(null);
  const jobsRef = useRef<Job[]>([]);
  const pollers = useRef(new Map<string, Poller>());
  const propsRef = useRef({ apiBase, session });

  /* Effects */
  useEffect(() => {
    if (!file) {
      setFilePreview("");
      return;
    }
    const u = URL.createObjectURL(file);
    setFilePreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    let alive = true;
    if (window.customElements?.get("model-viewer")) {
      setMvReady(true);
    } else {
      loadModelViewer()
        .then(() => window.customElements.whenDefined("model-viewer"))
        .then(() => { if (alive) setMvReady(true); })
        .catch(() => { if (alive) setMvError(true); });
    }
    return () => { alive = false; };
  }, []);

  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => { propsRef.current = { apiBase, session }; }, [apiBase, session]);

  const hasActive = jobs.some((j) => j.status === "submitting" || j.status === "polling");
  useEffect(() => {
    if (!hasActive) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasActive]);

  useEffect(() => {
    const map = pollers.current;
    return () => {
      map.forEach((p) => {
        p.ctrl.abort();
        if (p.timer) clearTimeout(p.timer);
      });
      map.clear();
      jobsRef.current.forEach(revokeJobUrls);
    };
  }, []);

  /* Derived state */
  const activeModel = catalog.some((m) => slug(m) === model) ? model : catalog[0] ? slug(catalog[0]) : "";
  const modelObj = catalog.find((m) => slug(m) === activeModel);
  const modelLabel = modelObj ? displayName(modelObj) : activeModel;
  const needsPrompt = activeModel === "asset-harvester";
  const trimmedPrompt = prompt.trim();

  let blocker = "";
  if (preparing) blocker = "Preparing the image";
  else if (!session) blocker = "Sign in to generate 3D models.";
  else if (!activeModel) blocker = "No 3D model is available right now.";
  else if (needsPrompt && !trimmedPrompt) blocker = "Add a prompt for Asset Harvester.";
  else if (sourceMode === "upload" && !file) blocker = "Add a source image.";
  else if (sourceMode === "url" && !url.trim()) blocker = "Add an image URL.";
  else if (sourceMode === "url" && !isImageSource(url)) blocker = "The URL must start with https:// or be an image data URI.";
  const canGenerate = !blocker;

  const completed = jobs.filter((j) => j.status === "completed");
  const active = completed.find((j) => j.id === selectedId) ?? completed[0];
  const tab: ViewTab = viewTab === "video" && active?.videoUrl ? "video" : "model";
  const stem = active ? `model-${active.id.slice(0, 6)}` : "model";
  const envAttr = env === "neutral" ? "neutral" : env === "studio" ? "legacy" : undefined;
  const activeJobs = jobs.filter((j) => j.status === "submitting" || j.status === "polling");
  const viewerReady = tab === "model" && !!active?.glbUrl && mvReady;

  /* Job lifecycle */
  const patchJob = (id: string, patch: Partial<Job>) =>
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const stopPolling = (id: string) => {
    const p = pollers.current.get(id);
    if (!p) return;
    p.ctrl.abort();
    if (p.timer) clearTimeout(p.timer);
    pollers.current.delete(id);
  };

  const failJob = (id: string, message: string) => {
    stopPolling(id);
    patchJob(id, { status: "failed", statusText: "Failed", error: message, endedAt: Date.now() });
  };

  const finishJob = (id: string, r: any) => {
    pollers.current.delete(id);
    try {
      const item = r?.data?.[0];
      const glbUrl = item?.model_glb_b64_bytes ? b64ToBlobUrl(item.model_glb_b64_bytes, "model/gltf-binary") : undefined;
      const plyUrl = item?.model_ply_b64_bytes ? b64ToBlobUrl(item.model_ply_b64_bytes, "application/octet-stream") : undefined;
      const videoUrl = item?.orbit_video_b64_bytes ? b64ToBlobUrl(item.orbit_video_b64_bytes, "video/mp4") : undefined;
      if (!glbUrl && !plyUrl && !videoUrl) {
        patchJob(id, { status: "failed", statusText: "Failed", error: "The job finished without any model output.", endedAt: Date.now() });
        return;
      }
      const credits = Number(r?.usage?.payg_credits_charged);
      patchJob(id, {
        status: "completed",
        statusText: "Complete",
        endedAt: Date.now(),
        glbUrl,
        plyUrl,
        videoUrl,
        credits: Number.isFinite(credits) ? credits : undefined,
      });
      setSelectedId(id);
    } catch (e) {
      failJob(id, e instanceof Error ? e.message : "Could not read the model output.");
    }
  };

  const schedulePoll = (id: string, serverId: string) => {
    const p = pollers.current.get(id);
    if (!p) return;
    p.timer = setTimeout(() => void pollOnce(id, serverId), POLL_MS);
  };

  const pollOnce = async (id: string, serverId: string) => {
    const p = pollers.current.get(id);
    if (!p) return;
    const { ctrl } = p;
    try {
      const { data: r } = await apiJson(
        propsRef.current,
        `/v1/3d/jobs/${encodeURIComponent(serverId)}`,
        { headers: bearer(propsRef.current.session) },
        ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      p.failures = 0;
      if (r?.status === "completed") {
        finishJob(id, r);
        return;
      }
      if (r?.status === "failed") {
        failJob(id, errorMessage({ error: r.error }, "3D generation job failed."));
        return;
      }
      patchJob(id, { statusText: `Job ${r?.status || "running"}` });
      schedulePoll(id, serverId);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      p.failures += 1;
      if (p.failures >= MAX_POLL_FAILURES) failJob(id, e instanceof Error ? e.message : "Lost contact with the server.");
      else schedulePoll(id, serverId);
    }
  };

  const submit = async () => {
    if (!canGenerate) return;
    setFormError("");
    let dataUrl = url.trim();
    let thumb = dataUrl;
    if (sourceMode === "upload" && file) {
      setPreparing(true);
      try {
        ({ dataUrl, thumb } = await prepareImage(file));
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Could not prepare the image.");
        setPreparing(false);
        return;
      }
      setPreparing(false);
    }

    const id = uid();
    const ctrl = new AbortController();
    pollers.current.set(id, { ctrl, failures: 0 });
    const isHarvester = activeModel === "asset-harvester";
    const isTrellis = activeModel === "trellis2";
    const body: Record<string, unknown> = { model: activeModel, image_urls: [dataUrl] };
    if (isHarvester) body.prompt = trimmedPrompt;
    if (isTrellis) body.resolution = resolution;

    const job: Job = {
      id,
      model: activeModel,
      modelLabel,
      prompt: isHarvester ? trimmedPrompt : undefined,
      resolution: isTrellis ? resolution : undefined,
      thumb,
      status: "submitting",
      statusText: "Submitting job",
      startedAt: Date.now(),
    };
    setJobs((list) => [job, ...list]);

    try {
      const { data: r } = await apiJson(
        propsRef.current,
        "/v1/3d/generations",
        { method: "POST", headers: jsonHeaders(session), body: JSON.stringify(body) },
        ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      if (r?.job_id) {
        patchJob(id, { serverId: r.job_id, status: "polling", statusText: "Queued on the server" });
        schedulePoll(id, r.job_id);
      } else if (r?.data) {
        finishJob(id, r);
      } else {
        failJob(id, "Unexpected response from the 3D generation endpoint.");
      }
    } catch (e) {
      if (!ctrl.signal.aborted) failJob(id, e instanceof Error ? e.message : "Submission failed.");
    }
  };

  const cancelJob = (id: string) => {
    stopPolling(id);
    patchJob(id, { status: "stopped", statusText: "Stopped on this device", endedAt: Date.now() });
  };

  const removeJob = (id: string) => {
    stopPolling(id);
    const j = jobsRef.current.find((x) => x.id === id);
    if (j) revokeJobUrls(j);
    setJobs((list) => list.filter((x) => x.id !== id));
  };

  /* Viewer actions */
  const resetCamera = () => {
    const v = viewerRef.current;
    if (!v) return;
    v.resetTurntableRotation?.();
    v.jumpCameraToGoal?.();
  };

  const capture = async () => {
    const v = viewerRef.current;
    if (!v || typeof v.toBlob !== "function") return;
    try {
      const blob: Blob = await v.toBlob({ mimeType: "image/png", idealAspect: true });
      const u = URL.createObjectURL(blob);
      downloadHref(u, `${stem}.png`);
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not capture the view.");
    }
  };

  if (apiPrefix === "/gen") {
    return (
      <EmptyStage icon="cube" title="3D is only available on the P2G API">
        3D generation is not offered on the subscription Gen API. Switch the source to P2G to use the 3D studio.
      </EmptyStage>
    );
  }

  return (
    <div className={shared.studio} data-theme={theme} style={{ colorScheme: theme }}>
      <aside className={shared.controls} aria-label="3D generation settings">
        <ModelSelect
          label="Model"
          models={catalog}
          value={activeModel}
          onChange={setModel}
          placeholder="Select a 3D model"
        />

        {needsPrompt && (
          <Field label="Prompt" hint="Required.">
            <textarea
              className={shared.textarea}
              rows={3}
              value={prompt}
              placeholder="e.g. a weathered leather armchair with brass studs"
              onChange={(e) => setPrompt(e.target.value)}
              aria-required="true"
            />
          </Field>
        )}

        <Field label="Source image">
          {sourceMode === "upload" ? (
            <Dropzone
              accept="image/*"
              kind="image"
              file={file}
              previewUrl={filePreview}
              hint="Drop an image or click to browse"
              onFile={(f) => {
                if (f && !f.type.startsWith("image/")) {
                  setFormError("That file is not an image.");
                  return;
                }
                setFormError("");
                setFile(f);
              }}
            />
          ) : (
            <span className={shared.hint}>Using an image URL. Change it in Advanced.</span>
          )}
        </Field>

        <Advanced>
          <div className={styles.advancedStack}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={sourceMode === "url"}
                onChange={(e) => {
                  setFormError("");
                  setSourceMode(e.target.checked ? "url" : "upload");
                }}
              />
              <span>Use an image URL instead</span>
            </label>
            {sourceMode === "url" && (
              <>
                <input
                  className={shared.input}
                  type="url"
                  inputMode="url"
                  aria-label="Image URL"
                  placeholder="https://... or data:image/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                {isImageSource(url) && (
                  <img className={styles.urlPreview} src={url.trim()} alt="Source preview" loading="lazy" referrerPolicy="no-referrer" />
                )}
              </>
            )}

            {activeModel === "trellis2" && (
              <Field label="Resolution" right={<span className={shared.readout}>{RESOLUTION_PRICE[resolution]}</span>}>
                <Segmented<Resolution> value={resolution} onChange={setResolution} options={RESOLUTION_OPTIONS} />
              </Field>
            )}

            {MODEL_HINTS[activeModel] && <p className={styles.note}>{MODEL_HINTS[activeModel]}</p>}
          </div>
        </Advanced>

        <div className={styles.generate}>
          <Button icon="sparkle" busy={preparing} disabled={!canGenerate} onClick={submit} className={styles.fullBtn}>
            Generate 3D model
          </Button>
          {blocker && <span className={shared.hint}>{blocker}</span>}
        </div>

        {formError && <ErrorNote onDismiss={() => setFormError("")}>{formError}</ErrorNote>}
      </aside>

      <section className={shared.stage} aria-label="3D viewer and jobs">
        {active ? (
          <div className={styles.viewerCard}>
            <div className={styles.viewerHead}>
              <span className={styles.viewerTitle}>{active.modelLabel}</span>
              {active.videoUrl && (
                <Segmented<ViewTab>
                  size="sm"
                  value={tab}
                  onChange={setViewTab}
                  options={[
                    { value: "model", label: "Model" },
                    { value: "video", label: "Orbit video" },
                  ]}
                />
              )}
              {viewerReady && (
                <button
                  type="button"
                  className={cx(styles.toggle, autoRotate && styles.toggleOn)}
                  aria-pressed={autoRotate}
                  aria-label="Auto-rotate"
                  title="Auto-rotate"
                  onClick={() => setAutoRotate((v) => !v)}
                >
                  <Icon name="play" />
                </button>
              )}
            </div>

            {tab === "video" && active.videoUrl ? (
              <video className={styles.video} src={active.videoUrl} controls autoPlay loop muted playsInline />
            ) : mvError ? (
              <ErrorNote>The 3D viewer could not load. Downloads still work.</ErrorNote>
            ) : !mvReady ? (
              <div className={cx(shared.skeleton, styles.viewerSkeleton)} role="status" aria-label="Loading the 3D viewer" />
            ) : active.glbUrl ? (
              <model-viewer
                key={active.id}
                ref={viewerRef}
                className={styles.viewer}
                src={active.glbUrl}
                alt={`3D model: ${active.modelLabel}`}
                camera-controls=""
                interaction-prompt="auto"
                auto-rotate={autoRotate ? "" : undefined}
                shadow-intensity={String(shadow)}
                exposure={String(exposure)}
                environment-image={envAttr}
                style={{ backgroundColor: BG_COLORS[bg], touchAction: "pan-y" }}
              />
            ) : (
              <p className={shared.hint}>This job did not return a GLB file. Use the downloads below.</p>
            )}

            <div className={styles.downloads}>
              {active.glbUrl && (
                <Button variant="ghost" icon="download" className={styles.dl} onClick={() => downloadHref(active.glbUrl!, `${stem}.glb`)}>GLB</Button>
              )}
              {active.credits !== undefined && (
                <span className={styles.credits}>Credits charged: {fmtCredits(active.credits)}</span>
              )}
            </div>

            <Advanced label="Viewer settings">
              <div className={styles.settings}>
                <div className={styles.settingsRow}>
                  {viewerReady && (
                    <>
                      <Button variant="ghost" icon="arrow-clockwise" className={styles.dl} onClick={resetCamera}>Reset camera</Button>
                      <Button variant="ghost" icon="image" className={styles.dl} onClick={capture}>Capture PNG</Button>
                    </>
                  )}
                  {active.plyUrl && (
                    <Button variant="ghost" icon="download" className={styles.dl} onClick={() => downloadHref(active.plyUrl!, `${stem}.ply`)}>PLY</Button>
                  )}
                  {active.videoUrl && (
                    <Button variant="ghost" icon="download" className={styles.dl} onClick={() => downloadHref(active.videoUrl!, `${stem}-orbit.mp4`)}>Orbit MP4</Button>
                  )}
                </div>

                {viewerReady && (
                  <div className={styles.settingsGrid}>
                    <Range label="Shadow" value={shadow} min={0} max={2} step={0.05} onChange={setShadow} format={(v) => v.toFixed(2)} />
                    <Range label="Exposure" value={exposure} min={0} max={2} step={0.05} onChange={setExposure} format={(v) => v.toFixed(2)} />
                    <Field label="Environment">
                      <Segmented<EnvPreset> size="sm" value={env} onChange={setEnv} options={ENV_OPTIONS} />
                    </Field>
                    <Field label="Background">
                      <div className={styles.swatches} role="group" aria-label="Viewer background">
                        {(Object.keys(BG_COLORS) as BgPreset[]).map((b) => (
                          <button
                            key={b}
                            type="button"
                            className={cx(styles.swatch, b === "auto" && styles.swatchAuto)}
                            style={b === "auto" ? undefined : { background: BG_COLORS[b] }}
                            aria-label={`${BG_LABELS[b]} background`}
                            title={BG_LABELS[b]}
                            aria-pressed={bg === b}
                            onClick={() => setBg(b)}
                          />
                        ))}
                      </div>
                    </Field>
                  </div>
                )}
              </div>
            </Advanced>
          </div>
        ) : (
          <div className={styles.emptyWrap}>
            <EmptyStage icon="cube" title={activeJobs.length ? "Your model is on its way" : "No 3D model yet"} />
          </div>
        )}

        {completed.length > 1 && (
          <div className={styles.strip} role="group" aria-label="Finished results">
            {completed.map((j) => (
              <button
                key={j.id}
                type="button"
                className={cx(styles.thumb, j.id === active?.id && styles.thumbOn)}
                aria-pressed={j.id === active?.id}
                onClick={() => setSelectedId(j.id)}
              >
                <img className={styles.thumbImg} src={j.thumb} alt="" />
                <span className={styles.thumbName}>{j.modelLabel}</span>
                <span className={styles.thumbPrompt}>
                  {j.prompt || (j.resolution ? `Resolution: ${j.resolution}` : "Image to 3D")}
                </span>
              </button>
            ))}
          </div>
        )}

        {jobs.length > 0 && (
          <div className={styles.jobs}>
            <h3 className={styles.jobsTitle}>Jobs</h3>
            {activeJobs.length > 0 && (
              <p className={styles.note}>Most jobs finish in 1 to 5 minutes.</p>
            )}
            {jobs.map((j) => {
              const isActive = j.status === "submitting" || j.status === "polling";
              const elapsed = (j.endedAt ?? now) - j.startedAt;
              const dot = j.status === "completed" ? shared.dotDone : j.status === "failed" ? shared.dotFailed : isActive ? shared.dotPending : "";
              return (
                <article key={j.id} className={styles.job} aria-label={`${j.modelLabel} job`}>
                  <div className={styles.jobHead}>
                    <img className={styles.jobThumb} src={j.thumb} alt="" />
                    <div className={styles.jobMeta}>
                      <span className={styles.jobTitle}>{j.modelLabel}{j.prompt ? ` · ${j.prompt}` : ""}</span>
                      <span className={styles.jobStatus}>
                        <span className={cx(shared.dot, dot, styles.statusDot)} />
                        {j.statusText} · {fmtElapsed(elapsed)}
                      </span>
                    </div>
                    {isActive ? (
                      <button
                        type="button"
                        className={styles.cancel}
                        title="Stops tracking here. The server job may still finish."
                        onClick={() => cancelJob(j.id)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <IconButton
                        icon={j.status === "completed" ? "trash" : "x"}
                        label={j.status === "completed" ? "Remove result" : "Dismiss job"}
                        onClick={() => removeJob(j.id)}
                      />
                    )}
                  </div>

                  {isActive && (
                    <div className={styles.progress} role="progressbar" aria-label={`${j.modelLabel} progress`} aria-valuetext={j.statusText}>
                      <div className={styles.progressBar} />
                    </div>
                  )}

                  {j.error && <p className={styles.jobError} role="alert">{j.error}</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
