"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import shared from "./Playground.module.css";
import styles from "./VideoStudio.module.css";
import type { StudioProps } from "./types";
import { slug, videoModels } from "./models";
import { formatModelPrice } from "../../../lib/modelPricing";
import { apiJson, assertOk, bearer, dataUrlToBlob, downloadHref, fileToDataUrl, jsonHeaders, uid } from "./api";
import { Advanced, Button, cx, Dropzone, EmptyStage, ErrorNote, Field, IconButton, ModelSelect, Segmented } from "./ui";

const DURATIONS = [4, 8, 12, 20, 30].map((s) => ({ value: s, label: `${s}s`, title: `${s} seconds` }));
const RECENT_KEY = "playground-video-prompts-v1";
const RECENT_MAX = 8;
const POLL_MS = 3000;

type JobStatus = "submitting" | "queued" | "in_progress" | "fetching" | "completed" | "failed" | "cancelled";
const TERMINAL: JobStatus[] = ["completed", "failed", "cancelled"];
const STATUS_TEXT: Record<JobStatus, string> = {
  submitting: "Submitting",
  queued: "Queued",
  in_progress: "Generating",
  fetching: "Downloading",
  completed: "Ready",
  failed: "Failed",
  cancelled: "Stopped tracking",
};

interface Job {
  localId: string;
  jobId?: string;
  prompt: string;
  model: string;
  seconds: number;
  /** Reference image data URL, kept in memory only so "Reuse settings" can restore it. */
  reference?: string;
  status: JobStatus;
  progress?: number;
  error?: string;
  videoUrl?: string;
  credits?: string;
  startedAt: number;
  finishedAt?: number;
}

interface Controller {
  ac: AbortController;
  timer?: ReturnType<typeof setTimeout>;
}

function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function readRecent(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode, blocked) - recents simply do not persist */
  }
}

/* ---------- Entry point ---------- */

export default function VideoStudio(props: StudioProps) {
  if (props.apiPrefix === "/gen") {
    return (
      <EmptyStage icon="video" title="Video generation unavailable">
        Video generation is only available on the P2G API — switch the source at the top.
      </EmptyStage>
    );
  }
  return <VideoWorkspace {...props} />;
}

/* ---------- Workspace ---------- */

