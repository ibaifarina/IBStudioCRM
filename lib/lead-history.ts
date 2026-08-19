import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const HISTORY_ERROR =
  "No se pudo guardar una versión de seguridad. Aplica la migración del historial e inténtalo de nuevo.";

export async function captureLeadChangeSet(
  supabase: SupabaseClient,
  leadIds: number[],
  description: string,
  existed = true
): Promise<{ id: number } | { error: string }> {
  const ids = [
    ...new Set(leadIds.filter((id) => Number.isSafeInteger(id) && id > 0)),
  ];
  if (ids.length === 0) return { error: "No hay leads para guardar." };

  const { data, error } = await supabase.rpc("capture_lead_change_set", {
    p_lead_ids: ids,
    p_description: description.trim().slice(0, 180),
    p_existed: existed,
  });

  if (error || typeof data !== "number") return { error: HISTORY_ERROR };
  return { id: data };
}
