"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import Icon, { type IconName } from "../../Icon";
import panel from "./Panel.module.css";
import styles from "./PlaygroundPanel.module.css";
import shared from "../playground/Playground.module.css";
import { Segmented, cx } from "../playground/ui";
import type { ApiPrefix, StudioProps } from "../playground/types";
import ContextChip from "../ContextChip";
import { slug } from "../playground/models";

interface Props { config: any; session: any; apiBase: string; theme?: "light" | "dark"; }

type Mode = "text" | "image" | "video" | "audio" | "3d" | "embedding" | "realtime" | "decision";

function StudioLoading() {
  return (
    <div className={shared.fadeIn} style={{ display: "grid", gap: "1rem" }}>
      <div className={shared.skeleton} style={{ height: 56 }} />
      <div className={shared.skeleton} style={{ height: 360 }} />
    </div>
  );
}

const load = (loader: () => Promise<{ default: ComponentType<StudioProps> }>) =>
  dynamic(loader, { ssr: false, loading: () => <StudioLoading /> });

const TextChat = load(() => import("../playground/TextChat"));
const ImageStudio = load(() => import("../playground/ImageStudio"));
const VideoStudio = load(() => import("../playground/VideoStudio"));
const AudioStudio = load(() => import("../playground/AudioStudio"));
const ThreeDStudio = load(() => import("../playground/ThreeDStudio"));
const EmbeddingStudio = load(() => import("../playground/EmbeddingStudio"));
const DecisionStudio = load(() => import("../playground/DecisionStudio"));
const RealtimeStudio = load(() => import("../playground/RealtimeStudio"));

const MODES: { id: Mode; label: string; icon: IconName; blurb: string; p2gOnly?: boolean }[] = [
  { id: "text", label: "Text", icon: "chat-circle-text", blurb: "Chat with streaming, vision and reasoning" },
  { id: "image", label: "Image", icon: "image", blurb: "Generate and edit images" },
  { id: "video", label: "Video", icon: "video", blurb: "Text and image to video", p2gOnly: true },
  { id: "audio", label: "Audio", icon: "music", blurb: "Music, speech, transcription and voice tools" },
  { id: "3d", label: "3D", icon: "cube", blurb: "Image to 3D models", p2gOnly: true },
  { id: "embedding", label: "Embeddings", icon: "list", blurb: "Turn text into vectors for search and similarity", p2gOnly: true },
  { id: "decision", label: "Decisions", icon: "list", blurb: "Classify and evaluate typed questions with probabilities", p2gOnly: true },
  { id: "realtime", label: "Realtime", icon: "mic", blurb: "Live voice conversations and transcription", p2gOnly: true },
];

const STUDIOS: Record<Mode, ComponentType<StudioProps>> = {
  text: TextChat,
  image: ImageStudio,
  video: VideoStudio,
  audio: AudioStudio,
  "3d": ThreeDStudio,
  embedding: EmbeddingStudio,
  realtime: RealtimeStudio,
  decision: DecisionStudio,
};

const ALL_MODES: readonly Mode[] = ["text", "image", "video", "audio", "3d", "embedding", "realtime", "decision"];
const P2G_ONLY: readonly Mode[] = ["video", "3d", "embedding", "realtime", "decision"];

const readPref = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const v = localStorage.getItem(key) as T | null;
    if (v && allowed.includes(v)) return v;
  } catch { /* storage unavailable */ }
  return fallback;
};

