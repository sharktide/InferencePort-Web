"use client";

/* Organization context. One place decides "who am I working as": a personal account or one of my organizations.
   While an org is active, every API request to the InferencePort API carries the X-InferencePort-Org header, so the
   playground, models, agents and usage all bill and apply policy as that org. Personal-only endpoints are exempt. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createOrgApi, ORG_HEADER, type OrgApi, type OrgSummary } from "../../lib/orgs";

const STORAGE_KEY = "console-org";
/* The header only matters where usage is billed or the org wallet is shown. Read-only lookups (models, agents) stay
   header-free so an exhausted org budget or a role that cannot spend never breaks them. */
const ORG_BILLED = /^\/v1\/(chat|images|videos|audio|3d|embeddings|me|credits)(\/|\?|$)/;
/* Server-side refresh trigger, e.g. after a first SSO sign-in joined the user to an organization. */
export const ORGS_CHANGED_EVENT = "console:orgs-changed";

export interface OrgContextValue {
  /** null until loaded (or while signed out) */
  orgs: OrgSummary[] | null;
  activeSlug: string | null;
  activeOrg: OrgSummary | null;
  /** Set when the organization list could not be loaded; call refresh() to retry. */
  listError: string | null;
  /** Switch context. Pass null for the personal account. */
  setActiveSlug: (slug: string | null) => void;
  refresh: () => Promise<void>;
  api: OrgApi;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function useOrgContext(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrgContext must be used inside <OrgProvider>");
  return ctx;
}

/** Safe variant for components that may render outside the provider (returns null). */
export function useOptionalOrgContext(): OrgContextValue | null {
  return useContext(OrgContext);
}

function readStored(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
}
function writeStored(slug: string | null) {
  try { slug ? localStorage.setItem(STORAGE_KEY, slug) : localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function OrgProvider({ session, apiBase, children }: { session: any; apiBase: string; children: ReactNode }) {
  const token: string | undefined = session?.access_token;
  const tokenRef = useRef<string | undefined>(token);
  tokenRef.current = token;
  const api = useMemo(() => createOrgApi(apiBase, () => tokenRef.current), [apiBase]);

  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null);
  const [requested, setRequested] = useState<string | null>(() => (typeof window === "undefined" ? null : readStored()));

  const [listError, setListError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const started = tokenRef.current;
    if (!started) { setOrgs(null); setListError(null); return; }
    try {
      const { orgs: list } = await api.list();
      if (tokenRef.current !== started) return; /* signed out or switched account while loading */
      setOrgs(list);
      setListError(null);
    } catch (e) {
      if (tokenRef.current !== started) return;
      setListError(e instanceof Error ? e.message : "Could not load your organizations");
    }
  }, [api]);

  useEffect(() => {
    const onChanged = () => { void refresh(); };
    window.addEventListener(ORGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(ORGS_CHANGED_EVENT, onChanged);
  }, [refresh]);

  const signedIn = !!token;
  useEffect(() => {
    if (!signedIn) { setOrgs(null); setListError(null); return; }
    void refresh();
  }, [signedIn, refresh]);

  /* The active org must be one the user belongs to; otherwise fall back to personal. */
  const activeOrg = useMemo(
    () => (requested && orgs ? orgs.find((o) => o.slug === requested) ?? null : null),
    [requested, orgs],
  );
  const activeSlug = activeOrg?.slug ?? null;

  const setActiveSlug = useCallback((slug: string | null) => {
    setRequested(slug);
    writeStored(slug);
  }, []);

  /* Add the org header to API requests while an org is active. Restored on cleanup. */
  useEffect(() => {
    if (typeof window === "undefined" || !activeSlug) return;
    const original = window.fetch;
    const base = apiBase.replace(/\/$/, "");
    window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith(base) && ORG_BILLED.test(url.slice(base.length))) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has(ORG_HEADER)) headers.set(ORG_HEADER, activeSlug);
          return original.call(window, input, { ...init, headers });
        }
      } catch { /* fall through to the untouched request */ }
      return original.call(window, input, init);
    } as typeof window.fetch;
    return () => { window.fetch = original; };
  }, [activeSlug, apiBase]);

  const value = useMemo<OrgContextValue>(
    () => ({ orgs, activeSlug, activeOrg, listError, setActiveSlug, refresh, api }),
    [orgs, activeSlug, activeOrg, listError, setActiveSlug, refresh, api],
  );
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}
