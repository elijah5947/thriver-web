"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Supabase client handles the session from the URL automatically.
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace("/onboarding");
      else router.replace("/login");
    })();
  }, [router]);

  return (
    <main style={{ padding: 24 }}>
      <p>Signing you in…</p>
    </main>
  );
}