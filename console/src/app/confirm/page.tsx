"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://sharktide-lightning.hf.space";

export default function ConfirmPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setLoading(false);
      setError("No session_id provided.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/stripe/reconcile/${sessionId}`);
        const json = await res.json();
        if (!json.ok) {
          setError("Unable to load payment details.");
        } else {
          setData(json);
        }
      } catch {
        setError("Error loading details.");
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className={styles.card}>
        <h2 className={styles.heading}>Loading...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.card}>
        <div className={styles.successHeader}>
          <div className={styles.brandInline}>
            <img src="/console/assets/logo.png" alt="InferencePort AI Logo" className={styles.brandImg} />
            <div className={styles.brandName}>InferencePort AI</div>
          </div>
          {!error.includes("session") && (
            <div className={styles.checkmark}>
              <svg viewBox="0 0 24 24" className={styles.checkmarkSvg}>
                <path d="M5 12.5 10 17 20 7" />
              </svg>
            </div>
          )}
        </div>
        <h2 className={styles.heading}>{error.includes("session") ? "Missing session" : "Payment Confirmed"}</h2>
        <p style={{ color: "var(--muted)" }}>{error}</p>
        <div className={styles.btnRow}>
          <a href="/console/" className={styles.btnLink}>Return to Dashboard</a>
        </div>
      </div>
    );
  }

  const pm = data.payment_method;

  return (
    <div className={styles.card}>
      <ConfettiScript />
      <div className={styles.successHeader}>
        <div className={styles.brandInline}>
          <img src="/console/assets/logo.png" alt="InferencePort AI Logo" className={styles.brandImg} />
          <div className={styles.brandName}>InferencePort AI</div>
        </div>
        <div className={styles.checkmark}>
          <svg viewBox="0 0 24 24" className={styles.checkmarkSvg}>
            <path d="M5 12.5 10 17 20 7" />
          </svg>
        </div>
      </div>
      <h2 className={styles.heading}>Payment Confirmed</h2>
      <p style={{ color: "var(--text)", marginBottom: "1rem" }}>Your credits will be added to your account shortly.</p>
      <div className={styles.receiptBox}>
        <div><span className={styles.label}>Product: </span>{data.product?.name || "Unknown"}</div>
        <div><span className={styles.label}>Amount: </span>{(data.amount_total / 100).toFixed(2)} {data.currency?.toUpperCase()}</div>
        <div><span className={styles.label}>Email: </span>{data.customer_email || "N/A"}</div>
        <div><span className={styles.label}>Payment Method: </span>{pm?.brand ? `${pm.brand.toUpperCase()} \u2022\u2022\u2022\u2022 ${pm.last4}` : "N/A"}</div>
      </div>
      <div className={styles.btnRow}>
        <a href="/console/" className={styles.btnLink}>Return to Dashboard</a>
        <a href="https://docs.inferenceport.ai" className={`${styles.btnLink} ${styles.btnLinkDocs}`}>View Docs</a>
      </div>
      <p style={{ color: "var(--muted)", marginTop: 30, fontSize: 12 }}>Contact us at <a href="mailto:inferenceportai@gmail.com">inferenceportai@gmail.com</a></p>
      <p style={{ color: "var(--muted)", marginTop: 15, fontSize: 10 }}>InferencePort AI partners with Stripe to provide invoicing and payment processing.</p>
      <p style={{ color: "var(--muted)", fontSize: 10 }}>&copy; 2026 InferencePort AI &middot; <a href="https://inferenceport.ai/security.html">Terms</a> &middot; <a href="https://inferenceport.ai/security.html">Privacy</a></p>
    </div>
  );
}

function ConfettiScript() {
  return (
    <>
      <canvas id="confetti-canvas" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 999 }} />
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var canvas = document.getElementById("confetti-canvas");
          if (!canvas) return;
          var ctx = canvas.getContext("2d");
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          var pieces = [];
          var colors = ["#1a6bff", "#60a5fa", "#f5c400", "#facc15"];
          for (var i = 0; i < 120; i++) {
            pieces.push({
              x: canvas.width / 2, y: canvas.height / 2,
              r: Math.random() * 6 + 4,
              c: colors[Math.floor(Math.random() * colors.length)],
              vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, a: 1
            });
          }
          function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            pieces.forEach(function(p) {
              ctx.globalAlpha = p.a;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
              ctx.fillStyle = p.c;
              ctx.fill();
              p.x += p.vx; p.y += p.vy; p.a -= 0.015;
            });
            if (pieces.some(function(p) { return p.a > 0; })) requestAnimationFrame(draw);
          }
          draw();
        })();
      ` }} />
    </>
  );
}
