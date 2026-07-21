"use client";

import { useActionState } from "react";
import { setRecoveredPassword } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(
    setRecoveredPassword,
    INITIAL_FORM_STATE
  );
  const invalid = state.status === "error";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Nueva contraseña</CardTitle>
        <CardDescription>
          Elige una contraseña distinta para recuperar tu cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-5">
          <FieldGroup className="gap-4">
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="new-password">Contraseña nueva</FieldLabel>
              <Input
                id="new-password"
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
              <FieldLabel htmlFor="confirm-new-password">
                Repite la contraseña
              </FieldLabel>
              <Input
                id="confirm-new-password"
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
            Guardar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
