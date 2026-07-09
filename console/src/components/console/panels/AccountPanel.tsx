"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./Panel.module.css";

interface AccountPanelProps { config: any; session: any; supabase: any; apiBase: string; }

export default function AccountPanel({ config, session, supabase, apiBase }: AccountPanelProps) {
  const [wallet, setWallet] = useState<any>(null);
  const [usageSummary, setUsageSummary] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [packs] = useState<any[]>(config?.billing?.packs || []);
  const [notices] = useState<any[]>(config?.notices || []);

  const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` });
  const fj = async (path: string, opts: RequestInit = {}) => { const r = await fetch(`${apiBase}${path}`, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`); return d; };

  const loadAccountData = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const [me, ledgerData, subData] = await Promise.all([
        fj("/v1/me", { headers: authH() }),
        fj("/v1/credits/ledger?limit=30", { headers: authH() }),
        fj("/subscription", { headers: authH() }).catch(() => null),
      ]);
      setWallet(me.wallet || {});
      setUsageSummary(me.usage_summary || {});
      setLedger(ledgerData.entries || []);
      if (subData) setSubscription(subData);
    } catch { /* ignore */ }
  }, [session, apiBase]);

  useEffect(() => { if (session?.access_token) loadAccountData(); }, [session, loadAccountData]);

  const fmt = (v: string | null) => { if (!v) return "Never"; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString(); };

  const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    const fd = new FormData(e.currentTarget);
    try { const { error } = await supabase.auth.signInWithPassword({ email: fd.get("email") as string, password: fd.get("password") as string }); if (error) throw error; } catch (err: any) { alert(err.message); }
  };

  const handleSignUp = async () => {
    if (!supabase) return;
    const email = (document.getElementById("email-input") as HTMLInputElement)?.value;
    const password = (document.getElementById("password-input") as HTMLInputElement)?.value;
    try { const { error } = await supabase.auth.signUp({ email, password }); if (error) throw error; alert("Sign-up complete. Check your email."); } catch (err: any) { alert(err.message); }
  };

  const handleOAuth = async (p: string) => { await supabase?.auth.signInWithOAuth({ provider: p as any, options: { redirectTo: window.location.href } }); };

  const handleForgot = async () => {
    const email = (document.getElementById("email-input") as HTMLInputElement)?.value?.trim();
    if (!email) return alert("Enter your email first.");
    try { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: config?.supabase?.resetRedirectUrl }); if (error) throw error; alert("Password reset email sent."); } catch (err: any) { alert(err.message); }
  };

  const handleDelete = async () => {
    if (!supabase || !session?.user) return;
    if (!confirm("Delete your account permanently?")) return;
    try {
      if (session.user.app_metadata?.provider === "email") {
        const password = prompt("Confirm your password:");
        if (!password) return;
        const vr = await fetch(config.supabase.deletePasswordVerifyEndpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: session.user.email, password }) });
        if (!vr.ok) throw new Error("Password verification failed");
      }
      const dr = await fetch(config.supabase.deleteAccountEndpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` } });
      if (!dr.ok) { const p = await dr.json().catch(() => ({})); throw new Error(p.error || "Delete failed"); }
      await supabase.auth.signOut(); alert("Account deleted.");
    } catch (err: any) { alert(err.message); }
  };

  if (!session) {
    return (
      <div className={`${styles.panel} ${styles.active}`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: "1.5rem", gridColumn: "span 12" }}>
          <section className={`${styles.card} ${styles.authCard}`}>
            <div className={styles.heading}>Account</div>
            <div className={styles.stack}>
              <p className={`${styles.muted} ${styles.tiny}`}>Sign in to access the Pay-2-Go API.</p>
              <form className={styles.stack} onSubmit={handleEmailSignIn}>
                <input id="email-input" name="email" type="email" placeholder="Email" required />
                <input id="password-input" name="password" type="password" placeholder="Password" required />
                <div className={styles.row}>
                  <button type="submit" style={{ flex: 1 }}>Sign in</button>
                  <button type="button" className="ghost" style={{ flex: 1 }} onClick={handleSignUp}>Sign up</button>
                </div>
              </form>
              <div className={styles.stack}>
                <button className="ghost" onClick={() => handleOAuth("google")}>Continue with Google</button>
                <button className="ghost" onClick={() => handleOAuth("github")}>Continue with GitHub</button>
                <button className="ghost" onClick={() => handleOAuth("azure")}>Continue with Microsoft</button>
                <button className="ghost" onClick={() => handleOAuth("custom:huggingface")}>Continue with HuggingFace</button>
              </div>
              <button className={`${styles.muted} ${styles.tiny}`} type="button" onClick={handleForgot}>Forgot password?</button>
            </div>
          </section>
          <section className={styles.card} style={{ gridColumn: "span 7" }}>
            <div className={styles.heading}>P2G Credits (Pay-2-Go)</div>
            <div className={styles.lockedOverlay}>Sign in to view your credit balance</div>
          </section>
        </div>
        <section className={styles.card}>
          <div className={styles.heading}>Subscription (Generation API)</div>
          <div className={styles.lockedOverlay}>Sign in to view your subscription info</div>
        </section>
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: "1.5rem", gridColumn: "span 12" }}>
        <section className={`${styles.card} ${styles.authCard}`}>
          <div className={styles.heading}>Account</div>
          <div className={styles.signedInView}>
            <div className={styles.userBadge}>
              <div className={styles.userAvatar}>{session.user?.email?.[0]?.toUpperCase() || "?"}</div>
              <div className={styles.userEmail}>{session.user?.email}</div>
            </div>
            <button className="text-btn danger" onClick={handleDelete}>Delete account</button>
          </div>
        </section>
        <section className={styles.card} style={{ gridColumn: "span 7" }}>
          <div className={styles.heading}>P2G Credits (Pay-2-Go)</div>
          {wallet ? (
            <div>
              <div className={styles.statGrid}>
                <div className={styles.statArticle}><span className={styles.statLabel}>Remaining</span><strong className={styles.statValue}>{Number(wallet.balance_credits || 0).toFixed(4)}</strong></div>
                <div className={styles.statArticle}><span className={styles.statLabel}>Total purchased</span><strong className={styles.statValue}>{Number(wallet.lifetime_credits_purchased || 0).toFixed(4)}</strong></div>
                <div className={styles.statArticle}><span className={styles.statLabel}>Total used</span><strong className={styles.statValue}>{Number(usageSummary.totalCreditsUsed || 0).toFixed(4)}</strong></div>
              </div>
              <p className={`${styles.muted} ${styles.tiny}`} style={{ marginTop: "1rem" }}>P2G credit balances enforced server-side. Low balance returns HTTP 402.</p>
            </div>
          ) : <div className={styles.lockedOverlay}>Sign in to view your credit balance</div>}
        </section>
      </div>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Subscription (Generation API)</div>
        {subscription ? (
          <div>
            <div className={styles.statGrid} style={{ marginBottom: "1rem" }}>
              <div className={styles.statArticle}><span className={styles.statLabel}>Plan</span><strong className={styles.statValue}>{subscription.plan_name || "Free"}</strong></div>
              <div className={styles.statArticle}><span className={styles.statLabel}>Plan Key</span><strong className={styles.statValue}>{subscription.plan_key || "\u2014"}</strong></div>
              <div className={styles.statArticle}><span className={styles.statLabel}>Signed Up</span><strong className={styles.statValue}>{subscription.signed_up ? fmt(subscription.signed_up) : "\u2014"}</strong></div>
            </div>
            {subscription.subscription?.length ? subscription.subscription.map((sub: any, i: number) => (
              <div key={i} className={styles.ledgerRow} style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div><strong>Status</strong><div className={`${styles.muted} ${styles.tiny}`}>{sub.status || "\u2014"}</div></div>
                <div><strong>Period</strong><div className={`${styles.muted} ${styles.tiny}`}>{sub.current_period_start ? fmt(sub.current_period_start) : "\u2014"} \u2014 {sub.current_period_end ? fmt(sub.current_period_end) : "\u2014"}</div></div>
                <div><strong>Plan</strong><div className={`${styles.muted} ${styles.tiny}`}>{sub.plan_id || "\u2014"}</div></div>
              </div>
            )) : <p className={`${styles.muted} ${styles.tiny}`}>No active subscription. You are on the Free plan.</p>}
          </div>
        ) : <div className={styles.lockedOverlay}>Sign in to view your subscription info</div>}
      </section>

      {notices.length > 0 && (
        <section className={`${styles.card} ${styles.wide}`}>
          <div className={styles.heading}>Notifications</div>
          <div className={styles.stack}>
            {notices.map((n: any, i: number) => <article key={i} style={{ padding: "1rem 1.1rem", borderRadius: 10, border: "1.5px solid rgba(26,107,255,0.2)", background: "rgba(26,107,255,0.04)" }}><strong style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)", display: "block", marginBottom: "0.4rem" }}>{(n.level || "info").toUpperCase()}</strong><p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem", lineHeight: 1.55 }}>{n.message}</p></article>)}
          </div>
        </section>
      )}

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Credit Packs</div>
        <div className={styles.packGrid}>
          {packs.map((p: any) => (
            <div key={p.label} className={styles.pack}>
              <strong style={{ fontSize: "0.95rem", fontWeight: 600 }}>{p.label}</strong>
              <div className={styles.creditAmount}>{Number(p.credits).toFixed(4)} credits</div>
              <div className={styles.muted} style={{ fontSize: "0.8rem", marginBottom: "0.65rem" }}>${Number(p.amountUsd).toFixed(2)} USD</div>
              <button disabled={!p.stripePaymentLink} onClick={() => { if (!session?.user?.email) return alert("Sign in first."); const url = new URL(p.stripePaymentLink); url.searchParams.set("prefilled_email", session.user.email); window.location.href = url.toString(); }} style={{ width: "100%", fontSize: "0.8rem", padding: "0.6rem 0.75rem" }}>{!p.stripePaymentLink ? "Link pending" : "Add credits"}</button>
            </div>
          ))}
        </div>
        <div className={styles.subheading}>Usage Rates</div>
        <ul className={styles.rateList}>
          {[`${config?.pricing?.textCreditPerMillionTokens} credits per 1,000,000 text tokens (including multimodal text payloads)`, `${config?.pricing?.imageCreditPerImage} credits per image`, `${config?.pricing?.videoCreditPerSecond} credits per second of video`, `${config?.pricing?.audioCreditPerSecond} credits per second of audio (music/sfx)`].map((r, i) => <li key={i} className={styles.rateListItem}>{r}</li>)}
        </ul>
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>P2G Ledger</div>
        <div className={styles.ledger}>
          <div className={styles.ledgerHeader}><span>Type</span><span>Credits</span><span>Units</span><span>Date</span></div>
          {ledger.length === 0 ? <div className={styles.lockedOverlay} style={{ minHeight: 60 }}>No ledger entries yet.</div> : ledger.map((e: any, i: number) => (
            <div key={i} className={styles.ledgerRow}>
              <div><strong>{e.entry_type}</strong><div className={`${styles.muted} ${styles.tiny}`}>{e.usage_kind || "\u2014"}</div></div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>{Number(e.delta_credits || 0).toFixed(4)}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>{e.units != null ? e.units : "\u2014"} {e.unit_label || ""}</div>
              <div className={`${styles.muted} ${styles.tiny}`}>{e.created_at || ""}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}