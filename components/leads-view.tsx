"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { endOfDay, format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import {
  ArrowUpDownIcon,
  AtSignIcon,
  CalendarDaysIcon,
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  FilterIcon,
  GlobeIcon,
  HistoryIcon,
  Loader2Icon,
  MapPinIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
  TagIcon,
  Trash2Icon,
  UploadIcon,
  UsersRoundIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { loadLeadsPage } from "@/app/(app)/leads/actions";
import { AddedDateFilter } from "@/components/added-date-filter";
import { BulkDeleteLeadsDialog } from "@/components/bulk-delete-leads-dialog";
import { BulkEditLeadsDialog } from "@/components/bulk-edit-leads-dialog";
import { LeadImportDialog } from "@/components/lead-import-dialog";
import { LeadDetailsModal } from "@/components/lead-details-modal";
import { LeadHistoryDialog } from "@/components/lead-history-dialog";
import { LeadDialog } from "@/components/lead-dialog";
import { StatusDot, StatusSelect } from "@/components/status-badge";
import { TagBadge } from "@/components/tag-badge";
import { UseMessageTemplateDialog } from "@/components/use-message-template-dialog";
import {
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
  type StatusKey,
  type WebsiteStatusKey,
} from "@/lib/config";
import { formatDateShort, isFollowUpOverdue, isFollowUpToday } from "@/lib/dates";
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
import { instagramUrl, mapsUrl } from "@/lib/lead-links";

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy_failed");
}

function FilterMenuValue({ children }: { children?: string }) {
  return (
    <span className="ml-auto max-w-32 truncate text-right text-xs font-normal text-muted-foreground">
      {children}
    </span>
  );
}

function CopyHint({
  copied,
  className,
}: {
  copied: boolean;
  className?: string;
}) {
  return copied ? (
    <CheckIcon
      className={cn(
        "ml-1 size-3.5 shrink-0 animate-in text-emerald-600 opacity-100 zoom-in-50 dark:text-emerald-400",
        className
      )}
    />
  ) : (
    <CopyIcon
      className={cn(
        "ml-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-visible/name:opacity-100",
        className
      )}
    />
  );
}

function FollowUpCell({ lead }: { lead: LeadWithTags }) {
  const overdue = isFollowUpOverdue(lead.followUpDate, lead.statuses);
  const dueToday = isFollowUpToday(lead.followUpDate, lead.statuses);

  if (!lead.followUpDate) {
    return <span className="text-muted-foreground/60">—</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 tabular-nums",
        overdue && "text-destructive",
        dueToday && "text-brand"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          overdue
            ? "bg-destructive"
            : dueToday
              ? "bg-brand"
              : "bg-muted-foreground/30"
        )}
      />
      <span className={cn((overdue || dueToday) && "font-semibold")}>
        {formatDateShort(lead.followUpDate)}
      </span>
      {overdue && (
        <span className="rounded-full bg-destructive/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-destructive uppercase dark:bg-destructive/15">
          Vencido
        </span>
      )}
      {dueToday && (
        <span className="rounded-full bg-brand/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-brand uppercase dark:bg-brand/15">
          Hoy
        </span>
      )}
    </span>
  );
}

