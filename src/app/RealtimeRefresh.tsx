"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Listens for INSERT/UPDATE/DELETE on the tables that drive the dashboard.
 * When anything changes — your action or the other user's — calls
 * `router.refresh()` to re-fetch the server component tree without a full
 * navigation.
 *
 * Caveat: Supabase Realtime won't deliver events unless the tables are added
 * to the `supabase_realtime` publication. See migration 0002.
 *
 * Renders nothing. Mount once anywhere on the page.
 */
export function RealtimeRefresh() {
  const router = useRouter();
  // Guard against React 18 StrictMode double-mounting in dev, which would
  // otherwise create two channels.
  const subscribed = useRef(false);

  useEffect(() => {
    if (subscribed.current) return;
    subscribed.current = true;

    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "progress" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "revisions" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      subscribed.current = false;
    };
  }, [router]);

  return null;
}
