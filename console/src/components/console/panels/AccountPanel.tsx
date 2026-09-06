"use client";

import { useState, useCallback } from "react";
import styles from "./Panel.module.css";
import accountStyles from "./AccountPanel.module.css";

type AuthMode = "signin" | "signup" | "forgot";

interface AccountPanelProps { config: any; session: any; supabase: any; }

const PROVIDER_SVG: Record<string, JSX.Element> = {
  github: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>,
  google: <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/><path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/><path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>,
  azure: <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>,
  "custom:huggingface": <span style={{ fontSize: "1.1rem" }}>&#129303;</span>,
  email: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
};

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  azure: "Microsoft",
  "custom:huggingface": "Hugging Face",
  email: "Email / Password",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function timeAgo(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function AccountPanel({ config, session, supabase }: AccountPanelProps) {
  const [notices] = useState<any[]>(config?.notices || []);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    if (newPassword !== confirmPassword) return alert("Passwords do not match.");
    if (newPassword.length < 6) return alert("Password must be at least 6 characters.");
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) { alert(err.message); }
    setChangingPassword(false);
  };

  const handleSignOutEverywhere = async () => {
    if (!supabase) return;
    if (!confirm("Sign out from all devices and sessions?")) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      alert("Signed out from all sessions.");
    } catch (err: any) { alert(err.message); }
    setSigningOut(false);
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

  const user = session.user || {};
  const isEmailProvider = user.app_metadata?.provider === "email";
  const identities = user.identities || [];
  const linkedProviders = identities.map((id: any) => id.provider).filter(Boolean);
  const emailVerified = user.user_metadata?.email_verified || user.app_metadata?.email_verified || false;
  const userCreated = user.created_at || user.user_metadata?.created_at;
  const lastSignIn = user.last_sign_in_at;

  return (
    <div className={`${styles.panel} ${styles.active}`}>
      <section className={`${styles.card} ${accountStyles.userSection}`}>
        <div className={styles.heading}>Account</div>
        <div className={accountStyles.signedInContent}>
          <div className={accountStyles.userBadge}>
            <div className={accountStyles.userAvatar}>{user.email?.[0]?.toUpperCase() || "?"}</div>
            <div className={accountStyles.userInfo}>
              <div className={accountStyles.userEmail}>{user.email}</div>
              <div className={accountStyles.userProvider}>Signed in via {PROVIDER_LABELS[user.app_metadata?.provider] || user.app_metadata?.provider || "email"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Account Details</div>
        <div className={accountStyles.infoGrid}>
          <div className={accountStyles.infoItem}>
            <span className={accountStyles.infoLabel}>User ID</span>
            <span className={accountStyles.infoValueMono}>{user.id || "\u2014"}</span>
          </div>
          <div className={accountStyles.infoItem}>
            <span className={accountStyles.infoLabel}>Email</span>
            <span className={accountStyles.infoValue}>{user.email || "\u2014"}</span>
          </div>
          <div className={accountStyles.infoItem}>
            <span className={accountStyles.infoLabel}>Email Verified</span>
            <span className={`${accountStyles.infoBadge} ${emailVerified ? accountStyles.badgeVerified : accountStyles.badgeUnverified}`}>
              {emailVerified ? "Verified" : "Not Verified"}
            </span>
          </div>
          <div className={accountStyles.infoItem}>
            <span className={accountStyles.infoLabel}>Account Created</span>
            <span className={accountStyles.infoValue}>{formatDateTime(userCreated)}<span className={accountStyles.infoRelative}>{timeAgo(userCreated)}</span></span>
          </div>
          <div className={accountStyles.infoItem}>
            <span className={accountStyles.infoLabel}>Last Sign-in</span>
            <span className={accountStyles.infoValue}>{formatDateTime(lastSignIn)}<span className={accountStyles.infoRelative}>{timeAgo(lastSignIn)}</span></span>
          </div>
          <div className={accountStyles.infoItem}>
            <span className={accountStyles.infoLabel}>Auth Provider</span>
            <span className={accountStyles.infoValue}>{PROVIDER_LABELS[user.app_metadata?.provider] || user.app_metadata?.provider || "email"}</span>
          </div>
        </div>
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Security</div>
        {isEmailProvider ? (
          <form className={accountStyles.passwordForm} onSubmit={handleChangePassword}>
            <div className={accountStyles.fieldGroup}>
              <label className={accountStyles.fieldLabel} htmlFor="new-password">New Password</label>
              <input id="new-password" type="password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div className={accountStyles.fieldGroup}>
              <label className={accountStyles.fieldLabel} htmlFor="confirm-password">Confirm Password</label>
              <input id="confirm-password" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            <div className={accountStyles.securityActions}>
              <button type="submit" className={accountStyles.primaryBtn} disabled={changingPassword || !newPassword || !confirmPassword}>
                {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        ) : (
          <div className={accountStyles.providerNote}>
            <div className={accountStyles.providerNoteIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </div>
            <p>Password management is handled by your <strong>{PROVIDER_LABELS[user.app_metadata?.provider] || user.app_metadata?.provider}</strong> account. To change your password, update it through that provider.</p>
          </div>
        )}
        <div className={accountStyles.securityDangerZone}>
          <div className={accountStyles.dangerZoneLabel}>Session Management</div>
          <button className={accountStyles.dangerBtn} onClick={handleSignOutEverywhere} disabled={signingOut}>
            {signingOut ? "Signing out..." : "Sign out from all devices"}
          </button>
        </div>
      </section>

      <section className={`${styles.card} ${styles.wide}`}>
        <div className={styles.heading}>Linked Accounts</div>
        <div className={accountStyles.linkedList}>
          {linkedProviders.length > 0 ? linkedProviders.map((provider: string) => (
            <div key={provider} className={accountStyles.linkedItem}>
              <div className={accountStyles.linkedIcon}>{PROVIDER_SVG[provider] || provider[0]?.toUpperCase() || "?"}</div>
              <div className={accountStyles.linkedInfo}>
                <span className={accountStyles.linkedName}>{PROVIDER_LABELS[provider] || provider}</span>
                <span className={accountStyles.linkedStatus}>Connected</span>
              </div>
            </div>
          )) : (
            <div className={accountStyles.linkedEmpty}>No linked accounts</div>
          )}
        </div>
      </section>

      <section className={`${styles.card} ${accountStyles.dangerSection}`}>
        <div className={styles.heading}>Danger Zone</div>
        <div className={accountStyles.dangerContent}>
          <div className={accountStyles.dangerInfo}>
            <span className={accountStyles.dangerTitle}>Delete Account</span>
            <span className={accountStyles.dangerDesc}>Permanently delete your account and all associated data. This action cannot be undone.</span>
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
