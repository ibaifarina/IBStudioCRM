"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { CheckCheckIcon, CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  TemplateMessageText,
  templateVariableStyle,
} from "@/components/template-variable-text";
import {
  extractTemplateVariables,
  fillMessageTemplate,
} from "@/lib/message-templates";

const EMPTY_VALUES: Record<string, string> = {};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy_failed");
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const subscribeToClock = () => () => {};
const getClockSnapshot = () => formatClock(new Date());
const getServerClockSnapshot = () => "";

export function MessageTemplateFillForm({
  content,
  initialValues = EMPTY_VALUES,
}: {
  content: string;
  initialValues?: Record<string, string>;
}) {
  const variables = useMemo(() => extractTemplateVariables(content), [content]);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const resolvedValues = useMemo(
    () => ({ ...initialValues, ...values }),
    [initialValues, values]
  );
  const output = useMemo(
    () => fillMessageTemplate(content, resolvedValues),
    [content, resolvedValues]
  );
  const missingVariables = variables.filter(
    (variable) => !resolvedValues[variable.key]?.trim()
  );
  const filledCount = variables.length - missingVariables.length;
  const [lastCopiedOutput, setLastCopiedOutput] = useState("");
  const copied = Boolean(output) && lastCopiedOutput === output;
  const clock = useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getServerClockSnapshot
  );

  return (
    <div className="space-y-7">
      {variables.length > 0 && (
        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div>
              <p className="font-heading text-base font-semibold">
                Personaliza el mensaje
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Los campos conocidos se completan automáticamente desde el lead.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div
                className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={variables.length}
                aria-valuenow={filledCount}
                aria-label="Campos completados"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    missingVariables.length === 0 ? "bg-emerald-500" : "bg-brand"
                  )}
                  style={{
                    width: `${Math.round((filledCount / variables.length) * 100)}%`,
                  }}
                />
              </div>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  missingVariables.length === 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                {missingVariables.length === 0
                  ? "Listo"
                  : `${filledCount}/${variables.length}`}
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {variables.map((variable) => (
              <div key={variable.key} className="space-y-2">
                <Label htmlFor={`template-variable-${variable.key}`}>
                  {variable.label}
                </Label>
                <Input
                  id={`template-variable-${variable.key}`}
                  value={resolvedValues[variable.key] ?? ""}
                  placeholder={`Valor para [${variable.label}]`}
                  className={templateVariableStyle(variable.key).soft}
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      [variable.key]: event.target.value,
                    }));
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-heading text-base font-semibold">Mensaje final</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Revisa el resultado antes de copiarlo.
            </p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {output.trim().length} car.
          </span>
        </div>

        <div className="chat-canvas relative overflow-hidden rounded-2xl border px-4 py-6 sm:px-6 sm:py-8">
          <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md border bg-card px-4 py-3 shadow-sm sm:max-w-[85%]">
            <div className="text-[15px] leading-7">
              {content ? (
                <TemplateMessageText content={content} values={resolvedValues} />
              ) : (
                <span className="text-muted-foreground">
                  El mensaje final aparecerá aquí.
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-end gap-1 text-[11px] leading-none text-muted-foreground">
              <span suppressHydrationWarning>{clock}</span>
              <CheckCheckIcon className="size-3.5 text-sky-500 dark:text-sky-400" />
            </div>
          </div>
        </div>

        {missingVariables.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Completa{" "}
            {missingVariables.length === 1 ? "el campo" : "los campos"}{" "}
            {missingVariables.map((variable) => `[${variable.label}]`).join(", ")}{" "}
            para copiar.
          </p>
        )}
        <Button
          size="lg"
          className="mt-4 w-full sm:w-auto sm:min-w-44"
          disabled={!content.trim() || missingVariables.length > 0}
          onClick={async () => {
            try {
              await copyText(output);
              setLastCopiedOutput(output);
              toast.success("Mensaje copiado");
            } catch {
              toast.error("No se pudo copiar el mensaje.");
            }
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Mensaje copiado" : "Copiar mensaje"}
        </Button>
      </div>
    </div>
  );
}
