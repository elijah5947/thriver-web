"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import FollowButton from "@/components/FollowButton";

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null; // ok if null / missing column; just won’t show
};

type Stats = { posts: number; hype: number; likes: number };

type Attempt = {
  id: string;
  video_path: string;
  like_count: number;
  created_at: string;
  challenge_id: string;
  challenges?: { title: string }[] | null;
};

type Challenge = {
  id: string;
  type: "direct" | "public";
  title: string;
  hype_count: number;
  created_at: string;
  target_user_id: string | null;
};

type Tab = "videos" | "challenges" | "liked";
type SortVideos = "recent" | "likes";
type SortChallenges = "recent" | "hype";

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = (params?.username ?? "").toLowerCase();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ posts: 0, hype: 0, likes: 0 });

  const [tab, setTab] = useState<Tab>("videos");
  const [sortVideos, setSortVideos] = useState<SortVideos>("recent");
  const [sortChallenges, setSortChallenges] = useState<SortChallenges>("recent");

  const [videos, setVideos] = useState<Attempt[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [liked, setLiked] = useState<Attempt[]>([]);

  const [status, setStatus] = useState("Loading…");

  async function load() {
    setStatus("Loading…");

    // profile
    const { data: p, error: pErr } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("username", username)
      .single();

    if (pErr || !p) {
      setStatus("Profile not found.");
      setProfile(null);
      return;
    }
    setProfile(p as Profile);

    // stats
    const { data: st, error: stErr } = await supabase.rpc("get_profile_stats", { p_user_id: p.id });
    if (!stErr && st && st[0]) setStats(st[0] as Stats);

    // videos (attempts)
    const orderCol = sortVideos === "recent" ? "created_at" : "like_count";
    const ascending = false;

    const { data: v } = await supabase
      .from("attempts")
      .select("id, video_path, like_count, created_at, challenge_id, challenges(title)")
      .eq("user_id", p.id)
      .order(orderCol, { ascending })
      .limit(60);

    setVideos((v ?? []) as unknown as Attempt[]);

    // challenges (created by this user)
    const orderC = sortChallenges === "recent" ? "created_at" : "hype_count";
    const { data: c } = await supabase
      .from("challenges")
      .select("id, type, title, hype_count, created_at, target_user_id")
      .eq("creator_id", p.id)
      .order(orderC, { ascending: false })
      .limit(60);

    setChallenges((c ?? []) as Challenge[]);

    // liked tab: attempts liked by this user
    const { data: likedRows } = await supabase
      .from("attempt_likes")
      .select("attempt_id, created_at, attempts(id, video_path, like_count, created_at, challenge_id, challenges(title))")
      .eq("liker_id", p.id)
      .order("created_at", { ascending: false })
      .limit(60);

    const likedAttempts = (likedRows ?? [])
      .map((r: any) => r.attempts)
      .filter(Boolean) as Attempt[];
    setLiked(likedAttempts);

    setStatus("OK");
  }

  useEffect(() => {
    if (!username) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, sortVideos, sortChallenges]);

  if (!profile) return <main style={{ padding: 24 }}>{status}</main>;

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      {/* Header */}
      <div className="th-card th-enter" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                fontWeight: 1000,
              }}
            >
              {profile.avatar_url ? (
                // If you store avatar URLs (Supabase storage public URL), it will show.
                // Otherwise it displays fallback.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                profile.username.slice(0, 1).toUpperCase()
              )}
            </div>

            <div>
              <div style={{ fontSize: 26, fontWeight: 1000 }}>
                @{profile.username}
              </div>
              <div className="th-muted" style={{ marginTop: 6 }}>
                <Link href="/feed">← Back to feed</Link>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <FollowButton targetUserId={profile.id} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <div className="th-card" style={{ padding: 14, textAlign: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>{stats.posts}</div>
            <div className="th-muted" style={{ fontSize: 12 }}>Posts</div>
          </div>
          <div className="th-card" style={{ padding: 14, textAlign: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>{stats.hype}</div>
            <div className="th-muted" style={{ fontSize: 12 }}>Hype</div>
          </div>
          <div className="th-card" style={{ padding: 14, textAlign: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>{stats.likes}</div>
            <div className="th-muted" style={{ fontSize: 12 }}>Likes</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className={`th-pill ${tab === "videos" ? "th-accent" : ""}`} onClick={() => setTab("videos")}>
            Videos
          </button>
          <button className={`th-pill ${tab === "challenges" ? "th-accent" : ""}`} onClick={() => setTab("challenges")}>
            Challenges
          </button>
          <button className={`th-pill ${tab === "liked" ? "th-accent" : ""}`} onClick={() => setTab("liked")}>
            Liked
          </button>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            {tab === "videos" && (
              <>
                <button className={`th-pill ${sortVideos === "recent" ? "th-accent" : ""}`} onClick={() => setSortVideos("recent")}>Recent</button>
                <button className={`th-pill ${sortVideos === "likes" ? "th-accent" : ""}`} onClick={() => setSortVideos("likes")}>Most liked</button>
              </>
            )}
            {tab === "challenges" && (
              <>
                <button className={`th-pill ${sortChallenges === "recent" ? "th-accent" : ""}`} onClick={() => setSortChallenges("recent")}>Recent</button>
                <button className={`th-pill ${sortChallenges === "hype" ? "th-accent" : ""}`} onClick={() => setSortChallenges("hype")}>Most hyped</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: 16 }}>
        {tab === "videos" && <VideoGrid items={videos} />}
        {tab === "liked" && <VideoGrid items={liked} />}
        {tab === "challenges" && <ChallengeList items={challenges} />}
      </div>
    </main>
  );
}

function VideoGrid({ items }: { items: Attempt[] }) {
  if (!items.length) return <div className="th-muted" style={{ marginTop: 16 }}>Nothing here yet.</div>;

  return (
    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
      {items.map((a) => {
        const { data: pub } = supabase.storage.from("videos").getPublicUrl(a.video_path);
        return (
          <Link key={a.id} href={`/a/${a.id}`} className="th-card" style={{ overflow: "hidden" }}>
            <div style={{ aspectRatio: "9 / 16", background: "#000" }}>
              <video muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }}>
                <source src={pub.publicUrl} />
              </video>
            </div>
            <div style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="th-muted" style={{ fontSize: 12, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.challenges?.[0]?.title ?? "Attempt"}
              </div>
              <div style={{ fontWeight: 900, fontSize: 12 }}>❤️ {a.like_count}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ChallengeList({ items }: { items: Challenge[] }) {
  if (!items.length) return <div className="th-muted" style={{ marginTop: 16 }}>No challenges yet.</div>;

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
      {items.map((c) => (
        <div key={c.id} className="th-card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 1000 }}>{c.title}</div>
            <div className="th-muted" style={{ marginTop: 6, fontSize: 12 }}>
              {c.type === "direct" ? "Direct challenge" : "Public challenge"} · 🔥 {c.hype_count}
            </div>
          </div>
          <Link href={`/c/${c.id}`} className="th-btn">
            Open →
          </Link>
        </div>
      ))}
    </div>
  );
}