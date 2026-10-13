"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./security.module.css";
import Icon from "../../../Icon";
import { CAP_LABELS } from "@/lib/orgs";

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const DOMAIN_RE = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(\/(3[0-2]|[12]?\d))?$/;
const IPV6 = /^[0-9a-fA-F:]+(\/(12[0-8]|1[01]\d|[1-9]?\d))?$/;

export function isIpOrCidr(v: string): boolean {
  return IPV4.test(v) || (v.includes(":") && v.split(":").length >= 3 && IPV6.test(v));
}

/** Splits a textarea into trimmed, non-empty lines. */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

export function isHttpsUrl(v: string): boolean {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

/** Read-only value with a copy button. Clipboard may be unavailable (insecure context); fails quietly. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={s.field}>
      <span>{label}</span>
      <div className={s.copyRow}>
        <code className={s.copyValue}>{value}</code>
        <button type="button" className="ghost" onClick={copy} aria-label={`Copy ${label}`}>
          <Icon name="copy" /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/** Placeholder for a plan-gated feature: a lock, a sentence, and an upgrade hint. Never hides the feature silently. */
export function LockedNote({ children }: { children: ReactNode }) {
  return (
    <div className={s.lockedCard}>
      <Icon name="lock-simple" size={22} />
      <div>{children}</div>
    </div>
  );
}

/** Shown when the caller can see a section but lacks the capability to change it. */
export function ReadOnlyNote({ cap }: { cap: string }) {
  return (
    <div className={`${s.callout} ${s.calloutInfo}`}>
      Read-only. Changing this needs the &ldquo;{CAP_LABELS[cap] ?? cap}&rdquo; permission.
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className={`${s.callout} ${s.calloutDanger}`} role="alert">
      <span>{message}</span>
    </div>
  );
}
