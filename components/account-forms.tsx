"use client";

import { useActionState } from "react";
import {
  updateEmail,
  updatePassword,
  updateProfile,
} from "@/app/(app)/cuenta/actions";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { INITIAL_FORM_STATE } from "@/lib/form-state";

export function ProfileNameForm({ currentName }: { currentName: string }) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfile,
    INITIAL_FORM_STATE
  );

  return (
    <form action={profileAction} className="flex flex-col gap-5">
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
      <FormMessage state={profileState} />
      <Button type="submit" className="self-start" disabled={profilePending}>
        {profilePending && <Spinner data-icon="inline-start" />}
        Guardar perfil
      </Button>
    </form>
  );
}

export function EmailUpdateForm({ currentEmail }: { currentEmail: string }) {
  const [emailState, emailAction, emailPending] = useActionState(
    updateEmail,
    INITIAL_FORM_STATE
  );

  return (
    <form action={emailAction} className="flex flex-col gap-5">
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
        <FieldDescription>
          Te enviaremos un email para confirmar el cambio.
        </FieldDescription>
      </Field>
      <FormMessage state={emailState} />
      <Button type="submit" className="self-start" disabled={emailPending}>
        {emailPending && <Spinner data-icon="inline-start" />}
        Cambiar email
      </Button>
    </form>
  );
}

export function PasswordUpdateForm() {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updatePassword,
    INITIAL_FORM_STATE
  );
  const invalid = passwordState.status === "error" || undefined;

  return (
    <form action={passwordAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={invalid} className="sm:col-span-2">
          <FieldLabel htmlFor="current-password">Contraseña actual</FieldLabel>
          <Input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={invalid}
          />
        </Field>
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor="account-new-password">Contraseña nueva</FieldLabel>
          <Input
            id="account-new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-invalid={invalid}
          />
          <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
        </Field>
        <Field data-invalid={invalid}>
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
            aria-invalid={invalid}
          />
        </Field>
      </div>
      <FormMessage state={passwordState} />
      <Button type="submit" className="self-start" disabled={passwordPending}>
        {passwordPending && <Spinner data-icon="inline-start" />}
        Cambiar contraseña
      </Button>
    </form>
  );
}
