"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "signin" | "signup";

function isValidUsername(u: string) {
  return /^[a-z0-9_]{3,20}$/.test(u);
}

// We use a synthetic email behind the scenes so Supabase Auth works
// without ever asking the user for an email.
function usernameToEmail(username: string) {
  return `${username}@thriver.local`;
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const u = useMemo(() => username.trim().toLowerCase(), [username]);
  const usernameOk = useMemo(() => isValidUsername(u), [u]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!usernameOk) {
      setStatus("Username must be 3–20 chars: a-z, 0-9, underscore.");
      return;
    }
    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      const email = usernameToEmail(u);

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setStatus(error.message);
          return;
        }
        window.location.href = "/feed";
        return;
      }

      // signup
      // 1) Check username availability first
      const { data: exists, error: existsErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", u)
        .maybeSingle();

      if (existsErr) {
        setStatus("Error checking username: " + existsErr.message);
        return;
      }
      if (exists) {
        setStatus("That username is taken.");
        return;
      }

      // 2) Create Supabase Auth user using synthetic email
      const { data: sign, error: signErr } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signErr) {
        setStatus(signErr.message);
        return;
      }

      const userId = sign.user?.id;
      if (!userId) {
        setStatus("Signup succeeded but no user returned. If email confirmation is ON, turn it OFF for now.");
        return;
      }

      // 3) Create profile row
      const { error: profErr } = await supabase.from("profiles").insert({
        id: userId,
        username: u,
      });

      if (profErr) {
        // If profile insert fails, sign out so the user isn't stuck half-created.
        await supabase.auth.signOut();
        setStatus("Could not create profile: " + profErr.message);
        return;
      }

      window.location.href = "/feed";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="th-screen" style={{ display: "grid", placeItems: "center", padding: 18 }}>
      <div className="th-card" style={{ width: "min(520px, 100%)", padding: 18 }}>
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
          {mode === "signin" ? "Welcome back." : "Create your account."}
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900 }}>Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. thriver_king"
              autoComplete="username"
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
            {!usernameOk && username.trim().length > 0 && (
              <div className="th-muted" style={{ fontSize: 12 }}>
                Use 3–20 chars: a-z, 0-9, underscore.
              </div>
            )}
          </label>

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

          <button
            className="th-btn th-accent"
            disabled={busy}
            style={{ marginTop: 4, padding: "12px 14px", borderRadius: 12, fontWeight: 1000 }}
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
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

        <div className="th-muted" style={{ marginTop: 14, fontSize: 12, lineHeight: 1.35 }}>
          Note: turn <b>Confirm email</b> OFF in Supabase Auth to avoid email rate limits during MVP.
        </div>
      </div>
    </main>
  );
}
