"use client";

import { useMemo, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TemplateMessageText,
  TemplateVariableToken,
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
  const [lastCopiedOutput, setLastCopiedOutput] = useState("");
  const copied = Boolean(output) && lastCopiedOutput === output;

  return (
    <div className="space-y-7">
      {variables.length > 0 && (
        <div>
          <div className="mb-4">
            <p className="font-heading text-base font-semibold">
              Personaliza el mensaje
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Los campos conocidos se completan automáticamente desde el lead.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {variables.map((variable) => (
              <div key={variable.key} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`template-variable-${variable.key}`}>
                    {variable.label}
                  </Label>
                  <TemplateVariableToken
                    variableKey={variable.key}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    [{variable.label}]
                  </TemplateVariableToken>
                </div>
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
        </div>
        <div className="min-h-48 rounded-xl border bg-background p-4 text-[15px] leading-7 shadow-xs sm:p-5">
          {content ? (
            <TemplateMessageText content={content} values={resolvedValues} />
          ) : (
            <span className="text-muted-foreground">
              El mensaje final aparecerá aquí.
            </span>
          )}
        </div>
        {missingVariables.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Completa {missingVariables.length === 1 ? "el campo" : "los campos"}{" "}
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
