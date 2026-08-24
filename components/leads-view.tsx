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
  GaugeIcon,
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
import { LeadScoreBadge } from "@/components/lead-score-badge";
import { LeadDialog } from "@/components/lead-dialog";
import { NextActionDot, NextActionSelect } from "@/components/next-action-badge";
import { StatusDot, StatusSelect } from "@/components/status-badge";
import { TagBadge } from "@/components/tag-badge";
import { UseMessageTemplateDialog } from "@/components/use-message-template-dialog";
import {
  WebsiteStatusDot,
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
  NEXT_ACTIONS,
  STATUSES,
  WEBSITE_STATUSES,
  WEBSITE_STATUS_MAP,
  type StatusKey,
  type NextActionKey,
} from "@/lib/config";
import {
  formatActionTiming,
  formatRelativeTime,
  isNextActionOverdue,
  isNextActionToday,
} from "@/lib/dates";
import { openNewLead } from "@/lib/events";
import { leadActivitySummary } from "@/lib/lead-activity";
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
import { SCORE_GRADES } from "@/lib/lead-scoring-config";
import type { LeadGrade } from "@/lib/lead-scoring";

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

function NextActionCell({
  lead,
  onChange,
}: {
  lead: LeadWithTags;
  onChange: (action: NextActionKey, actionAt: string | null) => void;
}) {
  const overdue = isNextActionOverdue(lead.nextAction, lead.nextActionAt);
  const dueToday = isNextActionToday(lead.nextAction, lead.nextActionAt);

  return (
    <div className="min-w-0">
      <NextActionSelect
        leadId={lead.id}
        action={lead.nextAction}
        actionAt={lead.nextActionAt}
        onActionChange={onChange}
      />
      {lead.nextAction !== "sin_accion" && (
        <p className={cn("mt-0.5 text-xs text-muted-foreground", overdue && "font-medium text-destructive", dueToday && "font-medium text-brand")}>
          {formatActionTiming(lead.nextAction, lead.nextActionAt)}
        </p>
      )}
    </div>
  );
}

function ChannelsCell({ lead }: { lead: LeadWithTags }) {
  const channels = [
    { key: "instagram", available: Boolean(lead.instagram), icon: AtSignIcon, label: "Instagram" },
    { key: "website", available: Boolean(lead.website), icon: GlobeIcon, label: "Web" },
    { key: "phone", available: Boolean(lead.phone), icon: PhoneIcon, label: "Teléfono" },
    { key: "whatsapp", available: Boolean(lead.phone), icon: MessageCircleIcon, label: "WhatsApp" },
  ];
  return (
    <div className="flex items-center gap-1">
      {channels.map(({ key, available, icon: Icon, label }) => (
        <span key={key} title={available ? label : `${label}: sin dato`} className={cn("grid size-6 place-items-center rounded-md border", available ? "bg-background text-muted-foreground" : "border-dashed text-muted-foreground/25")}>
          <Icon className="size-3.5" />
        </span>
      ))}
    </div>
  );
}

