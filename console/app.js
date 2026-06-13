import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let cfg = null;
let supabase = null;
let session = null;
const FALLBACK_API_BASE_URL = "https://sharktide-lightning.hf.space";

const el = {
  consoleNavTabs: Array.from(document.querySelectorAll("[data-console-tab]")),
  consolePanels: Array.from(document.querySelectorAll("[data-console-panel]")),
  appName: document.getElementById("app-name"),
  homeLink: document.getElementById("home-link"),
  authState: document.getElementById("auth-state"),
  emailAuthForm: document.getElementById("email-auth-form"),
  emailInput: document.getElementById("email-input"),
  passwordInput: document.getElementById("password-input"),
  signupBtn: document.getElementById("signup-btn"),
  googleBtn: document.getElementById("google-btn"),
  githubBtn: document.getElementById("github-btn"),
  forgotBtn: document.getElementById("forgot-btn"),
  deleteBtn: document.getElementById("delete-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  // auth view toggles
  signedOutView: document.getElementById("signed-out-view"),
  signedInView: document.getElementById("signed-in-view"),
  userAvatar: document.getElementById("user-avatar"),
  userEmailDisplay: document.getElementById("user-email-display"),
  // wallet toggle
  walletContent: document.getElementById("wallet-content"),
  walletLocked: document.getElementById("wallet-locked"),
  // notices
  noticeList: document.getElementById("notice-list"),
  packGrid: document.getElementById("pack-grid"),
  modelsGrid: document.getElementById("models-grid"),
  textModelSelect: document.getElementById("text-model-select"),
  rateList: document.getElementById("rate-list"),
  creditsRemaining: document.getElementById("credits-remaining"),
  creditsTotal: document.getElementById("credits-total"),
  creditsUsed: document.getElementById("credits-used"),
  ledgerTable: document.getElementById("ledger-table"),
  apiKeyCard: document.getElementById("api-keys-card"),
  apiKeyName: document.getElementById("api-key-name"),
  apiKeyExpiry: document.getElementById("api-key-expiry"),
  apiKeyStatus: document.getElementById("api-key-status"),
  apiKeyList: document.getElementById("api-key-list"),
  apiKeyReveal: document.getElementById("api-key-reveal"),
  apiKeySecret: document.getElementById("api-key-secret"),
  createApiKeyBtn: document.getElementById("create-api-key-btn"),
  refreshApiKeysBtn: document.getElementById("refresh-api-keys-btn"),
  copyApiKeyBtn: document.getElementById("copy-api-key-btn"),
  closeApiKeyRevealBtn: document.getElementById("close-api-key-reveal-btn"),
  runText: document.getElementById("run-text"),
  textPrompt: document.getElementById("text-prompt"),
  textOutput: document.getElementById("text-output"),
  runImage: document.getElementById("run-image"),
  imagePrompt: document.getElementById("image-prompt"),
  imageOutput: document.getElementById("image-output"),
  runVideo: document.getElementById("run-video"),
  videoPrompt: document.getElementById("video-prompt"),
  videoDuration: document.getElementById("video-duration"),
  videoOutput: document.getElementById("video-output"),
  runAudio: document.getElementById("run-audio"),
  audioPrompt: document.getElementById("audio-prompt"),
  audioDuration: document.getElementById("audio-duration"),
  audioOutput: document.getElementById("audio-output"),
  modelsPanelLocked: document.getElementById("models-panel-locked"),
  apiKeyPanelLocked: document.getElementById("api-key-panel-locked"),
  usagePanelLocked: document.getElementById("usage-panel-locked"),
  themeToggle: document.getElementById("theme-toggle"),
  themeIconLight: document.querySelector(".theme-icon-light"),
  themeIconDark: document.querySelector(".theme-icon-dark"),
  sidebarUserTag: document.getElementById("sidebar-user-tag"),
  sidebarUserAvatar: document.getElementById("sidebar-user-avatar"),
  sidebarUserEmail: document.getElementById("sidebar-user-email"),
  // gen-api panel
  genPanelLocked: document.getElementById("gen-api-panel-locked"),
  genDocsCard: document.getElementById("gen-api-docs-card"),
  genPlaygroundCard: document.getElementById("gen-api-playground-card"),
  genTextModelSelect: document.getElementById("gen-text-model-select"),
  genTextPrompt: document.getElementById("gen-text-prompt"),
  genTextOutput: document.getElementById("gen-text-output"),
  runGenText: document.getElementById("run-gen-text"),
  genImagePrompt: document.getElementById("gen-image-prompt"),
  genImageOutput: document.getElementById("gen-image-output"),
  runGenImage: document.getElementById("run-gen-image"),
  // payg-api panel
  paygPanelLocked: document.getElementById("payg-api-panel-locked"),
  paygDocsCard: document.getElementById("payg-api-docs-card"),
  paygPlaygroundCard: document.getElementById("payg-api-playground-card"),
  paygTextModelSelect: document.getElementById("payg-text-model-select"),
  paygTextPrompt: document.getElementById("payg-text-prompt"),
  paygTextOutput: document.getElementById("payg-text-output"),
  runPaygText: document.getElementById("run-payg-text"),
  paygImagePrompt: document.getElementById("payg-image-prompt"),
  paygImageOutput: document.getElementById("payg-image-output"),
  runPaygImage: document.getElementById("run-payg-image"),
  paygVideoPrompt: document.getElementById("payg-video-prompt"),
  paygVideoDuration: document.getElementById("payg-video-duration"),
  paygVideoOutput: document.getElementById("payg-video-output"),
  runPaygVideo: document.getElementById("run-payg-video"),
  paygAudioPrompt: document.getElementById("payg-audio-prompt"),
  paygAudioDuration: document.getElementById("payg-audio-duration"),
  paygAudioOutput: document.getElementById("payg-audio-output"),
  runPaygAudio: document.getElementById("run-payg-audio"),
  // shield panel
  shieldPlaygroundLocked: document.getElementById("shield-playground-locked"),
  shieldPlaygroundCard: document.getElementById("shield-playground-card"),
  shieldEmail: document.getElementById("shield-email"),
  shieldPhone: document.getElementById("shield-phone"),
  shieldIp: document.getElementById("shield-ip"),
  shieldUsername: document.getElementById("shield-username"),
  shieldDevice: document.getElementById("shield-device"),
  shieldContent: document.getElementById("shield-content"),
  runShieldAnalyze: document.getElementById("run-shield-analyze"),
  shieldResult: document.getElementById("shield-result"),
  shieldRiskScore: document.getElementById("shield-risk-score"),
  shieldConfidence: document.getElementById("shield-confidence"),
  shieldDecision: document.getElementById("shield-decision"),
  shieldThreats: document.getElementById("shield-threats"),
  shieldReasons: document.getElementById("shield-reasons"),
  shieldInvestigation: document.getElementById("shield-investigation"),
  shieldFullResponse: document.getElementById("shield-full-response"),
  // subscription card
  subscriptionContent: document.getElementById("subscription-content"),
  subscriptionLocked: document.getElementById("subscription-locked"),
  subscriptionCard: document.getElementById("subscription-card"),
  subPlanName: document.getElementById("sub-plan-name"),
  subPlanKey: document.getElementById("sub-plan-key"),
  subSignedUp: document.getElementById("sub-signed-up"),
  subDetail: document.getElementById("sub-detail"),
  // models source toggle
  modelsSourceTabs: Array.from(document.querySelectorAll("[data-models-source]")),
  // playground api source label
  playgroundApiLabel: document.getElementById("playground-api-label"),
  // gen video/audio
  genVideoPrompt: document.getElementById("gen-video-prompt"),
  genVideoDuration: document.getElementById("gen-video-duration"),
  runGenVideo: document.getElementById("run-gen-video"),
  genVideoOutput: document.getElementById("gen-video-output"),
  genAudioPrompt: document.getElementById("gen-audio-prompt"),
  genAudioDuration: document.getElementById("gen-audio-duration"),
  runGenAudio: document.getElementById("run-gen-audio"),
  genAudioOutput: document.getElementById("gen-audio-output"),
  // gen usage
  genUsageCard: document.getElementById("gen-usage-card"),
  genUsageContent: document.getElementById("gen-usage-content"),
  genUsageLocked: document.getElementById("gen-usage-locked"),
  genUsageChat: document.getElementById("gen-usage-chat"),
  genUsageImages: document.getElementById("gen-usage-images"),
  genUsageVideos: document.getElementById("gen-usage-videos"),
  genUsageAudio: document.getElementById("gen-usage-audio")
};

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (el.themeIconLight && el.themeIconDark) {
    el.themeIconLight.style.display = theme === "dark" ? "none" : "";
    el.themeIconDark.style.display = theme === "dark" ? "" : "none";
  }
}

