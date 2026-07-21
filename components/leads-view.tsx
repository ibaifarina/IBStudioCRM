"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AtSignIcon,
  ExternalLinkIcon,
  FilterIcon,
  Loader2Icon,
  MapPinIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { LeadDialog } from "@/components/lead-dialog";
import { StatusDot, StatusSelect } from "@/components/status-badge";
import { TagBadge } from "@/components/tag-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteLead } from "@/lib/actions";
import { STATUSES } from "@/lib/config";
import { formatDate, formatDateShort, isFollowUpOverdue, isFollowUpToday } from "@/lib/dates";
import { openNewLead } from "@/lib/events";
import type { LeadWithTags, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

function instagramUrl(handle: string) {
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}

function mapsUrl(lead: LeadWithTags) {
  if (lead.lat != null && lead.lng != null) {
    return `https://www.google.com/maps?q=${lead.lat},${lead.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${lead.name} ${lead.address ?? "Barcelona"}`
  )}`;
}

export function LeadsView({
  leads,
  tags,
  initialOpenId,
}: {
  leads: LeadWithTags[];
  tags: Tag[];
  initialOpenId?: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<number | "all">("all");
  const [openId, setOpenId] = useState<number | null>(initialOpenId ?? null);
  const [editing, setEditing] = useState<LeadWithTags | null>(null);
  const [deleting, setDeleting] = useState<LeadWithTags | null>(null);

  // Sincroniza ?open=<id> de la URL (p. ej. al llegar desde la paleta ⌘K).
  const [prevInitial, setPrevInitial] = useState(initialOpenId);
  if (initialOpenId !== prevInitial) {
    setPrevInitial(initialOpenId);
    if (initialOpenId != null) setOpenId(initialOpenId);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (tagFilter !== "all" && !lead.tags.some((t) => t.id === tagFilter))
        return false;
      if (!q) return true;
      const haystack = [
        lead.name,
        lead.instagram,
        lead.notes,
        lead.problem,
        lead.address,
        ...lead.tags.map((t) => t.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, search, statusFilter, tagFilter]);

  const openLead = openId != null ? leads.find((l) => l.id === openId) : null;
  const activeTag = tagFilter !== "all" ? tags.find((t) => t.id === tagFilter) : null;

  const closeSheet = () => {
    setOpenId(null);
    if (typeof window !== "undefined" && window.location.search.includes("open=")) {
      router.replace("/leads");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nombre, notas, zona…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="gap-1.5">
                <FilterIcon className="size-3.5" />
                {statusFilter === "all"
                  ? "Estado"
                  : STATUSES.find((s) => s.value === statusFilter)?.label}
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={() => setStatusFilter("all")}>
              Todos los estados
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {STATUSES.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
              >
                <StatusDot status={s.value} />
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="gap-1.5">
                <TagIcon className="size-3.5" />
                {activeTag ? activeTag.name : "Etiqueta"}
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => setTagFilter("all")}>
              Todas las etiquetas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {tags.map((t) => (
              <DropdownMenuItem key={t.id} onClick={() => setTagFilter(t.id)}>
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {(statusFilter !== "all" || tagFilter !== "all" || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setTagFilter("all");
            }}
          >
            Limpiar
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} de {leads.length} leads
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Negocio</TableHead>
              <TableHead className="hidden lg:table-cell">Etiquetas</TableHead>
              <TableHead className="hidden xl:table-cell">Notas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Contacto</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <span>No hay leads que coincidan.</span>
                    <Button size="sm" onClick={openNewLead}>
                      <PlusIcon />
                      Añadir lead
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((lead) => {
              const overdue = isFollowUpOverdue(lead.followUpDate, lead.status);
              const today = isFollowUpToday(lead.followUpDate, lead.status);
              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(lead.id)}
                >
                  <TableCell className="max-w-56 pl-4">
                    <div className="truncate font-medium">{lead.name}</div>
                    {lead.instagram && (
                      <div className="truncate text-xs text-muted-foreground">
                        @{lead.instagram}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex max-w-44 flex-wrap gap-1">
                      {lead.tags.map((tag) => (
                        <TagBadge key={tag.id} tag={tag} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-72 xl:table-cell">
                    <p className="truncate text-muted-foreground">
                      {lead.notes?.trim() || lead.problem?.trim() || "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusSelect leadId={lead.id} status={lead.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDateShort(lead.contactDate)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        overdue && "font-semibold text-destructive",
                        today && "font-semibold text-brand"
                      )}
                    >
                      {formatDateShort(lead.followUpDate)}
                      {overdue && " · vencido"}
                      {today && " · hoy"}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontalIcon />
                            <span className="sr-only">Acciones</span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setEditing(lead)}>
                          <PencilIcon />
                          Editar
                        </DropdownMenuItem>
                        {lead.instagram && (
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(instagramUrl(lead.instagram!), "_blank")
                            }
                          >
                            <AtSignIcon />
                            Abrir Instagram
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => window.open(mapsUrl(lead), "_blank")}
                        >
                          <MapPinIcon />
                          Ver en Google Maps
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(lead)}
                        >
                          <Trash2Icon />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <LeadSheet
        lead={openLead ?? null}
        onClose={closeSheet}
        onEdit={(lead) => setEditing(lead)}
        onDelete={(lead) => setDeleting(lead)}
      />

      <LeadDialog
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
        allTags={tags}
        lead={editing}
      />

      <DeleteDialog
        lead={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          closeSheet();
        }}
      />
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function LeadSheet({
  lead,
  onClose,
  onEdit,
  onDelete,
}: {
  lead: LeadWithTags | null;
  onClose: () => void;
  onEdit: (lead: LeadWithTags) => void;
  onDelete: (lead: LeadWithTags) => void;
}) {
  return (
    <Sheet open={lead != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {lead && (
          <>
            <SheetHeader className="border-b pb-4">
              <SheetTitle className="pr-8 font-heading text-xl">
                {lead.name}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detalle del lead
              </SheetDescription>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusSelect leadId={lead.id} status={lead.status} />
                {lead.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-3 p-4">
              <InfoRow label="Instagram">
                {lead.instagram ? (
                  <a
                    href={instagramUrl(lead.instagram)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    @{lead.instagram}
                    <ExternalLinkIcon className="size-3" />
                  </a>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow label="Web">
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-brand hover:underline"
                  >
                    <span className="truncate">{lead.website}</span>
                    <ExternalLinkIcon className="size-3 shrink-0" />
                  </a>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow label="Teléfono">
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <PhoneIcon className="size-3" />
                    {lead.phone}
                  </a>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow label="Dirección">
                <a
                  href={mapsUrl(lead)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <MapPinIcon className="size-3 shrink-0" />
                  {lead.address ?? "Ver en Maps"}
                </a>
              </InfoRow>
              <InfoRow label="Contacto">{formatDate(lead.contactDate)}</InfoRow>
              <InfoRow label="Follow-up">
                <span
                  className={cn(
                    isFollowUpOverdue(lead.followUpDate, lead.status) &&
                      "font-semibold text-destructive"
                  )}
                >
                  {formatDate(lead.followUpDate)}
                  {isFollowUpOverdue(lead.followUpDate, lead.status) &&
                    " · vencido"}
                </span>
              </InfoRow>

              {(lead.notes?.trim() || lead.problem?.trim()) && (
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Notas
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {lead.notes?.trim() || lead.problem}
                  </p>
                </div>
              )}

              <div className="mt-2 flex gap-2">
                <Button className="flex-1" onClick={() => onEdit(lead)}>
                  <PencilIcon />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => onDelete(lead)}
                  aria-label="Eliminar lead"
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DeleteDialog({
  lead,
  onClose,
  onDeleted,
}: {
  lead: LeadWithTags | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={lead != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Eliminar «{lead?.name}»?</DialogTitle>
          <DialogDescription>
            Se borrará el lead con todas sus notas. Esta acción no se puede
            deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (!lead) return;
              startTransition(async () => {
                const result = await deleteLead(lead.id);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Lead eliminado");
                onDeleted();
              });
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
