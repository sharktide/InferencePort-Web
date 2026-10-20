import { slug } from "../../../lib/modelPricing";

export { slug };

const arr = (v: any): string[] => (Array.isArray(v) ? v : []);

// Embedding and realtime models list "text" as an input/output but are not chat models.
const NON_CHAT_TYPES = ["embedding", "realtime", "decision"];
export const isNonChat = (m: any) => NON_CHAT_TYPES.includes(m?.type);
export const isText = (m: any) => !isNonChat(m) && arr(m?.input_modalities).includes("text") && arr(m?.output_modalities).includes("text");
export const outputs = (m: any, kind: string) => arr(m?.output_modalities).includes(kind) || m?.type === kind;
export const accepts = (m: any, kind: string) => arr(m?.input_modalities).includes(kind);

export function dedupe(list: any[]): any[] {
  const seen = new Set<string>();
  return list.filter((m) => {
    const k = slug(m) || m?.name;
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const textModels = (models: any[]) => dedupe(models.filter(isText));
export const imageModels = (models: any[]) => dedupe(models.filter((m) => outputs(m, "image")));
export const videoModels = (models: any[]) => dedupe(models.filter((m) => outputs(m, "video")));
export const embeddingModels = (models: any[]) => dedupe(models.filter((m) => m?.type === "embedding" || arr(m?.output_modalities).includes("embedding")));
export const realtimeModels = (models: any[]) => dedupe(models.filter((m) => m?.type === "realtime"));
export const threeDModels = (models: any[]) => dedupe(models.filter((m) => outputs(m, "3d") || m?.type === "3D"));

export function displayName(m: any): string {
  const name = m?.name || m?.id || "Unnamed model";
  if ((m?.type === "agent" || m?.managed_by === "inferenceport-agents") && m?.owned_by) return `@${m.owned_by}/${name}`;
  return name;
}
