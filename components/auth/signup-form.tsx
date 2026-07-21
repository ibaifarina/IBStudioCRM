"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/app/(auth)/actions";
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { INITIAL_FORM_STATE } from "@/lib/form-state";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, INITIAL_FORM_STATE);
  const invalid = state.status === "error";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Crea tu cuenta</CardTitle>
        <CardDescription>
          Tu pipeline quedará aislado y disponible en todos tus dispositivos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-5">
          <FieldGroup className="gap-4">
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="signup-name">Nombre</FieldLabel>
              <Input
                id="signup-name"
                name="fullName"
                autoComplete="name"
                placeholder="Tu nombre"
                required
                aria-invalid={invalid || undefined}
              />
            </Field>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="signup-email">Email</FieldLabel>
              <Input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                required
                aria-invalid={invalid || undefined}
              />
            </Field>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="signup-password">Contraseña</FieldLabel>
              <Input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                aria-invalid={invalid || undefined}
              />
              <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
            </Field>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="signup-confirm-password">
                Repite la contraseña
              </FieldLabel>
              <Input
                id="signup-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                aria-invalid={invalid || undefined}
              />
            </Field>
          </FieldGroup>
          <FormMessage state={state} />
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Crear cuenta
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?&nbsp;
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Iniciar sesión
        </Link>
      </CardFooter>
    </Card>
  );
}
