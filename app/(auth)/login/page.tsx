import { LoginForm } from "@/components/auth/login-form";
import type { FormState } from "@/lib/form-state";
import { safeRedirectPath } from "@/lib/redirects";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    message?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  let initialState: FormState = { status: "idle" };

  if (params.message === "password-updated") {
    initialState = {
      status: "success",
      message: "Contraseña actualizada. Ya puedes iniciar sesión.",
    };
  } else if (params.error === "confirmation-failed") {
    initialState = {
      status: "error",
      message: "El enlace no es válido o ha caducado.",
    };
  }

  return (
    <LoginForm
      next={safeRedirectPath(params.next)}
      initialState={initialState}
    />
  );
}
