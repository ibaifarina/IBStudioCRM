import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { FormState } from "@/lib/form-state";

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;

  const success = state.status === "success";
  return (
    <Alert variant={success ? "default" : "destructive"}>
      {success ? <CircleCheckIcon /> : <CircleAlertIcon />}
      <AlertTitle>{success ? "Listo" : "No se pudo continuar"}</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