function initTheme() {
  const saved = localStorage.getItem("console-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("console-theme", next);
  applyTheme(next);
}

initTheme();
el.themeToggle?.addEventListener("click", toggleTheme);

// Cards that require sign-in
const PROTECTED_CARDS = [
  "notices-card", "pricing-card",
  "models-card", "playground-card", "ledger-card", "api-keys-card",
  "gen-api-playground-card",
  "payg-api-playground-card",
  "shield-playground-card",
  "subscription-card",
  "gen-usage-card"
];

let currentRawApiKey = "";
let currentApiKeyName = "";
let remoteTextModels = [];
let genApiModels = [];
let currentTextModelId = "";
let currentModelsSource = "p2g";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[match] || match));
}

function formatDateTime(value) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatModelSlug(model) {
  return model?.id || model?.upstream_id || model?.openrouter?.slug || "";
}

function formatModelPricing(model) {
  const pricing = model?.pricing || {};
  const parts = [];
  if (pricing.prompt != null && pricing.completion != null) {
    parts.push(`prompt ${pricing.prompt}`);
    parts.push(`completion ${pricing.completion}`);
  }
  if (pricing.image != null && String(pricing.image) !== "0") {
    parts.push(`image ${pricing.image}`);
  }
  if (pricing.request != null && String(pricing.request) !== "0") {
    parts.push(`request ${pricing.request}`);
  }
  if (pricing.input_cache_read != null && String(pricing.input_cache_read) !== "0") {
    parts.push(`cache ${pricing.input_cache_read}`);
  }
  return parts.length ? parts.join(" · ") : "Pricing unavailable";
}

function formatModalities(model) {
  const modalities = Array.isArray(model?.input_modalities) ? model.input_modalities : [];
  if (!modalities.length) return "Configured model";
  return modalities.map((value) => String(value).toUpperCase()).join(" / ");
}

function isTextModel(model) {
  const input = Array.isArray(model?.input_modalities) ? model.input_modalities : [];
  const output = Array.isArray(model?.output_modalities) ? model.output_modalities : [];
  return input.includes("text") && output.includes("text");
}

