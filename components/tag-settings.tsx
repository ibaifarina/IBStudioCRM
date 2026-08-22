"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { deleteTag, renameTag } from "@/app/(app)/cuenta/actions";
import { IconTile } from "@/components/icon-tile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
import { createTag } from "@/lib/actions";
import { TAG_COLORS } from "@/lib/config";

export type TagSetting = {
  id: number;
  name: string;
  color: string;
  itemCount: number;
};

function itemCountLabel(itemCount: number) {
  if (itemCount === 0) return "Sin leads";
  return `${itemCount} ${itemCount === 1 ? "lead" : "leads"}`;
}

export function TagSettings({ tags }: { tags: TagSetting[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<TagSetting | null>(null);
  const [renamePending, startRenameTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [draftNewName, setDraftNewName] = useState("");
  const [createPending, startCreateTransition] = useTransition();

  const previewColor = TAG_COLORS[tags.length % TAG_COLORS.length];

  function stopEditing() {
    setEditingId(null);
    setDraftName("");
  }

  function closeCreateDialog() {
    if (createPending) return;
    setCreateOpen(false);
    setDraftNewName("");
  }

  function submitCreate() {
    const name = draftNewName.trim();
    if (!name) {
      toast.error("Introduce un nombre para la etiqueta.");
      return;
    }

    startCreateTransition(async () => {
      const result = await createTag(name);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (tags.some((tag) => tag.id === result.id)) {
        toast.info("Ya existe una etiqueta con ese nombre.");
      } else {
        toast.success("Etiqueta creada");
      }
      setCreateOpen(false);
      setDraftNewName("");
      router.refresh();
    });
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
          <div className="flex items-start gap-3">
            <IconTile>
              <TagsIcon aria-hidden="true" />
            </IconTile>
            <div className="min-w-0">
              <CardTitle>Etiquetas</CardTitle>
              <CardDescription>
                Crea, renombra o elimina las etiquetas que utilizas para
                organizar tus leads.
              </CardDescription>
            </div>
          </div>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={createPending}
            >
              <PlusIcon data-icon="inline-start" />
              Nueva etiqueta
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-12 text-center">
              <div className="flex size-11 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
                <TagsIcon className="size-5" aria-hidden="true" />
              </div>
              <p className="mt-3 font-medium">Aún no tienes etiquetas</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Crea la primera para organizar tus leads por categorías.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setCreateOpen(true)}
                disabled={createPending}
              >
                <PlusIcon data-icon="inline-start" />
                Crear etiqueta
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border">
              {tags.map((tag) => {
                const editing = editingId === tag.id;
                return (
                  <li
                    key={tag.id}
                    className="group flex min-h-14 items-center gap-3 px-3.5 py-2 transition-colors hover:bg-muted/40"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10 ring-inset"
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
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                          {tag.name}
                        </p>
                        <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
                          {itemCountLabel(tag.itemCount)}
                        </span>
                        <div className="ml-1 flex shrink-0 items-center gap-0.5 lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
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
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) closeCreateDialog();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva etiqueta</DialogTitle>
            <DialogDescription>
              El color se asigna automáticamente para mantener la paleta equilibrada.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitCreate();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="new-tag-name" className="text-sm font-medium">
                Nombre
              </label>
              <Input
                id="new-tag-name"
                value={draftNewName}
                onChange={(event) => setDraftNewName(event.target.value)}
                maxLength={80}
                autoFocus
                autoComplete="off"
                placeholder="P. ej. Restaurante"
                disabled={createPending}
              />
              <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border bg-muted/40 py-1 pr-2.5 pl-2 text-xs font-medium">
                <span
                  className="size-2 rounded-full ring-1 ring-black/10 ring-inset"
                  style={{ backgroundColor: previewColor }}
                  aria-hidden="true"
                />
                {draftNewName.trim() || "Nueva etiqueta"}
              </span>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeCreateDialog}
                disabled={createPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createPending || !draftNewName.trim()}>
                {createPending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <PlusIcon />
                )}
                Crear etiqueta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
