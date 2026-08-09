"use client";

import { useState, useTransition } from "react";
import {
  CheckIcon,
  Loader2Icon,
  PencilIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { deleteTag, renameTag } from "@/app/(app)/cuenta/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export type TagSetting = {
  id: number;
  name: string;
  color: string;
  itemCount: number;
};

export function TagSettings({ tags }: { tags: TagSetting[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<TagSetting | null>(null);
  const [renamePending, startRenameTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  function stopEditing() {
    setEditingId(null);
    setDraftName("");
  }

  function submitRename(tag: TagSetting) {
    const name = draftName.trim();
    if (!name) {
      toast.error("Introduce un nombre para la etiqueta.");
      return;
    }

    if (name === tag.name) {
      stopEditing();
      return;
    }

    startRenameTransition(async () => {
      const result = await renameTag(tag.id, name);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Etiqueta renombrada");
      stopEditing();
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Etiquetas</CardTitle>
          <CardDescription>
            Renombra o elimina las etiquetas que utilizas para organizar tus leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center">
              <TagsIcon className="mb-2 size-5 text-muted-foreground" />
              <p className="font-medium">Aún no tienes etiquetas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Puedes crearlas al añadir o editar un lead.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              {tags.map((tag, index) => {
                const editing = editingId === tag.id;
                return (
                  <div key={tag.id}>
                    {index > 0 && <Separator />}
                    <div className="flex min-h-14 items-center gap-3 px-3 py-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                        aria-hidden="true"
                      />

                      {editing ? (
                        <form
                          className="flex min-w-0 flex-1 items-center gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            submitRename(tag);
                          }}
                        >
                          <Input
                            value={draftName}
                            onChange={(event) => setDraftName(event.target.value)}
                            maxLength={80}
                            autoFocus
                            aria-label={`Nuevo nombre para ${tag.name}`}
                            disabled={renamePending}
                          />
                          <Button
                            type="submit"
                            size="icon-sm"
                            aria-label="Guardar nombre"
                            disabled={renamePending}
                          >
                            {renamePending ? (
                              <Loader2Icon className="animate-spin" />
                            ) : (
                              <CheckIcon />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Cancelar edición"
                            onClick={stopEditing}
                            disabled={renamePending}
                          >
                            <XIcon />
                          </Button>
                        </form>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{tag.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tag.itemCount === 0
                                ? "Sin leads asociados"
                                : `${tag.itemCount} ${tag.itemCount === 1 ? "lead asociado" : "leads asociados"}`}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Renombrar ${tag.name}`}
                            onClick={() => {
                              setEditingId(tag.id);
                              setDraftName(tag.name);
                            }}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            aria-label={`Eliminar ${tag.name}`}
                            onClick={() => setDeleteCandidate(tag)}
                          >
                            <Trash2Icon />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deleteCandidate != null}
        onOpenChange={(open) => {
          if (!open && !deletePending) setDeleteCandidate(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              ¿Eliminar «{deleteCandidate?.name}»?
            </DialogTitle>
            <DialogDescription>
              {deleteCandidate && deleteCandidate.itemCount > 0 ? (
                <>
                  Esta etiqueta se quitará de {deleteCandidate.itemCount}{" "}
                  {deleteCandidate.itemCount === 1 ? "lead" : "leads"}. Los leads
                  no se eliminarán. Esta acción no se puede deshacer.
                </>
              ) : (
                "La etiqueta se eliminará permanentemente. Esta acción no se puede deshacer."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteCandidate(null)}
              disabled={deletePending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deletePending || !deleteCandidate}
              onClick={() => {
                if (!deleteCandidate) return;
                const candidate = deleteCandidate;
                startDeleteTransition(async () => {
                  const result = await deleteTag(
                    candidate.id,
                    candidate.itemCount > 0
                  );
                  if ("error" in result) {
                    toast.error(result.error);
                    return;
                  }
                  if ("requiresConfirmation" in result) {
                    setDeleteCandidate({
                      ...candidate,
                      itemCount: result.associatedCount,
                    });
                    return;
                  }

                  toast.success("Etiqueta eliminada");
                  setDeleteCandidate(null);
                });
              }}
            >
              {deletePending ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <Trash2Icon />
              )}
              Eliminar etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