function getTextModels() {
  const textModels = remoteTextModels.slice();
  (cfg.models || []).forEach((model) => {
    if (isTextModel(model)) {
      textModels.push(model);
    }
  });
  const seen = new Set();
  return textModels.filter((model) => {
    const key = formatModelSlug(model) || model.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderTextModelSelect() {
  if (!el.textModelSelect) return;

  const textModels = getTextModels();
  if (!textModels.length) {
    el.textModelSelect.innerHTML = `<option value="">No text models available</option>`;
    el.textModelSelect.disabled = true;
    currentTextModelId = "";
    return;
  }

  const preferredIds = [currentTextModelId, textModels[0]?.id, textModels[0]?.upstream_id, formatModelSlug(textModels[0])].filter(Boolean);
  const nextSelected = preferredIds.find((candidate) => textModels.some((model) => [model.id, model.upstream_id, formatModelSlug(model)].filter(Boolean).includes(candidate)));
  currentTextModelId = nextSelected || textModels[0].id || textModels[0].upstream_id || formatModelSlug(textModels[0]);

  el.textModelSelect.innerHTML = textModels.map((model) => {
    const slug = formatModelSlug(model);
    const value = model.id || model.upstream_id || slug;
    const selected = value === currentTextModelId || slug === currentTextModelId;
    return `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""}>${escapeHtml(model.name)}</option>`;
  }).join("");

  el.textModelSelect.disabled = false;
}

function renderModels() {
  if (!el.modelsGrid) return;

  const cards = [];
  const displayModels = currentModelsSource === "p2g" ? getTextModels() : genApiModels;

  displayModels.forEach((model) => {
    if (!model.name && !model.id) return;
    cards.push({
      label: "Text",
      name: model.name || model.id || "Unnamed model",
      slug: formatModelSlug(model),
      pricing: model.pricing ? formatModelPricing(model) : "—",
      source: "text"
    });
  });

  (cfg.models || []).forEach((model) => {
    if (isTextModel(model)) return;
    cards.push({
      label: String(model.type || formatModalities(model)).toUpperCase(),
      name: model.name || model.id || "Unnamed model",
      slug: formatModelSlug(model) || "—",
      pricing: model.pricing ? formatModelPricing(model) : "Existing configuration",
      source: "config"
    });
  });

  el.modelsGrid.innerHTML = "";
  cards.forEach((model) => {
    const card = document.createElement("article");
    if (model.label === "VIDEO" || model.label === "AUDIO") {
      model.pricing = "$0.01 per second";
    } else if (model.label === "IMAGE") {
      model.pricing = "$0.02 per image";
    } else if (model.label === "Text") {
      const raw = model.pricing
      if (raw && raw !== "—" && raw !== "Pricing unavailable") {
        const pricing = Object.fromEntries(
          [...raw.matchAll(/(\w+)\s([\d.]+)/g)]
            .map(([_, k, v]) => [k, +(v * 1_000_000).toFixed(2)])
        );
        if (pricing.prompt != null && pricing.completion != null) {
          model.pricing = `In: $${pricing.prompt}/M · Out: $${pricing.completion}/M`;
        }
      }
    }
    card.className = "model-card";
    card.innerHTML = `
      <div class="model-card-top">
        <strong>${escapeHtml(model.name)}</strong>
        <span class="model-pill ${model.source === "text" ? "is-text" : "is-config"}">${escapeHtml(model.label)}</span>
      </div>
      <div class="model-meta">
        <span class="model-key">Slug</span>
        <span class="model-value">${escapeHtml(model.slug)}</span>
      </div>
      <div class="model-meta">
        <span class="model-key">Pricing</span>
        <span class="model-value">${escapeHtml(model.pricing)}</span>
      </div>
    `;
    el.modelsGrid.appendChild(card);
  });

  renderTextModelSelect();
  renderGenTextModelSelect();
  renderPaygTextModelSelect();
}

function getApiKeyStatus(apiKey) {
  if (apiKey.isRevoked) {
    return { label: "Revoked", className: "is-revoked" };
  }
  if (apiKey.isExpired) {
    return { label: "Expired", className: "is-expired" };
  }
  return { label: "Active", className: "is-active" };
}

function setApiKeyStatus(message) {
  if (el.apiKeyStatus) {
    el.apiKeyStatus.textContent = message;
  }
}

function hideApiKeyReveal() {
  currentRawApiKey = "";
  currentApiKeyName = "";
  if (el.apiKeyReveal) {
    el.apiKeyReveal.style.display = "none";
  }
  if (el.apiKeySecret) {
    el.apiKeySecret.textContent = "";
  }
}

function showApiKeyReveal(rawKey, name) {
  currentRawApiKey = rawKey;
  currentApiKeyName = name;
  if (el.apiKeySecret) {
    el.apiKeySecret.textContent = rawKey;
  }
  if (el.apiKeyReveal) {
    el.apiKeyReveal.style.display = "";
  }
}

function renderApiKeys(items) {
  if (!el.apiKeyList) return;

  if (!Array.isArray(items) || items.length === 0) {
    el.apiKeyList.innerHTML = `
      <div class="locked-overlay" style="margin-top:1rem;">
        No API keys yet. Generate one to authenticate Lightning requests without a Supabase session JWT.
      </div>
    `;
    return;
  }

  el.apiKeyList.innerHTML = items.map((apiKey) => {
    const status = getApiKeyStatus(apiKey);
    return `
      <article class="api-key-row">
        <div class="api-key-row-head">
          <div class="api-key-row-title">
            <div class="api-key-name">${escapeHtml(apiKey.name)}</div>
            <div class="api-key-prefix">${escapeHtml(apiKey.keyPrefix)}...</div>
          </div>
          <div class="api-key-badge ${status.className}">${escapeHtml(status.label)}</div>
        </div>
        <div class="api-key-meta">
          <span>Created: ${escapeHtml(formatDateTime(apiKey.createdAt))}</span>
          <span>Last used: ${escapeHtml(formatDateTime(apiKey.lastUsedAt))}</span>
          <span>Expires: ${escapeHtml(apiKey.expiresAt ? formatDateTime(apiKey.expiresAt) : "Never")}</span>
        </div>
        <div class="api-key-actions">
          <button
            type="button"
            class="ghost"
            data-api-key-action="revoke"
            data-api-key-id="${escapeHtml(apiKey.id)}"
            ${apiKey.isRevoked ? "disabled" : ""}
          >
            ${apiKey.isRevoked ? "Revoked" : "Revoke Key"}
          </button>
        </div>
      </article>
    `;
  }).join("");

  el.apiKeyList.querySelectorAll('[data-api-key-action="revoke"]').forEach((button) => {
    button.addEventListener("click", () => {
      const keyId = button.dataset.apiKeyId;
      if (!keyId) return;
      void revokeApiKey(keyId);
    });
  });
}

async function refreshApiKeys() {
  if (!session?.access_token) {
    if (el.apiKeyList) {
      el.apiKeyList.innerHTML = `
        <div class="locked-overlay" style="margin-top:1rem;">
          Sign in to create and manage Lightning API keys.
        </div>
      `;
    }
    setApiKeyStatus("Sign in to create and manage Lightning API keys.");
    return;
  }

  try {
    const response = await fetchJson("/v1/lightning-api-keys", { headers: authHeaders() });
    renderApiKeys(response.items || []);
    setApiKeyStatus("Use a generated key as Authorization: Bearer <your-api-key> when calling Lightning.");
  } catch (error) {
    if (el.apiKeyList) {
      el.apiKeyList.innerHTML = `
        <div class="locked-overlay" style="margin-top:1rem;">
          Could not load API keys.
        </div>
      `;
    }
    setApiKeyStatus(`Could not load API keys: ${error.message || String(error)}`);
  }
}

async function createApiKey() {
  if (!session?.access_token) {
    showToast("Sign in first, then create an API key.");
    return;
  }

  const name = el.apiKeyName?.value.trim() || "";
  const expiresAt = el.apiKeyExpiry?.value.trim() || null;
  if (!name) {
    setApiKeyStatus("Please enter a name for this key.");
    return;
  }

  setBusy(el.createApiKeyBtn, true, "Creating…");
  setApiKeyStatus("Creating API key...");

  try {
    const result = await fetchJson("/v1/lightning-api-keys", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name, expiresAt })
    });

    if (!result?.apiKey || !result?.rawKey) {
      throw new Error("Could not create API key");
    }

    if (el.apiKeyName) el.apiKeyName.value = "";
    if (el.apiKeyExpiry) el.apiKeyExpiry.value = "";
    showApiKeyReveal(result.rawKey, result.apiKey.name);
    setApiKeyStatus("New key created. Copy it now before closing the reveal panel.");
    await refreshApiKeys();
  } catch (error) {
    setApiKeyStatus(`Error: ${error.message || String(error)}`);
  } finally {
    setBusy(el.createApiKeyBtn, false);
  }
}

