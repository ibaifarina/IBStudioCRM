import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) return null;

  // Claims are the authentication source used by the proxy. Fetch the full
  // profile for optional account details, but never turn a transient profile
  // request failure into a contradictory "logged out" result.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id === claims.sub) return user;
  } catch {
    // Fall back to the already verified claims below.
  }

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    phone: typeof claims.phone === "string" ? claims.phone : undefined,
    app_metadata: claims.app_metadata ?? {},
    user_metadata: claims.user_metadata ?? {},
    aud: Array.isArray(claims.aud) ? claims.aud[0] ?? "authenticated" : claims.aud,
    role: claims.role,
    is_anonymous: claims.is_anonymous,
    created_at: "",
  } satisfies User;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function getUserDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  return user.email?.split("@")[0] ?? "Mi cuenta";
}
