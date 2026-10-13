"use client";

import { useState, type ReactNode } from "react";
import Icon from "../../../Icon";
import {
  ROLE_LABELS as ORG_ROLE_LABELS,
  type OrgApi, type OrgDetail, type OrgMember, type OrgPlan, type OrgRole,
} from "../../../../lib/orgs";
import styles from "./orgs.module.css";

export interface OrgTabProps {
  api: OrgApi;
  org: OrgDetail;
  onChanged: () => void;
}

/** Tabs that need to know who the signed-in user is (you-badge, leave, own keys). */
export interface OwnTabProps extends OrgTabProps {
  userId: string | null;
}

export type AssignableRole = Exclude<OrgRole, "owner">;

export const PLAN_LABELS: Record<OrgPlan, string> = { free: "Free", starter: "Starter", team: "Team", enterprise: "Enterprise" };
export const ROLE_LABELS: Record<OrgRole, string> = ORG_ROLE_LABELS;
export const SOURCE_LABELS: Record<OrgMember["source"], string> = {
  creator: "Creator",
  invite: "Invited",
  sso_jit: "SSO",
  admin: "Added by staff",
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}

export function planLabel(plan: string): string {
  return (PLAN_LABELS as Record<string, string>)[plan] ?? plan;
}

/** Roles the caller may assign (mirrors permissions.py: owners assign admins; admins assign lower roles only). */
export function assignableRoles(callerRole: OrgRole): AssignableRole[] {
  if (callerRole === "owner") return ["admin", "billing_manager", "auditor", "member"];
  if (callerRole === "admin") return ["billing_manager", "auditor", "member"];
  return [];
}

/** Whether the caller may change this member's role or remove them (self and owners are never managed here). */
export function canManageMember(callerRole: OrgRole, target: OrgMember, selfId: string | null): boolean {
  if (target.role === "owner" || (selfId !== null && target.user_id === selfId)) return false;
  if (callerRole === "owner") return true;
  return callerRole === "admin" && (target.role === "member" || target.role === "billing_manager");
}

export function memberName(m: { email: string | null; username: string | null; user_id: string }): string {
  return m.email || (m.username ? `@${m.username}` : m.user_id);
}

export function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.";
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return withTime ? d.toLocaleString() : d.toLocaleDateString();
}

type Tone = "neutral" | "brand" | "ok" | "warn" | "crit";

const badgeTone: Record<Tone, string> = {
  neutral: styles.badge,
  brand: `${styles.badge} ${styles.badgeBrand}`,
  ok: `${styles.badge} ${styles.badgeOk}`,
  warn: `${styles.badge} ${styles.badgeWarn}`,
  crit: `${styles.badge} ${styles.badgeCrit}`,
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={badgeTone[tone]}>{children}</span>;
}

/** Plan badge: free is neutral, every paid plan uses the brand tone. */
export function PlanBadge({ plan }: { plan: OrgPlan | string }) {
  return <Badge tone={plan === "free" ? "neutral" : "brand"}>{planLabel(plan)}</Badge>;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Icon name="copy" aria-hidden="true" /> {copied ? "Copied" : label}
    </button>
  );
}

export function Locked({ children }: { children: ReactNode }) {
  return <div className={styles.locked}>{children}</div>;
}

const calloutTone = {
  error: styles.calloutError,
  ok: styles.calloutOk,
  warn: styles.calloutWarn,
  info: "",
} as const;

export function Callout({ tone, children }: { tone: keyof typeof calloutTone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`${styles.callout} ${calloutTone[tone]}`}>
      {children}
    </div>
  );
}
