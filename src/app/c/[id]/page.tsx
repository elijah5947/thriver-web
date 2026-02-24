"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Challenge = {
  id: string;
  creator_id: string;
  type: "direct" | "public";
  target_user_id: string | null;
  title: string;
  description: string;
  rules: string | null;
  proof_requirements: string | null;
  difficulty: number;
  tags: string[];
  hype_count: number;
  ends_at: string | null;
  is_finalized: boolean;
  finalized_at: string | null;
  winner_attempt_id: string | null;
  created_at: string;
};

type AttemptRow = {
  id: string;
  user_id: string;
  created_at: string;
  status: string;
  is_rewarded: boolean;
  awarded_hype: number;
};

export default function ChallengePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [me, setMe] = useState<{ id: string } | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptLikes, setAttemptLikes] = useState<Record<string, number>>({});

  const [hasHyped, setHasHyped] = useState(false);
  const [status, setStatus] = useState("Loading…");
  const [busy, setBusy] = useState(false);

  const isEnded = useMemo(() => {
    if (!challenge?.ends_at) return false;
    return new Date(challenge.ends_at).getTime() <= Date.now();
  }, [challenge?.ends_at]);

  async function load() {
    if (!id) return;

    setStatus("Loading…");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user ?? null;
    setMe(user ? { id: user.id } : null);

    const { data: c, error: cErr } = await supabase
      .from("challenges")
      .select(
        "id,creator_id,type,target_user_id,title,description,rules,proof_requirements,difficulty,tags,hype_count,ends_at,is_finalized,finalized_at,winner_attempt_id,created_at"
      )
      .eq("id", id)
      .single();

    if (cErr || !c) {
      setStatus("Error: " + (cErr?.message ?? "Challenge not found"));
      setChallenge(null);
      return;
    }
    setChallenge(c);

    // Has viewer hyped?
    if (user) {
      const { data: vote } = await supabase
        .from("challenge_hype_votes")
        .select("challenge_id")
        .eq("challenge_id", id)
        .eq("voter_id", user.id)
        .maybeSingle();
      setHasHyped(!!vote);
    } else {
      setHasHyped(false);
    }

    // Load attempts
    const { data: atts, error: aErr } = await supabase
      .from("attempts")
      .select("id,user_id,created_at,status,is_rewarded,awarded_hype")
      .eq("challenge_id", id)
      .order("created_at", { ascending: false });

    if (aErr) {
      setStatus("Error loading attempts: " + aErr.message);
      setAttempts([]);
      return;
    }

    const attemptList = (atts ?? []) as AttemptRow[];
    setAttempts(attemptList);

    // If public, show like counts for each attempt
    if (c.type === "public" && attemptList.length) {
      const counts: Record<string, number> = {};
      // Small MVP loop; later replace with a single RPC / view.
      for (const a of attemptList) {
        const { count } = await supabase
          .from("attempt_likes")
          .select("*", { count: "exact", head: true })
          .eq("attempt_id", a.id);
        counts[a.id] = count ?? 0;
      }
      setAttemptLikes(counts);
    } else {
      setAttemptLikes({});
    }

    setStatus("OK");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleHype() {
    if (!id) return;

    // Require auth to hype
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      setStatus("Log in to hype challenges.");
      return;
    }

    setBusy(true);

    if (hasHyped) {
      await supabase
        .from("challenge_hype_votes")
        .delete()
        .eq("challenge_id", id)
        .eq("voter_id", user.id);
    } else {
      await supabase.from("challenge_hype_votes").insert({
        challenge_id: id,
        voter_id: user.id,
      });
    }

    setBusy(false);
    await load();
  }

  async function finalizePublicChallenge() {
    if (!challenge) return;
    if (challenge.type !== "public") return;

    setBusy(true);
    const { error } = await supabase.rpc("finalize_public_challenge", {
      p_challenge_id: challenge.id,
    });
    setBusy(false);

    if (error) {
      setStatus("Finalize error: " + error.message);
      return;
    }

    await load();
  }

  if (!challenge) {
    return <main style={{ padding: 24 }}>{status}</main>;
  }

  const canUpload =
    !!me &&
    (challenge.type === "public" ||
      (challenge.type === "direct" && challenge.target_user_id === me.id));

  const canFinalize =
    !!me &&
    challenge.type === "public" &&
    me.id === challenge.creator_id &&
    !!challenge.ends_at &&
    isEnded &&
    !challenge.is_finalized;

  return (
    <main style={{ padding: 24, maxWidth: 860 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900 }}>{challenge.title}</h1>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            Type: <strong>{challenge.type}</strong> · Difficulty:{" "}
            <strong>{challenge.difficulty}</strong>
            {challenge.type === "public" && challenge.ends_at && (
              <>
                {" "}
                · Ends: <strong>{new Date(challenge.ends_at).toLocaleString()}</strong>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "start", gap: 10 }}>
          <button
            onClick={toggleHype}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontWeight: 900,
              background: hasHyped ? "#111" : "white",
              color: hasHyped ? "white" : "black",
            }}
          >
            {hasHyped ? "🔥 Hyped" : "🔥 Hype"}
          </button>

          <div style={{ paddingTop: 10, fontWeight: 800 }}>
            {challenge.hype_count} Hype
          </div>
        </div>
      </div>

      <p style={{ marginTop: 14 }}>{challenge.description}</p>

      {challenge.rules && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900 }}>Rules</div>
          <div style={{ marginTop: 6, opacity: 0.9 }}>{challenge.rules}</div>
        </div>
      )}

      {challenge.proof_requirements && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900 }}>Proof requirements</div>
          <div style={{ marginTop: 6, opacity: 0.9 }}>{challenge.proof_requirements}</div>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {challenge.tags?.map((t) => (
          <span
            key={t}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #eee",
              fontSize: 12,
              fontWeight: 700,
              opacity: 0.9,
            }}
          >
            #{t}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {canUpload ? (
          <Link
            href={`/upload/${challenge.id}`}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontWeight: 900,
              display: "inline-block",
            }}
          >
            + Upload attempt
          </Link>
        ) : (
          <span style={{ opacity: 0.7, fontSize: 13 }}>
            {challenge.type === "direct"
              ? "Only the challenged user can upload an attempt."
              : "Log in to upload an attempt."}
          </span>
        )}

        {canFinalize && (
          <button
            onClick={finalizePublicChallenge}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontWeight: 900,
            }}
          >
            🏁 Finalize (pick winner)
          </button>
        )}

        {challenge.type === "public" && challenge.is_finalized && (
          <span style={{ paddingTop: 10, fontWeight: 800 }}>
            Finalized ✅
          </span>
        )}
      </div>

      <hr style={{ margin: "22px 0", border: "none", borderTop: "1px solid #eee" }} />

      <h2 style={{ fontSize: 18, fontWeight: 900 }}>Attempts</h2>

      {attempts.length === 0 ? (
        <p style={{ marginTop: 10, opacity: 0.8 }}>No attempts yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
          {attempts.map((a) => {
            const likes = attemptLikes[a.id] ?? 0;
            const isWinner =
              challenge.type === "public" &&
              challenge.is_finalized &&
              challenge.winner_attempt_id === a.id;

            return (
              <li
                key={a.id}
                style={{
                  padding: 12,
                  border: "1px solid #eee",
                  borderRadius: 12,
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>
                  <Link href={`/a/${a.id}`} style={{ fontWeight: 900 }}>
                    View attempt →
                  </Link>

                  <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
                    {challenge.type === "public" ? (
                      <>
                        ❤️ {likes} like{likes === 1 ? "" : "s"}
                        {isWinner && (
                          <span style={{ marginLeft: 10, fontWeight: 900 }}>
                            🏆 Winner
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        Rewarded:{" "}
                        <strong>{a.is_rewarded ? "Yes" : "No"}</strong>
                        {a.is_rewarded && (
                          <>
                            {" "}
                            · Award: <strong>{a.awarded_hype}</strong> hype
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {status !== "OK" && <p style={{ marginTop: 12 }}>{status}</p>}
    </main>
  );
}