function LastActivityCell({ lead }: { lead: LeadWithTags }) {
  const activity = lead.recentActivities[0];
  return (
    <div className="max-w-52">
      <p className="truncate text-sm">
        {activity ? leadActivitySummary(activity) : `Actualizado · ${formatRelativeTime(lead.updatedAt)}`}
      </p>
    </div>
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
  initialNextAction,
  initialActionTiming,
}: {
  initialPage: LeadPage;
  tags: Tag[];
  today: string;
  createdDates: string[];
  initialOpenId?: number;
  initialOpenLead: LeadWithTags | null;
  templates: MessageTemplate[];
  initialNextAction?: NextActionKey;
  initialActionTiming?: "today" | "overdue";
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialPage.leads);
  const [total, setTotal] = useState(initialPage.total ?? initialPage.leads.length);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const initialPageRef = useRef(initialPage);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey | "all">("all");
  const [nextActionFilter, setNextActionFilter] = useState<NextActionKey | "all">(
    initialNextAction ?? "all"
  );
  const [actionTiming, setActionTiming] = useState<"today" | "overdue" | "all">(
    initialActionTiming ?? "all"
  );
  const [websiteStatusFilter, setWebsiteStatusFilter] =
    useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<LeadGrade | "all">("all");
  const [scoreMinFilter, setScoreMinFilter] = useState<number | "all">("all");
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

  useEffect(() => {
    initialPageRef.current = initialPage;
  }, [initialPage]);

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
      nextAction: nextActionFilter === "all" ? undefined : nextActionFilter,
      actionTiming: actionTiming === "all" ? undefined : actionTiming,
      websiteStatus:
        websiteStatusFilter === "all"
          ? undefined
          : (websiteStatusFilter as LeadFilters["websiteStatus"]),
      leadGrade: gradeFilter === "all" ? undefined : gradeFilter,
      scoreMin: scoreMinFilter === "all" ? undefined : scoreMinFilter,
      tagId: tagFilter === "all" ? undefined : tagFilter,
      createdFrom: from ? startOfDay(from).toISOString() : undefined,
      createdTo: to ? endOfDay(to).toISOString() : undefined,
    };
  }, [
    addedDateFilter,
    actionTiming,
    gradeFilter,
    nextActionFilter,
    search,
    statusFilter,
    tagFilter,
    scoreMinFilter,
    websiteStatusFilter,
  ]);

  const hasFilters = Object.values(filters).some(Boolean);
  const isDefaultQuery = !hasFilters && sort === "updated_desc";
  const initialQueryIsDefault = !initialNextAction && !initialActionTiming;
  const queryKey = JSON.stringify({ filters, sort });
  const activeQueryKey = useRef(queryKey);

  useEffect(() => {
    activeQueryKey.current = queryKey;
  }, [queryKey]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(
      () => {
        if (isDefaultQuery && initialQueryIsDefault) {
          const defaultPage = initialPageRef.current;
          setLeads(defaultPage.leads);
          setTotal(defaultPage.total ?? defaultPage.leads.length);
          setNextCursor(defaultPage.nextCursor);
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
  }, [filters, initialQueryIsDefault, isDefaultQuery, search, sort]);

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
      result: {
        status: StatusKey;
        contactedAt: string | null;
        repliedAt: string | null;
        lastContactAt: string | null;
        nextAction: NextActionKey;
        nextActionAt: string | null;
      }
    ) => {
      const update = (lead: LeadWithTags) =>
        lead.id === leadId
          ? {
              ...lead,
              status: result.status,
              statuses: [result.status],
              contactedAt: result.contactedAt,
              contactDate: result.contactedAt?.slice(0, 10) ?? null,
              repliedAt: result.repliedAt,
              lastContactAt: result.lastContactAt,
              nextAction: result.nextAction,
              nextActionAt: result.nextActionAt,
            }
          : lead;
      const matchesStatus =
        statusFilter === "all"
          ? result.status !== "descartado"
          : result.status === statusFilter;
      const matchesAction =
        nextActionFilter === "all" || result.nextAction === nextActionFilter;
      const matchesTiming =
        actionTiming === "all" ||
        (actionTiming === "overdue"
          ? isNextActionOverdue(result.nextAction, result.nextActionAt)
          : result.nextAction !== "sin_accion" &&
            (!result.nextActionAt ||
              isNextActionOverdue(result.nextAction, result.nextActionAt) ||
              isNextActionToday(result.nextAction, result.nextActionAt)));
      const remainsVisible = matchesStatus && matchesAction && matchesTiming;
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
    [
      actionTiming,
      initialOpenLead,
      leads,
      nextActionFilter,
      statusFilter,
    ]
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
    nextActionFilter !== "all",
    actionTiming !== "all",
    websiteStatusFilter !== "all",
    gradeFilter !== "all",
    scoreMinFilter !== "all",
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
    const matchesStatus =
      statusFilter === "all"
        ? updatedLead.status !== "descartado"
        : updatedLead.status === statusFilter;
    const matchesAction =
      nextActionFilter === "all" || updatedLead.nextAction === nextActionFilter;
    const matchesTiming =
      actionTiming === "all" ||
      (actionTiming === "overdue"
        ? isNextActionOverdue(updatedLead.nextAction, updatedLead.nextActionAt)
        : updatedLead.nextAction !== "sin_accion" &&
          (!updatedLead.nextActionAt ||
            isNextActionOverdue(updatedLead.nextAction, updatedLead.nextActionAt) ||
            isNextActionToday(updatedLead.nextAction, updatedLead.nextActionAt)));
    const matchesGrade =
      gradeFilter === "all" || updatedLead.leadGrade === gradeFilter;
    const matchesScore =
      scoreMinFilter === "all" || updatedLead.leadScore >= scoreMinFilter;
    const remainsVisible =
      matchesStatus && matchesAction && matchesTiming && matchesGrade && matchesScore;
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
  }, [actionTiming, gradeFilter, initialOpenLead, leads, nextActionFilter, scoreMinFilter, statusFilter]);

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
    setNextActionFilter("all");
    setActionTiming("all");
    setWebsiteStatusFilter("all");
    setGradeFilter("all");
    setScoreMinFilter("all");
    setTagFilter("all");
    setAddedDateFilter(undefined);
    setSort("updated_desc");
    const params = new URLSearchParams(window.location.search);
    params.delete("action");
    params.delete("due");
    const query = params.toString();
    router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
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
              {sort !== "updated_desc" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSort("updated_desc")}>
                    <RotateCcwIcon />
                    Orden predeterminado
                  </DropdownMenuItem>
                </>
              )}
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
                  <GaugeIcon />
                  <span>Lead Score</span>
                  <FilterMenuValue>
                    {gradeFilter !== "all"
                      ? `Grado ${gradeFilter}`
                      : scoreMinFilter !== "all"
                        ? `${scoreMinFilter}+`
                        : "Todos"}
                  </FilterMenuValue>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuItem onClick={() => { setGradeFilter("all"); setScoreMinFilter("all"); }}>
                    <CheckIcon className={cn((gradeFilter !== "all" || scoreMinFilter !== "all") && "opacity-0")} />
                    Todos los scores
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {SCORE_GRADES.map((item) => (
                    <DropdownMenuItem
                      key={item.grade}
                      onClick={() => { setGradeFilter(item.grade); setScoreMinFilter("all"); }}
                    >
                      <span className="grid size-5 place-items-center rounded-md border text-[11px] font-semibold">
                        {item.grade}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {gradeFilter === item.grade && <CheckIcon />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {[80, 65, 50].map((minimum) => (
                    <DropdownMenuItem
                      key={minimum}
                      onClick={() => { setScoreMinFilter(minimum); setGradeFilter("all"); }}
                    >
                      <CheckIcon className={cn(scoreMinFilter !== minimum && "opacity-0")} />
                      Puntuación {minimum} o más
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CalendarDaysIcon />
                  <span>Próxima acción</span>
                  <FilterMenuValue>
                    {nextActionFilter === "all"
                      ? "Todas"
                      : NEXT_ACTIONS.find((item) => item.value === nextActionFilter)?.shortLabel}
                  </FilterMenuValue>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuItem onClick={() => setNextActionFilter("all")}>
                    <CheckIcon className={cn(nextActionFilter !== "all" && "opacity-0")} />
                    Todas las acciones
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {NEXT_ACTIONS.map((action) => (
                    <DropdownMenuItem key={action.value} onClick={() => setNextActionFilter(action.value)}>
                      <NextActionDot action={action.value} />
                      <span className="flex-1">{action.label}</span>
                      {nextActionFilter === action.value && <CheckIcon />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActionTiming(actionTiming === "today" ? "all" : "today")}>
                    <CheckIcon className={cn(actionTiming !== "today" && "opacity-0")} />
                    Pendientes hasta hoy
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActionTiming(actionTiming === "overdue" ? "all" : "overdue")}>
                    <CheckIcon className={cn(actionTiming !== "overdue" && "opacity-0")} />
                    Solo vencidas
                  </DropdownMenuItem>
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

              {hasFilters && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={resetFilters}>
                    <RotateCcwIcon />
                    Restablecer filtros
                  </DropdownMenuItem>
                </>
              )}

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
            {gradeFilter !== "all" && (
              <FilterChip onRemove={() => setGradeFilter("all")}>
                <GaugeIcon className="size-3 text-muted-foreground" />
                Grado {gradeFilter}
              </FilterChip>
            )}
            {scoreMinFilter !== "all" && (
              <FilterChip onRemove={() => setScoreMinFilter("all")}>
                <GaugeIcon className="size-3 text-muted-foreground" />
                Score {scoreMinFilter}+
              </FilterChip>
            )}
            {nextActionFilter !== "all" && (
              <FilterChip onRemove={() => setNextActionFilter("all")}>
                <NextActionDot action={nextActionFilter} />
                {NEXT_ACTIONS.find((action) => action.value === nextActionFilter)?.label}
              </FilterChip>
            )}
            {actionTiming !== "all" && (
              <FilterChip onRemove={() => setActionTiming("all")}>
                <CalendarDaysIcon className="size-3 text-muted-foreground" />
                {actionTiming === "today" ? "Pendientes hasta hoy" : "Acciones vencidas"}
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

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs [overflow-anchor:none]">
        <Table className="table-fixed">
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
                  "w-[19%] text-[11px] font-semibold tracking-wider text-muted-foreground uppercase",
                  selectionMode ? undefined : "pl-5"
                )}
              >
                Negocio
              </TableHead>
              <TableHead className="w-[10%] text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Score
              </TableHead>
              <TableHead className="hidden w-[12%] text-[11px] font-semibold tracking-wider text-muted-foreground uppercase md:table-cell">
                Canales
              </TableHead>
              <TableHead className="w-[15%] text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Estado
              </TableHead>
              <TableHead className="hidden w-[20%] text-[11px] font-semibold tracking-wider text-muted-foreground uppercase lg:table-cell">
                Última actividad
              </TableHead>
              <TableHead className="w-[20%] text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Próxima acción
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFiltering && (
              <TableRow>
                <TableCell
                  colSpan={selectionMode ? 8 : 7}
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
                  colSpan={selectionMode ? 8 : 7}
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
                    className={cn(
                      "w-[19%] max-w-0 overflow-hidden py-3",
                      !selectionMode && "pl-5"
                    )}
                  >
                    <div className="min-w-0 overflow-hidden">
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
                      {lead.tags.length > 0 && (
                        <div className="mt-1 flex max-w-56 flex-wrap gap-1">
                          {lead.tags.slice(0, 2).map((tag) => (
                            <TagBadge key={tag.id} tag={tag} />
                          ))}
                          {lead.tags.length > 2 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{lead.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <LeadScoreBadge
                      score={lead.leadScore}
                      grade={lead.leadGrade}
                      confidence={lead.scoreConfidence}
                      breakdown={lead.scoreBreakdown}
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <ChannelsCell lead={lead} />
                  </TableCell>
                  <TableCell className="max-w-44">
                    <StatusSelect
                      leadId={lead.id}
                      status={lead.status}
                      onStatusChange={(result) => updateLeadStatus(lead.id, result)}
                    />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <LastActivityCell lead={lead} />
                  </TableCell>
                  <TableCell>
                    <NextActionCell
                      lead={lead}
                      onChange={(nextAction, nextActionAt) =>
                        updateLead({
                          ...lead,
                          nextAction,
                          nextActionAt,
                          followUpDate: nextActionAt?.slice(0, 10) ?? null,
                        })
                      }
                    />
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
        key={openLead ? `lead-details-${openLead.id}` : "closed-lead-details"}
        lead={openLead ?? null}
        onClose={closeSheet}
        onEdit={(lead) => setEditing(lead)}
        onDelete={(lead) => setDeleting(lead)}
        onUseTemplate={setMessageLead}
        onLeadChange={updateLead}
      />

      {messageLead && (
        <UseMessageTemplateDialog
          key={`lead-message-${messageLead.id}`}
          lead={messageLead}
          templates={templates}
          open
          onOpenChange={(open) => !open && setMessageLead(null)}
          onLeadUpdated={updateLead}
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
