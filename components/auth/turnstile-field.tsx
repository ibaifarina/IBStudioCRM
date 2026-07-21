"use client";

import {
  Turnstile,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";
import { useCallback, useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TurnstileAction = "login" | "signup" | "password_reset";

export function TurnstileField({
  action,
  pending,
  onReadyChange,
}: {
  action: TurnstileAction;
  pending: boolean;
  onReadyChange: (ready: boolean) => void;
}) {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const wasPending = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = useCallback(() => {
    setError(null);
    onReadyChange(true);
  }, [onReadyChange]);

  const handleUnavailable = useCallback(() => {
    onReadyChange(false);
    setError("No se pudo completar la verificación. Recarga la página e inténtalo de nuevo.");
  }, [onReadyChange]);

  const handleExpire = useCallback(() => {
    onReadyChange(false);
  }, [onReadyChange]);

  useEffect(() => {
    const submissionFinished = wasPending.current && !pending;
    wasPending.current = pending;

    if (!submissionFinished) return;

    onReadyChange(false);
    turnstileRef.current?.reset();
  }, [onReadyChange, pending]);

  if (!SITE_KEY) {
    return (
      <p role="alert" className="text-sm text-destructive">
        La verificación de seguridad no está configurada.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Turnstile
        ref={turnstileRef}
        siteKey={SITE_KEY}
        className="max-w-full"
        options={{
          action,
          appearance: "interaction-only",
          execution: "render",
          language: "es",
          responseField: true,
          responseFieldName: "captchaToken",
          retry: "auto",
          refreshExpired: "auto",
          refreshTimeout: "auto",
          size: "flexible",
          theme: "auto",
        }}
        injectScript={false}
        onSuccess={handleSuccess}
        onExpire={handleExpire}
        onError={handleUnavailable}
        onTimeout={handleUnavailable}
        onUnsupported={handleUnavailable}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