function VideoWorkspace({ session, apiBase, models }: StudioProps) {
  const catalog = useMemo(() => videoModels(models), [models]);

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [seconds, setSeconds] = useState(4);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refData, setRefData] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const promptRef = useRef<HTMLTextAreaElement>(null);
  /** In-flight lifecycle per job: one AbortController and at most one pending poll timer. */
  const ctrl = useRef(new Map<string, Controller>());
  /** Every object URL we created, so each can be revoked exactly once. */
  const urls = useRef(new Set<string>());
  /** Latest credentials for long-running polls, which outlive the render that started them. */
  const live = useRef({ session, apiBase });

  useEffect(() => {
    live.current = { session, apiBase };
  }, [session, apiBase]);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  // Unmount: abort requests, clear timers, revoke blob URLs.
  useEffect(() => {
    const c = ctrl.current;
    const u = urls.current;
    return () => {
      c.forEach((e) => {
        clearTimeout(e.timer);
        e.ac.abort();
      });
      c.clear();
      u.forEach((url) => URL.revokeObjectURL(url));
      u.clear();
    };
  }, []);

  // Revoke object URLs whose job has been removed.
  useEffect(() => {
    const keep = new Set(jobs.map((j) => j.videoUrl).filter((u): u is string => !!u));
    urls.current.forEach((u) => {
      if (!keep.has(u)) {
        URL.revokeObjectURL(u);
        urls.current.delete(u);
      }
    });
  }, [jobs]);

  const hasActive = jobs.some((j) => !TERMINAL.includes(j.status));
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasActive]);

  const update = (id: string, patch: Partial<Job>) =>
    setJobs((prev) => prev.map((j) => (j.localId === id ? { ...j, ...patch } : j)));

  const release = (id: string) => {
    const e = ctrl.current.get(id);
    if (e) clearTimeout(e.timer);
    ctrl.current.delete(id);
  };

  const failJob = (id: string, message: string) => {
    release(id);
    update(id, { status: "failed", error: message, finishedAt: Date.now() });
  };

  const fetchContent = async (id: string, jobId: string) => {
    const entry = ctrl.current.get(id);
    if (!entry) return;
    const { signal } = entry.ac;
    update(id, { status: "fetching", progress: 100 });
    try {
      const r = await fetch(`${live.current.apiBase}/v1/videos/${encodeURIComponent(jobId)}/content`, {
        headers: bearer(live.current.session),
        signal,
      });
      await assertOk(r);
      const credits = r.headers.get("X-Payg-Credits-Charged") ?? undefined;
      const blob = await r.blob();
      if (!ctrl.current.has(id)) return;
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      release(id);
      update(id, { status: "completed", videoUrl: url, credits, finishedAt: Date.now() });
    } catch (e) {
      if (signal.aborted || !ctrl.current.has(id)) return;
      failJob(id, errText(e, "Could not download the video."));
    }
  };

  const poll = async (id: string, jobId: string) => {
    const entry = ctrl.current.get(id);
    if (!entry) return;
    const { signal } = entry.ac;
    try {
      const { data } = await apiJson(live.current, `/v1/videos/${encodeURIComponent(jobId)}`, { headers: bearer(live.current.session) }, signal);
      if (!ctrl.current.has(id)) return;
      const status = String(data?.status ?? "queued");
      if (status === "failed") {
        const msg = typeof data?.error === "string" ? data.error : data?.error?.message;
        failJob(id, msg || "Video generation failed.");
        return;
      }
      if (status === "completed") {
        await fetchContent(id, jobId);
        return;
      }
      const progress = typeof data?.progress === "number" ? Math.max(0, Math.min(100, data.progress)) : undefined;
      update(id, { status: status === "in_progress" ? "in_progress" : "queued", progress });
      entry.timer = setTimeout(() => void poll(id, jobId), POLL_MS);
    } catch (e) {
      if (signal.aborted || !ctrl.current.has(id)) return;
      failJob(id, errText(e, "Could not reach the video service."));
    }
  };

  const rememberPrompt = (text: string) => {
    const next = [text, ...recent.filter((p) => p !== text)].slice(0, RECENT_MAX);
    setRecent(next);
    writeRecent(next);
  };

  const submit = async () => {
    const text = prompt.trim();
    if (!text) return;
    if (!session?.access_token) {
      setFormError("Sign in to generate videos.");
      return;
    }
    setFormError("");
    const id = uid();
    const ac = new AbortController();
    ctrl.current.set(id, { ac });
    setJobs((prev) => [
      { localId: id, prompt: text, model, seconds, reference: refData ?? undefined, status: "submitting", startedAt: Date.now() },
      ...prev,
    ]);
    rememberPrompt(text);

    const body: Record<string, unknown> = { prompt: text, seconds };
    if (model) body.model = model;
    if (refData) body.input_reference = refData;

    try {
      const { data } = await apiJson(live.current, "/v1/videos", { method: "POST", headers: jsonHeaders(session), body: JSON.stringify(body) }, ac.signal);
      if (!ctrl.current.has(id)) return;
      if (!data?.id) throw new Error("Unexpected response from the video endpoint.");
      const jobId = String(data.id);
      update(id, { jobId, status: "queued" });
      void poll(id, jobId);
    } catch (e) {
      if (ac.signal.aborted) return;
      failJob(id, errText(e, "Could not start the job."));
    }
  };

  /** Stops client-side tracking only; the server job may still complete. */
  const stopTracking = (id: string) => {
    const e = ctrl.current.get(id);
    if (e) {
      clearTimeout(e.timer);
      e.ac.abort();
    }
    ctrl.current.delete(id);
  };

  const cancelJob = (id: string) => {
    stopTracking(id);
    update(id, { status: "cancelled", finishedAt: Date.now() });
  };

  const removeJob = (id: string) => {
    stopTracking(id);
    setJobs((prev) => prev.filter((j) => j.localId !== id));
  };

  const reuseJob = (j: Job) => {
    setPrompt(j.prompt);
    setModel(j.model);
    setSeconds(j.seconds);
    if (j.reference) {
      const blob = dataUrlToBlob(j.reference);
      setRefFile(new File([blob], "reference-image", { type: blob.type }));
      setRefData(j.reference);
    } else {
      setRefFile(null);
      setRefData(null);
    }
    promptRef.current?.focus();
  };

  const onRefFile = async (f: File | null) => {
    if (!f) {
      setRefFile(null);
      setRefData(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setFormError("The reference must be an image file.");
      return;
    }
    setFormError("");
    setRefFile(f);
    try {
      setRefData(await fileToDataUrl(f));
    } catch (e) {
      setRefFile(null);
      setFormError(errText(e, "Could not read that image."));
    }
  };

  const clearRecent = () => {
    setRecent([]);
    writeRecent([]);
  };

  const selected = useMemo(() => catalog.find((m) => slug(m) === model), [catalog, model]);
  const perSecond = selected ? parseFloat(selected?.pricing?.request) : NaN;
  const priceText = selected ? formatModelPrice(selected) : null;
  const estimate = perSecond > 0 ? `≈ $${(perSecond * seconds).toFixed(3)}` : (priceText ?? "Not published");
  const estimateHint = !selected
    ? "Pick a model to see its price."
    : perSecond > 0
      ? `${priceText} × ${seconds}s · estimate only`
      : "Estimate only.";

  return (
    <div className={shared.studio}>
      <aside className={cx(shared.controls, styles.rail)} aria-label="Video settings">
        <Field label="Prompt">
          <textarea
            ref={promptRef}
            className={shared.textarea}
            rows={4}
            aria-label="Prompt"
            placeholder="A slow dolly shot through a rain-soaked neon street at night…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
          />
        </Field>

        <Button icon="video" className={styles.submit} onClick={() => void submit()} disabled={!prompt.trim()}>
          Generate video
        </Button>

        <ModelSelect
          models={catalog}
          value={model}
          onChange={setModel}
          defaultLabel="Default"
          label="Model"
          hint={catalog.length ? undefined : "No video models are available right now."}
        />

        <ErrorNote onDismiss={() => setFormError("")}>{formError}</ErrorNote>

        <Advanced>
          <div className={styles.advBody}>
            <Field label="Duration">
              <Segmented value={seconds} onChange={setSeconds} options={DURATIONS} />
            </Field>

            <Field label="Reference image">
              <Dropzone
                accept="image/*"
                kind="image"
                file={refFile}
                previewUrl={refData ?? undefined}
                onFile={onRefFile}
                hint="Drop an image or click to browse"
              />
            </Field>

            <div className={styles.estimate} aria-live="polite" title={estimateHint}>
              <span className={shared.label}>Estimated cost</span>
              <span className={styles.estimateValue}>{estimate}</span>
            </div>

            {recent.length > 0 && (
              <div className={styles.recent}>
                <div className={styles.recentHead}>
                  <span className={shared.label}>Recent prompts</span>
                  <button type="button" className={styles.linkBtn} onClick={clearRecent}>Clear</button>
                </div>
                <div className={styles.chips}>
                  {recent.map((p) => (
                    <button key={p} type="button" className={cx(shared.chip, styles.chipBtn)} title={p} onClick={() => setPrompt(p)}>
                      <span className={styles.chipText}>{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Advanced>
      </aside>

      <section className={shared.stage} aria-label="Video jobs">
        {jobs.length === 0 ? (
          <EmptyStage icon="video" title="No videos yet" />
        ) : (
          <div className={styles.grid}>
            {jobs.map((j) => (
              <JobCard
                key={j.localId}
                job={j}
                now={now}
                onCancel={cancelJob}
                onRemove={removeJob}
                onReuse={reuseJob}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Job card ---------- */

function JobCard({
  job, now, onCancel, onRemove, onReuse,
}: {
  job: Job;
  now: number;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onReuse: (j: Job) => void;
}) {
  const [loop, setLoop] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const active = !TERMINAL.includes(job.status);
  const elapsed = (job.finishedAt ?? now) - job.startedAt;
  const pct = job.progress;

  const copyPrompt = () => {
    navigator.clipboard?.writeText(job.prompt).then(() => setCopied(true)).catch(() => undefined);
  };

  return (
    <article className={styles.job} aria-label={`Video: ${job.prompt}`}>
      {job.status === "completed" && job.videoUrl ? (
        <video
          className={styles.video}
          src={job.videoUrl}
          controls
          loop={loop}
          playsInline
          preload="metadata"
          aria-label={`Generated video: ${job.prompt}`}
        />
      ) : active ? (
        <div className={cx(styles.media, shared.skeleton)} />
      ) : null}

      <p className={styles.prompt} title={job.prompt}>{job.prompt}</p>

      {active && (
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Generation progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct !== undefined ? Math.round(pct) : undefined}
        >
          {pct !== undefined ? (
            <div className={styles.progressFill} style={{ ["--value" as any]: `${pct}%` }} />
          ) : (
            <div className={cx(styles.indeterminate, shared.skeleton)} />
          )}
        </div>
      )}

      <div className={styles.meta} role="status" aria-live="polite">
        <span className={job.status === "failed" ? styles.failText : undefined}>{STATUS_TEXT[job.status]}</span>
        {active && <span className={styles.elapsed} title="Elapsed time">{fmtElapsed(elapsed)}</span>}
        {job.credits !== undefined && <span>Credits {job.credits}</span>}
        {job.status === "completed" && job.videoUrl && (
          <label className={styles.loop}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            Loop
          </label>
        )}
      </div>

      {job.status === "failed" && <ErrorNote>{job.error || "Video generation failed."}</ErrorNote>}

      <div className={styles.actions}>
        {active ? (
          <IconButton
            icon="stop"
            label="Cancel (stops tracking here; the server job may still finish)"
            className={styles.iconAct}
            onClick={() => onCancel(job.localId)}
          />
        ) : (
          <>
            {job.status === "completed" && job.videoUrl && (
              <IconButton
                icon="download"
                label="Download"
                className={styles.iconAct}
                onClick={() => downloadHref(job.videoUrl as string, `video-${(job.jobId ?? job.localId).slice(0, 12)}.mp4`)}
              />
            )}
            <IconButton icon={copied ? "check" : "copy"} label={copied ? "Prompt copied" : "Copy prompt"} className={styles.iconAct} onClick={copyPrompt} />
            <IconButton icon="arrow-clockwise" label="Reuse settings" className={styles.iconAct} onClick={() => onReuse(job)} />
            <IconButton icon="trash" label="Remove" className={styles.iconAct} onClick={() => onRemove(job.localId)} />
          </>
        )}
      </div>
    </article>
  );
}
