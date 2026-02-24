

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import RightRail from "@/components/RightRail";
import FollowButton from "@/components/FollowButton";

type Tab = "for_you" | "following";

type AttemptRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  caption: string | null;
  video_path: string;
  like_count: number;
  created_at: string;
  challenges?: { title: string } | null;
};

type ChallengeRow = {
  id: string;
  title: string;
  description: string;
  hype_count: number;
  ends_at: string | null;
  created_at: string;
};

type FeedUnit =
  | { kind: "video"; attemptId: string }
  | { kind: "challengeBlock"; challengeIds: string[] };

export default function FeedPage() {
  const [me, setMe] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("for_you");

  const [units, setUnits] = useState<FeedUnit[]>([]);
  const [index, setIndex] = useState(0);

  const [attempts, setAttempts] = useState<Record<string, AttemptRow>>({});
  const [challenges, setChallenges] = useState<Record<string, ChallengeRow>>({});
  const [profiles, setProfiles] = useState<Record<string, { username: string | null }>>({});

  const lockRef = useRef(false);
  const current = units[index] ?? null;

  const currentVideo = useMemo(() => {
    if (!current || current.kind !== "video") return null;
    return attempts[current.attemptId] ?? null;
  }, [current, attempts]);

  const currentChallengeBlock = useMemo(() => {
    if (!current || current.kind !== "challengeBlock") return null;
    return current.challengeIds.map((id) => challenges[id]).filter(Boolean) as ChallengeRow[];
  }, [current, challenges]);

  // Preload the next video (helps transitions feel instant)
  const nextVideoSrc = useMemo(() => {
    for (let j = index + 1; j < units.length; j++) {
      const u = units[j];
      if (u.kind !== "video") continue;
      const nextAttempt = attempts[u.attemptId];
      if (!nextAttempt) return null;
      const { data: pub } = supabase.storage.from("videos").getPublicUrl(nextAttempt.video_path);
      return pub.publicUrl;
    }
    return null;
  }, [index, units, attempts]);

  function step(delta: number) {
    if (lockRef.current) return;
    lockRef.current = true;
    setTimeout(() => (lockRef.current = false), 220);
    setIndex((i) => Math.max(0, Math.min(units.length - 1, i + delta)));
  }

  // Arrow keys + PageUp/PageDown + Space
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        step(+1);
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        step(-1);
      }
    }
    window.addEventListener("keydown", onKey, { passive: false } as any);
    return () => window.removeEventListener("keydown", onKey as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units.length]);

  // Scroll wheel navigation (feels like swipe)
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) < 18) return;
      e.preventDefault();
      step(e.deltaY > 0 ? +1 : -1);
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units.length]);

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) return;
    setMe(user.id);

    // Attempts
    const attemptRpc = tab === "for_you" ? "get_video_feed_for_you" : "get_video_feed_following";
    const { data: attemptRaw, error: aErr } = await supabase.rpc(attemptRpc, {
      p_viewer_id: user.id,
      p_limit: 70,
    });
    if (aErr) throw new Error(aErr.message);

    const attemptIds: string[] = (attemptRaw ?? []).map((r: any) => String(r.attempt_id));

    // Challenges (blocks)
    const challengeRpc = tab === "for_you" ? "get_public_challenges_for_you" : "get_public_challenges_following";
    const { data: challRaw, error: cErr } = await supabase.rpc(challengeRpc, {
      p_viewer_id: user.id,
      p_limit: 60,
    });
    if (cErr) throw new Error(cErr.message);

    const challengeIds: string[] = (challRaw ?? []).map((r: any) => String(r.challenge_id));

    // Build units: every 4 videos insert 3-challenge block
    const built: FeedUnit[] = [];
    let chIdx = 0;

    for (let i = 0; i < attemptIds.length; i++) {
      built.push({ kind: "video", attemptId: attemptIds[i] });

      if ((i + 1) % 4 === 0 && chIdx < challengeIds.length) {
        const block = challengeIds.slice(chIdx, chIdx + 3);
        if (block.length) built.push({ kind: "challengeBlock", challengeIds: block });
        chIdx += 3;
      }
    }

    setUnits(built);
    setIndex(0);

    // Fetch attempt details (NO implicit join to challenges)
    const uniqueAttemptIds = Array.from(new Set(attemptIds)).slice(0, 70);
    let userIds: string[] = [];

    if (uniqueAttemptIds.length) {
      const { data: aRows, error: aRowsErr } = await supabase
        .from("attempts")
        .select("id,challenge_id,user_id,caption,video_path,like_count,created_at")
        .in("id", uniqueAttemptIds);

      if (aRowsErr) throw new Error(aRowsErr.message);

      // Fetch challenge titles for those attempts
      const challengeIdsFromAttempts = Array.from(
        new Set((aRows ?? []).map((a: any) => a.challenge_id))
      ).filter(Boolean);

      const titleMap: Record<string, { title: string }> = {};
      if (challengeIdsFromAttempts.length) {
        const { data: ctRows, error: ctErr } = await supabase
          .from("challenges")
          .select("id,title")
          .in("id", challengeIdsFromAttempts);

        if (ctErr) throw new Error(ctErr.message);

        (ctRows ?? []).forEach((c: any) => {
          titleMap[c.id] = { title: c.title };
        });
      }

      const map: Record<string, AttemptRow> = {};
      (aRows ?? []).forEach((a: any) => {
        map[a.id] = {
          ...a,
          challenges: titleMap[a.challenge_id] ?? null,
        };
      });
      setAttempts(map);

      userIds = Array.from(new Set((aRows ?? []).map((a: any) => a.user_id))).filter(Boolean);
    } else {
      setAttempts({});
    }

    // Fetch usernames for overlay
    if (userIds.length) {
      const { data: pRows, error: pErr } = await supabase
        .from("profiles")
        .select("id,username")
        .in("id", userIds);

      if (pErr) throw new Error(pErr.message);

      const pmap: Record<string, { username: string | null }> = {};
      (pRows ?? []).forEach((p: any) => (pmap[p.id] = { username: p.username ?? null }));
      setProfiles(pmap);
    } else {
      setProfiles({});
    }

    // Fetch challenge details for blocks
    const uniqueChallengeIds = Array.from(new Set(challengeIds)).slice(0, 70);
    if (uniqueChallengeIds.length) {
      const { data: cRows, error: cRowsErr } = await supabase
        .from("challenges")
        .select("id,title,description,hype_count,ends_at,created_at")
        .in("id", uniqueChallengeIds);

      if (cRowsErr) throw new Error(cRowsErr.message);

      const map: Record<string, ChallengeRow> = {};
      (cRows ?? []).forEach((c: any) => (map[c.id] = c));
      setChallenges(map);
    } else {
      setChallenges({});
    }
  }

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) return;
      setMe(user.id);

      try {
        await load();
      } catch (e: any) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!me) {
    return (
      <main style={{ padding: 24 }}>
        <p>Log in to view your feed.</p>
        <Link href="/login" className="th-btn th-accent">
          Go to login →
        </Link>
      </main>
    );
  }

  return (
    <main>
      <div className="th-header" style={{ height: 70 }}>
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            height: 70,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 1000, letterSpacing: 0.2 }}>
              Thriver<span style={{ color: "var(--accent)" }}>.</span>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className={`th-pill ${tab === "for_you" ? "th-accent" : ""}`} onClick={() => setTab("for_you")}>
                For You
              </button>
              <button
                className={`th-pill ${tab === "following" ? "th-accent" : ""}`}
                onClick={() => setTab("following")}
              >
                Following
              </button>
            </div>

            <div className="th-muted" style={{ fontSize: 12 }}>
              Tip: ↑/↓ or scroll
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/create" className="th-btn th-accent">
              + Create
            </Link>
          </div>
        </div>
      </div>

      <div className="th-screen" style={{ position: "relative" }}>
        {!current ? (
          <div className="th-card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>No items yet</div>
            <div className="th-muted" style={{ marginTop: 8 }}>
              Follow someone or create a challenge.
            </div>
          </div>
        ) : current.kind === "video" ? (
          <div style={{ position: "relative" }}>
            <VideoUnit
              attempt={currentVideo}
              username={currentVideo ? profiles[currentVideo.user_id]?.username ?? null : null}
              onEnded={() => step(+1)}
              preloadSrc={nextVideoSrc}
            />
            <RightRail mode="video" attemptId={current.attemptId} />
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <ChallengeBlockUnit challenges={currentChallengeBlock} />
            <RightRail mode="challengeBlock" challengeId={current.challengeIds[0]} />
          </div>
        )}
      </div>
    </main>
  );
}

