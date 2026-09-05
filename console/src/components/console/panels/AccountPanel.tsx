"use client";

import { useState } from "react";
import styles from "./Panel.module.css";
import accountStyles from "./AccountPanel.module.css";

type AuthMode = "signin" | "signup" | "forgot";

interface AccountPanelProps { config: any; session: any; supabase: any; }

export default function AccountPanel({ config, session, supabase }: AccountPanelProps) {
  const [notices] = useState<any[]>(config?.notices || []);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");

  const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    const fd = new FormData(e.currentTarget);
    try { const { error } = await supabase.auth.signInWithPassword({ email: fd.get("email") as string, password: fd.get("password") as string }); if (error) throw error; } catch (err: any) { alert(err.message); }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    try { const { error } = await supabase.auth.signUp({ email, password }); if (error) throw error; alert("Sign-up complete. Check your email."); } catch (err: any) { alert(err.message); }
  };

  const handleOAuth = async (p: string) => { await supabase?.auth.signInWithOAuth({ provider: p as any, options: { redirectTo: window.location.href } }); };

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
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

  const renderAuthCard = () => {
    if (authMode === "forgot") {
      return (
        <div className={accountStyles.signInCard}>
          <div className={accountStyles.brandMark}>InferencePortAI</div>
          <p className={accountStyles.signInSubtitle}>Reset your password</p>

          <form className={accountStyles.authForm} onSubmit={handleForgot}>
            <div className={accountStyles.fieldGroup}>
              <label className={accountStyles.fieldLabel} htmlFor="forgot-email">Email</label>
              <input id="forgot-email" name="email" type="email" placeholder="Enter your email" required />
            </div>
            <button type="submit" data-auth className={accountStyles.primaryBtn}>Send Reset Link</button>
          </form>

          <div className={accountStyles.authFooter}>
            <button type="button" data-auth className={accountStyles.backLink} onClick={() => setAuthMode("signin")}>Back to Sign In</button>
          </div>
        </div>
      );
    }

    if (authMode === "signup") {
      return (
        <div className={accountStyles.signInCard}>
          <div className={accountStyles.brandMark}>InferencePortAI</div>
          <p className={accountStyles.signInSubtitle}>Create your account</p>

          <div className={accountStyles.socialGrid}>
            <button data-auth className={accountStyles.socialBtn} type="button" onClick={() => handleOAuth("github")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub
            </button>
            <button data-auth className={accountStyles.socialBtn} type="button" onClick={() => handleOAuth("google")}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/><path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/><path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
              Google
            </button>
            <button data-auth className={accountStyles.socialBtn} type="button" onClick={() => handleOAuth("azure")}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>
              Microsoft
            </button>
            <button data-auth className={accountStyles.socialBtn} type="button" onClick={() => handleOAuth("custom:huggingface")}>
              🤗&nbsp;&nbsp;Hugging Face
            </button>
          </div>

          <div className={accountStyles.divider}><span>OR</span></div>

          <form className={accountStyles.authForm} onSubmit={handleSignUp}>
            <div className={accountStyles.fieldGroup}>
              <label className={accountStyles.fieldLabel} htmlFor="signup-email">Email</label>
              <input id="signup-email" name="email" type="email" placeholder="Enter your email" required />
            </div>
            <div className={accountStyles.fieldGroup}>
              <label className={accountStyles.fieldLabel} htmlFor="signup-password">Password</label>
              <input id="signup-password" name="password" type="password" placeholder="Enter your password" required />
            </div>
            <button type="submit" data-auth className={accountStyles.primaryBtn}>Create Account</button>
          </form>

          <div className={accountStyles.authFooter}>
            Already have an account? <button type="button" data-auth onClick={() => setAuthMode("signin")}>Sign In</button>
          </div>
        </div>
      );
    }

    // Default: sign in
    return (
      <div className={accountStyles.signInCard}>
        <div className={accountStyles.brandMark}>InferencePortAI</div>
        <p className={accountStyles.signInSubtitle}>Sign in to your account</p>

        <div className={accountStyles.socialGrid}>
          <button data-auth className={accountStyles.socialBtn} type="button" onClick={() => handleOAuth("github")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </button>
          <button data-auth className={accountStyles.socialBtn} type="button" onClick={() => handleOAuth("google")}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/><path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/><path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
            Google
          </button>
          <button data-auth className={accountStyles.socialBtn} type="button" onClick={() => handleOAuth("azure")}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>
            Microsoft
          </button>
          <button data-auth className={accountStyles.socialBtn} type="button" onClick={() => handleOAuth("custom:huggingface")}>
              🤗&nbsp;&nbsp;Hugging Face
          </button>
        </div>

        <div className={accountStyles.divider}><span>OR</span></div>

        <form className={accountStyles.authForm} onSubmit={handleEmailSignIn}>
          <div className={accountStyles.fieldGroup}>
            <label className={accountStyles.fieldLabel} htmlFor="email-input">Email</label>
            <input id="email-input" name="email" type="email" placeholder="Enter your email" required />
          </div>
          <div className={accountStyles.fieldGroup}>
            <label className={accountStyles.fieldLabel} htmlFor="password-input">Password</label>
            <input id="password-input" name="password" type="password" placeholder="Enter your password" required />
          </div>
          <button type="submit" data-auth className={accountStyles.primaryBtn}>Sign In</button>
        </form>

        <button data-auth className={accountStyles.textLink} type="button" onClick={() => setAuthMode("forgot")}>Forgot Password?</button>

        <div className={accountStyles.authFooter}>
          Don't have an account? <button type="button" data-auth onClick={() => setAuthMode("signup")}>Sign Up</button>
        </div>
      </div>
    );
  };

  if (!session) {
    return (
      <div className={`${styles.panel} ${styles.active}`}>
        <div className={accountStyles.signInWrapper}>
          {renderAuthCard()}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${accountStyles.userSection}`}>
        <div className={styles.heading}>Account</div>
        <div className={accountStyles.signedInContent}>
          <div className={accountStyles.userBadge}>
            <div className={accountStyles.userAvatar}>{session.user?.email?.[0]?.toUpperCase() || "?"}</div>
            <div className={accountStyles.userInfo}>
              <div className={accountStyles.userEmail}>{session.user?.email}</div>
              <div className={accountStyles.userProvider}>Signed in via {session.user?.app_metadata?.provider || "email"}</div>
            </div>
          </div>
          <button className={accountStyles.deleteBtn} onClick={handleDelete}>Delete account</button>
        </div>
      </section>

      {notices.length > 0 && (
        <section className={`${styles.card} ${styles.wide}`}>
          <div className={styles.heading}>Notifications</div>
          <div className={styles.stack}>
            {notices.map((n: any, i: number) => <article key={i} className={accountStyles.notice}><strong className={accountStyles.noticeLevel}>{(n.level || "info").toUpperCase()}</strong><p className={accountStyles.noticeMessage}>{n.message}</p></article>)}
          </div>
        </section>
      )}
    </div>
  );
}
