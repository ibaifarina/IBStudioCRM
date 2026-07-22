"use client";

import { useEffect, useState } from "react";
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
import type { LeadOption, Tag } from "@/lib/types";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
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
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const openLead = () => setNewLeadOpen(true);
    const openPalette = () => setPaletteOpen(true);

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
        setNewLeadOpen(true);
      }
    };

    window.addEventListener(OPEN_NEW_LEAD_EVENT, openLead);
    window.addEventListener(OPEN_PALETTE_EVENT, openPalette);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_NEW_LEAD_EVENT, openLead);
      window.removeEventListener(OPEN_PALETTE_EVENT, openPalette);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const run = (fn: () => void) => {
    setPaletteOpen(false);
    fn();
  };

  return (
    <>
      <LeadDialog
        open={newLeadOpen}
        onOpenChange={setNewLeadOpen}
        allTags={tags}
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
                <CommandItem
                  onSelect={() => run(() => setNewLeadOpen(true))}
                >
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
