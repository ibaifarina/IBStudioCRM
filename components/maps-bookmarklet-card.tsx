"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  GripVerticalIcon,
  MapPinnedIcon,
} from "lucide-react";
import { toast } from "sonner";
import { IconTile } from "@/components/icon-tile";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildGoogleMapsBookmarklet } from "@/lib/google-maps-bookmarklet";
import { cn } from "@/lib/utils";

const BOOKMARK_NAME = "Enviar negocio a IBStudio CRM";

const STEPS = [
  "Abre la ficha del negocio en Google Maps.",
  `Pulsa el marcador “${BOOKMARK_NAME}”.`,
  "El CRM se abre y muestra “Nuevo lead” ya rellenado.",
];

export function MapsBookmarkletCard() {
  const bookmarkRef = useRef<HTMLAnchorElement>(null);
  const scriptRef = useRef<HTMLInputElement>(null);
  const [copyState, setCopyState] = useState<
    "idle" | "copied" | "selected"
  >("idle");

  useLayoutEffect(() => {
    const bookmarklet = buildGoogleMapsBookmarklet(window.location.origin);
    // React blocks javascript: URLs in JSX. This is a trusted, local script and
    // must exist as the real href for browsers to create it as a bookmark.
    bookmarkRef.current?.setAttribute("href", bookmarklet);
    if (scriptRef.current) scriptRef.current.value = bookmarklet;
  });

  const handleCopy = async () => {
    const bookmarklet = buildGoogleMapsBookmarklet(window.location.origin);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await Promise.race([
          navigator.clipboard.writeText(bookmarklet),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("Clipboard timeout")), 750)
          ),
        ]);
        copied = true;
      }
    } catch {
      // Permission is browser-controlled; use the visible field fallback.
    }

    if (!copied && scriptRef.current) {
      scriptRef.current.focus();
      scriptRef.current.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopyState("copied");
      toast.success("Script del extractor copiado");
    } else {
      setCopyState("selected");
      toast.info("Script seleccionado. Pulsa Ctrl+C o ⌘C para copiarlo.");
    }
    window.setTimeout(() => setCopyState("idle"), 6_000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <IconTile>
            <MapPinnedIcon aria-hidden="true" />
          </IconTile>
          <div className="min-w-0">
            <CardTitle>Extractor de Google Maps</CardTitle>
            <CardDescription>
              Añade este marcador para enviar los datos visibles de un negocio
              al CRM y abrir el lead ya rellenado.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 rounded-xl border border-dashed border-brand/30 bg-brand/[0.04] p-4 sm:grid-cols-[1fr_auto] sm:items-center dark:border-brand/25 dark:bg-brand/[0.08]">
          <div className="min-w-0">
            <p className="font-medium">Instalación rápida</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Arrastra el botón hasta la barra de marcadores del navegador.
            </p>
          </div>
          <a
            ref={bookmarkRef}
            href="#"
            draggable
            onClick={(event) => {
              event.preventDefault();
              toast.info("Arrastra este botón a la barra de marcadores.");
            }}
            onDragStart={(event) => {
              event.dataTransfer.setData(
                "text/uri-list",
                buildGoogleMapsBookmarklet(window.location.origin)
              );
              event.dataTransfer.setData(
                "text/plain",
                buildGoogleMapsBookmarklet(window.location.origin)
              );
              event.dataTransfer.effectAllowed = "copyLink";
            }}
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "cursor-grab shadow-sm active:cursor-grabbing"
            )}
            title="Arrastra este enlace a la barra de marcadores"
          >
            <GripVerticalIcon aria-hidden="true" />
            {BOOKMARK_NAME}
          </a>
        </div>

        <div className="grid gap-2.5">
          <div>
            <p className="text-sm font-medium">Instalación manual</p>
            <p className="text-xs text-muted-foreground">
              Crea un marcador y pega el script copiado en su campo URL.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              ref={scriptRef}
              readOnly
              defaultValue=""
              onFocus={(event) => event.currentTarget.select()}
              aria-label="Script del extractor de Google Maps"
              className="min-w-0 font-mono text-xs"
            />
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copyState === "copied" ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {copyState === "copied"
                ? "Copiado"
                : copyState === "selected"
                  ? "Seleccionado"
                  : "Copiar script"}
            </Button>
          </div>
        </div>

        <ol className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border bg-background text-[10px] font-semibold tabular-nums text-foreground">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
