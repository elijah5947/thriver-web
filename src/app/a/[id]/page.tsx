"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Attempt = {
  id: string;
  challenge_id: string;
  user_id: string;
  video_path: string;
  status: string;
  created_at: string;
  is_rewarded: boolean;
  awarded_hype: number;
  challenges: {
    id: string;
    type: "direct" | "public";
    title: string;
    hype_count: number;
    target_user_id: string | null;
    ends_at: string | null;
    is_finalized: boolean;
    winner_attempt_id: string | null;
  }[];
};

export default function AttemptPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [me, setMe] = useState<{ id: string } | null>(null);

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading…");

  // public like state
  const [likeCount, setLikeCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);

  // direct completion vote state
  const [myCompletionVote, setMyCompletionVote] = useState<boolean | null>(null);
  const [yesCount, setYesCount] = useState(0);
  const [noCount, setNoCount] = useState(0);

  const completePct = useMemo(() => {
    const total = yesCount + noCount;
    if (!total) return 0;
    return Math.round((yesCount / total) * 100);
  }, [yesCount, noCount]);

  async function refreshCounts(att: Attempt) {
    // Public likes
    if (att.challenges?.[0]?.type === "public") {
      const { count } = await supabase
        .from("attempt_likes")
        .select("*", { count: "exact", head: true })
        .eq("attempt_id", att.id);
      setLikeCount(count ?? 0);

      if (me) {
        const { data: myLike } = await supabase
          .from("attempt_likes")
          .select("attempt_id")
          .eq("attempt_id", att.id)
          .eq("liker_id", me.id)
          .maybeSingle();
        setHasLiked(!!myLike);
      } else {
        setHasLiked(false);
      }
    }

    // Direct completion votes
    if (att.challenges?.[0]?.type === "direct") {
      const { count: y } = await supabase
        .from("completion_votes")
        .select("*", { count: "exact", head: true })
        .eq("attempt_id", att.id)
        .eq("is_complete", true);

      const { count: n } = await supabase
        .from("completion_votes")
        .select("*", { count: "exact", head: true })
        .eq("attempt_id", att.id)
        .eq("is_complete", false);

      setYesCount(y ?? 0);
      setNoCount(n ?? 0);

      if (me) {
        const { data: myVote } = await supabase
          .from("completion_votes")
          .select("is_complete")
          .eq("attempt_id", att.id)
          .eq("voter_id", me.id)
          .maybeSingle();

        setMyCompletionVote(myVote ? myVote.is_complete : null);
      } else {
        setMyCompletionVote(null);
      }
    }
  }

  async function load() {
    if (!id) return;

    setStatus("Loading…");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user ?? null;
    setMe(user ? { id: user.id } : null);

    // Load attempt + challenge
    const { data, error } = await supabase
      .from("attempts")
      .select(
        "id,challenge_id,user_id,video_path,status,created_at,is_rewarded,awarded_hype, challenges(id,type,title,hype_count,target_user_id,ends_at,is_finalized,winner_attempt_id)"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      setStatus("Attempt not found.");
      setAttempt(null);
      return;
    }

    const att = data as unknown as Attempt;
    setAttempt(att);

    const { data: pub } = supabase.storage.from("videos").getPublicUrl(att.video_path);
    setVideoUrl(pub.publicUrl);

    await refreshCounts(att);

    setStatus("OK");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleLike() {
    if (!attempt) return;
    if (!me) {
      setStatus("Log in to like.");
      return;
    }

    if (hasLiked) {
      await supabase
        .from("attempt_likes")
        .delete()
        .eq("attempt_id", attempt.id)
        .eq("liker_id", me.id);
    } else {
      await supabase.from("attempt_likes").insert({
        attempt_id: attempt.id,
        liker_id: me.id,
      });
    }

    await load();
  }

  async function setCompletionVote(isComplete: boolean) {
    if (!attempt) return;
    if (!me) {
      setStatus("Log in to vote completion.");
      return;
    }

    // Upsert because (attempt_id, voter_id) is primary key
    const { error } = await supabase.from("completion_votes").upsert(
      {
        attempt_id: attempt.id,
        voter_id: me.id,
        is_complete: isComplete,
      },
      { onConflict: "attempt_id,voter_id" }
    );

    if (error) {
      setStatus("Vote error: " + error.message);
      return;
    }

    // Your trigger will award/revoke automatically based on >50% yes.
    await load();
  }

  if (!attempt) {
    return <main style={{ padding: 24 }}>{status}</main>;
  }

  const ch = attempt.challenges?.[0] ?? null;
  const isWinner =
    ch?.type === "public" && ch.is_finalized && ch.winner_attempt_id === attempt.id;

  return (
    <main style={{ padding: 24, maxWidth: 860 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Attempt</h1>
          {ch && (
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              Challenge:{" "}
              <Link href={`/c/${attempt.challenge_id}`} style={{ fontWeight: 900 }}>
                {ch.title}
              </Link>{" "}
              · Type: <strong>{ch.type}</strong>
              {ch.type === "public" && ch.ends_at && (
                <>
                  {" "}
                  · Ends: <strong>{new Date(ch.ends_at).toLocaleString()}</strong>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ paddingTop: 2 }}>
          <Link
            href={`/c/${attempt.challenge_id}`}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontWeight: 900,
              display: "inline-block",
            }}
          >
            ← Back
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {videoUrl ? (
          <video controls style={{ width: "100%", borderRadius: 12 }}>
            <source src={videoUrl} />
          </video>
        ) : (
          <p>Loading video…</p>
        )}
      </div>

      {/* PUBLIC: likes */}
      {ch?.type === "public" && (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={toggleLike}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontWeight: 900,
              background: hasLiked ? "#111" : "white",
              color: hasLiked ? "white" : "black",
            }}
          >
            {hasLiked ? "❤️ Liked" : "❤️ Like"}
          </button>
          <div style={{ fontWeight: 900 }}>{likeCount} like{likeCount === 1 ? "" : "s"}</div>

          {isWinner && (
            <div style={{ marginLeft: 10, fontWeight: 900 }}>
              🏆 Winner (awarded {ch.hype_count} hype)
            </div>
          )}
        </div>
      )}

      {/* DIRECT: completion voting */}
      {ch?.type === "direct" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 900 }}>Validate completion</div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setCompletionVote(true)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                fontWeight: 900,
                background: myCompletionVote === true ? "#111" : "white",
                color: myCompletionVote === true ? "white" : "black",
              }}
            >
              ✅ Completed
            </button>
            <button
              onClick={() => setCompletionVote(false)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                fontWeight: 900,
                background: myCompletionVote === false ? "#111" : "white",
                color: myCompletionVote === false ? "white" : "black",
              }}
            >
              ❌ Not completed
            </button>

            <div style={{ paddingTop: 10, fontWeight: 900 }}>
              {completePct}% yes ({yesCount} ✅ / {noCount} ❌)
            </div>
          </div>

          <div style={{ marginTop: 10, opacity: 0.85 }}>
            Rule: if yes% is <strong>over 50%</strong>, user earns the challenge’s hype.
            If it drops to <strong>50% or below</strong>, they lose it.
          </div>

          <div style={{ marginTop: 10 }}>
            Rewarded: <strong>{attempt.is_rewarded ? "Yes" : "No"}</strong>
            {attempt.is_rewarded && (
              <>
                {" "}
                · Award snapshot: <strong>{attempt.awarded_hype}</strong> hype
              </>
            )}
          </div>
        </div>
      )}

      {status !== "OK" && <p style={{ marginTop: 12 }}>{status}</p>}
    </main>
  );
}