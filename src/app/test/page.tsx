"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function TestPage() {
  const [authStatus, setAuthStatus] = useState("checking auth...");
  const [dbStatus, setDbStatus] = useState("checking db...");

  useEffect(() => {
    (async () => {
      // Auth check
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) setAuthStatus("AUTH ❌ " + sessionError.message);
      else setAuthStatus("AUTH ✅ session fetched (user signed in? " + (!!sessionData.session) + ")");

      // DB check (profiles table must exist; RLS may still allow select)
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .limit(1);

      if (error) setDbStatus("DB ❌ " + error.message);
      else setDbStatus("DB ✅ reachable (rows returned: " + (data?.length ?? 0) + ")");
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Supabase Test</h1>
      <p style={{ marginTop: 12 }}>{authStatus}</p>
      <p style={{ marginTop: 12 }}>{dbStatus}</p>
      <p style={{ marginTop: 12 }}>
        If DB fails: run your SQL schema in Supabase (tables + RLS).
      </p>
    </main>
  );
}