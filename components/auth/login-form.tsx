"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { TurnstileField } from "@/components/auth/turnstile-field";
import type { FormState } from "@/lib/form-state";

export function LoginForm({
  next,
  initialState,
}: {
  next: string;
  initialState: FormState;
}) {
  const [state, action, pending] = useActionState(login, initialState);
  const [captchaReady, setCaptchaReady] = useState(false);
  const invalid = state.status === "error";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Inicia sesión</CardTitle>
        <CardDescription>
          Accede a tus leads desde cualquier dispositivo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-5">
          <input type="hidden" name="next" value={next} />
          <FieldGroup className="gap-4">
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="login-email">Email</FieldLabel>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                required
                aria-invalid={invalid || undefined}
              />
            </Field>
            <Field data-invalid={invalid || undefined}>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
                <Link
                  href="/recuperar-contrasena"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ¿La has olvidado?
                </Link>
              </div>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-invalid={invalid || undefined}
              />
            </Field>
          </FieldGroup>
          <TurnstileField
            action="login"
            pending={pending}
            onReadyChange={setCaptchaReady}
          />
          <FormMessage state={state} />
          <Button type="submit" size="lg" disabled={pending || !captchaReady}>
            {pending && <Spinner data-icon="inline-start" />}
            Entrar
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        ¿No tienes cuenta?&nbsp;
        <Link href="/registro" className="font-medium text-foreground underline-offset-4 hover:underline">
          Crear cuenta
        </Link>
      </CardFooter>
    </Card>
  );
}
