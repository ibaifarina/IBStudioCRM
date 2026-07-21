import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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
