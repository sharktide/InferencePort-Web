// Shared pricing formatters for model cards.
//
// Audio models are billed on four different units (per 1k input characters,
// per million UTF-8 bytes, per input second, per output second) and the API
// exposes the unit through `billing_unit` plus the matching price key. The
// old formatter read `pricing.request` for every audio model and labelled it
// "/sec", which was wrong for TTS and STT models.

export interface ModelDiscount {
  type: string;
  percent: number;
  fixedPrice: number;
}

// Validate the *whole* rate: parseFloat("0.5invalid") must not become $0.50.
const num = (v: any): number | null => {
  if (typeof v !== "number" && typeof v !== "string") return null;
  if (typeof v === "string" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v.trim())) return null;
  const n = typeof v === "number" ? v : Number(v.trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Prefer an actual paid rate across all published fallback fields, only
// reporting zero when *every* supplied valid rate is zero.
const lowestListedPrice = (...rates: any[]): number | null => {
  const valid = rates.map(num).filter((n): n is number => n !== null);
  if (!valid.length) return null;
  const positive = valid.filter((n) => n > 0);
  return Math.min(...(positive.length ? positive : valid));
};

const perMillionTokens = (v: any): number | null => {
  const n = num(v);
  return n === null ? null : n * 1_000_000;
};

// 0.015 -> "0.015", 15 -> "15", 0.000045 -> "0.000045"
const fmtRate = (v: number): string => {
  const s = v.toFixed(6);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};

export function modelType(m: any): string {
  if (m?.type) return String(m.type);
  const o = Array.isArray(m?.output_modalities) ? m.output_modalities : [];
  // Keep inferred modality precedence identical to the public Marketplace.
  if (o.includes("embedding")) return "embedding";
  if (o.includes("3d")) return "3d";
  if (o.includes("image")) return "image";
  if (o.includes("video")) return "video";
  if (o.includes("audio")) return "audio";
  return "text";
}

export function slug(m: any): string {
  return m?.id || m?.upstream_id || m?.openrouter?.slug || "";
}

export function billingUnit(m: any): string {
  if (typeof m?.billing_unit === "string" && m.billing_unit) return m.billing_unit;
  if (num(m?.price_per_1k_chars) != null) return "input_chars";
  if (num(m?.price_per_million_bytes) != null) return "input_bytes";
  if (num(m?.input_price_per_second) != null) return "input_seconds";
  if (num(m?.price_per_second) != null) return "seconds";
  return "";
}

export function formatAudioPrice(m: any, pct = 1): string | null {
  const pricing = m?.pricing || {};
  const unit = billingUnit(m);
  const chars = num(m?.price_per_1k_chars);
  const bytes = num(m?.price_per_million_bytes);
  const inputSec = num(m?.input_price_per_second);
  const outputSec = num(m?.price_per_second);
  const request = num(pricing.request);
  const input = Array.isArray(m?.input_modalities) ? m.input_modalities : [];

  // A generic request rate has no guaranteed /character or /byte meaning.
  // Only use it as a fallback for second-based units, as in existing audio API.
  if (unit === "input_chars") return chars === null ? null : `$${fmtRate(chars * pct)}/1k chars`;
  if (unit === "input_bytes") return bytes === null ? null : `$${fmtRate(bytes * pct)}/M bytes`;
  if (unit === "input_seconds") {
    const rate = lowestListedPrice(inputSec, request);
    return rate === null ? null : `$${fmtRate(rate * pct)}/input sec`;
  }
  if (unit === "seconds") {
    const rate = lowestListedPrice(outputSec, request);
    return rate === null ? null : `$${fmtRate(rate * pct)}/sec`;
  }

  if (request !== null) return `$${fmtRate(request * pct)}${input.includes("audio") ? "/input sec" : "/sec"}`;
  return null;
}

// Embedding models bill per million input tokens; realtime models either per
// million tokens by modality (gpt-realtime-*) or per second of streamed audio
// (live transcription). Rates are USD and `pct` scales them like the others.
export function formatEmbeddingPrice(m: any, pct = 1): string | null {
  const rate = lowestListedPrice(m?.input_pricing_per_million_tokens, perMillionTokens(m?.pricing?.prompt));
  return rate === null ? null : `$${fmtRate(rate * pct)}/M tokens`;
}

export function formatRealtimePrice(m: any, pct = 1): string | null {
  const rates = m?.realtime_pricing_per_million_tokens;
  const parts: string[] = [];
  if (rates && typeof rates === "object") {
    const audioIn = num(rates.audio_in);
    const audioOut = num(rates.audio_out);
    const textIn = num(rates.text_in);
    const textOut = num(rates.text_out);
    if (audioIn !== null) parts.push(`Audio in: $${fmtRate(audioIn * pct)}/M`);
    if (audioOut !== null) parts.push(`Audio out: $${fmtRate(audioOut * pct)}/M`);
    if (textIn !== null) parts.push(`Text in: $${fmtRate(textIn * pct)}/M`);
    if (textOut !== null) parts.push(`Text out: $${fmtRate(textOut * pct)}/M`);
  }
  const seconds = num(m?.input_price_per_second);
  if (seconds !== null) parts.push(`Audio: $${fmtRate(seconds * 3600 * pct)}/hour`);
  return parts.length ? parts.join(" · ") : null;
}

// Published text and multimodal token rates may accompany any primary
// billing unit. Keep every visible charge rather than hiding positive fees
// behind zero-valued token or generation rates.
const tokenPriceParts = (p: any, pct: number): string[] => {
  const parts: string[] = [];
  const inRate = perMillionTokens(p.prompt);
  const outRate = perMillionTokens(p.completion);
  if (inRate !== null) parts.push(`In: $${fmtRate(inRate * pct)}/M`);
  if (outRate !== null) parts.push(`Out: $${fmtRate(outRate * pct)}/M`);
  const tp = p.token_pricing || {};
  for (const [key, label] of [["text_in", "Text"], ["image_in", "Img In"], ["image_out", "Img Out"]]) {
    const rate = num(tp[key]);
    if (rate !== null) parts.push(`${label}: $${fmtRate(rate * pct)}/M tokens`);
  }
  return parts;
};

const tokenStartingRates = (p: any): Array<number | null> => {
  const tp = p.token_pricing || {};
  return [
    perMillionTokens(p.prompt), perMillionTokens(p.completion),
    num(tp.text_in), num(tp.image_in), num(tp.image_out),
  ];
};

// pct scales every rate (used for reward discounts); 1 keeps list prices.
export function formatModelPrice(m: any, pct = 1): string | null {
  const type = modelType(m).toLowerCase();
  if (type === "embedding" || type === "decision") return formatEmbeddingPrice(m, pct);
  if (type === "realtime") return formatRealtimePrice(m, pct);
  const p = m?.pricing || {};
  const parts: string[] = [];

  if (type === "audio") {
    const audio = formatAudioPrice(m, pct);
    if (audio) parts.push(audio);
  } else if (type === "image") {
    const image = num(p.image);
    const request = num(p.request);
    if (image !== null) parts.push(`$${fmtRate(image * pct)}/gen`);
    if (request !== null) parts.push(`$${fmtRate(request * pct)}/request`);
  } else if (type === "3d") {
    const values = m?.price_tiers && typeof m.price_tiers === "object"
      ? Object.values(m.price_tiers).map(num).filter((v): v is number => v !== null)
      : [];
    if (values.length) {
      const min = Math.min(...values) * pct;
      const max = Math.max(...values) * pct;
      parts.push(min === max ? `$${min.toFixed(4)}/model` : `$${min.toFixed(2)}-$${max.toFixed(2)}/model`);
    }
    const request = num(p.request);
    if (request !== null) parts.push(`${parts.length ? "Request: " : ""}$${(request * pct).toFixed(4)}/model`);
  } else if (type === "video") {
    const rate = lowestListedPrice(p.request, m?.price_per_second);
    if (rate !== null) parts.push(`$${fmtRate(rate * pct)}/sec`);
  }
  parts.push(...tokenPriceParts(p, pct));
  // Text/agent models may also have per-request charges; never hide these
  // behind zero prompt/completion rates.
  if (!["audio", "image", "3d", "video"].includes(type)) {
    const request = num(p.request);
    if (request !== null) parts.push(`$${fmtRate(request * pct)}/request`);
  }
  return parts.length ? parts.join(" · ") : null;
}

// Legacy formatter entry point; share the same validated prices as filtering.
export function formatPricing(m: any): string | null {
  return formatModelPrice(m);
}

// Numeric starting *list* rate in USD for the model's native billing unit.
// Prices from different modalities are not normalized (e.g. /M tokens vs /sec).
// Use the lowest positive rate where multiple rates exist, or zero if every
// explicitly published rate is zero. Unknown prices remain null, never free.
export function modelStartingPrice(m: any): number | null {
  const p = m?.pricing || {};
  const type = modelType(m).toLowerCase();

  if (type === "embedding" || type === "decision") {
    return lowestListedPrice(m?.input_pricing_per_million_tokens, perMillionTokens(p.prompt));
  }
  if (type === "realtime") {
    const rates = m?.realtime_pricing_per_million_tokens || {};
    const sec = num(m?.input_price_per_second);
    return lowestListedPrice(rates.text_in, rates.audio_in, rates.text_out, rates.audio_out, sec === null ? null : sec * 3600);
  }

  const tokens = tokenStartingRates(p);
  if (type === "audio") {
    const unit = billingUnit(m);
    // Never compare a generic request rate with character/byte rates.
    if (unit === "input_chars") return lowestListedPrice(m?.price_per_1k_chars, ...tokens);
    if (unit === "input_bytes") return lowestListedPrice(m?.price_per_million_bytes, ...tokens);
    if (unit === "input_seconds") return lowestListedPrice(m?.input_price_per_second, p.request, ...tokens);
    if (unit === "seconds") return lowestListedPrice(m?.price_per_second, p.request, ...tokens);
    return lowestListedPrice(p.request, ...tokens);
  }
  if (type === "3d") {
    const tiers = m?.price_tiers && typeof m.price_tiers === "object" ? Object.values(m.price_tiers) : [];
    return lowestListedPrice(...tiers, p.request, ...tokens);
  }
  if (type === "image") return lowestListedPrice(p.image, p.request, ...tokens);
  if (type === "video") return lowestListedPrice(p.request, m?.price_per_second, ...tokens);
  return lowestListedPrice(p.request, ...tokens);
}

export function matchesModelPriceRange(price: number | null, range: string): boolean {
  if (range === "all") return true;
  if (price === null) return false;
  if (range === "zero") return price === 0;
  if (range === "lt1") return price > 0 && price < 1;
  if (range === "1to5") return price >= 1 && price < 5;
  if (range === "5to20") return price >= 5 && price < 20;
  if (range === "gte20") return price >= 20;
  return true;
}

export function compareModelPrice(a: any, b: any, order: "asc" | "desc"): number {
  const priceA = modelStartingPrice(a);
  const priceB = modelStartingPrice(b);
  if (priceA === null) return priceB === null ? 0 : 1;
  if (priceB === null) return -1;
  return order === "asc" ? priceA - priceB : priceB - priceA;
}

// null when the discount does not apply, so callers fall back to list price.
export function formatDiscountedPrice(m: any, discount: ModelDiscount): string | null {
  if (discount.type !== "percent" || discount.percent <= 0) return null;
  return formatModelPrice(m, 1 - discount.percent / 100);
}
