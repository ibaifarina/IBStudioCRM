"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  PlusIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react";
import { TagBadge } from "@/components/tag-badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { findSimilarTag, normalizeTagName } from "@/lib/tag-similarity";
import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ImportTagChoice =
  | { type: "existing"; tag: Tag; matchedFrom?: string }
  | { type: "new"; name: string };

export function ImportTagSelector({
  tags,
  value,
  onChange,
  className,
  ariaLabel = "Elegir etiqueta",
  draftTagNames = [],
}: {
  tags: Tag[];
  value: ImportTagChoice | null;
  onChange: (value: ImportTagChoice) => void;
  className?: string;
  ariaLabel?: string;
  draftTagNames?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const trimmed = search.trim().slice(0, 80);
  const similar = trimmed ? findSimilarTag(trimmed, tags) : null;
  const exact = tags.some(
    (tag) => normalizeTagName(tag.name) === normalizeTagName(trimmed)
  );
  const drafts = [
    ...new Map(
      draftTagNames
        .map((name) => name.trim())
        .filter(Boolean)
        .filter(
          (name) =>
            !tags.some(
              (tag) => normalizeTagName(tag.name) === normalizeTagName(name)
            )
        )
        .map((name) => [normalizeTagName(name), name])
    ).values(),
  ];
  const exactDraft = drafts.some(
    (name) => normalizeTagName(name) === normalizeTagName(trimmed)
  );

  const select = (choice: ImportTagChoice) => {
    onChange(choice);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 max-w-full items-center gap-1 rounded-full p-1 text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
        aria-label={ariaLabel}
      >
        {value?.type === "existing" ? (
          <TagBadge tag={value.tag} className="h-6 max-w-52 px-2.5 text-sm" />
        ) : value?.type === "new" ? (
          <span className="inline-flex h-6 min-w-0 max-w-52 items-center gap-1.5 rounded-full border border-dashed border-brand/40 bg-brand/5 px-2.5 text-sm font-medium text-brand">
            <PlusIcon className="size-3.5 shrink-0" />
            <span className="truncate">{value.name}</span>
          </span>
        ) : (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-dashed px-2.5 text-xs text-muted-foreground">
            <TagIcon className="size-3.5" />
            Elegir etiqueta…
          </span>
        )}
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar o escribir etiqueta…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {trimmed ? "Puedes crearla abajo" : "Sin etiquetas"}
            </CommandEmpty>
            <CommandGroup heading="Etiquetas existentes">
              {tags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.name}
                  data-checked={
                    value?.type === "existing" && value.tag.id === tag.id
                  }
                  onSelect={() => select({ type: "existing", tag })}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {drafts.length > 0 && (
              <CommandGroup heading="Nuevas en esta importación">
                {drafts.map((name) => (
                  <CommandItem
                    key={normalizeTagName(name)}
                    value={`nueva ${name}`}
                    data-checked={
                      value?.type === "new" &&
                      normalizeTagName(value.name) === normalizeTagName(name)
                    }
                    onSelect={() => select({ type: "new", name })}
                  >
                    <PlusIcon className="text-brand" />
                    <span className="truncate">{name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      pendiente
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {trimmed && similar && !similar.exact && (
              <CommandGroup heading="Coincidencia inteligente" forceMount>
                <CommandItem
                  value={`__similar__${trimmed}`}
                  forceMount
                  onSelect={() =>
                    select({
                      type: "existing",
                      tag: similar.tag,
                      matchedFrom: trimmed,
                    })
                  }
                >
                  <SparklesIcon className="text-brand" />
                  <span className="min-w-0">
                    <span className="block truncate">Usar «{similar.tag.name}»</span>
                    <span className="block text-xs text-muted-foreground">
                      Se parece a «{trimmed}»
                    </span>
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {trimmed && !exact && !similar && !exactDraft && (
              <CommandGroup forceMount>
                <CommandItem
                  value={`__crear__${trimmed}`}
                  forceMount
                  onSelect={() => select({ type: "new", name: trimmed })}
                >
                  <PlusIcon />
                  Crear «{trimmed}» al importar
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
