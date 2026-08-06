"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChartPieIcon,
  MapIcon,
  PlusIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";
import { LeadDialog } from "@/components/lead-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { OPEN_NEW_LEAD_EVENT, OPEN_PALETTE_EVENT } from "@/lib/events";
import {
  GOOGLE_MAPS_CRM_WINDOW_NAME,
  GOOGLE_MAPS_LEAD_ACK_TYPE,
  GOOGLE_MAPS_LEAD_HASH_KEY,
  GOOGLE_MAPS_LEAD_MESSAGE_TYPE,
  parseGoogleMapsLead,
  parseGoogleMapsLeadHash,
  type GoogleMapsLead,
} from "@/lib/google-maps-lead";
import type { LeadOption, Tag } from "@/lib/types";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

function isGoogleMapsOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      /(^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export function GlobalActions({
  leads,
  tags,
}: {
  leads: LeadOption[];
  tags: Tag[];
}) {
  const router = useRouter();
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [importedMapsLead, setImportedMapsLead] =
    useState<GoogleMapsLead | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openNewLead = useCallback(() => {
    setImportedMapsLead(null);
    setNewLeadOpen(true);
  }, []);

  const openImportedLead = useCallback((mapsLead: GoogleMapsLead) => {
    setImportedMapsLead(mapsLead);
    setNewLeadOpen(true);
  }, []);

  const setLeadDialogOpen = (nextOpen: boolean) => {
    setNewLeadOpen(nextOpen);
    if (!nextOpen) {
      setImportedMapsLead(null);
    }
  };

  useEffect(() => {
    const openPalette = () => setPaletteOpen(true);

    window.name = GOOGLE_MAPS_CRM_WINDOW_NAME;

    const importFromHash = () => {
      const hasImport = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      ).has(GOOGLE_MAPS_LEAD_HASH_KEY);
      if (!hasImport) return;

      const mapsLead = parseGoogleMapsLeadHash(window.location.hash);
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`
      );
      if (mapsLead) openImportedLead(mapsLead);
    };

    const onMapsMessage = (event: MessageEvent<unknown>) => {
      if (!isGoogleMapsOrigin(event.origin)) return;
      if (!event.data || typeof event.data !== "object") return;

      const message = event.data as Record<string, unknown>;
      if (
        message.type !== GOOGLE_MAPS_LEAD_MESSAGE_TYPE ||
        typeof message.payload !== "string" ||
        message.payload.length > 100_000
      ) {
        return;
      }

      const mapsLead = parseGoogleMapsLead(message.payload);
      if (!mapsLead) return;

      if (event.source && typeof message.id === "string") {
        try {
          (event.source as Window).postMessage(
            { type: GOOGLE_MAPS_LEAD_ACK_TYPE, id: message.id },
            event.origin
          );
        } catch {
          // The import still succeeds if the source tab closes before the ack.
        }
      }
      openImportedLead(mapsLead);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (
        e.key.toLowerCase() === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        openNewLead();
      }
    };

    window.addEventListener(OPEN_NEW_LEAD_EVENT, openNewLead);
    window.addEventListener(OPEN_PALETTE_EVENT, openPalette);
    window.addEventListener("hashchange", importFromHash);
    window.addEventListener("message", onMapsMessage);
    window.addEventListener("keydown", onKeyDown);
    importFromHash();
    return () => {
      window.removeEventListener(OPEN_NEW_LEAD_EVENT, openNewLead);
      window.removeEventListener(OPEN_PALETTE_EVENT, openPalette);
      window.removeEventListener("hashchange", importFromHash);
      window.removeEventListener("message", onMapsMessage);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openImportedLead, openNewLead]);

  const run = (fn: () => void) => {
    setPaletteOpen(false);
    fn();
  };

  return (
    <>
      <LeadDialog
        open={newLeadOpen}
        onOpenChange={setLeadDialogOpen}
        allTags={tags}
        importedMapsLead={importedMapsLead}
      />

      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent
          className="top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          <DialogDescription className="sr-only">
            Busca leads o ejecuta acciones
          </DialogDescription>
          <Command>
            <CommandInput placeholder="Buscar leads, acciones…" />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup heading="Acciones">
                <CommandItem onSelect={() => run(openNewLead)}>
                  <PlusIcon />
                  Nuevo lead
                </CommandItem>
                <CommandItem onSelect={() => run(() => router.push("/"))}>
                  <ChartPieIcon />
                  Ir a Resumen
                </CommandItem>
                <CommandItem
                  onSelect={() => run(() => router.push("/leads"))}
                >
                  <UsersIcon />
                  Ir a Leads
                </CommandItem>
                <CommandItem
                  onSelect={() => run(() => router.push("/mapa"))}
                >
                  <MapIcon />
                  Ir al Mapa
                </CommandItem>
              </CommandGroup>
              {leads.length > 0 && (
                <CommandGroup heading="Leads">
                  {leads.map((lead) => (
                    <CommandItem
                      key={lead.id}
                      value={`${lead.name} ${lead.instagram ?? ""}`}
                      onSelect={() =>
                        run(() => router.push(`/leads?open=${lead.id}`))
                      }
                    >
                      <StoreIcon />
                      <span className="truncate">{lead.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
