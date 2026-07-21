"use client";

import { useActionState } from "react";
import {
  updateEmail,
  updatePassword,
  updateProfile,
} from "@/app/(app)/cuenta/actions";
import { FormMessage } from "@/components/form-message";
import { LeadDataTransfer } from "@/components/lead-data-transfer";
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

export function AccountForms({
  currentName,
  currentEmail,
}: {
  currentName: string;
  currentEmail: string;
}) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfile,
    INITIAL_FORM_STATE
  );
  const [emailState, emailAction, emailPending] = useActionState(
    updateEmail,
    INITIAL_FORM_STATE
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updatePassword,
    INITIAL_FORM_STATE
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>
            El nombre que aparece dentro de tu espacio de trabajo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="flex flex-col gap-5">
            <FieldGroup>
              <Field data-invalid={profileState.status === "error" || undefined}>
                <FieldLabel htmlFor="account-name">Nombre</FieldLabel>
                <Input
                  id="account-name"
                  name="fullName"
                  autoComplete="name"
                  defaultValue={currentName}
                  required
                  aria-invalid={profileState.status === "error" || undefined}
                />
              </Field>
            </FieldGroup>
            <FormMessage state={profileState} />
            <Button type="submit" className="self-start" disabled={profilePending}>
              {profilePending && <Spinner data-icon="inline-start" />}
              Guardar perfil
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Se usa para iniciar sesión y recuperar tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={emailAction} className="flex flex-col gap-5">
            <FieldGroup>
              <Field data-invalid={emailState.status === "error" || undefined}>
                <FieldLabel htmlFor="account-email">Email</FieldLabel>
                <Input
                  id="account-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={currentEmail}
                  required
                  aria-invalid={emailState.status === "error" || undefined}
                />
              </Field>
            </FieldGroup>
            <FormMessage state={emailState} />
            <Button type="submit" className="self-start" disabled={emailPending}>
              {emailPending && <Spinner data-icon="inline-start" />}
              Cambiar email
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Contraseña</CardTitle>
          <CardDescription>
            Confirma tu contraseña actual antes de establecer una nueva.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={passwordAction} className="flex max-w-md flex-col gap-5">
            <FieldGroup className="gap-4">
              <Field data-invalid={passwordState.status === "error" || undefined}>
                <FieldLabel htmlFor="current-password">Contraseña actual</FieldLabel>
                <Input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  aria-invalid={passwordState.status === "error" || undefined}
                />
              </Field>
              <Field data-invalid={passwordState.status === "error" || undefined}>
                <FieldLabel htmlFor="account-new-password">
                  Contraseña nueva
                </FieldLabel>
                <Input
                  id="account-new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  aria-invalid={passwordState.status === "error" || undefined}
                />
                <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
              </Field>
              <Field data-invalid={passwordState.status === "error" || undefined}>
                <FieldLabel htmlFor="account-confirm-password">
                  Repite la contraseña nueva
                </FieldLabel>
                <Input
                  id="account-confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  aria-invalid={passwordState.status === "error" || undefined}
                />
              </Field>
            </FieldGroup>
            <FormMessage state={passwordState} />
            <Button type="submit" className="self-start" disabled={passwordPending}>
              {passwordPending && <Spinner data-icon="inline-start" />}
              Cambiar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>

      <LeadDataTransfer />
    </div>
  );
}
