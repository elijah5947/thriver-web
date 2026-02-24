"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CommentRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export default function CommentsPanel({
  entityType,
  entityId,
  onClose,
}: {
  entityType: "challenge" | "attempt";
  entityId: string;
  onClose: () => void;
}) {
  const [me, setMe] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    setMe(sess.session?.user?.id ?? null);

    const { data, error } = await supabase
      .from("comments")
      .select("id,author_id,body,created_at")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      setStatus("Comments error: " + error.message);
      setComments([]);
      return;
    }
    setStatus(null);
    setComments((data ?? []) as CommentRow[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function post() {
    if (!me) {
      setStatus("Log in to comment.");
      return;
    }
    const text = body.trim();
    if (!text) return;

    const { error } = await supabase.from("comments").insert({
      author_id: me,
      entity_type: entityType,
      entity_id: entityId,
      body: text,
    });

    if (error) {
      setStatus("Post error: " + error.message);
      return;
    }

    setBody("");
    await load();
  }

  return (
    <>
      <div className="th-drawerBackdrop" onClick={onClose} />
      <div className="th-drawer">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Comments</div>
          <button className="th-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <input
            className="th-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Say something motivating…"
          />
          <button className="th-btn th-accent" onClick={post}>
            Post
          </button>
        </div>

        {status && <div style={{ marginTop: 12 }} className="th-muted">{status}</div>}

        <div style={{ marginTop: 14, display: "grid", gap: 10, overflowY: "auto", maxHeight: "calc(100vh - 170px)" }}>
          {comments.map((c) => (
            <div key={c.id} className="th-card" style={{ padding: 12 }}>
              <div className="th-muted" style={{ fontSize: 12 }}>
                {new Date(c.created_at).toLocaleString()}
              </div>
              <div style={{ marginTop: 8, lineHeight: 1.35 }}>{c.body}</div>
            </div>
          ))}
          {comments.length === 0 && <div className="th-muted">No comments yet. Be the first.</div>}
        </div>
      </div>
    </>
  );
}