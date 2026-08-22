"use client";

import { useMemo, useState } from "react";
import {
  ChevronRightIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { MessageTemplateFillForm } from "@/components/message-template-fill-form";
import { TemplateEditorDialog } from "@/components/template-editor-dialog";
import { TemplateIcon } from "@/components/template-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MessageTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MessageTemplatesView({
  initialTemplates,
}: {
  initialTemplates: MessageTemplate[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialTemplates[0]?.id ?? null
  );
  const [search, setSearch] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<
    MessageTemplate | null | undefined
  >(undefined);
  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    if (!query) return templates;
    return templates.filter(
      (template) =>
        template.name.toLocaleLowerCase("es").includes(query) ||
        template.content.toLocaleLowerCase("es").includes(query)
    );
  }, [search, templates]);
  const selected =
    templates.find((template) => template.id === selectedId) ?? templates[0];

  const handleSaved = (saved: MessageTemplate) => {
    setTemplates((current) => {
      const exists = current.some((template) => template.id === saved.id);
      return exists
        ? current.map((template) => (template.id === saved.id ? saved : template))
        : [saved, ...current];
    });
    setSelectedId(saved.id);
  };

  const handleDeleted = (deletedId: number) => {
    const remaining = templates.filter((template) => template.id !== deletedId);
    setTemplates(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  };

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Plantillas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personaliza y copia mensajes sin repetir trabajo.
          </p>
        </div>
        <Button size="lg" onClick={() => setEditingTemplate(null)}>
          <PlusIcon />
          Nueva plantilla
        </Button>
      </header>

      <div className="grid min-h-[680px] overflow-hidden rounded-xl border bg-card shadow-xs lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b bg-muted/15 lg:border-r lg:border-b-0">
          <div className="border-b p-4">
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="bg-background pl-8"
                placeholder="Buscar plantillas…"
                aria-label="Buscar plantillas"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {filteredTemplates.length} de {templates.length}{" "}
              {templates.length === 1 ? "plantilla" : "plantillas"}
            </p>
          </div>

          <div className="max-h-80 flex-1 overflow-y-auto p-3 lg:max-h-none">
            {filteredTemplates.length > 0 ? (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedId(template.id)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl border bg-background px-3 py-3 text-left transition-[border-color,box-shadow,transform] hover:border-foreground/15 hover:shadow-xs active:scale-[0.99]",
                      selected?.id === template.id &&
                        "border-brand/60 bg-brand/[0.035] shadow-xs ring-1 ring-brand/10"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground",
                        selected?.id === template.id &&
                          "border-brand/25 bg-brand/10 text-brand"
                      )}
                    >
                      <TemplateIcon name={template.icon} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {template.name}
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {template.content}
                      </span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
                <SearchIcon className="mb-3 size-5 text-muted-foreground" />
                <p className="text-sm font-medium">No hay coincidencias</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Prueba con otro nombre o texto del mensaje.
                </p>
              </div>
            )}
          </div>

          <div className="hidden items-start gap-2 border-t px-4 py-4 text-xs leading-5 text-muted-foreground lg:flex">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            Las variables conocidas se rellenan automáticamente al abrir una plantilla desde un lead.
          </div>
        </aside>

        <main className="min-w-0 bg-background">
          {selected ? (
            <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
              <div className="mb-7 flex items-center gap-3 border-b pb-5">
                <span className="flex size-12 items-center justify-center rounded-xl border bg-muted/25 text-brand">
                  <TemplateIcon name={selected.icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-heading text-2xl font-semibold tracking-tight">
                    {selected.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Completa, revisa y copia el mensaje.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setEditingTemplate(selected)}
                >
                  <PencilIcon />
                  Editar
                </Button>
              </div>

              <MessageTemplateFillForm
                key={`template-use-${selected.id}`}
                content={selected.content}
              />
            </div>
          ) : (
            <div className="flex min-h-[680px] flex-col items-center justify-center px-6 text-center">
              <span className="mb-4 flex size-12 items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
                <PlusIcon className="size-5" />
              </span>
              <h2 className="font-heading text-lg font-semibold">
                Crea tu primera plantilla
              </h2>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                Añade variables como [nombre] y tendrás un mensaje reutilizable listo para copiar.
              </p>
              <Button className="mt-4" onClick={() => setEditingTemplate(null)}>
                <PlusIcon />
                Nueva plantilla
              </Button>
            </div>
          )}
        </main>
      </div>

      {editingTemplate !== undefined && (
        <TemplateEditorDialog
          key={editingTemplate?.id ?? "new-template"}
          template={editingTemplate}
          open
          onOpenChange={(open) => !open && setEditingTemplate(undefined)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
