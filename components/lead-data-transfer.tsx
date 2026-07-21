"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { buttonVariants, Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { FormState } from "@/lib/form-state";

export function LeadDataTransfer() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function importCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({ status: "idle" });

    try {
      const response = await fetch("/cuenta/datos-leads", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result = (await response.json()) as {
        error?: string;
        imported?: number;
        createdTags?: number;
      };

      if (!response.ok) {
        setState({
          status: "error",
          message: result.error ?? "No se pudo importar el archivo.",
        });
        return;
      }

      const imported = result.imported ?? 0;
      const createdTags = result.createdTags ?? 0;
      setState({
        status: "success",
        message: `${imported} ${imported === 1 ? "lead importado" : "leads importados"}${
          createdTags > 0
            ? ` y ${createdTags} ${createdTags === 1 ? "etiqueta creada" : "etiquetas creadas"}`
            : ""
        }.`,
      });
      formRef.current?.reset();
      router.refresh();
    } catch {
      setState({
        status: "error",
        message: "No se pudo conectar con el servidor. Inténtalo de nuevo.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Datos de leads</CardTitle>
        <CardDescription>
          Descarga una copia de tus datos o añade leads desde un archivo CSV.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col items-start gap-3">
          <div>
            <h3 className="font-medium">Exportar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Incluye todos los campos, fechas y etiquetas. El archivo es compatible
              con Excel y sirve como plantilla para futuras importaciones.
            </p>
          </div>
          <a
            href="/cuenta/datos-leads"
            download
            className={buttonVariants({ variant: "outline" })}
          >
            <DownloadIcon data-icon="inline-start" />
            Exportar CSV
          </a>
        </section>

        <section className="border-t pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-6">
          <div>
            <h3 className="font-medium">Importar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada fila se añadirá como un lead nuevo. Las etiquetas que ya existan
              se reutilizarán.
            </p>
          </div>
          <form ref={formRef} onSubmit={importCsv} className="mt-4 flex flex-col gap-4">
            <Field data-invalid={state.status === "error" || undefined}>
              <FieldLabel htmlFor="leads-csv">Archivo CSV</FieldLabel>
              <Input
                id="leads-csv"
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                disabled={pending}
                aria-invalid={state.status === "error" || undefined}
              />
              <FieldDescription>Hasta 5 MB y 5.000 leads por archivo.</FieldDescription>
            </Field>
            <FormMessage state={state} />
            <Button type="submit" className="self-start" disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UploadIcon data-icon="inline-start" />
              )}
              {pending ? "Importando…" : "Importar CSV"}
            </Button>
          </form>
        </section>
      </CardContent>
    </Card>
  );
}
