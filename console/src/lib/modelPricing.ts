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

const num = (v: any): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// 0.015 -> "0.015", 15 -> "15", 0.000045 -> "0.000045"
const fmtRate = (v: number): string => {
  const s = v.toFixed(6);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};

export function modelType(m: any): string {
  if (m?.type) return String(m.type);
  const o = Array.isArray(m?.output_modalities) ? m.output_modalities : [];
  if (o.includes("embedding")) return "embedding";
  if (o.includes("image")) return "image";
  if (o.includes("video")) return "video";
  if (o.includes("audio")) return "audio";
  if (o.includes("3d")) return "3d";
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

  if (unit === "input_chars" && chars != null) return `$${fmtRate(chars * pct)}/1k chars`;
  if (unit === "input_bytes" && bytes != null) return `$${fmtRate(bytes * pct)}/M bytes`;
  if (unit === "input_seconds") {
    const rate = inputSec != null ? inputSec : request;
    if (rate != null) return `$${fmtRate(rate * pct)}/input sec`;
  }
  if (unit === "seconds") {
    const rate = outputSec != null ? outputSec : request;
    if (rate != null) return `$${fmtRate(rate * pct)}/sec`;
  }

  if (chars != null) return `$${fmtRate(chars * pct)}/1k chars`;
  if (bytes != null) return `$${fmtRate(bytes * pct)}/M bytes`;
  if (inputSec != null && outputSec == null) return `$${fmtRate(inputSec * pct)}/input sec`;
  if (outputSec != null) return `$${fmtRate(outputSec * pct)}/sec`;
  if (request != null && request !== 0) {
    return `$${fmtRate(request * pct)}${input.includes("audio") ? "/input sec" : "/sec"}`;
  }
  return null;
}

// Embedding models bill per million input tokens; realtime models either per
// million tokens by modality (gpt-realtime-*) or per second of streamed audio
// (live transcription). Rates are USD and `pct` scales them like the others.
export function formatEmbeddingPrice(m: any, pct = 1): string | null {
  const perMillion = num(m?.input_pricing_per_million_tokens);
  if (perMillion != null) return `$${fmtRate(perMillion * pct)}/M tokens`;
  const prompt = num(m?.pricing?.prompt);
  if (prompt != null && prompt !== 0) return `$${fmtRate(prompt * 1_000_000 * pct)}/M tokens`;
  return null;
}

export function formatRealtimePrice(m: any, pct = 1): string | null {
  const rates = m?.realtime_pricing_per_million_tokens;
  if (rates && typeof rates === "object") {
    const textIn = num(rates.text_in);
    const audioIn = num(rates.audio_in);
    const textOut = num(rates.text_out);
    const audioOut = num(rates.audio_out);
    const parts: string[] = [];
    if (audioIn != null) parts.push(`Audio in: $${fmtRate(audioIn * pct)}/M`);
    if (audioOut != null) parts.push(`Audio out: $${fmtRate(audioOut * pct)}/M`);
    if (textIn != null && textOut != null) parts.push(`Text: $${fmtRate(textIn * pct)} in / $${fmtRate(textOut * pct)} out per M`);
    if (parts.length) return parts.join(" \u00b7 ");
  }
  const perSecond = num(m?.input_price_per_second);
  if (perSecond != null) return `$${fmtRate(perSecond * 3600 * pct)}/hour of audio`;
  return null;
}

// pct scales every rate (used for reward discounts); 1 keeps list prices.
export function formatModelPrice(m: any, pct = 1): string | null {
  const type = modelType(m);
  // These read their own top-level rate fields, so they work even when the entry has no `pricing` object.
  if ((type === "embedding" || type === "decision")) return formatEmbeddingPrice(m, pct);
  if (type === "realtime") return formatRealtimePrice(m, pct);
  const pricing = m?.pricing || {};

  if (type === "audio") {
    const audio = formatAudioPrice(m, pct);
    if (audio) return audio;
  }

  if (type === "image") {
    if (pricing.token_pricing) {
      const tp = pricing.token_pricing;
      const parts: string[] = [];
      if (tp.text_in && tp.text_in !== "0") parts.push(`Text: $${(parseFloat(tp.text_in) * pct).toFixed(2)}/M`);
      if (tp.image_in && tp.image_in !== "0") parts.push(`Img In: $${(parseFloat(tp.image_in) * pct).toFixed(2)}/M`);
      if (tp.image_out && tp.image_out !== "0") parts.push(`Img Out: $${(parseFloat(tp.image_out) * pct).toFixed(2)}/M`);
      if (parts.length > 0) return parts.join(" \u00b7 ");
    }
    if (pricing.image && pricing.image !== "0") return `$${(parseFloat(pricing.image) * pct).toFixed(4)}/gen`;
  }

  if (type === "3d" || type === "3D") {
    if (m.price_tiers) {
      const values = Object.values(m.price_tiers).map((v: any) => parseFloat(v) * pct);
      const min = Math.min(...values);
      const max = Math.max(...values);
      if (min !== max) return `$${min.toFixed(2)}-$${max.toFixed(2)}`;
      return `$${min.toFixed(4)}/model`;
    }
    if (pricing.request && pricing.request !== "0") return `$${(parseFloat(pricing.request) * pct).toFixed(4)}/model`;
  }

  if (type === "video" && pricing.request && pricing.request !== "0") {
    return `$${(parseFloat(pricing.request) * pct).toFixed(4)}/sec`;
  }

  if (pricing.prompt != null && pricing.completion != null && (parseFloat(pricing.prompt) !== 0 || parseFloat(pricing.completion) !== 0)) {
    const perMillion = (v: string) => (parseFloat(v) * 1_000_000 * pct).toFixed(2);
    return `In: $${perMillion(pricing.prompt)}/M \u00b7 Out: $${perMillion(pricing.completion)}/M`;
  }

  return null;
}

