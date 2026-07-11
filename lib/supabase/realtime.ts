import { supabase, realtimeTables } from "@/lib/supabase/client";

let realtimeSubscriptionId = 0;

export function subscribeToWorkspaceChanges(onChange: () => void) {
  const channel = supabase.channel(`vendorproof-mobile-sync-${++realtimeSubscriptionId}`);

  for (const table of realtimeTables) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
