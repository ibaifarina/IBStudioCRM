"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { safeRedirectPath } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

async function getSiteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

function authErrorMessage(error: { code?: string; message: string }) {
  switch (error.code) {
    case "invalid_credentials":
      return "El email o la contraseña no son correctos.";
    case "email_not_confirmed":
      return "Confirma tu email antes de iniciar sesión.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con este email.";
    case "weak_password":
      return "La contraseña no cumple los requisitos de seguridad.";
    case "signup_disabled":
      return "El registro está desactivado temporalmente.";
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
    default:
      return "No se pudo completar la operación. Inténtalo de nuevo.";
  }
}

export async function login(
  _previousState: FormState,
  formData: FormData
): Promise<FormState> {
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const next = safeRedirectPath(formData.get("next"));

  if (!email || !password) {
    return { status: "error", message: "Completa el email y la contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: "error", message: authErrorMessage(error) };

  redirect(next);
}

export async function signUp(
  _previousState: FormState,
  formData: FormData
): Promise<FormState> {
  const fullName = value(formData, "fullName");
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const confirmPassword = value(formData, "confirmPassword");

  if (!fullName || !email || !password) {
    return { status: "error", message: "Completa todos los campos." };
  }
  if (password.length < 8) {
    return {
      status: "error",
      message: "La contraseña debe tener al menos 8 caracteres.",
    };
  }
  if (password !== confirmPassword) {
    return { status: "error", message: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const origin = await getSiteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/`,
    },
  });

  if (error) return { status: "error", message: authErrorMessage(error) };

  // With email confirmation enabled, Supabase obfuscates duplicate signups
  // instead of returning an error. The faux user has no linked identities.
  if (data.user?.identities?.length === 0) {
    return {
      status: "error",
      message:
        "Ya existe una cuenta con este email. Inicia sesión o recupera tu contraseña.",
    };
  }

  if (!data.user) {
    return {
      status: "error",
      message: "No se pudo crear la cuenta. Inténtalo de nuevo.",
    };
  }

  if (data.session) redirect("/");
  redirect("/registro/revisa-tu-email");
}

export async function requestPasswordReset(
  _previousState: FormState,
  formData: FormData
): Promise<FormState> {
  const email = value(formData, "email").toLowerCase();
  if (!email) return { status: "error", message: "Introduce tu email." };

  const supabase = await createClient();
  const origin = await getSiteOrigin();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/restablecer-contrasena`,
  });

  return {
    status: "success",
    message:
      "Si existe una cuenta con ese email, recibirás un enlace para cambiar la contraseña.",
  };
}

export async function setRecoveredPassword(
  _previousState: FormState,
  formData: FormData
): Promise<FormState> {
  const password = value(formData, "password");
  const confirmPassword = value(formData, "confirmPassword");

  if (password.length < 8) {
    return {
      status: "error",
      message: "La contraseña debe tener al menos 8 caracteres.",
    };
  }
  if (password !== confirmPassword) {
    return { status: "error", message: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: authErrorMessage(error) };

  await supabase.auth.signOut();
  redirect("/login?message=password-updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