async function revokeApiKey(keyId) {
  const target = prompt("Type REVOKE to confirm this API key should be revoked.");
  if (target !== "REVOKE") return;

  try {
    const result = await fetchJson(`/v1/lightning-api-keys/${encodeURIComponent(keyId)}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (!result?.success) {
      throw new Error("Could not revoke API key");
    }
    setApiKeyStatus(`Revoked API key "${result.apiKey?.name || keyId}".`);
    await refreshApiKeys();
  } catch (error) {
    setApiKeyStatus(`Could not revoke API key: ${error.message || String(error)}`);
  }
}

function showToast(message) {
  console.log(message);
  alert(message);
}

function apiBase() {
  const configured = String(cfg?.dashboard?.apiBaseUrl || "").trim();
  if (configured.startsWith("https://")) {
    return configured.replace(/\/$/, "");
  }
  return FALLBACK_API_BASE_URL;
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${apiBase()}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || `HTTP ${response.status}`);
  }
  return data;
}

function authHeaders() {
  if (!session?.access_token) throw new Error("Sign in required");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`
  };
}

async function loadRemoteTextModels() {
  const response = await fetch("https://sharktide-lightning.hf.space/v1/models");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || `HTTP ${response.status}`);
  }

  const items = Array.isArray(data.data) ? data.data : [];
  remoteTextModels = items.filter((model) => isTextModel(model) && (model.is_ready !== false));
  renderModels();
}

function setupModelsSourceToggle() {
  el.modelsSourceTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const source = tab.dataset.modelsSource;
      if (source === currentModelsSource) return;
      el.modelsSourceTabs.forEach((t) => t.classList.toggle("active", t === tab));
      currentModelsSource = source;
      if (el.playgroundApiLabel) {
        el.playgroundApiLabel.textContent = source === "p2g" ? "P2G API" : "Gen API";
      }
      void loadModelsForCurrentSource();
    });
  });
}

async function loadModelsForCurrentSource() {
  if (currentModelsSource === "p2g") {
    await loadRemoteTextModels();
  } else {
    await loadRemoteGenModels();
  }
}

async function loadRemoteGenModels() {
  const response = await fetch("https://sharktide-lightning.hf.space/gen/models");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || `HTTP ${response.status}`);
  }
  genApiModels = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
  renderModels();
}

function renderConfig() {
  document.title = `${cfg.dashboard.appName} Developer Console`;
  el.appName.textContent = `${cfg.dashboard.appName} Developer Console`;
  el.homeLink.href = cfg.dashboard.homeUrl;

  el.noticeList.innerHTML = "";
  (cfg.notices || []).forEach((notice) => {
    const node = document.createElement("article");
    node.className = `notice ${notice.level || "info"}`;
    node.innerHTML = `<strong>${(notice.level || "info").toUpperCase()}</strong><p>${notice.message}</p>`;
    el.noticeList.appendChild(node);
  });

  el.packGrid.innerHTML = "";
  (cfg.billing?.packs || []).forEach((pack) => {
    const card = document.createElement("article");
    card.className = "pack";
    const link = pack.stripePaymentLink || "";
    const disabled = !link;
    card.innerHTML = `
      <strong>${pack.label}</strong>
      <div class="credit-amount">${Number(pack.credits).toFixed(4)} credits</div>
      <div class="muted">$${Number(pack.amountUsd).toFixed(2)} USD</div>
      <button ${disabled ? "disabled" : ""}>${disabled ? "Link pending" : "Add credits"}</button>
    `;
    card.querySelector("button")?.addEventListener("click", () => {
      if (!session?.user?.email) {
        showToast("Sign in first, then purchase credits.");
        return;
      }
      const url = new URL(link);
      if (!url.searchParams.has("prefilled_email")) {
        url.searchParams.set("prefilled_email", session.user.email);
      }
      window.location.href = url.toString();
    });
    el.packGrid.appendChild(card);
  });

  const p = cfg.pricing || {};
  el.rateList.innerHTML = `
    <li>${p.textCreditPerMillionTokens} credits per 1,000,000 text tokens (including multimodal text payloads)</li>
    <li>${p.imageCreditPerImage} credits per image</li>
    <li>${p.videoCreditPerSecond} credits per second of video</li>
    <li>${p.audioCreditPerSecond} credits per second of audio (music/sfx)</li>
  `;

  renderModels();
}

