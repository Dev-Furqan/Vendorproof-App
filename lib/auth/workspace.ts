import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";

export async function ensureMobileWorkspace(user: User | null) {
  if (!user) return null;

  const fullName = getStringMetadata(user.user_metadata?.full_name) ?? getStringMetadata(user.user_metadata?.name);
  const avatarUrl = getStringMetadata(user.user_metadata?.avatar_url);

  const { data, error } = await supabase.rpc("ensure_user_workspace", {
    user_full_name: fullName,
    user_avatar_url: avatarUrl
  });

  if (error) {
    if (/function .*ensure_user_workspace|schema cache/i.test(error.message)) {
      const existingWorkspaceId = await getExistingWorkspaceId(user.id);
      if (existingWorkspaceId) return existingWorkspaceId;

      const apiWorkspaceId = await ensureWorkspaceViaApi(user);
      if (apiWorkspaceId) return apiWorkspaceId;

      throw new Error("Mobile account setup is not enabled yet. Apply the latest Supabase migration, then try again.");
    }
    throw new Error(error.message);
  }

  return typeof data === "string" ? data : null;
}

function getStringMetadata(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function getExistingWorkspaceId(userId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return typeof data?.organization_id === "string" ? data.organization_id : null;
}

async function ensureWorkspaceViaApi(user: User) {
  const apiUrl = process.env.EXPO_PUBLIC_VENDORPROOF_API_URL?.replace(/\/$/, "");
  if (!apiUrl) return null;

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;

  const fullName = getStringMetadata(user.user_metadata?.full_name) ?? getStringMetadata(user.user_metadata?.name);
  const avatarUrl = getStringMetadata(user.user_metadata?.avatar_url);
  const response = await fetch(`${apiUrl}/api/mobile/workspace`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ fullName, avatarUrl })
  });

  const payload = (await response.json().catch(() => ({}))) as { organizationId?: unknown; error?: unknown };

  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Could not prepare your mobile workspace.");
  }

  return typeof payload.organizationId === "string" ? payload.organizationId : null;
}
