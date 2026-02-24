"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FollowButton({ targetUserId }: { targetUserId: string }) {
  const [me, setMe] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id ?? null;
    setMe(uid);

    if (!uid) {
      setIsFollowing(false);
      return;
    }

    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", uid)
      .eq("following_id", targetUserId)
      .maybeSingle();

    setIsFollowing(!!data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  async function toggle() {
    if (!me) return;
    if (me === targetUserId) return;

    setBusy(true);
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", targetUserId);
    } else {
      await supabase.from("follows").insert({ follower_id: me, following_id: targetUserId });
    }
    setBusy(false);
    await load();
  }

  if (!me || me === targetUserId) return null;

  return (
    <button
      className={`th-btn ${isFollowing ? "" : "th-accent"}`}
      onClick={toggle}
      disabled={busy}
      style={{ padding: "8px 12px", pointerEvents: "auto" }}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
