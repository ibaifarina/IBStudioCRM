"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, SearchIcon } from "lucide-react";
import { iconNames, type IconName } from "lucide-react/dynamic";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DEFAULT_TEMPLATE_ICON,
  TemplateIcon,
} from "@/components/template-icon";
import { cn } from "@/lib/utils";

const ICON_BATCH_SIZE = 60;

const SPANISH_ICON_ALIASES: Record<string, string> = {
  mensaje: "message chat mail send",
  correo: "mail inbox send",
  teléfono: "phone smartphone call",
  telefono: "phone smartphone call",
  usuario: "user contact person",
  usuarios: "users contacts people",
  calendario: "calendar date clock",
  ubicación: "map pin navigation",
  ubicacion: "map pin navigation",
  documento: "file document clipboard",
  propuesta: "file signature briefcase",
  web: "globe monitor laptop",
  estrella: "star sparkles award",
};

function iconSearchText(name: string) {
  const aliases = Object.entries(SPANISH_ICON_ALIASES)
    .filter(([, targets]) => targets.split(" ").some((target) => name.includes(target)))
    .map(([alias]) => alias)
    .join(" ");
  return `${name.replaceAll("-", " ")} ${aliases}`;
}

export function TemplateIconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(ICON_BATCH_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const filteredIcons = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return query
      ? iconNames.filter((name) => iconSearchText(name).includes(query))
      : iconNames;
  }, [search]);
  const visibleIcons = filteredIcons.slice(0, visibleCount);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || visibleCount >= filteredIcons.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((current) =>
            Math.min(current + ICON_BATCH_SIZE, filteredIcons.length)
          );
        }
      },
      { rootMargin: "120px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredIcons.length, visibleCount]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-xl border bg-background text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Elegir icono"
          />
        }
      >
        <TemplateIcon name={value || DEFAULT_TEMPLATE_ICON} className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(380px,calc(100vw-2rem))] gap-0 p-0">
        <div className="border-b p-3">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setVisibleCount(ICON_BATCH_SIZE);
              }}
              className="pl-8"
              placeholder="Buscar iconos…"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {visibleIcons.length > 0 ? (
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
              {visibleIcons.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={name.replaceAll("-", " ")}
                  aria-label={`Usar icono ${name}`}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    value === name && "bg-brand/10 text-brand ring-1 ring-brand/30"
                  )}
                >
                  <TemplateIcon name={name} />
                  {value === name && (
                    <CheckIcon className="absolute right-0.5 bottom-0.5 size-2.5 text-brand" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
              No hay iconos que coincidan.
            </div>
          )}
          {visibleCount < filteredIcons.length && (
            <div
              ref={loadMoreRef}
              className="mt-2 grid grid-cols-8 gap-1 sm:grid-cols-10"
              aria-label="Cargando más iconos"
            >
              {Array.from({ length: 10 }, (_, index) => (
                <span
                  key={index}
                  className="aspect-square animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          )}
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {Math.min(visibleCount, filteredIcons.length)} de {filteredIcons.length} iconos
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type { IconName };
