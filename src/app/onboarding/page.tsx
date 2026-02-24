"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function isValidUsername(u: string) {
  return /^[a-z0-9_]{3,20}$/.test(u);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.session.user.id);

      // If profile already exists, skip onboarding
      const { data: prof } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (prof?.username) router.replace("/feed");
    })();
  }, [router]);

  async function createProfile(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    const u = username.trim().toLowerCase();
    if (!isValidUsername(u)) {
      setStatus("Username must be 3–20 chars: a-z, 0-9, underscore.");
      return;
    }
    if (!userId) return;

    setLoading(true);

    const { error } = await supabase.from("profiles").insert({
      id: userId,
      username: u,
    });

    setLoading(false);

    if (error) {
      // unique violation shows as 23505 typically
      if (String(error.code) === "23505" || error.message.toLowerCase().includes("duplicate")) {
        setStatus("That username is taken.");
      } else {
        setStatus("Error: " + error.message);
      }
      return;
    }

    router.replace("/feed");
  }

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Choose a username</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Username/anon for now. You can change this later.
      </p>

      <form onSubmit={createProfile} style={{ marginTop: 16 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. thriver_king"
          style={{
            width: "100%",
            padding: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 12,
            background: "rgba(0,0,0,0.20)",
            color: "white",
            outline: "none",
          }}
        />
        <button
          disabled={loading}
          className="th-btn th-accent"
          style={{
            marginTop: 12,
            width: "100%",
            padding: 12,
            borderRadius: 12,
            fontWeight: 1000,
          }}
        >
          {loading ? "Creating…" : "Continue"}
        </button>
      </form>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </main>
  );
}
