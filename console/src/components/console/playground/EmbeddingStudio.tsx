"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import shared from "./Playground.module.css";
import styles from "./EmbeddingStudio.module.css";
import type { StudioProps } from "./types";
import { embeddingModels, slug } from "./models";
import { assertOk, downloadHref, jsonHeaders } from "./api";
import { Advanced, Button, cx, EmptyStage, ErrorNote, Field, IconButton, ModelSelect, Segmented } from "./ui";

const DEFAULT_MODEL = "text-embedding-3-small";
const MAX_INPUTS = 32; // the API accepts at most 32 inputs per request
const MIN_DIMENSIONS = 128;
const PREVIEW_VALUES = 6;
const SAMPLES = [
  "The cat sat on the mat.",
  "A kitten is resting on a rug.",
  "Quarterly revenue grew 12% year over year.",
];

interface Result {
  model: string;
  vectors: number[][];
  inputs: string[];
  tokens: number;
  credits?: number;
  base64: boolean;
}

export const cosine = (a: number[], b: number[]): number => {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

/** Decode an OpenAI `encoding_format: "base64"` embedding (little-endian float32). */
export function decodeBase64Embedding(b64: string): number[] {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const out: number[] = [];
  for (let i = 0; i + 4 <= bytes.length; i += 4) out.push(view.getFloat32(i, true));
  return out;
}

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export default function EmbeddingStudio({ session, apiBase, apiPrefix, models }: StudioProps) {
  const catalog = useMemo(() => embeddingModels(models), [models]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [text, setText] = useState(SAMPLES.join("\n"));
  const [dimensions, setDimensions] = useState("");
  const [format, setFormat] = useState<"float" | "base64">("float");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<number | "all" | null>(null);
  /** Id of the newest request; an older one that finishes late must not replace newer results. */
  const latest = useRef(0);

  useEffect(() => {
    if (catalog.length && !catalog.some((m) => slug(m) === model)) setModel(slug(catalog[0]));
  }, [catalog, model]);

  useEffect(() => {
    if (copied === null) return;
    const t = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const lines = useMemo(() => text.split("\n").map((l) => l.trim()).filter(Boolean), [text]);
  const selected = catalog.find((m) => slug(m) === model);
  const maxDims = Number(selected?.dimensions) || undefined;

  if (apiPrefix !== "/v1") {
    return (
      <EmptyStage icon="list" title="Embeddings run on the P2G API">
        Switch the source to P2G API to create embeddings. They are billed per input token from your credits.
      </EmptyStage>
    );
  }

  const submit = async () => {
    if (!lines.length || busy) return;
    if (lines.length > MAX_INPUTS) { setError(`Use at most ${MAX_INPUTS} lines per request in the playground.`); return; }
    const dims = dimensions.trim() ? Number(dimensions) : undefined;
    if (dims !== undefined && (!Number.isInteger(dims) || dims < MIN_DIMENSIONS || (maxDims && dims > maxDims))) {
      setError(`Dimensions must be a whole number between ${MIN_DIMENSIONS} and ${maxDims ?? "the model maximum"}.`);
      return;
    }
    const mine = ++latest.current;
    setError("");
    setBusy(true);
    try {
      const body: Record<string, unknown> = { model, input: lines, encoding_format: format };
      if (dims !== undefined) body.dimensions = dims;
      const r = await assertOk(await fetch(`${apiBase}/v1/embeddings`, { method: "POST", headers: jsonHeaders(session), body: JSON.stringify(body) }));
      const d = await r.json();
      const rows: any[] = Array.isArray(d?.data) ? [...d.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)) : [];
      const vectors = rows.map((row) => (typeof row.embedding === "string" ? decodeBase64Embedding(row.embedding) : (row.embedding as number[])));
      if (vectors.length !== lines.length) throw new Error("The API returned an unexpected number of embeddings.");
      if (mine !== latest.current) return;
      setResult({
        model: d?.model || model,
        vectors,
        inputs: lines,
        tokens: Number(d?.usage?.prompt_tokens ?? d?.usage?.total_tokens ?? 0),
        credits: typeof d?.usage?.payg_credits_charged === "number" ? d.usage.payg_credits_charged : undefined,
        base64: format === "base64",
      });
    } catch (e) {
      if (mine === latest.current) setError(errText(e, "Embedding request failed."));
    } finally {
      if (mine === latest.current) setBusy(false);
    }
  };

  const copy = (what: number | "all") => {
    if (!result) return;
    const payload = what === "all" ? result.vectors : result.vectors[what];
    navigator.clipboard?.writeText(JSON.stringify(payload)).then(() => setCopied(what)).catch(() => undefined);
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify({ model: result.model, data: result.inputs.map((input, index) => ({ index, input, embedding: result.vectors[index] })) })], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    downloadHref(href, "embeddings.json");
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const showMatrix = !!result && result.vectors.length > 1 && result.vectors.length <= 8;

  return (
    <div className={shared.studio}>
      <aside className={cx(shared.controls, styles.rail)} aria-label="Embedding settings">
        <Field label="Input" hint={`One text per line · ${lines.length} of ${MAX_INPUTS}`}>
          <textarea
            className={shared.textarea}
            rows={7}
            aria-label="Texts to embed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }}
          />
        </Field>

        <Button icon="sparkle" className={styles.submit} busy={busy} onClick={() => void submit()} disabled={!lines.length}>
          Create embeddings
        </Button>

        <ModelSelect models={catalog} value={model} onChange={setModel} label="Model" hint={catalog.length ? undefined : "No embedding models are available right now."} />

        <ErrorNote onDismiss={() => setError("")}>{error}</ErrorNote>

        <Advanced>
          <div className={styles.advBody}>
            <Field label="Dimensions" hint={`Optional · ${MIN_DIMENSIONS} to ${maxDims ?? 4096}${selected?.supported_dimensions ? ` (this model: ${selected.supported_dimensions.join(", ")})` : ""}. Leave empty for the model default.`}>
              <input
                className={shared.input}
                inputMode="numeric"
                placeholder={maxDims ? String(maxDims) : "Model default"}
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </Field>
            <Field label="Encoding" hint="Base64 halves the response size; the playground decodes it for you.">
              <Segmented value={format} onChange={setFormat} options={[{ value: "float", label: "Float" }, { value: "base64", label: "Base64" }]} />
            </Field>
          </div>
        </Advanced>
      </aside>

      <section className={shared.stage} aria-label="Embedding results">
        {!result ? (
          <EmptyStage icon="list" title="No embeddings yet">
            Enter a few texts, one per line, to see their vectors and how similar they are to each other.
          </EmptyStage>
        ) : (
          <>
            <div className={styles.summary} role="status" aria-live="polite">
              <span><strong>{result.vectors.length}</strong> vector{result.vectors.length === 1 ? "" : "s"}</span>
              <span><strong>{result.vectors[0]?.length ?? 0}</strong> dimensions</span>
              <span><strong>{result.tokens}</strong> tokens</span>
              {result.credits !== undefined && <span>Credits <strong>{result.credits}</strong></span>}
              <span className={styles.spacer} />
              <IconButton icon={copied === "all" ? "check" : "copy"} label={copied === "all" ? "Copied" : "Copy all vectors as JSON"} onClick={() => copy("all")} />
              <IconButton icon="download" label="Download JSON" onClick={download} />
            </div>

            {showMatrix && (
              <div className={shared.stageCard}>
                <span className={shared.label}>Cosine similarity</span>
                <div className={styles.matrixWrap}>
                  <table className={styles.matrix}>
                    <thead>
                      <tr><th />{result.inputs.map((_, j) => <th key={j} scope="col">#{j + 1}</th>)}</tr>
                    </thead>
                    <tbody>
                      {result.vectors.map((a, i) => (
                        <tr key={i}>
                          <th scope="row">#{i + 1}</th>
                          {result.vectors.map((b, j) => {
                            const v = cosine(a, b);
                            return (
                              <td key={j} style={{ ["--sim" as any]: `${Math.max(0, Math.min(1, v)) * 100}%` }} className={styles.cell} title={`${i + 1} vs ${j + 1}: ${v.toFixed(4)}`}>
                                {v.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <ul className={styles.list}>
              {result.vectors.map((v, i) => (
                <li key={i} className={styles.item}>
                  <div className={styles.itemHead}>
                    <span className={styles.itemIndex}>#{i + 1}</span>
                    <span className={styles.itemText} title={result.inputs[i]}>{result.inputs[i]}</span>
                    <IconButton icon={copied === i ? "check" : "copy"} label={copied === i ? "Copied" : "Copy vector as JSON"} onClick={() => copy(i)} />
                  </div>
                  <code className={styles.preview}>
                    [{v.slice(0, PREVIEW_VALUES).map((x) => x.toFixed(4)).join(", ")}, … {Math.max(0, v.length - PREVIEW_VALUES)} more] · norm {norm(v).toFixed(3)}
                  </code>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