async function refreshAccount() {
  if (!session) return;
  const data = await fetchJson("/v1/me", { headers: authHeaders() });
  const wallet = data.wallet || {};
  const usage = data.usage_summary || {};

  el.creditsRemaining.textContent = Number(wallet.balance_credits || 0).toFixed(4);
  el.creditsTotal.textContent = Number(wallet.lifetime_credits_purchased || 0).toFixed(4);
  el.creditsUsed.textContent = Number(usage.totalCreditsUsed || 0).toFixed(4);

  const ledger = await fetchJson("/v1/credits/ledger?limit=30", { headers: authHeaders() });
  renderLedger(ledger.entries || []);

  await refreshSubscription().catch((e) => console.warn(e));
  await refreshGenUsage().catch((e) => console.warn(e));
}

async function refreshSubscription() {
  if (!session) return;
  try {
    const data = await fetchJson("/subscription", { headers: authHeaders() });
    el.subPlanName.textContent = data.plan_name || "Free";
    el.subPlanKey.textContent = data.plan_key || "—";
    el.subSignedUp.textContent = data.signed_up ? formatDateTime(data.signed_up) : "—";

    if (Array.isArray(data.subscription) && data.subscription.length) {
      el.subDetail.innerHTML = data.subscription.map((sub) =>
        `<div class="ledger-row" style="grid-template-columns:1fr 1fr 1fr;">
          <div><strong>Status</strong><div class="muted tiny">${escapeHtml(sub.status || "—")}</div></div>
          <div><strong>Period</strong><div class="muted tiny">${escapeHtml(formatDateTime(sub.current_period_start))} — ${escapeHtml(formatDateTime(sub.current_period_end))}</div></div>
          <div><strong>Plan</strong><div class="muted tiny">${escapeHtml(sub.plan_id || "—")}</div></div>
        </div>`
      ).join("");
    } else {
      el.subDetail.innerHTML = '<p class="muted tiny">No active subscription. You are on the Free plan.</p>';
    }

    el.subscriptionContent.style.display = "";
    el.subscriptionLocked.style.display = "none";
  } catch (error) {
    el.subscriptionContent.style.display = "none";
    el.subscriptionLocked.style.display = "flex";
    el.subscriptionLocked.textContent = `Could not load subscription: ${error.message}`;
  }
}

async function refreshGenUsage() {
  if (!session) return;
  try {
    const data = await fetchJson("/usage", { headers: authHeaders() });
    const usage = data.usage || {};

    function fmtUsage(u) {
      if (!u) return "—";
      return `${u.used} / ${u.limit} (${u.remaining} remaining)`;
    }

    el.genUsageChat.textContent = fmtUsage(usage.cloudChatDaily);
    el.genUsageImages.textContent = fmtUsage(usage.imagesDaily);
    el.genUsageVideos.textContent = fmtUsage(usage.videosDaily);
    el.genUsageAudio.textContent = fmtUsage(usage.audioWeekly);

    el.genUsageContent.style.display = "grid";
    el.genUsageLocked.style.display = "none";
  } catch (error) {
    el.genUsageContent.style.display = "none";
    el.genUsageLocked.style.display = "flex";
    el.genUsageLocked.textContent = `Could not load usage: ${error.message}`;
  }
}

function renderLedger(entries) {
  el.ledgerTable.innerHTML = "";
  if (!entries.length) {
    el.ledgerTable.innerHTML = `<div class="locked-overlay" style="min-height:60px;">No ledger entries yet.</div>`;
    return;
  }

  // Header row
  const header = document.createElement("div");
  header.className = "ledger-header";
  header.innerHTML = `
    <span>Type</span>
    <span>Credits</span>
    <span>Units</span>
    <span>Date</span>
  `;
  el.ledgerTable.appendChild(header);

  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "ledger-row";
    row.innerHTML = `
      <div><strong>${entry.entry_type}</strong><div class="muted tiny">${entry.usage_kind || "—"}</div></div>
      <div style="font-family:var(--mono);font-size:0.8rem;">${Number(entry.delta_credits || 0).toFixed(4)}</div>
      <div style="font-family:var(--mono);font-size:0.8rem;">${entry.units != null ? entry.units : "—"} ${entry.unit_label || ""}</div>
      <div class="muted tiny">${entry.created_at || ""}</div>
    `;
    el.ledgerTable.appendChild(row);
  });
}

function setProtectedCardsVisible(visible) {
  PROTECTED_CARDS.forEach((id) => {
    const card = document.getElementById(id);
    if (card) card.style.display = visible ? "" : "none";
  });
}

function setPanelLockedState(locked) {
  if (el.modelsPanelLocked) el.modelsPanelLocked.style.display = locked ? "" : "none";
  if (el.apiKeyPanelLocked) el.apiKeyPanelLocked.style.display = locked ? "" : "none";
  if (el.usagePanelLocked) el.usagePanelLocked.style.display = locked ? "" : "none";
  if (el.genPanelLocked) el.genPanelLocked.style.display = locked ? "" : "none";
  if (el.paygPanelLocked) el.paygPanelLocked.style.display = locked ? "" : "none";
  if (el.shieldPlaygroundLocked) el.shieldPlaygroundLocked.style.display = locked ? "" : "none";
}

function setConsolePanel(nextPanel) {
  const fallbackPanel = session?.user ? "models" : "account";
  const targetPanel = nextPanel || fallbackPanel;

  el.consoleNavTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.consoleTab === targetPanel);
  });

  el.consolePanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.consolePanel === targetPanel);
  });
}