export default function PlaygroundPanel({ session, apiBase, theme = "light" }: Props) {
  const [mode, setMode] = useState<Mode>("text");
  const [source, setSource] = useState<"p2g" | "gen">("p2g");
  const [visited, setVisited] = useState<Mode[]>(["text"]);
  const [loadedModels, setLoadedModels] = useState<any[]>([]);
  const [modelsOwner, setModelsOwner] = useState("");
  const modelOwner = [apiBase, session?.access_token ?? "", source].join(":");
  const models = useMemo(() => modelsOwner === modelOwner ? loadedModels : [], [modelsOwner, modelOwner, loadedModels]);
  const modelRequest = useRef<AbortController | null>(null);
  const [modelsState, setModelsState] = useState<"loading" | "ready" | "error">("loading");
  const [initialModel, setInitialModel] = useState<string | undefined>();

  const applyLaunch = useCallback((candidate: unknown) => {
    if (!candidate || typeof candidate !== "object") return;
    const launch = candidate as { source?: unknown; mode?: unknown; modelId?: unknown };
    if ((launch.source !== "p2g" && launch.source !== "gen") ||
        typeof launch.mode !== "string" || !ALL_MODES.includes(launch.mode as Mode)) return;
    const nextMode = launch.mode as Mode;
    if (launch.source === "gen" && P2G_ONLY.includes(nextMode)) return;
    const modelId = typeof launch.modelId === "string" ? launch.modelId.trim() : "";

    setSource(launch.source);
    setMode(nextMode);
    setVisited((v) => v.includes(nextMode) ? v : [...v, nextMode]);
    setInitialModel(modelId || undefined);
    try {
      localStorage.setItem("playground-source", launch.source);
      localStorage.setItem("playground-mode", nextMode);
    } catch { /* preferences are optional */ }
  }, []);
  const applyLaunchRef = useRef(applyLaunch);
  useEffect(() => { applyLaunchRef.current = applyLaunch; }, [applyLaunch]);

  /* Restore the last-used source and mode after hydration (localStorage is client-only) */
  useEffect(() => {
    const m = readPref<Mode>("playground-mode", ALL_MODES, "text");
    const s = readPref<"p2g" | "gen">("playground-source", ["p2g", "gen"], "p2g");
    setSource(s);
    setMode(s === "gen" && P2G_ONLY.includes(m) ? "text" : m);
    setVisited([m]);
    try {
      const raw = sessionStorage.getItem("console-playground-launch");
      if (raw) {
        sessionStorage.removeItem("console-playground-launch");
        applyLaunchRef.current(JSON.parse(raw));
      }
    } catch { /* malformed or unavailable session storage */ }
  }, []);

  useEffect(() => {
    const onLaunch = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && typeof detail === "object") {
        try { sessionStorage.removeItem("console-playground-launch"); } catch { /* storage is optional */ }
        applyLaunch(detail);
      }
      else {
        try {
          const raw = sessionStorage.getItem("console-playground-launch");
          if (raw) { sessionStorage.removeItem("console-playground-launch"); applyLaunch(JSON.parse(raw)); }
        } catch { /* ignore invalid handoff */ }
      }
    };
    window.addEventListener("console-playground-launch", onLaunch);
    return () => window.removeEventListener("console-playground-launch", onLaunch);
  }, [applyLaunch]);

  const apiPrefix: ApiPrefix = source === "p2g" ? "/v1" : "/gen";

  const loadModels = useCallback(async () => {
    modelRequest.current?.abort();
    const controller = new AbortController();
    modelRequest.current = controller;
    setModelsState("loading");
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const r = await fetch(`${apiBase}/${source === "gen" ? "gen" : "v1"}/models`, { headers, signal: controller.signal });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error("models");
      if (controller.signal.aborted) return;
      setLoadedModels((Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : []).filter((m: any) => m.is_ready !== false));
      setModelsOwner(modelOwner);
      setModelsState("ready");
    } catch {
      if (controller.signal.aborted) return;
      setModelsState("error");
    }
  }, [apiBase, session?.access_token, source, modelOwner]);

  useEffect(() => { void loadModels(); return () => modelRequest.current?.abort(); }, [loadModels]);
  useEffect(() => {
    if (modelsOwner === modelOwner && modelsState === "ready" && initialModel && !models.some((m) => slug(m) === initialModel || m?.id === initialModel || m?.name === initialModel)) {
      setInitialModel(undefined);
    }
  }, [modelsOwner, modelOwner, modelsState, models, initialModel]);

  const choose = (next: Mode) => {
    setMode(next);
    setVisited((v) => (v.includes(next) ? v : [...v, next]));
    try { localStorage.setItem("playground-mode", next); } catch { /* ignore */ }
  };

  const chooseSource = (next: "p2g" | "gen") => {
    setInitialModel(undefined);
    setSource(next);
    try { localStorage.setItem("playground-source", next); } catch { /* ignore */ }
    if (next === "gen" && P2G_ONLY.includes(mode)) choose("text");
  };

  const active = MODES.find((m) => m.id === mode)!;
  const studioProps: StudioProps = useMemo(
    () => ({ session, apiBase, apiPrefix, models, theme, initialModel }),
    [session, apiBase, apiPrefix, models, theme, initialModel],
  );

  if (!session) {
    return (
      <div className={`${panel.panel} ${panel.active}`}>
        <div className={`${panel.lockedOverlay} ${panel.panelLock}`}>Sign in to use the playground.</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            Playground
          </h1>
          <p className={styles.sub}>{active.blurb}</p>
        </div>
        <ContextChip personal={source === "gen" || mode === "decision"} />
        <div className={styles.sourceWrap}>
          <span className={styles.sourceLabel}>Billing source</span>
          <Segmented
            label="Billing source"
            value={source}
            onChange={chooseSource}
            options={[
              { value: "p2g", label: "P2G · Credits", title: "Pay as you go using credits; supports all listed modalities" },
              { value: "gen", label: "Gen · Subscription", title: "Subscription usage for text, image and music" },
            ]}
          />
        </div>
      </header>

      <nav className={styles.modeRail} aria-label="Playground modality">
        {MODES.map((m) => {
          const locked = source === "gen" && m.p2gOnly;
          return (
            <button
              key={m.id}
              type="button"
              disabled={locked}
              aria-current={mode === m.id ? "page" : undefined}
              title={locked ? "Only available on the P2G API" : m.blurb}
              className={cx(styles.modeBtn, m.id === "decision" && styles.modeDecision, mode === m.id && styles.modeActive)}
              onClick={() => choose(m.id)}
            >
              <Icon name={m.icon} className={styles.modeIcon} />
              <span>{m.label}</span>
              {locked && <span className={styles.lockTag}>P2G</span>}
            </button>
          );
        })}
        <span className={styles.railSpacer} />
        {modelsState === "error" && (
          <button type="button" className={styles.retry} onClick={loadModels}>Models failed to load · Retry</button>
        )}
      </nav>

      {/* Studios stay mounted once opened so chats, drafts and running jobs survive tab switches */}
      <div className={styles.studios}>
        {visited.map((id) => {
          const Studio = STUDIOS[id];
          const hidden = id !== mode || (source === "gen" && MODES.find((m) => m.id === id)?.p2gOnly);
          return (
            <section key={id} hidden={hidden} className={styles.studioSlot} aria-label={`${id} studio`}>
              <Studio {...studioProps} active={!hidden} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
