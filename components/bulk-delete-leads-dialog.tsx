"use client";

import { useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteLeadsBulk } from "@/lib/actions";

export function BulkDeleteLeadsDialog({
  open,
  onOpenChange,
  leadIds,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: number[];
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const count = leadIds.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            ¿Eliminar {count} {count === 1 ? "lead" : "leads"}?
          </DialogTitle>
          <DialogDescription>
            Se borrarán los leads seleccionados, junto con sus notas y
            etiquetas. Podrás recuperarlos juntos desde el historial de cambios.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending || count === 0}
            onClick={() => {
              startTransition(async () => {
                const result = await deleteLeadsBulk(leadIds);
                if ("error" in result) {
                  toast.error(result.error);
                  return;
                }

                toast.success(
                  `${result.deleted} ${result.deleted === 1 ? "lead eliminado" : "leads eliminados"}`
                );
                onOpenChange(false);
                onDeleted();
              });
            }}
          >
            {pending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <Trash2Icon />
            )}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