function FilterChip({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-7 animate-in items-center gap-1.5 rounded-full border bg-card pr-1 pl-2.5 text-xs font-medium whitespace-nowrap fade-in-0 zoom-in-95">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar filtro"
        className="grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <XIcon className="size-3" />
      </button>
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
  const [statusFilter, setStatusFilter] = useState<StatusKey | "all">("all");
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyResetRef = useRef<number | null>(null);

  const copyLeadValue = useCallback(
    async (value: string, label: string, field: string) => {
      try {
        await copyText(value);
        setCopiedField(field);
        if (copyResetRef.current != null) {
          window.clearTimeout(copyResetRef.current);
        }
        copyResetRef.current = window.setTimeout(() => {
          setCopiedField((current) => (current === field ? null : current));
          copyResetRef.current = null;
        }, 1200);
        toast.success(`${label} copiado`);
      } catch {
        toast.error(`No se pudo copiar ${label.toLowerCase()}.`);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (copyResetRef.current != null) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

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
    (
      leadId: number,
      statuses: StatusKey[],
      contactDate: string | null
    ) => {
      const update = (lead: LeadWithTags) =>
        lead.id === leadId
          ? { ...lead, status: statuses[0], statuses, contactDate }
          : lead;
      const remainsVisible =
        statusFilter === "all"
          ? !statuses.includes("descartado")
          : statuses.includes(statusFilter);
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
        ? !updatedLead.statuses.includes("descartado")
        : updatedLead.statuses.includes(statusFilter);
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

  const addedDateLabel = useMemo(() => {
    if (!addedDateFilter?.from) return null;
    if (!addedDateFilter.to || addedDateFilter.from === addedDateFilter.to) {
      return format(addedDateFilter.from, "d MMM", { locale: es });
    }
    return `${format(addedDateFilter.from, "d MMM", { locale: es })} – ${format(
      addedDateFilter.to,
      "d MMM",
      { locale: es }
    )}`;
  }, [addedDateFilter]);

  const hasActiveChips = activeFilterCount > 0 || sort !== "updated_desc";

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-lg pr-8 pl-9"
              placeholder="Buscar por nombre, notas, zona…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="lg"
                  className={cn(
                    "gap-1.5",
                    sort !== "updated_desc" &&
                      "border-brand/30 bg-brand/[0.06] text-brand hover:bg-brand/10 hover:text-brand dark:border-brand/40 dark:bg-brand/10"
                  )}
                >
                  <ArrowUpDownIcon className="size-3.5" />
                  Ordenar
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-72">
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setSort("updated_desc")}
                disabled={sort === "updated_desc"}
              >
                <RotateCcwIcon />
                Orden predeterminado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="lg"
                  className={cn(
                    "gap-1.5",
                    activeFilterCount > 0 &&
                      "border-brand/30 bg-brand/[0.06] text-brand hover:bg-brand/10 hover:text-brand dark:border-brand/40 dark:bg-brand/10"
                  )}
                >
                  <FilterIcon className="size-3.5" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 flex size-4.5 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-64">
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
                size="lg"
                className={cn(selectionMode && "bg-muted")}
              />
              }
            >
              <WrenchIcon className="size-4" />
              Herramientas
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
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

          <span className="ml-auto hidden text-sm text-muted-foreground tabular-nums sm:block">
            {isFiltering ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2Icon className="size-3.5 animate-spin" />
                Buscando…
              </span>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {filtered.length}
                </span>{" "}
                de {total} leads
              </>
            )}
          </span>
        </div>

        {hasActiveChips && (
          <div className="flex flex-wrap items-center gap-1.5">
            {sort !== "updated_desc" && (
              <FilterChip onRemove={() => setSort("updated_desc")}>
                <ArrowUpDownIcon className="size-3 text-muted-foreground" />
                {activeSort.label}
              </FilterChip>
            )}
            {statusFilter !== "all" && (
              <FilterChip onRemove={() => setStatusFilter("all")}>
                <StatusDot status={statusFilter} className="size-3.5" />
                {STATUSES.find((s) => s.value === statusFilter)?.label}
              </FilterChip>
            )}
            {websiteStatusFilter !== "all" && (
              <FilterChip onRemove={() => setWebsiteStatusFilter("all")}>
                <WebsiteStatusDot status={websiteStatusFilter} className="size-3.5" />
                {
                  WEBSITE_STATUS_MAP[
                    websiteStatusFilter as keyof typeof WEBSITE_STATUS_MAP
                  ]?.label
                }
              </FilterChip>
            )}
            {activeTag && (
              <FilterChip onRemove={() => setTagFilter("all")}>
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: activeTag.color }}
                />
                {activeTag.name}
              </FilterChip>
            )}
            {addedDateLabel && (
              <FilterChip onRemove={() => setAddedDateFilter(undefined)}>
                <CalendarDaysIcon className="size-3 text-muted-foreground" />
                {addedDateLabel}
              </FilterChip>
            )}
            <button
              type="button"
              onClick={resetFilters}
              className="ml-1 inline-flex h-7 cursor-pointer items-center rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Restablecer
            </button>
          </div>
        )}
      </div>

      {selectionMode && selectedCount === 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            Marca los leads que quieras editar o eliminar en bloque.
          </span>
          <Button variant="ghost" size="xs" onClick={closeSelectionMode}>
            Cancelar
          </Button>
        </div>
      )}

      {selectionMode && selectedCount > 0 && (
        <div className="mb-3 flex animate-in flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm fade-in-0 slide-in-from-top-1">
          <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums">
            {selectedCount}
          </span>
          <span className="mr-auto text-sm font-medium">
            {selectedCount === 1 ? "lead seleccionado" : "leads seleccionados"}
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
            <TableRow className="hover:bg-transparent border-border/70">
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
              <TableHead
                className={cn(
                  "text-[11px] font-semibold tracking-wider text-muted-foreground uppercase",
                  selectionMode ? undefined : "pl-5"
                )}
              >
                Negocio
              </TableHead>
              <TableHead className="hidden text-[11px] font-semibold tracking-wider text-muted-foreground uppercase lg:table-cell">
                Etiquetas
              </TableHead>
              <TableHead className="hidden text-[11px] font-semibold tracking-wider text-muted-foreground uppercase md:table-cell">
                Web
              </TableHead>
              <TableHead className="hidden text-[11px] font-semibold tracking-wider text-muted-foreground uppercase xl:table-cell">
                Teléfono
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Estado
              </TableHead>
              <TableHead className="hidden text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:table-cell">
                Contacto
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Follow-up
              </TableHead>
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
                  className="h-64 text-center"
                >
                  <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
                    <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                      {hasFilters ? (
                        <SearchXIcon className="size-5" />
                      ) : (
                        <UsersRoundIcon className="size-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {hasFilters
                          ? "Sin resultados"
                          : "Aún no hay leads aquí"}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {hasFilters
                          ? "Ningún lead coincide con los filtros actuales."
                          : "Añade tu primer lead para empezar a hacer seguimiento."}
                      </p>
                    </div>
                    {hasFilters ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetFilters}
                      >
                        <RotateCcwIcon />
                        Limpiar filtros
                      </Button>
                    ) : (
                      <Button size="sm" onClick={openNewLead}>
                        <PlusIcon />
                        Añadir lead
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!isFiltering && filtered.map((lead) => {
              return (
                <TableRow
                  key={lead.id}
                  className="group/row cursor-pointer border-border/60"
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
                    className={cn("py-3", !selectionMode && "pl-5")}
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="group/name inline-flex max-w-full items-center rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`Copiar nombre de ${lead.name}`}
                        title="Copiar nombre"
                        onClick={(event) => {
                          event.stopPropagation();
                          void copyLeadValue(
                            lead.name,
                            "Nombre",
                            `name-${lead.id}`
                          );
                        }}
                      >
                        <span className="truncate font-medium">
                          {lead.name}
                        </span>
                        <CopyHint copied={copiedField === `name-${lead.id}`} />
                      </button>
                      {lead.instagram && (
                        <div className="truncate text-xs text-muted-foreground">
                          @{lead.instagram}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex max-w-48 flex-wrap items-center gap-1">
                      {lead.tags.slice(0, 2).map((tag) => (
                        <TagBadge key={tag.id} tag={tag} />
                      ))}
                      {lead.tags.length > 2 && (
                        <span
                          className="inline-flex h-5 items-center rounded-full border px-1.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground"
                          title={lead.tags
                            .slice(2)
                            .map((tag) => tag.name)
                            .join(", ")}
                        >
                          +{lead.tags.length - 2}
                        </span>
                      )}
                      {lead.tags.length === 0 && (
                        <span className="text-muted-foreground/50">—</span>
                      )}
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
                  <TableCell className="hidden xl:table-cell">
                    {lead.phone ? (
                      <button
                        type="button"
                        className="group/copy inline-flex items-center rounded-sm text-sm text-muted-foreground tabular-nums outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`Copiar teléfono de ${lead.name}`}
                        title="Copiar teléfono"
                        onClick={(event) => {
                          event.stopPropagation();
                          void copyLeadValue(
                            lead.phone!,
                            "Teléfono",
                            `phone-${lead.id}`
                          );
                        }}
                      >
                        <PhoneIcon className="mr-1.5 size-3.5" />
                        {lead.phone}
                        {copiedField === `phone-${lead.id}` ? (
                          <CheckIcon className="ml-1 size-3.5 shrink-0 animate-in text-emerald-600 opacity-100 zoom-in-50 dark:text-emerald-400" />
                        ) : (
                          <CopyIcon className="ml-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-100 group-focus-visible/copy:opacity-100" />
                        )}
                      </button>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-44">
                    <StatusSelect
                      leadId={lead.id}
                      statuses={lead.statuses}
                      onStatusesChange={(statuses, contactDate) =>
                        updateLeadStatus(lead.id, statuses, contactDate)
                      }
                    />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground tabular-nums sm:table-cell">
                    {formatDateShort(lead.contactDate)}
                  </TableCell>
                  <TableCell>
                    <FollowUpCell lead={lead} />
                  </TableCell>
                  <TableCell
                    className="pr-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <MoreHorizontalIcon />
                            <span className="sr-only">Acciones</span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setMessageLead(lead)}>
                          <MessageSquareTextIcon />
                          Preparar mensaje
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditing(lead)}>
                          <PencilIcon />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
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
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <Loader2Icon className="animate-spin" />
            ) : null}
            {isLoadingMore ? "Cargando…" : "Cargar más leads"}
          </Button>
        ) : !isFiltering && filtered.length > 0 ? (
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px w-12 bg-border" />
            Se han cargado todos los leads
            <span className="h-px w-12 bg-border" />
          </span>
        ) : null}
      </div>

      <LeadDetailsModal
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