function renderAuthState() {
  if (session?.user) {
    el.signedOutView.style.display = "none";
    el.signedInView.style.display = "flex";
    el.logoutBtn.style.display = "";

    const email = session.user.email || "";
    el.userEmailDisplay.textContent = email;
    el.userAvatar.textContent = email ? email[0].toUpperCase() : "?";

    if (el.sidebarUserTag) {
      el.sidebarUserTag.style.display = "flex";
      el.sidebarUserEmail.textContent = email;
      el.sidebarUserAvatar.textContent = email ? email[0].toUpperCase() : "?";
    }

    setProtectedCardsVisible(true);
    setPanelLockedState(false);

    el.walletContent.style.display = "";
    el.walletLocked.style.display = "none";
    el.subscriptionContent.style.display = "";
    el.subscriptionLocked.style.display = "none";
    el.genUsageContent.style.display = "grid";
    el.genUsageLocked.style.display = "none";
    if (el.apiKeyCard) el.apiKeyCard.style.display = "";
  } else {
    el.signedOutView.style.display = "";
    el.signedInView.style.display = "none";
    el.logoutBtn.style.display = "none";

    if (el.sidebarUserTag) el.sidebarUserTag.style.display = "none";

    setProtectedCardsVisible(false);
    setPanelLockedState(true);
    setConsolePanel("account");

    el.walletContent.style.display = "none";
    el.walletLocked.style.display = "";
    el.subscriptionContent.style.display = "none";
    el.subscriptionLocked.style.display = "";
    el.genUsageContent.style.display = "none";
    el.genUsageLocked.style.display = "";
    if (el.apiKeyCard) el.apiKeyCard.style.display = "none";
    hideApiKeyReveal();

    el.creditsRemaining.textContent = "—";
    el.creditsTotal.textContent = "—";
    el.creditsUsed.textContent = "—";
    el.subPlanName.textContent = "—";
    el.subPlanKey.textContent = "—";
    el.subSignedUp.textContent = "—";
    el.subDetail.innerHTML = "";
    el.genUsageChat.textContent = "—";
    el.genUsageImages.textContent = "—";
    el.genUsageVideos.textContent = "—";
    el.genUsageAudio.textContent = "—";
    el.ledgerTable.textContent = "";
    if (el.apiKeyList) {
      el.apiKeyList.textContent = "";
    }
  }
}

async function initSupabase() {
  const url = cfg.supabase?.url;
  const key = cfg.supabase?.publishableKey;
  if (!url || !key) {
    showToast("Supabase config is missing from /v1/config.");
    return;
  }

  supabase = createClient(url, key, { auth: { persistSession: true } });
  const { data } = await supabase.auth.getSession();
  session = data.session;
  renderAuthState();

  if (session) {
    await refreshAccount().catch((e) => showToast(e.message));
    await refreshApiKeys().catch((e) => showToast(e.message));
  }

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    session = nextSession;
    renderAuthState();
    if (session) {
      await refreshAccount().catch((e) => showToast(e.message));
      await refreshApiKeys().catch((e) => showToast(e.message));
    }
  });
}

function setupConsoleNav() {
  el.consoleNavTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setConsolePanel(tab.dataset.consoleTab);
    });
  });
}

function setupTabs() {
  document.querySelectorAll(".playground-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const next = tab.dataset.tab;
      document.querySelectorAll(".playground-tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".playground-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === next);
      });
    });
  });
}

function setupAuthActions() {
  el.emailAuthForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: el.emailInput.value,
        password: el.passwordInput.value
      });
      if (error) throw error;
    } catch (error) {
      showToast(error.message || "Sign in failed");
    }
  });

  el.signupBtn.addEventListener("click", async () => {
    try {
      const { error } = await supabase.auth.signUp({
        email: el.emailInput.value,
        password: el.passwordInput.value
      });
      if (error) throw error;
      showToast("Sign-up complete. Check your email for confirmation if required.");
    } catch (error) {
      showToast(error.message || "Sign up failed");
    }
  });

  el.googleBtn.addEventListener("click", async () => {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
  });

  el.githubBtn.addEventListener("click", async () => {
    await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: window.location.href } });
  });

  el.forgotBtn.addEventListener("click", async () => {
    const email = el.emailInput.value?.trim();
    if (!email) {
      showToast("Enter your email first.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: cfg.supabase.resetRedirectUrl
      });
      if (error) throw error;
      showToast("Password reset email sent.");
    } catch (error) {
      showToast(error.message || "Failed to send password reset");
    }
  });

  el.deleteBtn.addEventListener("click", async () => {
    if (!session?.user) return;
    if (!confirm("Delete your account permanently? This immediately removes all credits.")) return;

    try {
      const provider = session.user.app_metadata?.provider;
      if (provider === "email") {
        const password = prompt("Confirm your password to delete account:");
        if (!password) return;

        const verifyResponse = await fetch(cfg.supabase.deletePasswordVerifyEndpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: session.user.email, password })
        });
        if (!verifyResponse.ok) {
          throw new Error("Password verification failed");
        }
      }

      const deleteResponse = await fetch(cfg.supabase.deleteAccountEndpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!deleteResponse.ok) {
        const payload = await deleteResponse.json().catch(() => ({}));
        throw new Error(payload.error || "Delete account failed");
      }

      await supabase.auth.signOut();
      showToast("Account deleted.");
    } catch (error) {
      showToast(error.message || "Delete account failed");
    }
  });

  el.logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });
}

function setupApiKeyActions() {
  el.createApiKeyBtn?.addEventListener("click", () => {
    void createApiKey();
  });

  el.refreshApiKeysBtn?.addEventListener("click", () => {
    void refreshApiKeys();
  });

  el.copyApiKeyBtn?.addEventListener("click", async () => {
    if (!currentRawApiKey) return;
    try {
      await navigator.clipboard.writeText(currentRawApiKey);
      setApiKeyStatus(`Copied API key for "${currentApiKeyName || "new key"}".`);
    } catch (error) {
      setApiKeyStatus(`Copy failed: ${error.message || String(error)}`);
    }
  });

  el.closeApiKeyRevealBtn?.addEventListener("click", () => {
    hideApiKeyReveal();
  });
}

