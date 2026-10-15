"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import Icon, { type IconName } from "../../Icon";
import panel from "./Panel.module.css";
import styles from "./PlaygroundPanel.module.css";
import shared from "../playground/Playground.module.css";
import { Segmented, cx } from "../playground/ui";
import type { ApiPrefix, StudioProps } from "../playground/types";
import ContextChip from "../ContextChip";

interface Props { config: any; session: any; apiBase: string; theme?: "light" | "dark"; }

type Mode = "text" | "image" | "video" | "audio" | "3d";

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

const MODES: { id: Mode; label: string; icon: IconName; blurb: string; p2gOnly?: boolean }[] = [
  { id: "text", label: "Text", icon: "chat-circle-text", blurb: "Chat with streaming, vision and reasoning" },
  { id: "image", label: "Image", icon: "image", blurb: "Generate and edit images" },
  { id: "video", label: "Video", icon: "video", blurb: "Text and image to video", p2gOnly: true },
  { id: "audio", label: "Audio", icon: "music", blurb: "Music, speech, transcription and voice tools" },
  { id: "3d", label: "3D", icon: "cube", blurb: "Image to 3D models", p2gOnly: true },
];

const STUDIOS: Record<Mode, ComponentType<StudioProps>> = {
  text: TextChat,
  image: ImageStudio,
  video: VideoStudio,
  audio: AudioStudio,
  "3d": ThreeDStudio,
};

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
  const [models, setModels] = useState<any[]>([]);
  const [modelsState, setModelsState] = useState<"loading" | "ready" | "error">("loading");

  /* Restore the last-used source and mode after hydration (localStorage is client-only) */
  useEffect(() => {
    const m = readPref<Mode>("playground-mode", ["text", "image", "video", "audio", "3d"], "text");
    const s = readPref<"p2g" | "gen">("playground-source", ["p2g", "gen"], "p2g");
    setSource(s);
    setMode(s === "gen" && (m === "video" || m === "3d") ? "text" : m);
    setVisited([m]);
  }, []);

  const apiPrefix: ApiPrefix = source === "p2g" ? "/v1" : "/gen";

  const loadModels = useCallback(async () => {
    setModelsState("loading");
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const r = await fetch(`${apiBase}/v1/models`, { headers });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error("models");
      setModels((Array.isArray(d.data) ? d.data : []).filter((m: any) => m.is_ready !== false));
      setModelsState("ready");
    } catch {
      setModelsState("error");
    }
  }, [apiBase, session?.access_token]);

  useEffect(() => { loadModels(); }, [loadModels]);

  const choose = (next: Mode) => {
    setMode(next);
    setVisited((v) => (v.includes(next) ? v : [...v, next]));
    try { localStorage.setItem("playground-mode", next); } catch { /* ignore */ }
  };

  const chooseSource = (next: "p2g" | "gen") => {
    setSource(next);
    try { localStorage.setItem("playground-source", next); } catch { /* ignore */ }
    if (next === "gen" && (mode === "video" || mode === "3d")) choose("text");
  };

  const active = MODES.find((m) => m.id === mode)!;
  const studioProps: StudioProps = useMemo(
    () => ({ session, apiBase, apiPrefix, models, theme }),
    [session, apiBase, apiPrefix, models, theme],
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
        <ContextChip />
        <div className={styles.sourceWrap}>
          <Segmented
            value={source}
            onChange={chooseSource}
            options={[
              { value: "p2g", label: "P2G API", title: "Pay-to-go credits, all modalities" },
              { value: "gen", label: "Gen API", title: "Subscription API: text, image and music" },
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
              className={cx(styles.modeBtn, mode === m.id && styles.modeActive)}
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
              <Studio {...studioProps} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
