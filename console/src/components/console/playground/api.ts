import type { StudioProps } from "./types";

export function bearer(session: any): Record<string, string> {
  return { Authorization: `Bearer ${session?.access_token}` };
}

export function jsonHeaders(session: any): Record<string, string> {
  return { "Content-Type": "application/json", ...bearer(session) };
}

/** Pull a human message out of any error body the API returns. */
export function errorMessage(body: any, fallback: string): string {
  if (!body) return fallback;
  if (typeof body === "string") return body.slice(0, 500) || fallback;
  const e = body.detail ?? body.error ?? body.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") return e.message || JSON.stringify(e).slice(0, 500);
  return fallback;
}

/** fetch + JSON with API error unwrapping. Throws Error(message). */
export async function apiJson(p: Pick<StudioProps, "apiBase">, path: string, init: RequestInit = {}, signal?: AbortSignal) {
  const r = await fetch(`${p.apiBase}${path}`, { ...init, signal });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errorMessage(d, `HTTP ${r.status}`));
  return { data: d, headers: r.headers };
}

/** Throws a clean Error for a non-ok Response, whatever the body type. */
export async function assertOk(r: Response): Promise<Response> {
  if (r.ok) return r;
  const text = await r.text().catch(() => "");
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* raw text */ }
  throw new Error(errorMessage(body, `HTTP ${r.status}`));
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Could not read file"));
    fr.readAsDataURL(file);
  });
}

export function b64ToBlobUrl(b64: string, type = "application/octet-stream"): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type }));
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const type = /data:([^;]+)/.exec(head)?.[1] || "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function downloadHref(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
