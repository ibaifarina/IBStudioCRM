"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return supabase;
}

export async function updateProfile(
  _previousState: FormState,
  formData: FormData
): Promise<FormState> {
  const fullName = value(formData, "fullName");
  if (!fullName) return { status: "error", message: "Introduce tu nombre." };

  const supabase = await getAuthenticatedClient();
  if (!supabase) {
    return { status: "error", message: "Tu sesión ha caducado." };
  }

  const { error } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });
  if (error) {
    return { status: "error", message: "No se pudo actualizar el nombre." };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Nombre actualizado." };
}

export async function updateEmail(
  _previousState: FormState,
  formData: FormData
): Promise<FormState> {
  const email = value(formData, "email").toLowerCase();
  if (!email) return { status: "error", message: "Introduce un email válido." };

  const supabase = await getAuthenticatedClient();
  if (!supabase) {
    return { status: "error", message: "Tu sesión ha caducado." };
  }

  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    return { status: "error", message: "No se pudo solicitar el cambio de email." };
  }

  return {
    status: "success",
    message: "Revisa tu correo para confirmar el cambio de email.",
  };
}

export async function updatePassword(
  _previousState: FormState,
  formData: FormData
): Promise<FormState> {
  const currentPassword = value(formData, "currentPassword");
  const password = value(formData, "password");
  const confirmPassword = value(formData, "confirmPassword");

  if (!currentPassword) {
    return { status: "error", message: "Introduce tu contraseña actual." };
  }
  if (password.length < 8) {
    return {
      status: "error",
      message: "La nueva contraseña debe tener al menos 8 caracteres.",
    };
  }
  if (password !== confirmPassword) {
    return { status: "error", message: "Las contraseñas no coinciden." };
  }

  const supabase = await getAuthenticatedClient();
  if (!supabase) {
    return { status: "error", message: "Tu sesión ha caducado." };
  }

  const { error } = await supabase.auth.updateUser({
    current_password: currentPassword,
    password,
  });
  if (error) {
    return {
      status: "error",
      message: "No se pudo cambiar la contraseña. Comprueba la contraseña actual.",
    };
  }

  return { status: "success", message: "Contraseña actualizada." };
}
