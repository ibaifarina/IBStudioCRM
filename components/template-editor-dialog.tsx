"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { GripVerticalIcon, Loader2Icon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  deleteMessageTemplate,
  saveMessageTemplate,
} from "@/app/(app)/plantillas/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemplateIconPicker } from "@/components/template-icon-picker";
import { DEFAULT_TEMPLATE_ICON } from "@/components/template-icon";
import {
  TEMPLATE_VARIABLE_MIME,
  TemplateContentEditor,
  type TemplateContentEditorHandle,
} from "@/components/template-content-editor";
import { templateVariableStyle } from "@/components/template-variable-text";
import {
  extractTemplateVariables,
  normalizeTemplateVariable,
  type TemplateVariable,
} from "@/lib/message-templates";
import type { MessageTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTED_VARIABLES = [
  "nombre",
  "teléfono",
  "instagram",
  "web",
  "dirección",
  "servicio",
];

function editableVariables(content: string): TemplateVariable[] {
  const variables = new Map<string, TemplateVariable>();
  for (const label of SUGGESTED_VARIABLES) {
    const key = normalizeTemplateVariable(label);
    variables.set(key, { key, label });
  }
  for (const variable of extractTemplateVariables(content)) {
    variables.set(variable.key, variable);
  }
  return [...variables.values()];
}

export function TemplateEditorDialog({
  template,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  template: MessageTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (template: MessageTemplate) => void;
  onDeleted: (id: number) => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [icon, setIcon] = useState(template?.icon ?? DEFAULT_TEMPLATE_ICON);
  const [content, setContent] = useState(template?.content ?? "");
  const [draggingOver, setDraggingOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const editorApiRef = useRef<TemplateContentEditorHandle | null>(null);
  const variables = useMemo(() => editableVariables(content), [content]);

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
        <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {template ? "Editar plantilla" : "Nueva plantilla"}
            </DialogTitle>
            <DialogDescription>
              Las variables son elementos: arrástralas a cualquier punto del mensaje.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-1 min-h-0 overflow-y-auto px-1">
            <div className="grid gap-5 py-1 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="space-y-5">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <div className="space-y-1.5">
                    <Label>Icono</Label>
                    <TemplateIconPicker value={icon} onChange={setIcon} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="template-editor-name">Nombre</Label>
                    <Input
                      id="template-editor-name"
                      value={name}
                      maxLength={80}
                      placeholder="Ej. Primer contacto"
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <Label htmlFor="template-editor-content">Mensaje</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Haz clic o suelta una variable donde quieras usarla.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {content.length}/5000
                    </span>
                  </div>
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-xl border bg-transparent transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/20",
                      draggingOver && "border-brand ring-3 ring-brand/15"
                    )}
                    onDragOver={(event) => {
                      if (
                        !event.dataTransfer.types.includes(TEMPLATE_VARIABLE_MIME)
                      ) {
                        return;
                      }
                      event.preventDefault();
                      setDraggingOver(true);
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                        setDraggingOver(false);
                      }
                    }}
                    onDrop={() => setDraggingOver(false)}
                  >
                    <TemplateContentEditor
                      handleRef={editorApiRef}
                      value={content}
                      onChange={setContent}
                      variables={variables}
                      placeholder="Escribe el mensaje de la plantilla…"
                    />
                  </div>
                  <p id="template-editor-help" className="text-xs text-muted-foreground">
                    Escribe una variable entre corchetes y se convertirá en etiqueta;
                    también puedes arrastrarlas entre palabras.
                  </p>
                </div>
              </div>

              <aside className="rounded-xl border bg-muted/20 p-3">
                <p className="text-sm font-semibold">Variables</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Arrástralas al mensaje.
                </p>
                <div className="mt-3 space-y-1.5">
                  {variables.map((variable) => (
                    <button
                      key={variable.key}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "copy";
                        event.dataTransfer.setData(
                          TEMPLATE_VARIABLE_MIME,
                          variable.key
                        );
                      }}
                      onClick={() => editorApiRef.current?.insertVariable(variable)}
                      className={cn(
                        "flex w-full cursor-grab items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-transform active:cursor-grabbing active:scale-[0.98]",
                        templateVariableStyle(variable.key).soft
                      )}
                    >
                      <GripVerticalIcon className="size-3.5 opacity-55" />
                      [{variable.label}]
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Se insertan donde tengas el cursor y puedes moverlas después.
                </p>
              </aside>
            </div>
          </div>

          <DialogFooter className="border-t pt-4 sm:justify-between">
            <div>
              {template && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2Icon />
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={saving || !name.trim() || !content.trim()}
                onClick={() =>
                  startSaving(async () => {
                    const result = await saveMessageTemplate({
                      ...(template ? { id: template.id } : {}),
                      name,
                      icon,
                      content,
                    });
                    if ("error" in result) {
                      toast.error(result.error);
                      return;
                    }
                    onSaved(result);
                    onOpenChange(false);
                    toast.success(template ? "Plantilla actualizada" : "Plantilla creada");
                  })
                }
              >
                {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
                {template ? "Guardar cambios" : "Crear plantilla"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar esta plantilla?</DialogTitle>
            <DialogDescription>
              Se eliminará «{template?.name}». Esta acción no afecta a ningún lead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleting || !template}
              onClick={() => {
                if (!template) return;
                startDeleting(async () => {
                  const result = await deleteMessageTemplate(template.id);
                  if ("error" in result) {
                    toast.error(result.error);
                    return;
                  }
                  onDeleted(template.id);
                  setConfirmDelete(false);
                  onOpenChange(false);
                  toast.success("Plantilla eliminada");
                });
              }}
            >
              {deleting && <Loader2Icon className="animate-spin" />}
              Eliminar plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
