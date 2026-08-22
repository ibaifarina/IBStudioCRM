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
  ArrowUpDownIcon,
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FilterIcon,
  GlobeIcon,
  HistoryIcon,
  Loader2Icon,
  MapPinIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  TagIcon,
  Trash2Icon,
  UploadIcon,
  WrenchIcon,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { loadLeadsPage } from "@/app/(app)/leads/actions";
import { AddedDateFilter } from "@/components/added-date-filter";
import { BulkDeleteLeadsDialog } from "@/components/bulk-delete-leads-dialog";
import { BulkEditLeadsDialog } from "@/components/bulk-edit-leads-dialog";
import { LeadImportDialog } from "@/components/lead-import-dialog";
import { LeadHistoryDialog } from "@/components/lead-history-dialog";
import { LeadDialog } from "@/components/lead-dialog";
import { StatusDot, StatusSelect } from "@/components/status-badge";
import { TagBadge } from "@/components/tag-badge";
import { UseMessageTemplateDialog } from "@/components/use-message-template-dialog";
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
  LEAD_SORTS,
  STATUSES,
  WEBSITE_STATUSES,
  WEBSITE_STATUS_MAP,
  type WebsiteStatusKey,
} from "@/lib/config";
import { formatDate, formatDateShort, isFollowUpOverdue, isFollowUpToday } from "@/lib/dates";
import { openNewLead } from "@/lib/events";
import type {
  LeadFilters,
  LeadPage,
  LeadSort,
  LeadWithTags,
  MessageTemplate,
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
    <span className="ml-auto max-w-32 truncate text-right text-xs font-normal text-muted-foreground">
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
  templates,
}: {
  initialPage: LeadPage;
  tags: Tag[];
  today: string;
  createdDates: string[];
  initialOpenId?: number;
  initialOpenLead: LeadWithTags | null;
  templates: MessageTemplate[];
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
  const [sort, setSort] = useState<LeadSort>("updated_desc");
  const [openId, setOpenId] = useState<number | null>(initialOpenId ?? null);
  const [editing, setEditing] = useState<LeadWithTags | null>(null);
  const [deleting, setDeleting] = useState<LeadWithTags | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selectionAnchorRef = useRef<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [importingLeads, setImportingLeads] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [messageLead, setMessageLead] = useState<LeadWithTags | null>(null);
  const [openLeadOverride, setOpenLeadOverride] =
    useState<LeadWithTags | null>(null);

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
  const isDefaultQuery = !hasFilters && sort === "updated_desc";
  const queryKey = JSON.stringify({ filters, sort });
  const activeQueryKey = useRef(queryKey);

  useEffect(() => {
    activeQueryKey.current = queryKey;
  }, [queryKey]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(
      () => {
        if (isDefaultQuery) {
          setLeads(initialPage.leads);
          setTotal(initialPage.total ?? initialPage.leads.length);
          setNextCursor(initialPage.nextCursor);
          setIsFiltering(false);
          return;
        }

        setIsFiltering(true);
        void loadLeadsPage({ filters, sort })
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
  }, [filters, initialPage, isDefaultQuery, search, sort]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore || isFiltering) return;
    const requestedQueryKey = queryKey;
    setIsLoadingMore(true);
    try {
      const result = await loadLeadsPage({ cursor: nextCursor, filters, sort });
      if (requestedQueryKey !== activeQueryKey.current) return;
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
      if (requestedQueryKey === activeQueryKey.current) {
        toast.error("No se pudieron cargar más leads.");
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [filters, isFiltering, isLoadingMore, nextCursor, queryKey, sort]);

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

  const updateLeadStatus = useCallback(
    (leadId: number, status: string, contactDate: string | null) => {
      const update = (lead: LeadWithTags) =>
        lead.id === leadId ? { ...lead, status, contactDate } : lead;
      const remainsVisible =
        statusFilter === "all"
          ? status !== "descartado"
          : status === statusFilter;
      const wasVisible = leads.some((lead) => lead.id === leadId);
      setLeads((current) =>
        remainsVisible
          ? current.map(update)
          : current.filter((lead) => lead.id !== leadId)
      );
      if (!remainsVisible && wasVisible) {
        setTotal((current) =>
          current == null ? current : Math.max(0, current - 1)
        );
      }
      setOpenLeadOverride((current) => {
        const candidate =
          current?.id === leadId
            ? current
            : initialOpenLead?.id === leadId
              ? initialOpenLead
              : null;
        return candidate ? update(candidate) : current;
      });
    },
    [initialOpenLead, leads, statusFilter]
  );

  const updateLeadWebsiteStatus = useCallback(
    (leadId: number, websiteStatus: WebsiteStatusKey) => {
      const update = (lead: LeadWithTags) =>
        lead.id === leadId ? { ...lead, websiteStatus } : lead;
      const remainsVisible =
        websiteStatusFilter === "all" ||
        websiteStatus === websiteStatusFilter;
      const wasVisible = leads.some((lead) => lead.id === leadId);
      setLeads((current) =>
        remainsVisible
          ? current.map(update)
          : current.filter((lead) => lead.id !== leadId)
      );
      if (!remainsVisible && wasVisible) {
        setTotal((current) =>
          current == null ? current : Math.max(0, current - 1)
        );
      }
      setOpenLeadOverride((current) => {
        const candidate =
          current?.id === leadId
            ? current
            : initialOpenLead?.id === leadId
              ? initialOpenLead
              : null;
        return candidate ? update(candidate) : current;
      });
    },
    [initialOpenLead, leads, websiteStatusFilter]
  );

  const openLead =
    openId != null
      ? (leads.find((lead) => lead.id === openId) ??
        (openLeadOverride?.id === openId
          ? openLeadOverride
          : initialOpenLead?.id === openId
            ? initialOpenLead
            : null))
      : null;
  const activeTag = tagFilter !== "all" ? tags.find((t) => t.id === tagFilter) : null;
  const activeSort = LEAD_SORTS.find((item) => item.value === sort)!;
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

  const toggleLead = (id: number, extendSelection = false) => {
    const singleSelectedId =
      selectedIds.size === 1 ? selectedIds.values().next().value : null;
    const anchorId = selectionAnchorRef.current ?? singleSelectedId;

    if (extendSelection && anchorId != null) {
      const anchorIndex = filtered.findIndex((lead) => lead.id === anchorId);
      const targetIndex = filtered.findIndex((lead) => lead.id === id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        setSelectedIds((current) => {
          const next = new Set(current);
          for (let index = start; index <= end; index += 1) {
            next.add(filtered[index].id);
          }
          return next;
        });
        selectionAnchorRef.current = id;
        return;
      }
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        if (selectionAnchorRef.current === id) {
          selectionAnchorRef.current = null;
        }
      } else {
        next.add(id);
        selectionAnchorRef.current = id;
      }
      return next;
    });
  };

  const toggleAllFiltered = () => {
    selectionAnchorRef.current = null;
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
    selectionAnchorRef.current = null;
  };

  const closeSheet = () => {
    setOpenId(null);
    if (typeof window !== "undefined" && window.location.search.includes("open=")) {
      router.replace("/leads", { scroll: false });
    }
  };

  const updateLead = useCallback((updatedLead: LeadWithTags) => {
    const remainsVisible =
      statusFilter === "all"
        ? updatedLead.status !== "descartado"
        : updatedLead.status === statusFilter;
    const wasVisible = leads.some((lead) => lead.id === updatedLead.id);
    setLeads((current) =>
      remainsVisible
        ? current.map((lead) =>
            lead.id === updatedLead.id ? updatedLead : lead
          )
        : current.filter((lead) => lead.id !== updatedLead.id)
    );
    if (!remainsVisible && wasVisible) {
      setTotal((current) =>
        current == null ? current : Math.max(0, current - 1)
      );
    }
    setOpenLeadOverride((current) => {
      const isOpenFallback =
        current?.id === updatedLead.id ||
        initialOpenLead?.id === updatedLead.id;
      return isOpenFallback ? updatedLead : current;
    });
    setEditing((current) =>
      current?.id === updatedLead.id ? updatedLead : current
    );
  }, [initialOpenLead, leads, statusFilter]);

  const removeLead = useCallback((leadId: number) => {
    setLeads((current) => current.filter((lead) => lead.id !== leadId));
    setTotal((current) =>
      current == null ? current : Math.max(0, current - 1)
    );
    setOpenLeadOverride((current) =>
      current?.id === leadId ? null : current
    );
  }, []);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setWebsiteStatusFilter("all");
    setTagFilter("all");
    setAddedDateFilter(undefined);
    setSort("updated_desc");
  };

  const refreshVisibleLeads = useCallback(async () => {
    setIsFiltering(true);
    try {
      const result = await loadLeadsPage({ filters, sort });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setLeads(result.leads);
      setTotal(result.total ?? result.leads.length);
      setNextCursor(result.nextCursor);
      setSelectedIds(new Set());
      selectionAnchorRef.current = null;
      setOpenId(null);
      setOpenLeadOverride(null);
      setEditing(null);
      setDeleting(null);
      router.refresh();
    } catch {
      toast.error("Los cambios se restauraron, pero no se pudo actualizar la vista.");
    } finally {
      setIsFiltering(false);
    }
  }, [filters, router, sort]);

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
                className={cn(
                  "gap-1.5",
                  (activeFilterCount > 0 || sort !== "updated_desc") &&
                    "bg-muted"
                )}
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
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowUpDownIcon />
                <span>Ordenar por</span>
                <FilterMenuValue>{activeSort.label}</FilterMenuValue>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                {LEAD_SORTS.map((item) => (
                  <DropdownMenuItem
                    key={item.value}
                    onClick={() => setSort(item.value)}
                  >
                    <CheckIcon
                      className={cn(sort !== item.value && "opacity-0")}
                    />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FilterIcon />
                <span>Estado</span>
                <FilterMenuValue>
                  {statusFilter === "all"
                    ? "Excepto descartados"
                    : STATUSES.find((s) => s.value === statusFilter)?.label}
                </FilterMenuValue>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  <CheckIcon className={cn(statusFilter !== "all" && "opacity-0")} />
                  Todos excepto descartados
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

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={resetFilters}
              disabled={isDefaultQuery}
            >
              <RotateCcwIcon />
              Restablecer filtros
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                className={cn(selectionMode && "bg-muted")}
              />
            }
          >
            <WrenchIcon />
            Herramientas
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => setImportingLeads(true)}>
              <UploadIcon />
              Importar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                selectionMode
                  ? closeSelectionMode()
                  : setSelectionMode(true)
              }
              disabled={!selectionMode && filtered.length === 0}
            >
              <PencilIcon />
              {selectionMode ? "Cancelar edición" : "Editar varios"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
              <HistoryIcon />
              Historial
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/plantillas")}>
              <FileTextIcon />
              Plantillas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedIds(new Set());
              selectionAnchorRef.current = null;
            }}
          >
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
                        onChange={(event) =>
                          toggleLead(
                            lead.id,
                            event.nativeEvent instanceof MouseEvent &&
                              event.nativeEvent.shiftKey
                          )
                        }
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
                      onStatusChange={(status) =>
                        updateLeadWebsiteStatus(lead.id, status)
                      }
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
                    <StatusSelect
                      leadId={lead.id}
                      status={lead.status}
                      onStatusChange={(status, contactDate) =>
                        updateLeadStatus(lead.id, status, contactDate)
                      }
                    />
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
                        <DropdownMenuItem onClick={() => setMessageLead(lead)}>
                          <MessageSquareTextIcon />
                          Preparar mensaje
                        </DropdownMenuItem>
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
        onUseTemplate={setMessageLead}
        onStatusChange={updateLeadStatus}
      />

      {messageLead && (
        <UseMessageTemplateDialog
          lead={messageLead}
          templates={templates}
          open
          onOpenChange={(open) => !open && setMessageLead(null)}
        />
      )}

      <BulkEditLeadsDialog
        open={bulkEditing}
        onOpenChange={setBulkEditing}
        leadIds={[...selectedIds]}
        allTags={tags}
        onUpdated={() => {
          closeSelectionMode();
          void refreshVisibleLeads();
        }}
      />

      <LeadImportDialog
        tags={tags}
        open={importingLeads}
        onOpenChange={setImportingLeads}
      />

      <LeadHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestored={refreshVisibleLeads}
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
        onSaved={updateLead}
      />

      <DeleteDialog
        lead={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(leadId) => {
          removeLead(leadId);
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
  onUseTemplate,
  onStatusChange,
}: {
  lead: LeadWithTags | null;
  onClose: () => void;
  onEdit: (lead: LeadWithTags) => void;
  onDelete: (lead: LeadWithTags) => void;
  onUseTemplate: (lead: LeadWithTags) => void;
  onStatusChange: (
    leadId: number,
    status: string,
    contactDate: string | null
  ) => void;
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
                <StatusSelect
                  leadId={lead.id}
                  status={lead.status}
                  onStatusChange={(status, contactDate) =>
                    onStatusChange(lead.id, status, contactDate)
                  }
                />
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

              <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                <Button onClick={() => onUseTemplate(lead)}>
                  <MessageSquareTextIcon />
                  Mensaje
                </Button>
                <Button variant="outline" onClick={() => onEdit(lead)}>
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
  onDeleted: (leadId: number) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={lead != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Eliminar «{lead?.name}»?</DialogTitle>
          <DialogDescription>
            Se borrará el lead con todas sus notas y etiquetas. Podrás
            recuperarlo desde el historial de cambios.
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
                onDeleted(lead.id);
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