function setBusy(button, isBusy, text = "Working…") {
  if (!button) return;
  if (isBusy) {
    button.dataset.originalText = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function setupPlayground() {
  el.textModelSelect?.addEventListener("change", () => {
    currentTextModelId = el.textModelSelect.value;
  });

  el.runText.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runText, true);
    el.textOutput.textContent = "Generating…";
    try {
      const selectedModel = el.textModelSelect?.value || currentTextModelId || undefined;
      const path = currentModelsSource === "p2g" ? "/v1/chat/completions" : "/gen/chat/completions";
      const result = await fetchJson(path, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          stream: false,
          model: selectedModel,
          messages: [{ role: "user", content: el.textPrompt.value || "Hello" }]
        })
      });
      el.textOutput.textContent = JSON.stringify(result, null, 2);
      await refreshAccount();
    } catch (error) {
      el.textOutput.textContent = error.message;
    } finally {
      setBusy(el.runText, false);
    }
  });

  el.runImage.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runImage, true);
    el.imageOutput.textContent = "Generating…";
    try {
      const path = currentModelsSource === "p2g" ? "/v1/images/generations" : "/gen/images/generations";
      const result = await fetchJson(path, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ prompt: el.imagePrompt.value || "A colorful neon city." })
      });
      const b64 = result?.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned");
      el.imageOutput.innerHTML = `<img src="data:image/jpeg;base64,${b64}" alt="Generated image" />`;
      await refreshAccount();
    } catch (error) {
      el.imageOutput.textContent = error.message;
    } finally {
      setBusy(el.runImage, false);
    }
  });

  function playgroundVideoFetch() {
    return currentModelsSource === "p2g"
      ? `${apiBase()}/v1/videos/generations`
      : `${apiBase()}/gen/videos/generations`;
  }

  el.runVideo.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runVideo, true);
    el.videoOutput.textContent = "Generating…";
    try {
      const response = await fetch(playgroundVideoFetch(), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: el.videoPrompt.value || "A drifting cloudscape at sunset.",
          duration: Number(el.videoDuration.value || 5)
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || "Video generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      el.videoOutput.innerHTML = `<video controls src="${url}"></video>`;
      await refreshAccount();
    } catch (error) {
      el.videoOutput.textContent = error.message;
    } finally {
      setBusy(el.runVideo, false);
    }
  });

  function playgroundAudioFetch() {
    return currentModelsSource === "p2g"
      ? `${apiBase()}/v1/audio/generations`
      : `${apiBase()}/gen/audio/generations`;
  }

  el.runAudio.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runAudio, true);
    el.audioOutput.textContent = "Generating…";
    try {
      const response = await fetch(playgroundAudioFetch(), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: el.audioPrompt.value || "Energetic electronic beat",
          duration_seconds: Number(el.audioDuration.value || 10)
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || "Audio generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      el.audioOutput.innerHTML = `<audio controls src="${url}"></audio>`;
      await refreshAccount();
    } catch (error) {
      el.audioOutput.textContent = error.message;
    } finally {
      setBusy(el.runAudio, false);
    }
  });
}

function renderGenTextModelSelect() {
  if (!el.genTextModelSelect) return;
  const textModels = getTextModels();
  if (!textModels.length) {
    el.genTextModelSelect.innerHTML = `<option value="">No text models available</option>`;
    el.genTextModelSelect.disabled = true;
    return;
  }
  const selected = textModels[0].id || textModels[0].upstream_id || formatModelSlug(textModels[0]);
  el.genTextModelSelect.innerHTML = textModels.map((model) => {
    const slug = formatModelSlug(model);
    const value = model.id || model.upstream_id || slug;
    return `<option value="${escapeHtml(value)}">${escapeHtml(model.name)}</option>`;
  }).join("");
  el.genTextModelSelect.disabled = false;
}

function renderPaygTextModelSelect() {
  if (!el.paygTextModelSelect) return;
  const textModels = getTextModels();
  if (!textModels.length) {
    el.paygTextModelSelect.innerHTML = `<option value="">No text models available</option>`;
    el.paygTextModelSelect.disabled = true;
    return;
  }
  const selected = textModels[0].id || textModels[0].upstream_id || formatModelSlug(textModels[0]);
  el.paygTextModelSelect.innerHTML = textModels.map((model) => {
    const slug = formatModelSlug(model);
    const value = model.id || model.upstream_id || slug;
    return `<option value="${escapeHtml(value)}">${escapeHtml(model.name)}</option>`;
  }).join("");
  el.paygTextModelSelect.disabled = false;
}

function setupGenApiPlayground() {
  el.runGenText?.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runGenText, true);
    el.genTextOutput.textContent = "Generating…";
    try {
      const selectedModel = el.genTextModelSelect?.value || undefined;
      const result = await fetchJson("/gen/chat/completions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          stream: false,
          model: selectedModel,
          messages: [{ role: "user", content: el.genTextPrompt.value || "Hello" }]
        })
      });
      el.genTextOutput.textContent = JSON.stringify(result, null, 2);
      await refreshAccount();
    } catch (error) {
      el.genTextOutput.textContent = error.message;
    } finally {
      setBusy(el.runGenText, false);
    }
  });

  el.runGenImage?.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runGenImage, true);
    el.genImageOutput.textContent = "Generating…";
    try {
      const result = await fetchJson("/gen/images/generations", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ prompt: el.genImagePrompt.value || "A colorful neon city." })
      });
      const b64 = result?.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned");
      el.genImageOutput.innerHTML = `<img src="data:image/jpeg;base64,${b64}" alt="Generated image" />`;
      await refreshAccount();
    } catch (error) {
      el.genImageOutput.textContent = error.message;
    } finally {
      setBusy(el.runGenImage, false);
    }
  });

  el.runGenVideo?.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runGenVideo, true);
    el.genVideoOutput.textContent = "Generating…";
    try {
      const response = await fetch(`${apiBase()}/gen/videos/generations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: el.genVideoPrompt.value || "A drifting cloudscape at sunset.",
          duration: Number(el.genVideoDuration.value || 5)
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || "Video generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      el.genVideoOutput.innerHTML = `<video controls src="${url}"></video>`;
      await refreshAccount();
    } catch (error) {
      el.genVideoOutput.textContent = error.message;
    } finally {
      setBusy(el.runGenVideo, false);
    }
  });

  el.runGenAudio?.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runGenAudio, true);
    el.genAudioOutput.textContent = "Generating…";
    try {
      const response = await fetch(`${apiBase()}/gen/audio/generations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: el.genAudioPrompt.value || "Energetic electronic beat",
          duration_seconds: Number(el.genAudioDuration.value || 10)
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || "Audio generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      el.genAudioOutput.innerHTML = `<audio controls src="${url}"></audio>`;
      await refreshAccount();
    } catch (error) {
      el.genAudioOutput.textContent = error.message;
    } finally {
      setBusy(el.runGenAudio, false);
    }
  });
}

