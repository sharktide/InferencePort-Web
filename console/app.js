import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let cfg = null;
let supabase = null;
let session = null;
const FALLBACK_API_BASE_URL = "https://sharktide-lightning.hf.space";

const el = {
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
  noticeList: document.getElementById("notice-list"),
  packGrid: document.getElementById("pack-grid"),
  modelsGrid: document.getElementById("models-grid"),
  rateList: document.getElementById("rate-list"),
  creditsRemaining: document.getElementById("credits-remaining"),
  creditsTotal: document.getElementById("credits-total"),
  creditsUsed: document.getElementById("credits-used"),
  ledgerTable: document.getElementById("ledger-table"),
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
  audioType: document.getElementById("audio-type"),
  audioDuration: document.getElementById("audio-duration"),
  audioOutput: document.getElementById("audio-output")
};

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
      <div>${Number(pack.credits).toFixed(4)} credits</div>
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

  el.modelsGrid.innerHTML = "";
  (cfg.models || []).forEach((model) => {
    const card = document.createElement("article");
    card.className = "model-card";
    card.innerHTML = `
      <img src="./assets/logo.png" alt="logo" />
      <div>
        <strong>${model.name}</strong>
        <p>${String(model.type || "model").toUpperCase()}</p>
      </div>
    `;
    el.modelsGrid.appendChild(card);
  });
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
}

function renderLedger(entries) {
  el.ledgerTable.innerHTML = "";
  if (!entries.length) {
    el.ledgerTable.textContent = "No ledger entries yet.";
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "ledger-row";
    row.innerHTML = `
      <div><strong>${entry.entry_type}</strong><div class="muted tiny">${entry.usage_kind || "-"}</div></div>
      <div>${Number(entry.delta_credits || 0).toFixed(4)} credits</div>
      <div>${entry.units != null ? entry.units : "-"} ${entry.unit_label || ""}</div>
      <div class="muted tiny">${entry.created_at || ""}</div>
    `;
    el.ledgerTable.appendChild(row);
  });
}

function renderAuthState() {
  if (session?.user) {
    el.authState.textContent = `Signed in as ${session.user.email}`;
    el.logoutBtn.hidden = false;
    el.deleteBtn.hidden = false;
  } else {
    el.authState.textContent = "Sign in to access the Pay-2-Go API.";
    el.logoutBtn.hidden = true;
    el.deleteBtn.hidden = true;
    el.creditsRemaining.textContent = "0.0000";
    el.creditsTotal.textContent = "0.0000";
    el.creditsUsed.textContent = "0.0000";
    el.ledgerTable.textContent = "Sign in to view usage and purchases.";
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
  }

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    session = nextSession;
    renderAuthState();
    if (session) {
      await refreshAccount().catch((e) => showToast(e.message));
    }
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const next = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".tab-panel").forEach((panel) => {
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

function setBusy(button, isBusy, text = "Working...") {
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
  el.runText.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runText, true);
    el.textOutput.textContent = "Generating...";
    try {
      const result = await fetchJson("/v1/chat/completions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          stream: false,
          messages: [
            { role: "user", content: el.textPrompt.value || "Hello" }
          ]
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
    el.imageOutput.textContent = "Generating...";
    try {
      const result = await fetchJson("/v1/images/generations", {
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

  el.runVideo.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runVideo, true);
    el.videoOutput.textContent = "Generating...";
    try {
      const response = await fetch(`${apiBase()}/v1/videos/generations`, {
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

  el.runAudio.addEventListener("click", async () => {
    if (!session) return showToast("Sign in required");
    setBusy(el.runAudio, true);
    el.audioOutput.textContent = "Generating...";
    try {
      const response = await fetch(`${apiBase()}/v1/audio/generations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: el.audioPrompt.value || "Energetic electronic beat",
          audio_type: el.audioType.value,
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

async function init() {
  cfg = await fetchJson("/v1/config");
  renderConfig();
  setupTabs();
  await initSupabase();
  setupAuthActions();
  setupPlayground();
}

init().catch((error) => {
  console.error(error);
  showToast(error.message || "Failed to initialize dashboard");
});
