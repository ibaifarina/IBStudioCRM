"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/(auth)/actions";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { INITIAL_FORM_STATE } from "@/lib/form-state";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    INITIAL_FORM_STATE
  );
  const [captchaReady, setCaptchaReady] = useState(false);
  const invalid = state.status === "error";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Recupera tu acceso</CardTitle>
        <CardDescription>
          Te enviaremos un enlace seguro para establecer una contraseña nueva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-5">
          <FieldGroup>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="recovery-email">Email</FieldLabel>
              <Input
                id="recovery-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                required
                aria-invalid={invalid || undefined}
              />
            </Field>
          </FieldGroup>
          <TurnstileField
            action="password_reset"
            pending={pending}
            onReadyChange={setCaptchaReady}
          />
          <FormMessage state={state} />
          <Button type="submit" size="lg" disabled={pending || !captchaReady}>
            {pending && <Spinner data-icon="inline-start" />}
            Enviar enlace
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Volver al inicio de sesión
        </Link>
      </CardFooter>
    </Card>
  );
}
