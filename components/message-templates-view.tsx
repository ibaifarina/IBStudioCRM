"use client";

import { useMemo, useRef, useState } from "react";
import {
  MessageSquarePlusIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
} from "lucide-react";
import { MessageTemplateFillForm } from "@/components/message-template-fill-form";
import { TemplateEditorDialog } from "@/components/template-editor-dialog";
import { TemplateIcon } from "@/components/template-icon";
import { TemplateVariableToken } from "@/components/template-variable-text";
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
  const detailRef = useRef<HTMLElement>(null);

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

  const selectTemplate = (id: number) => {
    setSelectedId(id);
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
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

      <div className="grid min-h-[680px] overflow-hidden rounded-2xl border bg-card shadow-xs lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b bg-muted/20 lg:border-r lg:border-b-0">
          <div className="border-b p-3">
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="bg-transparent pl-8 dark:bg-input/30"
                placeholder="Buscar plantillas…"
                aria-label="Buscar plantillas"
              />
            </div>
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              {filteredTemplates.length} de {templates.length}{" "}
              {templates.length === 1 ? "plantilla" : "plantillas"}
            </p>
          </div>

          <div className="max-h-80 min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-none">
            {filteredTemplates.length > 0 ? (
              <div className="space-y-1">
                {filteredTemplates.map((template) => {
                  const isSelected = selected?.id === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => selectTemplate(template.id)}
                      aria-current={isSelected || undefined}
                      className={cn(
                        "group block w-full rounded-xl border p-3 text-left transition-all duration-150",
                        isSelected
                          ? "border-brand/40 bg-brand/[0.06] shadow-xs dark:border-brand/25 dark:bg-brand/[0.14]"
                          : "border-transparent hover:border-border hover:bg-foreground/[0.04]"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <TemplateIcon
                          name={template.icon}
                          className={cn(
                            "size-5 shrink-0 text-muted-foreground",
                            isSelected && "text-brand"
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {template.name}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
                <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <SearchXIcon className="size-5" />
                </span>
                <p className="text-sm font-medium">Sin coincidencias</p>
                <p className="mt-1 max-w-52 text-xs leading-5 text-muted-foreground">
                  Prueba con otro nombre o con texto del mensaje.
                </p>
              </div>
            )}
          </div>

        </aside>

        <main ref={detailRef} className="min-w-0 scroll-mt-4">
          {selected ? (
            <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
              <div className="flex items-start gap-4 border-b pb-6">
                <TemplateIcon
                  name={selected.icon}
                  className="mt-1 size-6 shrink-0 text-brand"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-heading text-2xl font-semibold tracking-tight">
                    {selected.name}
                  </h2>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setEditingTemplate(selected)}
                >
                  <PencilIcon />
                  Editar
                </Button>
              </div>

              <div
                key={selected.id}
                className="mt-7 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <MessageTemplateFillForm
                  key={`template-use-${selected.id}`}
                  content={selected.content}
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[680px] flex-col items-center justify-center px-6 text-center">
              <span className="mb-5 flex size-16 items-center justify-center rounded-2xl border bg-muted/30 text-muted-foreground shadow-xs">
                <MessageSquarePlusIcon className="size-7" />
              </span>
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                Crea tu primera plantilla
              </h2>
              <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
                Añade variables como{" "}
                <TemplateVariableToken
                  variableKey="nombre"
                  className="px-1.5 py-0 text-xs"
                >
                  [nombre]
                </TemplateVariableToken>{" "}
                y tendrás mensajes reutilizables listos para copiar en segundos.
              </p>
              <Button className="mt-5" onClick={() => setEditingTemplate(null)}>
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