export function formatPricing(m: any): string | null {
  if (modelType(m) === "audio") return formatAudioPrice(m);
  if (["embedding", "decision"].includes(modelType(m))) return formatEmbeddingPrice(m);
  if (modelType(m) === "realtime") return formatRealtimePrice(m);
  const p = m?.pricing || {};
  if (p.token_pricing) {
    const tp = p.token_pricing;
    const parts: string[] = [];
    if (tp.text_in && tp.text_in !== "0") parts.push(`Text: $${parseFloat(tp.text_in).toFixed(2)}/M`);
    if (tp.image_in && tp.image_in !== "0") parts.push(`Img In: $${parseFloat(tp.image_in).toFixed(2)}/M`);
    if (tp.image_out && tp.image_out !== "0") parts.push(`Img Out: $${parseFloat(tp.image_out).toFixed(2)}/M`);
    if (parts.length > 0) return parts.join(" \u00b7 ");
  }
  if (p.prompt != null && p.completion != null) {
    const perMillion = (v: number) => (v * 1_000_000).toFixed(2);
    return `In: $${perMillion(p.prompt)}/M \u00b7 Out: $${perMillion(p.completion)}/M`;
  }
  return null;
}

// Numeric starting *list* rate in USD for the model's native billing unit.
// Prices from different modalities are not normalized (e.g. /M tokens vs /sec).
// Use the lowest positive rate where multiple rates exist, or zero if every
// explicitly published rate is zero. Unknown prices remain null, never free.
export function modelStartingPrice(m: any): number | null {
  const p = m?.pricing || {};
  const type = modelType(m).toLowerCase();
  const lowest = (...rates: any[]): number | null => {
    const valid = rates.map(num).filter((v): v is number => v !== null && v >= 0);
    if (!valid.length) return null;
    const positive = valid.filter((v) => v > 0);
    return Math.min(...(positive.length ? positive : valid));
  };
  const perMillion = (value: any) => {
    const n = num(value);
    return n === null ? null : n * 1_000_000;
  };

  if (type === "embedding" || type === "decision") {
    return lowest(m?.input_pricing_per_million_tokens) ?? lowest(perMillion(p.prompt));
  }
  if (type === "realtime") {
    const rates = m?.realtime_pricing_per_million_tokens || {};
    const tokenRate = lowest(rates.text_in, rates.audio_in, rates.text_out, rates.audio_out);
    const seconds = num(m?.input_price_per_second);
    return tokenRate ?? (seconds === null ? null : lowest(seconds * 3600));
  }
  if (type === "audio") {
    const unit = billingUnit(m);
    if (unit === "input_chars") return lowest(m?.price_per_1k_chars, p.request);
    if (unit === "input_bytes") return lowest(m?.price_per_million_bytes, p.request);
    if (unit === "input_seconds") return lowest(m?.input_price_per_second, p.request);
    if (unit === "seconds") return lowest(m?.price_per_second, p.request);
    return lowest(m?.price_per_1k_chars, m?.price_per_million_bytes, m?.input_price_per_second, m?.price_per_second, p.request);
  }
  if (type === "3d") {
    const tierRates = m?.price_tiers && typeof m.price_tiers === "object" ? Object.values(m.price_tiers) : [];
    return lowest(...tierRates) ?? lowest(p.request);
  }
  if (type === "image") {
    const rate = lowest(p.image);
    if (rate !== null) return rate;
    const tp = p.token_pricing || {};
    return lowest(tp.text_in, tp.image_in, tp.image_out, p.request);
  }
  if (type === "video") return lowest(p.request, m?.price_per_second);
  return lowest(perMillion(p.prompt), perMillion(p.completion)) ?? lowest(p.request);
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
