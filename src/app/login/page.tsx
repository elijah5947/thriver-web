"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "signin" | "signup" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const emailOk = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");

    const e2 = email.trim().toLowerCase();
    if (!emailOk) {
      setStatus("Enter a valid email.");
      return;
    }

    if (mode !== "reset" && password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: e2,
          password,
        });
        if (error) {
          setStatus(error.message);
          return;
        }
        setStatus("Signed in ✅");
        // Most apps route to feed
        window.location.href = "/feed";
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: e2,
          password,
          // If you enable email confirmation in Supabase, this helps direct users back.
          options: { emailRedirectTo: `${window.location.origin}/feed` },
        });
        if (error) {
          setStatus(error.message);
          return;
        }
        // Depending on your Supabase settings, user may be signed in immediately or need to confirm.
        setStatus("Account created ✅ (If email confirmation is on, check your inbox.)");
        window.location.href = "/feed";
        return;
      }

      // reset password
      const { error } = await supabase.auth.resetPasswordForEmail(e2, {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus("Password reset email sent ✅");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="th-screen"
      style={{
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
    >
      <div
        className="th-card"
        style={{
          width: "min(520px, 100%)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000, letterSpacing: 0.2 }}>
            Thriver<span style={{ color: "var(--accent)" }}>.</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`th-pill ${mode === "signin" ? "th-accent" : ""}`}
              onClick={() => {
                setMode("signin");
                setStatus("");
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`th-pill ${mode === "signup" ? "th-accent" : ""}`}
              onClick={() => {
                setMode("signup");
                setStatus("");
              }}
              type="button"
            >
              Sign up
            </button>
          </div>
        </div>

        <div className="th-muted" style={{ marginTop: 8 }}>
          {mode === "signin" ? "Welcome back." : mode === "signup" ? "Create your account." : "Reset your password."}
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900 }}>Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              inputMode="email"
              autoComplete="email"
              className="th-input"
              style={{
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.25)",
                color: "white",
                outline: "none",
              }}
            />
          </label>

          {mode !== "reset" && (
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900 }}>Password</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="th-input"
                style={{
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                  outline: "none",
                }}
              />
            </label>
          )}

          <button
            className="th-btn th-accent"
            disabled={busy}
            style={{ marginTop: 4, padding: "12px 14px", borderRadius: 12, fontWeight: 1000 }}
          >
            {busy
              ? "Working…"
              : mode === "signin"
              ? "Sign in"
              : mode === "signup"
              ? "Create account"
              : "Send reset email"}
          </button>

          {mode !== "reset" && (
            <button
              type="button"
              className="th-btn"
              style={{ padding: "10px 14px", borderRadius: 12 }}
              onClick={() => {
                setMode("reset");
                setStatus("");
              }}
            >
              Forgot password?
            </button>
          )}

          {mode === "reset" && (
            <button
              type="button"
              className="th-btn"
              style={{ padding: "10px 14px", borderRadius: 12 }}
              onClick={() => {
                setMode("signin");
                setStatus("");
              }}
            >
              Back to sign in
            </button>
          )}
        </form>

        {status && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {status}
          </div>
        )}
      </div>
    </main>
  );
}
