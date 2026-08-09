"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  ExternalLinkIcon,
  FileJsonIcon,
  FileUpIcon,
  Loader2Icon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import { loadLeadImportComparables } from "@/app/(app)/leads/actions";
import {
  ImportTagSelector,
  type ImportTagChoice,
} from "@/components/import-tag-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  analyzeGooglePlacesLeads,
  type AnalyzedGooglePlacesLead,
  GooglePlacesJsonError,
  parseGooglePlacesJson,
} from "@/lib/google-places-json";
import { findSimilarTag, normalizeTagName } from "@/lib/tag-similarity";
import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function suggestedTagName(rows: AnalyzedGooglePlacesLead[]) {
  const counts = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    for (const category of row.categories) {
      const key = category.toLocaleLowerCase("es");
      const current = counts.get(key);
      counts.set(key, { name: category, count: (current?.count ?? 0) + 1 });
    }
  }
  return [...counts.values()].sort((left, right) => right.count - left.count)[0]
    ?.name;
}

export function LeadImportDialog({
  tags,
}: {
  tags: Tag[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<AnalyzedGooglePlacesLead[]>([]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tagChoice, setTagChoice] = useState<ImportTagChoice | null>(null);
  const [rowTagChoices, setRowTagChoices] = useState<
    Record<number, ImportTagChoice>
  >({});
  const [inferredTag, setInferredTag] = useState("");

  const newCount = rows.filter((row) => !row.duplicate).length;
  const duplicateCount = rows.length - newCount;
  const missingTagCount = rows.filter(
    (row) => !row.duplicate && !(rowTagChoices[row.sourceIndex] ?? tagChoice)
  ).length;
  const draftTagNames = [
    ...new Map(
      [tagChoice, ...Object.values(rowTagChoices)]
        .filter(
          (choice): choice is Extract<ImportTagChoice, { type: "new" }> =>
            choice?.type === "new"
        )
        .map((choice) => [normalizeTagName(choice.name), choice.name])
    ).values(),
  ];

  const resetFile = () => {
    setFile(null);
    setRows([]);
    setError("");
    setDragging(false);
    setTagChoice(null);
    setRowTagChoices({});
    setInferredTag("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const readFile = async (nextFile: File | undefined) => {
    resetFile();
    if (!nextFile) return;

    setFile(nextFile);
    if (!nextFile.name.toLocaleLowerCase("es").endsWith(".json")) {
      setError("El archivo debe tener extensión .json.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError("El archivo supera el límite de 5 MB.");
      return;
    }

    setReading(true);
    try {
      const parsed = parseGooglePlacesJson(await nextFile.text());
      const existingLeads = await loadLeadImportComparables();
      if (!Array.isArray(existingLeads)) {
        setError(existingLeads.error);
        return;
      }
      const analyzed = analyzeGooglePlacesLeads(parsed, existingLeads);
      setRows(analyzed);
      const suggestion = suggestedTagName(analyzed);
      if (suggestion) {
        setInferredTag(suggestion);
        const similar = findSimilarTag(suggestion, tags);
        setTagChoice(
          similar
            ? {
                type: "existing",
                tag: similar.tag,
                matchedFrom: similar.exact ? undefined : suggestion,
              }
            : { type: "new", name: suggestion }
        );
      }
    } catch (readError) {
      setError(
        readError instanceof GooglePlacesJsonError
          ? readError.message
          : "No se ha podido leer el JSON."
      );
    } finally {
      setReading(false);
    }
  };

  const dropFile = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    if (reading) return;
    void readFile(event.dataTransfer.files[0]);
  };

  const removeRow = (sourceIndex: number) => {
    setRows((current) =>
      current.filter((row) => row.sourceIndex !== sourceIndex)
    );
    setRowTagChoices((current) => {
      const next = { ...current };
      delete next[sourceIndex];
      return next;
    });
  };

  const importLeads = async () => {
    if (!file || newCount === 0 || missingTagCount > 0) return;
    setImporting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set(
        "items",
        JSON.stringify(
          rows
            .filter((row) => !row.duplicate)
            .map((row) => {
              const choice = rowTagChoices[row.sourceIndex] ?? tagChoice;
              return choice?.type === "existing"
                ? { sourceIndex: row.sourceIndex, tagId: choice.tag.id }
                : { sourceIndex: row.sourceIndex, tagName: choice?.name };
            })
        )
      );
      const response = await fetch("/leads/importar", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        error?: string;
        imported?: number;
        skipped?: number;
        createdTags?: number;
        tag?: Tag;
        tagCount?: number;
        reusedSimilarTag?: boolean;
      };

      if (!response.ok) {
        setError(result.error ?? "No se pudieron importar los leads.");
        return;
      }

      const imported = result.imported ?? 0;
      const skipped = result.skipped ?? 0;
      toast.success(
        `${imported} ${imported === 1 ? "lead importado" : "leads importados"}${
          skipped > 0
            ? ` · ${skipped} ${skipped === 1 ? "duplicado omitido" : "duplicados omitidos"}`
            : ""
        }${
          result.tag
            ? ` · Etiqueta: ${result.tag.name}`
            : result.tagCount
              ? ` · ${result.tagCount} etiquetas`
              : ""
        }`
      );
      setOpen(false);
      resetFile();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (importing) return;
        setOpen(nextOpen);
        if (!nextOpen) resetFile();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <UploadIcon />
        Importar
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Importar leads de Google Maps</DialogTitle>
          <DialogDescription>
            Exporta los datos con{" "}
            <a
              href="https://apify.com/compass/crawler-google-places"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-brand"
            >
              Google Maps Scraper de Apify
              <ExternalLinkIcon className="size-3" aria-hidden="true" />
            </a>
            , sube el JSON y revisa los datos antes de confirmar. Los duplicados
            se detectan por teléfono o por nombre junto con dirección, web o
            ubicación.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void readFile(event.currentTarget.files?.[0])}
        />

        {rows.length === 0 ? (
          <button
            type="button"
            className={cn(
              "flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed border-input bg-muted/20 px-6 text-center transition-colors outline-none",
              "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              dragging && "border-brand bg-brand/5 ring-3 ring-brand/15",
              reading && "pointer-events-none opacity-60"
            )}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragging(false);
              }
            }}
            onDrop={dropFile}
            disabled={reading}
          >
            <span className="mb-3 flex size-11 items-center justify-center rounded-xl border bg-background text-muted-foreground shadow-xs">
              <FileUpIcon className="size-5" />
            </span>
            <span className="font-medium">
              {reading
                ? "Leyendo archivo…"
                : dragging
                  ? "Suelta el JSON para cargarlo"
                  : file?.name || "Arrastra tu JSON aquí"}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              o haz clic para seleccionarlo · hasta 5 MB y 5.000 leads
            </span>
          </button>
        ) : (
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border">
            <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-3 py-2.5">
              <FileJsonIcon className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {rows.length} {rows.length === 1 ? "registro" : "registros"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-3.5" />
                  {newCount} nuevos
                </span>
                {duplicateCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <CircleAlertIcon className="size-3.5" />
                    {duplicateCount} {duplicateCount === 1 ? "duplicado" : "duplicados"}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={resetFile}>
                <RotateCcwIcon />
                Cambiar
              </Button>
            </div>
            <div className="flex flex-col gap-2 border-b bg-background px-3 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Etiqueta predeterminada</p>
                <p className="text-xs text-muted-foreground">
                  Se usa en los leads sin una etiqueta personalizada.
                </p>
              </div>
              <ImportTagSelector
                tags={tags}
                value={tagChoice}
                onChange={setTagChoice}
                ariaLabel="Etiqueta predeterminada"
                draftTagNames={draftTagNames}
              />
              {tagChoice && Object.keys(rowTagChoices).length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRowTagChoices({})}
                >
                  Aplicar a todos
                </Button>
              )}
              {tagChoice?.type === "existing" && tagChoice.matchedFrom && (
                <p className="text-xs text-brand sm:max-w-52">
                  «{tagChoice.matchedFrom}» coincide con una etiqueta existente.
                </p>
              )}
              {tagChoice?.type === "new" && (
                <p className="text-xs text-muted-foreground sm:max-w-44">
                  Se creará al confirmar.
                </p>
              )}
              {!tagChoice && inferredTag && (
                <p className="text-xs text-muted-foreground sm:max-w-44">
                  Sugerencia: {inferredTag}
                </p>
              )}
            </div>
            <div className="max-h-[40vh] min-h-0 flex-1 overflow-auto sm:max-h-[48vh]">
              <div className="divide-y sm:hidden">
                {rows.map((row) => (
                  <div
                    key={`mobile-${row.placeId ?? row.name}-${row.sourceIndex}`}
                    className={cn(
                      "space-y-2.5 p-3",
                      row.duplicate && "bg-amber-500/5 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="mt-1 text-xs">
                          {row.duplicate ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                              <CircleAlertIcon className="size-3.5" />
                              {row.duplicateReason}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2Icon className="size-3.5" />
                              Se importará
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(row.sourceIndex)}
                        aria-label={`Quitar ${row.name} de la importación`}
                        title="Quitar de la importación"
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                    {!row.duplicate && (
                      <ImportTagSelector
                        tags={tags}
                        value={rowTagChoices[row.sourceIndex] ?? tagChoice}
                        onChange={(choice) =>
                          setRowTagChoices((current) => ({
                            ...current,
                            [row.sourceIndex]: choice,
                          }))
                        }
                        ariaLabel={`Etiqueta para ${row.name}`}
                        draftTagNames={draftTagNames}
                      />
                    )}
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <p className="truncate">
                        {row.categories.join(", ") || "Sin categoría"}
                      </p>
                      <p className="truncate">
                        {[row.phone, row.address].filter(Boolean).join(" · ") ||
                          "Sin teléfono ni dirección"}
                      </p>
                      <p className="truncate">
                        {row.instagram
                          ? `Instagram · @${row.instagram}`
                          : row.website || "Sin web"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <table className="hidden w-full min-w-[1100px] text-left text-sm sm:table">
                <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]">
                  <tr>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      Negocio
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      Resultado
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      Etiqueta
                    </th>
                    <th className="w-12 px-3 py-2">
                      <span className="sr-only">Quitar</span>
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      Categorías
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      Teléfono
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      Dirección
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      Online
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.placeId ?? row.name}-${row.sourceIndex}`}
                      className={cn(
                        "border-t",
                        row.duplicate && "bg-amber-500/5 text-muted-foreground"
                      )}
                    >
                      <td className="max-w-52 px-3 py-2 font-medium">
                        <span className="block truncate">{row.name}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {row.duplicate ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                            <CircleAlertIcon className="size-3.5" />
                            {row.duplicateReason}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2Icon className="size-3.5" />
                            Se importará
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.duplicate ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <ImportTagSelector
                            tags={tags}
                            value={rowTagChoices[row.sourceIndex] ?? tagChoice}
                            onChange={(choice) =>
                              setRowTagChoices((current) => ({
                                ...current,
                                [row.sourceIndex]: choice,
                              }))
                            }
                            ariaLabel={`Etiqueta para ${row.name}`}
                            draftTagNames={draftTagNames}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeRow(row.sourceIndex)}
                          aria-label={`Quitar ${row.name} de la importación`}
                          title="Quitar de la importación"
                        >
                          <Trash2Icon />
                        </Button>
                      </td>
                      <td className="max-w-48 px-3 py-2">
                        <span className="block truncate">
                          {row.categories.join(", ") || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {row.phone ?? "—"}
                      </td>
                      <td className="max-w-72 px-3 py-2">
                        <span className="block truncate">{row.address ?? "—"}</span>
                      </td>
                      <td className="max-w-44 px-3 py-2">
                        <span className="block truncate">
                          {row.instagram
                            ? `Instagram · @${row.instagram}`
                            : row.website || "Sin web"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={importing}
          >
            Cancelar
          </Button>
          <Button
            disabled={newCount === 0 || importing || missingTagCount > 0}
            onClick={() => void importLeads()}
          >
            {importing ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <UploadIcon />
            )}
            {importing
              ? "Importando…"
              : missingTagCount > 0
                ? `Faltan ${missingTagCount} ${missingTagCount === 1 ? "etiqueta" : "etiquetas"}`
              : newCount > 0
                ? `Importar ${newCount} ${newCount === 1 ? "lead" : "leads"}`
                : "Nada que importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
