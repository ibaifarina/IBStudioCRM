"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheckIcon,
  DatabaseIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  UploadIcon,
} from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { IconTile } from "@/components/icon-tile";
import { buttonVariants, Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { FormState } from "@/lib/form-state";

export function LeadDataTransfer() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
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
      setSelectedFileName("");
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
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <IconTile>
            <DatabaseIcon aria-hidden="true" />
          </IconTile>
          <div className="min-w-0">
            <CardTitle>Datos de leads</CardTitle>
            <CardDescription>
              Descarga una copia de tus datos o añade leads desde un archivo
              CSV.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid items-stretch gap-3 md:grid-cols-2">
        <section className="flex min-h-56 flex-col rounded-xl border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
              <DownloadIcon className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Exportar leads</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Descarga todos los campos, fechas y etiquetas en un CSV
                compatible con Excel.
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            También puedes usarlo como plantilla para futuras importaciones.
          </p>
          <a
            href="/cuenta/datos-leads"
            download
            className={buttonVariants({
              variant: "outline",
              className: "mt-auto self-start",
            })}
          >
            <DownloadIcon data-icon="inline-start" />
            Exportar CSV
          </a>
        </section>

        <section className="flex min-h-56 flex-col rounded-xl border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
              <UploadIcon className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Importar leads</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Añade cada fila como un lead nuevo y reutiliza automáticamente
                las etiquetas existentes.
              </p>
            </div>
          </div>
          <form
            ref={formRef}
            onSubmit={importCsv}
            className="mt-4 flex flex-1 flex-col gap-3"
          >
            <div>
              <input
                ref={fileRef}
                id="leads-csv"
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                disabled={pending}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) =>
                  setSelectedFileName(event.currentTarget.files?.[0]?.name ?? "")
                }
                aria-invalid={state.status === "error" || undefined}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={pending}
                className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-dashed border-input bg-background px-3 py-2 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                {selectedFileName ? (
                  <CircleCheckIcon
                    className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <FileSpreadsheetIcon
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {selectedFileName || "Seleccionar archivo CSV"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Hasta 5 MB y 5.000 leads
                  </span>
                </span>
              </button>
            </div>
            <FormMessage state={state} />
            <Button
              type="submit"
              className="mt-auto self-start"
              disabled={pending || !selectedFileName}
            >
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
