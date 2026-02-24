"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ChallengeType = "direct" | "public";

export default function CreateChallengePage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  const [type, setType] = useState<ChallengeType>("public");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [proofRequirements, setProofRequirements] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [tags, setTags] = useState("");

  // direct only
  const [targetUsername, setTargetUsername] = useState("");

  // public only
  const [endsAtLocal, setEndsAtLocal] = useState(""); // datetime-local

  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) {
        router.replace("/login");
        return;
      }
      setUserId(u.id);
    })();
  }, [router]);

  const parsedTags = useMemo(() => {
    return tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }, [tags]);

  function endsAtToISO(): string | null {
    if (!endsAtLocal) return null;
    // datetime-local is interpreted in local time by the browser; new Date(...) converts to ISO UTC.
    const d = new Date(endsAtLocal);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!userId) return;

    if (!title.trim() || !description.trim()) {
      setStatus("Title and description are required.");
      return;
    }

    // Validate by type
    let targetUserId: string | null = null;
    let endsAtISO: string | null = null;

    if (type === "direct") {
      const uname = targetUsername.trim().toLowerCase();
      if (!uname) {
        setStatus("Target username is required for a direct challenge.");
        return;
      }

      const { data: target, error: targetErr } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("username", uname)
        .maybeSingle();

      if (targetErr) {
        setStatus("Error looking up user: " + targetErr.message);
        return;
      }
      if (!target) {
        setStatus("No user found with that username.");
        return;
      }

      targetUserId = target.id;

      // Optional sanity: prevent challenging yourself
      if (targetUserId === userId) {
        setStatus("You can’t challenge yourself (for now).");
        return;
      }
    }

    if (type === "public") {
      endsAtISO = endsAtToISO();
      if (!endsAtISO) {
        setStatus("Public challenges require an end date/time (ends_at).");
        return;
      }
    }

    setSaving(true);

    const payload: any = {
      creator_id: userId,
      type,
      title: title.trim(),
      description: description.trim(),
      rules: rules.trim() || null,
      proof_requirements: proofRequirements.trim() || null,
      difficulty,
      tags: parsedTags,
      target_user_id: targetUserId,
      ends_at: endsAtISO,
    };

    const { data, error } = await supabase
      .from("challenges")
      .insert(payload)
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      setStatus("Error creating challenge: " + error.message);
      return;
    }

    router.push(`/c/${data.id}`);
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Create a Challenge</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <label style={{ display: "block", fontWeight: 700 }}>
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ChallengeType)}
            style={{
              display: "block",
              marginTop: 6,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              width: "100%",
            }}
          >
            <option value="public">Public (open)</option>
            <option value="direct">Direct (challenge a user)</option>
          </select>
        </label>

        {type === "direct" && (
          <label style={{ display: "block", marginTop: 12, fontWeight: 700 }}>
            Target username
            <input
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              placeholder="e.g. jordan23"
              style={{
                display: "block",
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                width: "100%",
              }}
            />
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
              This will appear on your followers’ feed and their followers’ feed.
            </div>
          </label>
        )}

        {type === "public" && (
          <label style={{ display: "block", marginTop: 12, fontWeight: 700 }}>
            Ends at (required)
            <input
              type="datetime-local"
              value={endsAtLocal}
              onChange={(e) => setEndsAtLocal(e.target.value)}
              style={{
                display: "block",
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                width: "100%",
              }}
            />
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
              Winner is the most-liked video at this time (finalized once).
            </div>
          </label>
        )}

        <label style={{ display: "block", marginTop: 12, fontWeight: 700 }}>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Build a website"
            style={{
              display: "block",
              marginTop: 6,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              width: "100%",
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12, fontWeight: 700 }}>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What’s the challenge? What counts as success?"
            style={{
              display: "block",
              marginTop: 6,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              width: "100%",
              minHeight: 110,
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12, fontWeight: 700 }}>
          Rules (optional)
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="Any constraints? Time limit? Allowed tools?"
            style={{
              display: "block",
              marginTop: 6,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              width: "100%",
              minHeight: 80,
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12, fontWeight: 700 }}>
          Proof requirements (optional)
          <textarea
            value={proofRequirements}
            onChange={(e) => setProofRequirements(e.target.value)}
            placeholder="What must be shown in the video?"
            style={{
              display: "block",
              marginTop: 6,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              width: "100%",
              minHeight: 80,
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12, fontWeight: 700 }}>
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            style={{
              display: "block",
              marginTop: 6,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              width: "100%",
            }}
          >
            <option value={1}>1 - Easy</option>
            <option value={2}>2</option>
            <option value={3}>3 - Medium</option>
            <option value={4}>4</option>
            <option value={5}>5 - Hard</option>
          </select>
        </label>

        <label style={{ display: "block", marginTop: 12, fontWeight: 700 }}>
          Tags (comma separated)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="fitness, coding, creativity"
            style={{
              display: "block",
              marginTop: 6,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              width: "100%",
            }}
          />
        </label>

        <button
          disabled={saving}
          style={{
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #ddd",
            fontWeight: 800,
          }}
        >
          {saving ? "Publishing…" : "Publish Challenge"}
        </button>

        {status && <p style={{ marginTop: 12 }}>{status}</p>}
      </form>
    </main>
  );
}