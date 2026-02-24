"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Challenge = {
  id: string;
  title: string;
};

export default function UploadAttemptPage() {
  const router = useRouter();
  const params = useParams<{ challengeId: string }>();
  const challengeId = params?.challengeId;

  const [userId, setUserId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState<string>("");

  const [status, setStatus] = useState<string>("Loading…");
  const [uploading, setUploading] = useState(false);

  const fileExt = useMemo(() => {
    if (!file?.name) return "mp4";
    const parts = file.name.split(".");
    return (parts[parts.length - 1] || "mp4").toLowerCase();
  }, [file]);

  useEffect(() => {
    (async () => {
      // Require auth
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);

      // Load challenge (for title / validation)
      if (!challengeId) return;
      const { data, error } = await supabase
        .from("challenges")
        .select("id,title")
        .eq("id", challengeId)
        .single();

      if (error || !data) {
        setStatus("Challenge not found (or not accessible).");
        return;
      }
      setChallenge(data);
      setStatus("Ready");
    })();
  }, [router, challengeId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!userId) return;
    if (!challengeId) return;

    if (!file) {
      setStatus("Please choose a video file.");
      return;
    }

    const captionTrimmed = caption.trim();
    const captionMax = 180;
    if (captionTrimmed.length > captionMax) {
      setStatus(`Caption too long. Max ${captionMax} characters.`);
      return;
    }

    // Basic client-side guardrails (MVP)
    const maxMB = 200;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxMB) {
      setStatus(`File too large (${sizeMB.toFixed(1)}MB). Max ${maxMB}MB for now.`);
      return;
    }

    setUploading(true);

    try {
      // 1) Create attempts row first (so we have attempt_id for the storage path)
      const { data: attempt, error: attemptErr } = await supabase
        .from("attempts")
        .insert({
          challenge_id: challengeId,
          user_id: userId,
          video_path: "pending", // temp, will update after upload
          caption: captionTrimmed || null,
        })
        .select("id")
        .single();

      if (attemptErr || !attempt) {
        setStatus("DB error creating attempt: " + (attemptErr?.message ?? "Unknown"));
        setUploading(false);
        return;
      }

      const attemptId = attempt.id as string;

      // 2) Upload to Storage
      // Path convention: attempts/{userId}/{attemptId}.{ext}
      const objectPath = `attempts/${userId}/${attemptId}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("videos")
        .upload(objectPath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "video/mp4",
        });

      if (uploadErr) {
        setStatus("Upload error: " + uploadErr.message);
        setUploading(false);
        return;
      }

      // 3) Update attempts row with the real video_path
      const { error: updErr } = await supabase
        .from("attempts")
        .update({ video_path: objectPath })
        .eq("id", attemptId);

      if (updErr) {
        setStatus("DB error updating attempt: " + updErr.message);
        setUploading(false);
        return;
      }

      // 4) Redirect to attempt page
      router.push(`/a/${attemptId}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Upload Attempt</h1>

      {challenge && (
        <p style={{ marginTop: 8, opacity: 0.85 }}>
          For challenge: <strong>{challenge.title}</strong>
        </p>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <label style={{ display: "block", fontWeight: 800 }}>
          Video
          <input
            style={{ display: "block", marginTop: 8 }}
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label style={{ display: "block", marginTop: 14, fontWeight: 800 }}>
          Caption (optional)
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Say something about your attempt…"
            style={{
              display: "block",
              marginTop: 8,
              width: "100%",
              minHeight: 90,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
            maxLength={180}
          />
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            {caption.trim().length}/180
          </div>
        </label>

        <button
          disabled={uploading || status === "Loading…"}
          style={{
            marginTop: 14,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #ddd",
            fontWeight: 800,
          }}
        >
          {uploading ? "Uploading…" : "Submit Attempt"}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>{status}</p>

      <p style={{ marginTop: 18, opacity: 0.7, fontSize: 13 }}>
        MVP limits: max ~200MB. We can raise this later or use a video service for transcoding.
      </p>
    </main>
  );
}