function setupPaygPlayground() {
  el.runPaygText?.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runPaygText, true);
    el.paygTextOutput.textContent = "Generating…";
    try {
      const selectedModel = el.paygTextModelSelect?.value || undefined;
      const result = await fetchJson("/v1/chat/completions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          stream: false,
          model: selectedModel,
          messages: [{ role: "user", content: el.paygTextPrompt.value || "Hello" }]
        })
      });
      el.paygTextOutput.textContent = JSON.stringify(result, null, 2);
      await refreshAccount();
    } catch (error) {
      el.paygTextOutput.textContent = error.message;
    } finally {
      setBusy(el.runPaygText, false);
    }
  });

  el.runPaygImage?.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runPaygImage, true);
    el.paygImageOutput.textContent = "Generating…";
    try {
      const result = await fetchJson("/v1/images/generations", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ prompt: el.paygImagePrompt.value || "A colorful neon city." })
      });
      const b64 = result?.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned");
      el.paygImageOutput.innerHTML = `<img src="data:image/jpeg;base64,${b64}" alt="Generated image" />`;
      await refreshAccount();
    } catch (error) {
      el.paygImageOutput.textContent = error.message;
    } finally {
      setBusy(el.runPaygImage, false);
    }
  });

  el.runPaygVideo?.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runPaygVideo, true);
    el.paygVideoOutput.textContent = "Generating…";
    try {
      const response = await fetch(`${apiBase()}/v1/videos/generations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: el.paygVideoPrompt.value || "A drifting cloudscape at sunset.",
          duration: Number(el.paygVideoDuration.value || 5)
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || "Video generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      el.paygVideoOutput.innerHTML = `<video controls src="${url}"></video>`;
      await refreshAccount();
    } catch (error) {
      el.paygVideoOutput.textContent = error.message;
    } finally {
      setBusy(el.runPaygVideo, false);
    }
  });

  el.runPaygAudio?.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runPaygAudio, true);
    el.paygAudioOutput.textContent = "Generating…";
    try {
      const response = await fetch(`${apiBase()}/v1/audio/generations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: el.paygAudioPrompt.value || "Energetic electronic beat",
          duration_seconds: Number(el.paygAudioDuration.value || 10)
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || "Audio generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      el.paygAudioOutput.innerHTML = `<audio controls src="${url}"></audio>`;
      await refreshAccount();
    } catch (error) {
      el.paygAudioOutput.textContent = error.message;
    } finally {
      setBusy(el.runPaygAudio, false);
    }
  });
}

function setupShieldPlayground() {
  el.runShieldAnalyze?.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runShieldAnalyze, true);
    if (el.shieldResult) el.shieldResult.style.display = "none";
    try {
      const body = {};
      const emailVal = el.shieldEmail?.value?.trim();
      if (emailVal) body.email = emailVal;
      const phoneVal = el.shieldPhone?.value?.trim();
      if (phoneVal) body.phone = phoneVal;
      const ipVal = el.shieldIp?.value?.trim();
      if (ipVal) body.ip = ipVal;
      const usernameVal = el.shieldUsername?.value?.trim();
      if (usernameVal) body.username = usernameVal;
      const deviceVal = el.shieldDevice?.value?.trim();
      if (deviceVal) body.device_fingerprint = deviceVal;
      const contentVal = el.shieldContent?.value?.trim();
      if (contentVal) body.content = contentVal;

      if (!Object.keys(body).length) {
        showToast("Enter at least one signal to analyze.");
        return;
      }

      const result = await fetchJson("/ai-shield/analyze", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body)
      });

      if (el.shieldRiskScore) el.shieldRiskScore.textContent = result.risk_score ?? "—";
      if (el.shieldConfidence) el.shieldConfidence.textContent = result.confidence ?? "—";
      if (el.shieldDecision) {
        el.shieldDecision.textContent = result.decision ?? "—";
        el.shieldDecision.className = "shield-stat-value shield-decision-" + (result.decision || "unknown");
      }

      if (el.shieldThreats) {
        const categories = Array.isArray(result.threat_categories) ? result.threat_categories : [];
        el.shieldThreats.innerHTML = categories.length
          ? categories.map((c) => `<span class="shield-threat-tag">${escapeHtml(c)}</span>`).join("")
          : '<span class="muted tiny">None identified</span>';
      }

      if (el.shieldReasons) {
        const reasons = Array.isArray(result.reasons) ? result.reasons : [];
        el.shieldReasons.innerHTML = reasons.length
          ? reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")
          : '<li class="muted tiny">No reasons provided</li>';
      }

      if (el.shieldInvestigation) {
        el.shieldInvestigation.textContent = JSON.stringify(result.investigation || {}, null, 2);
      }

      if (el.shieldFullResponse) {
        el.shieldFullResponse.textContent = JSON.stringify(result, null, 2);
      }

      if (el.shieldResult) el.shieldResult.style.display = "";
    } catch (error) {
      showToast(error.message || "Shield analysis failed");
    } finally {
      setBusy(el.runShieldAnalyze, false);
    }
  });
}

async function init() {
  cfg = await fetchJson("/v1/config");
  renderConfig();
  setupConsoleNav();
  setupTabs();
  setupModelsSourceToggle();
  setConsolePanel("account");
  // Protected cards start hidden (set in HTML); ensure consistent state
  setProtectedCardsVisible(false);
  await initSupabase();
  setupAuthActions();
  setupApiKeyActions();
  setupPlayground();
  setupGenApiPlayground();
  setupPaygPlayground();
  setupShieldPlayground();
  await loadRemoteTextModels().catch((error) => {
    console.warn(error);
    renderModels();
  });
  if (session?.access_token) {
    await refreshApiKeys();
  }
}

init().catch((error) => {
  console.error(error);
  showToast(error.message || "Failed to initialize dashboard");
});
