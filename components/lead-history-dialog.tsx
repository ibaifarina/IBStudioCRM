"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2Icon,
  HistoryIcon,
  Loader2Icon,
  RotateCcwIcon,
} from "lucide-react";
import { toast } from "sonner";
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
  loadLeadChangeHistory,
  restoreLeadChangeSet,
} from "@/lib/actions";
import type { LeadChangeSet } from "@/lib/types";

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export function LeadHistoryDialog({
  onRestored,
  open: controlledOpen,
  onOpenChange,
}: {
  onRestored: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [changes, setChanges] = useState<LeadChangeSet[]>([]);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<LeadChangeSet | null>(null);
  const [loading, startLoading] = useTransition();
  const [restoring, startRestoring] = useTransition();

  const refreshHistory = async () => {
    try {
      const result = await loadLeadChangeHistory();
      if (Array.isArray(result)) {
        setChanges(result);
        setLoadError("");
      } else {
        setLoadError(result.error);
      }
    } catch {
      setLoadError("No se pudo conectar con el historial de cambios.");
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) startLoading(refreshHistory);
        }}
      >
        {controlledOpen === undefined && (
          <DialogTrigger render={<Button variant="outline" />}>
            <HistoryIcon />
            Historial
          </DialogTrigger>
        )}
        <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de cambios</DialogTitle>
            <DialogDescription>
              Cada cambio guarda los datos y etiquetas anteriores. Las ediciones
              masivas se agrupan para poder restaurarlas de una vez. El historial
              se conserva durante 30 días.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
            {loading && changes.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Cargando historial…
              </div>
            ) : loadError ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 text-center">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startLoading(refreshHistory)}
                >
                  Reintentar
                </Button>
              </div>
            ) : changes.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
                <HistoryIcon className="mb-3 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Todavía no hay cambios</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Las próximas ediciones aparecerán aquí automáticamente.
                </p>
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {changes.map((change) => (
                  <div
                    key={change.id}
                    className="flex items-center gap-3 px-3 py-3"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {change.restoredAt ? (
                        <CheckCircle2Icon className="size-4" />
                      ) : (
                        <HistoryIcon className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {change.description}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(change.createdAt)} · {change.leadCount}{" "}
                        {change.leadCount === 1 ? "lead" : "leads"}
                        {change.restoredAt && " · Restaurado"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={Boolean(change.restoredAt)}
                      onClick={() => setSelected(change)}
                    >
                      <RotateCcwIcon />
                      {change.restoredAt ? "Restaurado" : "Restaurar"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selected != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !restoring) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Restaurar esta versión?</DialogTitle>
            <DialogDescription>
              Se recuperará el estado anterior de {selected?.leadCount ?? 0}{" "}
              {selected?.leadCount === 1 ? "lead" : "leads"}, incluidas sus
              etiquetas. El estado actual también se guardará, por si quieres
              revertir esta restauración.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
              <p className="text-sm font-medium">{selected.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateTime(selected.createdAt)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={restoring}
              onClick={() => setSelected(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={restoring || !selected}
              onClick={() => {
                if (!selected) return;
                startRestoring(async () => {
                  const result = await restoreLeadChangeSet(selected.id);
                  if ("error" in result) {
                    toast.error(result.error);
                    return;
                  }

                  toast.success(
                    `${result.restored} ${
                      result.restored === 1 ? "lead restaurado" : "leads restaurados"
                    }`
                  );
                  setSelected(null);
                  await refreshHistory();
                  await onRestored();
                });
              }}
            >
              {restoring ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <RotateCcwIcon />
              )}
              Restaurar versión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
