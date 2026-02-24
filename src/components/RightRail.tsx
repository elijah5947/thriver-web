"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CommentsPanel from "./CommentsPanel";

export default function RightRail({
  mode,
  attemptId,
  challengeId,
}: {
  mode: "video" | "challengeBlock";
  attemptId?: string;
  challengeId?: string; // when showing challenge block, you can pin actions to the first challenge
}) {
  const [me, setMe] = useState<string | null>(null);

  // micro-interaction bursts
  const [likeBurst, setLikeBurst] = useState(false);
  const [hypeBurst, setHypeBurst] = useState(false);

  const [likeCount, setLikeCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);

  const [hypeCount, setHypeCount] = useState(0);
  const [hasHyped, setHasHyped] = useState(false);

  const [showComments, setShowComments] = useState(false);

  // Determine which challenge we hype:
  const [resolvedChallengeId, setResolvedChallengeId] = useState<string | null>(challengeId ?? null);

  async function resolveChallengeFromAttempt(aid: string) {
    const { data } = await supabase.from("attempts").select("challenge_id").eq("id", aid).single();
    return data?.challenge_id ?? null;
  }

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id ?? null;
    setMe(uid);

    // Resolve challenge id for video mode
    let cid = challengeId ?? null;
    if (mode === "video" && attemptId) cid = await resolveChallengeFromAttempt(attemptId);
    setResolvedChallengeId(cid);

    // Likes
    if (mode === "video" && attemptId) {
      const { count } = await supabase
        .from("attempt_likes")
        .select("*", { count: "exact", head: true })
        .eq("attempt_id", attemptId);
      setLikeCount(count ?? 0);

      if (uid) {
        const { data: mine } = await supabase
          .from("attempt_likes")
          .select("attempt_id")
          .eq("attempt_id", attemptId)
          .eq("liker_id", uid)
          .maybeSingle();
        setHasLiked(!!mine);
      } else {
        setHasLiked(false);
      }
    } else {
      setLikeCount(0);
      setHasLiked(false);
    }

    // Hype (challenge)
    if (cid) {
      const { data: c } = await supabase.from("challenges").select("hype_count").eq("id", cid).single();
      setHypeCount(c?.hype_count ?? 0);

      if (uid) {
        const { data: hv } = await supabase
          .from("challenge_hype_votes")
          .select("challenge_id")
          .eq("challenge_id", cid)
          .eq("voter_id", uid)
          .maybeSingle();
        setHasHyped(!!hv);
      } else {
        setHasHyped(false);
      }
    } else {
      setHypeCount(0);
      setHasHyped(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, attemptId, challengeId]);

  async function toggleLike() {
    if (!me || !attemptId) return;
    if (hasLiked) {
      await supabase.from("attempt_likes").delete().eq("attempt_id", attemptId).eq("liker_id", me);
    } else {
      await supabase.from("attempt_likes").insert({ attempt_id: attemptId, liker_id: me });
    }
    setLikeBurst(true);
    setTimeout(() => setLikeBurst(false), 220);
    await load();
  }

  async function toggleHype() {
    if (!me || !resolvedChallengeId) return;
    if (hasHyped) {
      await supabase
        .from("challenge_hype_votes")
        .delete()
        .eq("challenge_id", resolvedChallengeId)
        .eq("voter_id", me);
    } else {
      await supabase.from("challenge_hype_votes").insert({ challenge_id: resolvedChallengeId, voter_id: me });
    }
    setHypeBurst(true);
    setTimeout(() => setHypeBurst(false), 260);
    await load();
  }

  const commentsEntityType = mode === "video" ? "attempt" : "challenge";
  const commentsEntityId = mode === "video" ? attemptId : resolvedChallengeId;

  return (
    <>
      <div className="th-actions">
        {/* Hype */}
        <div style={{ textAlign: "center" }}>
          <div
            className={`th-actionBtn ${hasHyped ? "th-actionBtnActive" : ""} ${hypeBurst ? "th-glow th-pop" : ""}`}
            onClick={toggleHype}
            title={me ? "Hype this challenge" : "Log in to hype"}
            style={{ pointerEvents: resolvedChallengeId ? "auto" : "none", opacity: resolvedChallengeId ? 1 : 0.45 }}
          >
            🔥
          </div>
          <div className="th-actionCount">{hypeCount}</div>
        </div>

        {/* Like (videos only) */}
        {mode === "video" && (
          <div style={{ textAlign: "center" }}>
            <div
              className={`th-actionBtn ${hasLiked ? "th-actionBtnActive" : ""} ${likeBurst ? "th-pop" : ""}`}
              onClick={toggleLike}
              title={me ? "Like this submission" : "Log in to like"}
            >
              ❤️
            </div>
            <div className="th-actionCount">{likeCount}</div>
          </div>
        )}

        {/* Comments */}
        <div style={{ textAlign: "center" }}>
          <div className="th-actionBtn" onClick={() => setShowComments(true)} title="Comments">
            💬
          </div>
          <div className="th-actionCount"> </div>
        </div>
      </div>

      {showComments && commentsEntityId && (
        <CommentsPanel
          entityType={commentsEntityType as any}
          entityId={commentsEntityId}
          onClose={() => setShowComments(false)}
        />
      )}
    </>
  );
}