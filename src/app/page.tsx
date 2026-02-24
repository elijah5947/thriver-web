"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Challenge = {
  id: string;
  title: string;
  difficulty: number;
  created_at: string;
};

export default function Home() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [status, setStatus] = useState("Loading…");

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("challenges")
        .select("id,title,difficulty,created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) setStatus("Error: " + error.message);
      else {
        setChallenges(data ?? []);
        setStatus(data?.length ? "OK" : "No challenges yet.");
      }
    })();
  }, [router]);

  return (
    <main style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Thriver</h1>
        <Link
          href="/create"
          style={{ padding: "10px 14px", border: "1px solid #ddd", borderRadius: 10, fontWeight: 700 }}
        >
          + Create
        </Link>
      </div>

      <div style={{ marginTop: 18 }}>
        {!challenges.length ? (
          <p>{status}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {challenges.map((c) => (
              <li key={c.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginTop: 10 }}>
                <Link href={`/c/${c.id}`} style={{ fontWeight: 800, fontSize: 18 }}>
                  {c.title}
                </Link>
                <div style={{ marginTop: 6, opacity: 0.8 }}>Difficulty: {c.difficulty}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}