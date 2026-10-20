"use client";

import { useEffect, useMemo, useState } from "react";
import shared from "./Playground.module.css";
import type { StudioProps } from "./types";
import { dedupe, slug } from "./models";
import { apiJson, jsonHeaders, downloadHref, fileToDataUrl } from "./api";
import { Button, EmptyStage, ErrorNote, Field, ModelSelect } from "./ui";
import { formatModelPrice } from "../../../lib/modelPricing";

const SAMPLE = {
  category: { type: "choice", instructions: "Classify the customer's request.", criteria: {
    billing: "Invoices, charges or payments", technical: "A problem using the product", other: "Anything else",
  } },
  urgent: { type: "noul", instructions: "Does the customer need urgent help?" },
};

export default function DecisionStudio({ session, apiBase, apiPrefix, models }: StudioProps) {
  const catalog = useMemo(() => dedupe(models.filter((m) => m.type === "decision")), [models]);
  const [model, setModel] = useState("microsoft/decision-1");
  const [state, setState] = useState("I was charged twice this month. Please help me get a refund.");
  const [stateFormat, setStateFormat] = useState("text");
  const [questions, setQuestions] = useState(JSON.stringify(SAMPLE, null, 2));
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [assetsJson, setAssetsJson] = useState("{}");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (catalog.length && !catalog.some((m) => slug(m) === model)) setModel(slug(catalog[0]));
  }, [catalog, model]);
  const selected = catalog.find((m) => slug(m) === model);
  const acceptsImages = selected?.input_modalities?.includes("image") === true;
  const acceptsVideos = selected?.input_modalities?.includes("video") === true;
  const acceptsAssets = selected?.supported_parameters?.includes("assets") === true;
  if (apiPrefix !== "/v1") return <EmptyStage icon="list" title="Decisions run on the P2G API">Switch to P2G to evaluate typed questions.</EmptyStage>;
  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const named = JSON.parse(questions);
      if (!named || Array.isArray(named) || typeof named !== "object" || !Object.keys(named).length) throw new Error("Questions must be a non-empty JSON object.");
      const payload: Record<string, unknown> = {
        model, state: stateFormat === "json" ? JSON.parse(state) : state, questions: named,
      };
      if (acceptsImages && imageFiles.length) {
        const maxCount = acceptsAssets ? 16 : 4;
        const maxSize = acceptsAssets ? 16 * 1024 * 1024 : 8_000_000;
        if (imageFiles.length > maxCount || imageFiles.some((file) => file.size > maxSize)) {
          throw new Error(`This model supports at most ${maxCount} images, up to ${Math.round(maxSize / 1024 / 1024)} MiB each.`);
        }
        payload.images = await Promise.all(imageFiles.map(fileToDataUrl));
      }
      if (acceptsVideos && videoFile) {
        if (videoFile.size > 32_000_000) throw new Error("Video cannot exceed 32 MB.");
        payload.videos = [await fileToDataUrl(videoFile)];
      }
      if (acceptsAssets && assetsJson.trim() && assetsJson.trim() !== "{}") {
        const parsed = JSON.parse(assetsJson);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          throw new Error("Named assets must be a JSON object.");
        }
        payload.assets = parsed;
      }
      const { data } = await apiJson({ apiBase }, "/v1/systemone", {
        method: "POST", headers: jsonHeaders(session), body: JSON.stringify(payload),
      });
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Decision request failed"); }
    finally { setBusy(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
    downloadHref(url, "decision.json");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className={shared.studio}>
    <aside className={shared.controls} aria-label="Decision settings">
      <ModelSelect models={catalog} value={model} onChange={setModel} label="Decision model" hint={selected ? formatModelPrice(selected) ?? undefined : "No decision models are available."} />
      <Field label="State format"><select className={shared.input} value={stateFormat} onChange={(e) => setStateFormat(e.target.value)} aria-label="State format"><option value="text">Text</option><option value="json">JSON</option></select></Field>
      <Field label="State" hint="Text to classify or evaluate">
        <textarea className={shared.textarea} rows={6} value={state} onChange={(e) => setState(e.target.value)} aria-label="Decision state" />
      </Field>
      {acceptsImages && <Field label="Images (optional)" hint={acceptsAssets ? "PNG, JPEG or WebP · up to 16 files" : "PNG, JPEG or WebP · up to 4 files"}>
        <input className={shared.input} type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label="Decision images"
          onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))} />
        {!!imageFiles.length && <p className={shared.hint}>{imageFiles.map((file) => file.name).join(", ")}</p>}
      </Field>}
      {acceptsVideos && <Field label="Video (optional)" hint="One MP4, WebM, MOV or MKV clip · up to 32 MB">
        <input className={shared.input} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" aria-label="Decision video"
          onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
      </Field>}
      {acceptsAssets && <Field label="Named image assets (JSON, optional)" hint={'For d3-turbo placeholders such as <animal>; values use {"type":"image","data_base64":"..." }.'}>
        <textarea className={shared.textarea} rows={5} value={assetsJson} onChange={(e) => setAssetsJson(e.target.value)}
          aria-label="Named decision assets JSON" spellCheck={false} />
      </Field>}
      <Field label="Questions (JSON)" hint="Named choice questions with criteria, noul questions returning a value from 0 to 1, or score questions with an ordered criteria list.">
        <textarea className={shared.textarea} rows={16} value={questions} onChange={(e) => setQuestions(e.target.value)} aria-label="Decision questions JSON" spellCheck={false} />
      </Field>
      <Button icon="sparkle" busy={busy} disabled={!state.trim() || !catalog.length} onClick={() => void submit()}>Evaluate decisions</Button>
      <ErrorNote onDismiss={() => setError("")}>{error}</ErrorNote>
    </aside>
    <section className={shared.stage} aria-label="Decision results" aria-live="polite">
      {!result ? <EmptyStage icon="list" title="Typed decisions with probabilities">Evaluate the sample or enter your own state and questions.</EmptyStage> : <div className={shared.stageCard}>
        <p>Model: {result.model} · Input tokens: {result.usage?.input_tokens ?? "—"} · Credits: {result.usage?.payg_credits_charged ?? "—"}</p>
        {Object.entries(result.answers ?? {}).map(([name, raw]) => {
          const answer = raw as any;
          return <div key={name} className={shared.stageCard}>
            <strong>{name}</strong>
            {answer.type === "choice" && <p>Choice: {answer.choice}</p>}
            {answer.type === "noul" && typeof answer.noul === "number" && <p>Score: {answer.noul.toFixed(4)}</p>}
            {answer.type === "score" && <p>Score: {String(answer.score ?? "—")}</p>}
            {answer.probabilities && Object.entries(answer.probabilities).map(([label, value]) => <p key={label}>{label}: {typeof value === "number" ? `${(value * 100).toFixed(2)}%` : String(value)}</p>)}
            {answer.error && <p>{String(answer.error)}</p>}
          </div>;
        })}
        <Button icon="download" onClick={download}>Download JSON</Button>
        <details><summary>Full response</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(result, null, 2)}</pre></details>
      </div>}
    </section>
  </div>;
}