function VideoUnit({
  attempt,
  username,
  onEnded,
  preloadSrc,
}: {
  attempt: AttemptRow | null;
  username: string | null;
  onEnded: () => void;
  preloadSrc: string | null;
}) {
  if (!attempt) return <div className="th-muted">Loading video…</div>;

  const { data: pub } = supabase.storage.from("videos").getPublicUrl(attempt.video_path);

  const title = attempt.challenges?.title ?? "Challenge";
  const caption = (attempt.caption ?? "").trim();
  const handle = (username ?? attempt.user_id.slice(0, 6)).replace(/^@/, "");

  return (
    <div className="th-enter" style={{ display: "grid", justifyItems: "center", gap: 12, position: "relative" }}>
      <div className="th-video" style={{ position: "relative" }}>
        <video controls autoPlay playsInline onEnded={onEnded}>
          <source src={pub.publicUrl} />
        </video>

        {/* bottom gradient for readability (NO boxes) */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "52%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.86), rgba(0,0,0,0.30), rgba(0,0,0,0.00))",
            pointerEvents: "none",
          }}
        />

        {/* Floating overlay (NO BOXES) */}
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 86, // keep clear of right action stack
            bottom: 18,
            display: "grid",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, pointerEvents: "auto" }}>
            <div
              style={{
                fontWeight: 1000,
                letterSpacing: 0.2,
                fontSize: 14,
                color: "rgba(255,255,255,0.92)",
                textShadow: "0 2px 18px rgba(0,0,0,0.85)",
              }}
            >
              @{handle}
            </div>
            <div style={{ pointerEvents: "auto" }}>
              <FollowButton targetUserId={attempt.user_id} />
            </div>
          </div>

          <div
            style={{
              fontWeight: 1000,
              fontSize: 18,
              lineHeight: 1.08,
              color: "rgba(255,255,255,0.96)",
              textShadow: "0 2px 22px rgba(0,0,0,0.9)",
            }}
          >
            {title}
          </div>

          {caption && (
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                lineHeight: 1.25,
                color: "rgba(255,255,255,0.86)",
                textShadow: "0 2px 18px rgba(0,0,0,0.85)",
              }}
            >
              {caption}
            </div>
          )}
        </div>
      </div>

      {/* Preload next */}
      {preloadSrc && (
        <video
          preload="auto"
          muted
          playsInline
          style={{ width: 1, height: 1, position: "absolute", left: -9999, top: -9999 }}
        >
          <source src={preloadSrc} />
        </video>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <Link href={`/a/${attempt.id}`} className="th-btn">
          Open →
        </Link>
        <Link href={`/c/${attempt.challenge_id}`} className="th-btn">
          Challenge →
        </Link>
      </div>
    </div>
  );
}

function ChallengeBlockUnit({ challenges }: { challenges: ChallengeRow[] | null }) {
  if (!challenges || challenges.length === 0) return <div className="th-muted">Loading challenges…</div>;

  return (
    <div style={{ maxWidth: 980, padding: "0 18px" }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 1000, fontSize: 22 }}>
          Public Challenges<span style={{ color: "var(--accent)" }}>.</span>
        </div>
        <div className="th-muted" style={{ marginTop: 6 }}>
          Pick one. Attempt it. Post it.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
        {challenges.slice(0, 3).map((c) => (
          <div key={c.id} className="th-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 1000, fontSize: 16, lineHeight: 1.1 }}>{c.title}</div>
            <div className="th-muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.35 }}>
              {c.description}
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 1000 }}>
                {c.hype_count} <span style={{ color: "var(--accent)" }}>🔥</span>
              </div>
              <Link href={`/c/${c.id}`} className="th-btn">
                Open →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 14 }} className="th-muted">
        (You’ll see 3 at a time.)
      </div>
    </div>
  );
}
