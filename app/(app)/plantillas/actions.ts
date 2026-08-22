"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MessageTemplate } from "@/lib/types";

type MessageTemplateInput = {
  id?: number;
  name: string;
  icon: string;
  content: string;
};

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    return {
      ok: false,
      error: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    } as const;
  }

  return { ok: true, supabase, userId } as const;
}

function mapTemplate(row: {
  id: number;
  name: string;
  icon: string;
  content: string;
  created_at: string;
  updated_at: string;
}): MessageTemplate {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveMessageTemplate(
  input: MessageTemplateInput
): Promise<MessageTemplate | { error: string }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Los datos de la plantilla no son válidos." };
  }

  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const content =
    typeof input.content === "string" ? input.content.trim() : "";
  const icon =
    typeof input.icon === "string" && /^[a-z0-9-]{1,80}$/.test(input.icon)
      ? input.icon
      : "message-square-text";
  if (!name) return { error: "Ponle un nombre a la plantilla." };
  if (name.length > 80) {
    return { error: "El nombre no puede superar los 80 caracteres." };
  }
  if (!content) return { error: "Escribe el mensaje de la plantilla." };
  if (content.length > 5000) {
    return { error: "El mensaje no puede superar los 5.000 caracteres." };
  }
  if (
    input.id != null &&
    (!Number.isSafeInteger(input.id) || input.id <= 0)
  ) {
    return { error: "La plantilla seleccionada no es válida." };
  }

  const values = {
    name,
    icon,
    content,
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? auth.supabase
        .from("message_templates")
        .update(values)
        .eq("id", input.id)
        .eq("user_id", auth.userId)
    : auth.supabase.from("message_templates").insert({
        ...values,
        user_id: auth.userId,
      });

  const { data, error } = await query
    .select("id, name, icon, content, created_at, updated_at")
    .maybeSingle();

  if (error || !data) {
    return {
      error:
        error?.code === "23505"
          ? "Ya tienes una plantilla con ese nombre."
          : "No se pudo guardar la plantilla. Comprueba que la migración esté aplicada.",
    };
  }

  revalidatePath("/plantillas");
  revalidatePath("/leads");
  return mapTemplate(data);
}

export async function deleteMessageTemplate(
  id: number
): Promise<{ deleted: true } | { error: string }> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { error: "La plantilla seleccionada no es válida." };
  }

  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const { data, error } = await auth.supabase
    .from("message_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: "No se pudo eliminar la plantilla." };

  revalidatePath("/plantillas");
  revalidatePath("/leads");
  return { deleted: true };
}
