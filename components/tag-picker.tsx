"use client";

import { useState, useTransition } from "react";
import { PlusIcon, TagIcon } from "lucide-react";
import { toast } from "sonner";
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
import { createTag } from "@/lib/actions";
import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TagPicker({
  allTags,
  selected,
  onChange,
  className,
}: {
  allTags: Tag[];
  selected: Tag[];
  onChange: (tags: Tag[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localTags, setLocalTags] = useState<Tag[]>([]);
  const [creating, startCreate] = useTransition();

  const tags = [
    ...allTags,
    ...localTags.filter((t) => !allTags.some((a) => a.id === t.id)),
  ];

  const isSelected = (tag: Tag) => selected.some((t) => t.id === tag.id);

  const toggle = (tag: Tag) => {
    onChange(
      isSelected(tag)
        ? selected.filter((t) => t.id !== tag.id)
        : [...selected, tag]
    );
  };

  const trimmed = search.trim();
  const exactMatch = tags.some(
    (t) => t.name.toLowerCase() === trimmed.toLowerCase()
  );

  const handleCreate = () => {
    if (!trimmed || creating) return;
    startCreate(async () => {
      const result = await createTag(trimmed);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setLocalTags((prev) =>
        prev.some((t) => t.id === result.id) ? prev : [...prev, result]
      );
      if (!selected.some((t) => t.id === result.id)) {
        onChange([...selected, result]);
      }
      setSearch("");
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex min-h-8 w-full cursor-pointer flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2 py-1 text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        {selected.length === 0 ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <TagIcon className="size-3.5" />
            Añadir etiquetas…
          </span>
        ) : (
          selected.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              onRemove={() => toggle(tag)}
            />
          ))
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar o crear etiqueta…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {trimmed ? "Pulsa abajo para crearla" : "Sin etiquetas"}
            </CommandEmpty>
            <CommandGroup>
              {tags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.name}
                  data-checked={isSelected(tag)}
                  onSelect={() => toggle(tag)}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmed && !exactMatch && (
              <CommandGroup forceMount>
                <CommandItem
                  value={`__crear__${trimmed}`}
                  forceMount
                  disabled={creating}
                  onSelect={handleCreate}
                >
                  <PlusIcon className="size-4" />
                  Crear «{trimmed}»
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
