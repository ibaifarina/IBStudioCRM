"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { endOfDay, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import {
  AtSignIcon,
  CheckIcon,
  ExternalLinkIcon,
  FilterIcon,
  GlobeIcon,
  Loader2Icon,
  MapPinIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { loadLeadsPage } from "@/app/(app)/leads/actions";
import { AddedDateFilter } from "@/components/added-date-filter";
import { BulkDeleteLeadsDialog } from "@/components/bulk-delete-leads-dialog";
import { BulkEditLeadsDialog } from "@/components/bulk-edit-leads-dialog";
import { LeadImportDialog } from "@/components/lead-import-dialog";
import { LeadDialog } from "@/components/lead-dialog";
import { StatusDot, StatusSelect } from "@/components/status-badge";
import { TagBadge } from "@/components/tag-badge";
import {
  WebsiteStatusBadge,
  WebsiteStatusDot,
  WebsiteStatusSelect,
} from "@/components/website-status-badge";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import {
  STATUSES,
  WEBSITE_STATUSES,
  WEBSITE_STATUS_MAP,
} from "@/lib/config";
import { formatDate, formatDateShort, isFollowUpOverdue, isFollowUpToday } from "@/lib/dates";
import { openNewLead } from "@/lib/events";
import type {
  LeadFilters,
  LeadPage,
  LeadWithTags,
  Tag,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function instagramUrl(handle: string) {
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  return `https://wa.me/${digits}`;
}

function mapsUrl(lead: LeadWithTags) {
  if (lead.lat != null && lead.lng != null) {
    return `https://www.google.com/maps?q=${lead.lat},${lead.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${lead.name} ${lead.address ?? "Barcelona"}`
  )}`;
}

function FilterMenuValue({ children }: { children?: string }) {
  return (
    <span className="ml-auto max-w-24 truncate text-right text-xs font-normal text-muted-foreground">
      {children}
    </span>
  );
}

export function LeadsView({
  initialPage,
  tags,
  today,
  createdDates,
  initialOpenId,
  initialOpenLead,
}: {
  initialPage: LeadPage;
  tags: Tag[];
  today: string;
  createdDates: string[];
  initialOpenId?: number;
  initialOpenLead: LeadWithTags | null;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialPage.leads);
  const [total, setTotal] = useState(initialPage.total ?? initialPage.leads.length);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [websiteStatusFilter, setWebsiteStatusFilter] =
    useState<string>("all");
  const [tagFilter, setTagFilter] = useState<number | "all">("all");
  const [addedDateFilter, setAddedDateFilter] = useState<DateRange>();
  const [openId, setOpenId] = useState<number | null>(initialOpenId ?? null);
  const [editing, setEditing] = useState<LeadWithTags | null>(null);
  const [deleting, setDeleting] = useState<LeadWithTags | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Sincroniza ?open=<id> de la URL (p. ej. al llegar desde la paleta ⌘K).
  const [prevInitial, setPrevInitial] = useState(initialOpenId);
  if (initialOpenId !== prevInitial) {
    setPrevInitial(initialOpenId);
    if (initialOpenId != null) setOpenId(initialOpenId);
  }

  const filters = useMemo<LeadFilters>(() => {
    const from = addedDateFilter?.from;
    const to = addedDateFilter?.to ?? from;
    return {
      search: search.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      websiteStatus:
        websiteStatusFilter === "all"
          ? undefined
          : (websiteStatusFilter as LeadFilters["websiteStatus"]),
      tagId: tagFilter === "all" ? undefined : tagFilter,
      createdFrom: from ? startOfDay(from).toISOString() : undefined,
      createdTo: to ? endOfDay(to).toISOString() : undefined,
    };
  }, [
    addedDateFilter,
    search,
    statusFilter,
    tagFilter,
    websiteStatusFilter,
  ]);

  const hasFilters = Object.values(filters).some(Boolean);
  const filtersKey = JSON.stringify(filters);
  const activeFiltersKey = useRef(filtersKey);

  useEffect(() => {
    activeFiltersKey.current = filtersKey;
  }, [filtersKey]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(
      () => {
        if (!hasFilters) {
          setLeads(initialPage.leads);
          setTotal(initialPage.total ?? initialPage.leads.length);
          setNextCursor(initialPage.nextCursor);
          setIsFiltering(false);
          return;
        }

        setIsFiltering(true);
        void loadLeadsPage({ filters })
          .then((result) => {
            if (cancelled) return;
            if ("error" in result) {
              toast.error(result.error);
              setIsFiltering(false);
              return;
            }
            setLeads(result.leads);
            setTotal(result.total ?? result.leads.length);
            setNextCursor(result.nextCursor);
            setSelectedIds(new Set());
            setIsFiltering(false);
          })
          .catch(() => {
            if (cancelled) return;
            toast.error("No se pudieron cargar los leads.");
            setIsFiltering(false);
          });
      },
      search.trim() ? 250 : 0
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [filters, hasFilters, initialPage, search]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore || isFiltering) return;
    const requestedFiltersKey = filtersKey;
    setIsLoadingMore(true);
    try {
      const result = await loadLeadsPage({ cursor: nextCursor, filters });
      if (requestedFiltersKey !== activeFiltersKey.current) return;
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setLeads((current) => {
        const existingIds = new Set(current.map((lead) => lead.id));
        return [
          ...current,
          ...result.leads.filter((lead) => !existingIds.has(lead.id)),
        ];
      });
      setNextCursor(result.nextCursor);
    } catch {
      if (requestedFiltersKey === activeFiltersKey.current) {
        toast.error("No se pudieron cargar más leads.");
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [filters, filtersKey, isFiltering, isLoadingMore, nextCursor]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !nextCursor || isFiltering) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isFiltering, loadMore, nextCursor]);

  const filtered = leads;

  const openLead =
    openId != null
      ? (leads.find((lead) => lead.id === openId) ??
        (initialOpenLead?.id === openId ? initialOpenLead : null))
      : null;
  const activeTag = tagFilter !== "all" ? tags.find((t) => t.id === tagFilter) : null;
  const selectedCount = selectedIds.size;
  const activeFilterCount = [
    statusFilter !== "all",
    websiteStatusFilter !== "all",
    tagFilter !== "all",
    Boolean(addedDateFilter?.from),
  ].filter(Boolean).length;
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((lead) => selectedIds.has(lead.id));
  const someFilteredSelected = filtered.some((lead) => selectedIds.has(lead.id));

  const toggleLead = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filtered.forEach((lead) => next.delete(lead.id));
      } else {
        filtered.forEach((lead) => next.add(lead.id));
      }
      return next;
    });
  };

  const closeSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

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
              <Button
                variant="outline"
                className={cn("gap-1.5", activeFilterCount > 0 && "bg-muted")}
              >
                <FilterIcon className="size-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FilterIcon />
                <span>Estado</span>
                <FilterMenuValue>
                  {statusFilter === "all"
                    ? "Todos"
                    : STATUSES.find((s) => s.value === statusFilter)?.label}
                </FilterMenuValue>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  <CheckIcon className={cn(statusFilter !== "all" && "opacity-0")} />
                  Todos los estados
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {STATUSES.map((status) => (
                  <DropdownMenuItem
                    key={status.value}
                    onClick={() => setStatusFilter(status.value)}
                  >
                    <StatusDot status={status.value} />
                    <span className="flex-1">{status.label}</span>
                    {statusFilter === status.value && <CheckIcon />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <GlobeIcon />
                <span>Web</span>
                <FilterMenuValue>
                  {websiteStatusFilter === "all"
                    ? "Todas"
                    : WEBSITE_STATUS_MAP[
                        websiteStatusFilter as keyof typeof WEBSITE_STATUS_MAP
                      ]?.label}
                </FilterMenuValue>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <DropdownMenuItem onClick={() => setWebsiteStatusFilter("all")}>
                  <CheckIcon
                    className={cn(websiteStatusFilter !== "all" && "opacity-0")}
                  />
                  Todos los estados web
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {WEBSITE_STATUSES.map((status) => (
                  <DropdownMenuItem
                    key={status.value}
                    onClick={() => setWebsiteStatusFilter(status.value)}
                  >
                    <WebsiteStatusDot status={status.value} />
                    <span className="flex-1">{status.label}</span>
                    {websiteStatusFilter === status.value && <CheckIcon />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <TagIcon />
                <span>Etiqueta</span>
                <FilterMenuValue>
                  {activeTag?.name ?? "Todas"}
                </FilterMenuValue>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <DropdownMenuItem onClick={() => setTagFilter("all")}>
                  <CheckIcon className={cn(tagFilter !== "all" && "opacity-0")} />
                  Todas las etiquetas
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {tags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    onClick={() => setTagFilter(tag.id)}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 truncate">{tag.name}</span>
                    {tagFilter === tag.id && <CheckIcon />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <AddedDateFilter
              createdDates={createdDates}
              today={today}
              value={addedDateFilter}
              onChange={setAddedDateFilter}
            />

          </DropdownMenuContent>
        </DropdownMenu>

        <LeadImportDialog tags={tags} />

        {selectionMode ? (
          <Button variant="outline" onClick={closeSelectionMode}>
            Cancelar edición
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => setSelectionMode(true)}
            disabled={filtered.length === 0}
          >
            <PencilIcon />
            Editar varios
          </Button>
        )}

        {(statusFilter !== "all" ||
          websiteStatusFilter !== "all" ||
          tagFilter !== "all" ||
          addedDateFilter?.from ||
          search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setWebsiteStatusFilter("all");
              setTagFilter("all");
              setAddedDateFilter(undefined);
            }}
          >
            Limpiar
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {isFiltering ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2Icon className="size-3.5 animate-spin" />
              Buscando…
            </span>
          ) : (
            `${filtered.length} de ${total} leads`
          )}
        </span>
      </div>

      {selectionMode && selectedCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
          <span className="mr-auto text-sm font-medium">
            {selectedCount} {selectedCount === 1 ? "lead seleccionado" : "leads seleccionados"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Deseleccionar
          </Button>
          <Button size="sm" onClick={() => setBulkEditing(true)}>
            <PencilIcon />
            Editar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleting(true)}
          >
            <Trash2Icon />
            Eliminar
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectionMode && (
                <TableHead className="w-10 pl-4">
                  <input
                    type="checkbox"
                    role="checkbox"
                    aria-label="Seleccionar todos los leads visibles"
                    checked={allFilteredSelected}
                    ref={(element) => {
                      if (element) {
                        element.indeterminate =
                          someFilteredSelected && !allFilteredSelected;
                      }
                    }}
                    onChange={toggleAllFiltered}
                    disabled={filtered.length === 0}
                    className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                  />
                </TableHead>
              )}
              <TableHead className={selectionMode ? undefined : "pl-4"}>
                Negocio
              </TableHead>
              <TableHead className="hidden lg:table-cell">Etiquetas</TableHead>
              <TableHead className="hidden md:table-cell">Web</TableHead>
              <TableHead className="hidden xl:table-cell">Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Contacto</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFiltering && (
              <TableRow>
                <TableCell
                  colSpan={selectionMode ? 9 : 8}
                  className="h-32 text-center"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    Cargando leads…
                  </span>
                </TableCell>
              </TableRow>
            )}
            {!isFiltering && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={selectionMode ? 9 : 8}
                  className="h-32 text-center"
                >
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
            {!isFiltering && filtered.map((lead) => {
              const overdue = isFollowUpOverdue(lead.followUpDate, lead.status);
              const today = isFollowUpToday(lead.followUpDate, lead.status);
              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  data-state={selectedIds.has(lead.id) ? "selected" : undefined}
                  onClick={() => setOpenId(lead.id)}
                >
                  {selectionMode && (
                    <TableCell
                      className="w-10 pl-4"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        role="checkbox"
                        aria-label={`Seleccionar ${lead.name}`}
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleLead(lead.id)}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </TableCell>
                  )}
                  <TableCell
                    className={cn("max-w-56", !selectionMode && "pl-4")}
                  >
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
                  <TableCell className="hidden md:table-cell">
                    <WebsiteStatusSelect
                      leadId={lead.id}
                      status={lead.websiteStatus}
                    />
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <PhoneIcon className="size-3.5" />
                        {lead.phone}
                      </a>
                    ) : (
                      "—"
                    )}
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

      <div
        ref={loadMoreRef}
        className="flex min-h-16 items-center justify-center py-3"
      >
        {nextCursor && !isFiltering ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
          >
            {isLoadingMore && <Loader2Icon className="animate-spin" />}
            {isLoadingMore ? "Cargando…" : "Cargar más leads"}
          </Button>
        ) : !isFiltering && filtered.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            Se han cargado todos los leads.
          </span>
        ) : null}
      </div>

      <LeadSheet
        lead={openLead ?? null}
        onClose={closeSheet}
        onEdit={(lead) => setEditing(lead)}
        onDelete={(lead) => setDeleting(lead)}
      />

      <BulkEditLeadsDialog
        open={bulkEditing}
        onOpenChange={setBulkEditing}
        leadIds={[...selectedIds]}
        allTags={tags}
        onUpdated={closeSelectionMode}
      />

      <BulkDeleteLeadsDialog
        open={bulkDeleting}
        onOpenChange={setBulkDeleting}
        leadIds={[...selectedIds]}
        onDeleted={closeSelectionMode}
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
                <WebsiteStatusBadge status={lead.websiteStatus} />
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
              <InfoRow label="Estado web">
                <WebsiteStatusBadge status={lead.websiteStatus} />
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
              <InfoRow label="WhatsApp">
                {lead.phone ? (
                  <a
                    href={whatsappUrl(lead.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    <MessageCircleIcon className="size-3" />
                    Abrir chat
                    <ExternalLinkIcon className="size-3" />
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
                  className="inline-flex max-w-full min-w-0 items-center gap-1 hover:underline"
                >
                  <MapPinIcon className="size-3 shrink-0" />
                  <span className="truncate">
                    {lead.address ?? "Ver en Maps"}
                  </span>
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
