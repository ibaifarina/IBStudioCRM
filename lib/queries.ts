import { cache } from "react";
import {
  defaultNextActionForStatus,
  isValidContactChannel,
  isValidLeadSource,
  isValidNextAction,
  normalizeLeadStatus,
  type LeadSortKey,
  type NextActionKey,
} from "@/lib/config";
import {
  dateInputToStartOfDayTimestamp,
  dateInputToTimestamp,
  todayISO,
} from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { calculateLeadScore, type LeadGrade, type LeadScoreBreakdown } from "@/lib/lead-scoring";
import type {
  LeadCursor,
  LeadFilters,
  LeadImportComparable,
  LeadActivity,
  LeadOption,
  LeadPage,
  LeadWithTags,
  MessageTemplate,
  Tag,
} from "@/lib/types";

export const LEADS_PAGE_SIZE = 50;

export const getMessageTemplates = cache(async (): Promise<MessageTemplate[]> => {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("message_templates")
    .select("id, name, icon, content, created_at, updated_at")
    .order("updated_at", { ascending: false });

  let hasIconColumn = true;
  if (error?.code === "42703" || error?.code === "PGRST204") {
    hasIconColumn = false;
    const fallback = await supabase
      .from("message_templates")
      .select("id, name, content, created_at, updated_at")
      .order("updated_at", { ascending: false });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(
      "No se pudieron cargar las plantillas. Comprueba que la migración esté aplicada.",
      { cause: error }
    );
  }

  return (data ?? []).map((template) => ({
    id: template.id,
    name: template.name,
    icon:
      hasIconColumn && "icon" in template && typeof template.icon === "string"
        ? template.icon
        : "message-square-text",
    content: template.content,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  }));
});

type TagRow = {
  id: number;
  name: string;
  color: string;
};

type LeadRow = {
  id: number;
  name: string;
  instagram: string | null;
  facebook?: string | null;
  website: string | null;
  website_status?: LeadWithTags["websiteStatus"] | null;
  phone: string | null;
  email?: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  problem: string | null;
  notes: string | null;
  status: string;
  statuses?: string[] | null;
  contact_date: string | null;
  follow_up_date: string | null;
  contacted_at?: string | null;
  replied_at?: string | null;
  last_contact_at?: string | null;
  last_outbound_at?: string | null;
  last_inbound_at?: string | null;
  contact_channel?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  source?: string | null;
  google_place_id?: string | null;
  business_categories?: string[] | null;
  rating?: number | string | null;
  review_count?: number | null;
  last_review_at?: string | null;
  photo_count?: number | null;
  social_links?: string[] | null;
  digital_presence_known?: boolean | null;
  open_status?: string | null;
  is_permanently_closed?: boolean | null;
  is_chain?: boolean | null;
  lead_score?: number | null;
  lead_grade?: LeadGrade | null;
  score_breakdown?: unknown;
  score_confidence?: number | null;
  score_version?: number | null;
  scored_at?: string | null;
  created_at: string;
  updated_at: string;
  lead_tags: Array<{ tags: TagRow | TagRow[] | null }>;
};

function legacyNextAction(lead: LeadRow, status: LeadWithTags["status"]): NextActionKey {
  if (lead.status === "revisar_mas_tarde" || lead.statuses?.includes("revisar_mas_tarde")) {
    return "revisar_mas_tarde";
  }
  if (lead.status === "seguimiento" || lead.statuses?.includes("seguimiento")) {
    return "hacer_follow_up";
  }
  if (status === "contactado" && lead.follow_up_date) return "hacer_follow_up";
  return defaultNextActionForStatus(status);
}

function mapLeadRow(
  lead: LeadRow,
  hasWebsiteStatusColumn = true
): LeadWithTags {
  const status = normalizeLeadStatus(lead.status, lead.statuses);
  const contactedAt = lead.contacted_at ?? dateInputToTimestamp(lead.contact_date);
  const nextAction =
    lead.next_action && isValidNextAction(lead.next_action)
      ? lead.next_action
      : legacyNextAction(lead, status);
  const tags = lead.lead_tags
    .flatMap((link) =>
      Array.isArray(link.tags) ? link.tags : link.tags ? [link.tags] : []
    )
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const fallbackScore = calculateLeadScore({
    name: lead.name,
    instagram: lead.instagram,
    facebook: lead.facebook,
    website: lead.website,
    websiteStatus: lead.website_status,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
    businessCategories: lead.business_categories,
    rating: lead.rating == null ? null : Number(lead.rating),
    reviewCount: lead.review_count,
    lastReviewAt: lead.last_review_at,
    photoCount: lead.photo_count,
    socialLinks: lead.social_links,
    digitalPresenceKnown: lead.digital_presence_known,
    contactChannel: lead.contact_channel,
    source: lead.source,
    openStatus: lead.open_status,
    isPermanentlyClosed: lead.is_permanently_closed,
    isChain: lead.is_chain,
    tags,
  });
  const storedBreakdown =
    lead.score_breakdown &&
    typeof lead.score_breakdown === "object" &&
    !Array.isArray(lead.score_breakdown)
      ? (lead.score_breakdown as LeadScoreBreakdown)
      : fallbackScore.scoreBreakdown;
  return {
    id: lead.id,
    name: lead.name,
    instagram: lead.instagram,
    facebook: lead.facebook ?? null,
    website: lead.website,
    websiteStatus:
      hasWebsiteStatusColumn && lead.website_status
        ? lead.website_status
        : lead.website
          ? "tiene_web"
          : "sin_revisar",
    phone: lead.phone,
    email: lead.email ?? null,
    address: lead.address,
    lat: lead.lat,
    lng: lead.lng,
    problem: lead.problem,
    notes: lead.notes,
    status,
    statuses: [status],
    contactedAt,
    repliedAt: lead.replied_at ?? null,
    lastContactAt: lead.last_contact_at ?? contactedAt,
    lastOutboundAt: lead.last_outbound_at ?? contactedAt,
    lastInboundAt: lead.last_inbound_at ?? null,
    contactChannel:
      lead.contact_channel && isValidContactChannel(lead.contact_channel)
        ? lead.contact_channel
        : null,
    nextAction,
    nextActionAt:
      lead.next_action_at ?? dateInputToTimestamp(lead.follow_up_date),
    source:
      lead.source && isValidLeadSource(lead.source) ? lead.source : "manual",
    googlePlaceId: lead.google_place_id ?? null,
    businessCategories: lead.business_categories ?? [],
    rating: lead.rating == null ? null : Number(lead.rating),
    reviewCount: lead.review_count ?? null,
    lastReviewAt: lead.last_review_at ?? null,
    photoCount: lead.photo_count ?? null,
    socialLinks: lead.social_links ?? [],
    digitalPresenceKnown: lead.digital_presence_known ?? false,
    openStatus: lead.open_status ?? null,
    isPermanentlyClosed: lead.is_permanently_closed ?? false,
    isChain: lead.is_chain ?? false,
    leadScore: lead.lead_score ?? fallbackScore.leadScore,
    leadGrade: lead.lead_grade ?? fallbackScore.leadGrade,
    scoreBreakdown: storedBreakdown,
    scoreConfidence: lead.score_confidence ?? fallbackScore.scoreConfidence,
    scoreVersion: lead.score_version ?? fallbackScore.scoreVersion,
    scoredAt: lead.scored_at ?? fallbackScore.scoredAt,
    contactDate: lead.contact_date,
    followUpDate: lead.follow_up_date,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    recentActivities: [],
    hasMoreActivity: false,
    tags,
  };
}

type ActivityRow = {
  id: number;
  lead_id: number;
  type: string;
  occurred_at: string;
  metadata: unknown;
  description: string | null;
  origin: string | null;
  template_id: number | null;
};

function mapActivity(row: ActivityRow): LeadActivity {
  return {
    id: row.id,
    leadId: row.lead_id,
    type: row.type,
    occurredAt: row.occurred_at,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    description: row.description,
    origin: row.origin,
    templateId: row.template_id,
  };
}

async function getRecentActivitiesByLead(
  leadIds: number[],
  visibleLimit = 5
): Promise<Map<number, LeadActivity[]>> {
  const result = new Map<number, LeadActivity[]>();
  if (leadIds.length === 0) return result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_activities")
    .select("id, lead_id, type, occurred_at, metadata, description, origin, template_id")
    .in("lead_id", leadIds)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.min(2_000, leadIds.length * (visibleLimit + 1) * 3));

  if (error?.code === "PGRST205" || error?.code === "42P01") return result;
  if (error) throw new Error("No se pudo cargar la actividad de los leads.", { cause: error });

  for (const row of (data ?? []) as ActivityRow[]) {
    const current = result.get(row.lead_id) ?? [];
    if (current.length < visibleLimit + 1) current.push(mapActivity(row));
    result.set(row.lead_id, current);
  }
  return result;
}

function attachActivities(
  leads: LeadWithTags[],
  activities: Map<number, LeadActivity[]>,
  visibleLimit = 5
) {
  return leads.map((lead) => {
    const all = activities.get(lead.id) ?? [];
    return {
      ...lead,
      recentActivities: all.slice(0, visibleLimit),
      hasMoreActivity: all.length > visibleLimit,
    };
  });
}

export const getLeadsWithTags = cache(async (): Promise<LeadWithTags[]> => {
  const supabase = await createClient();
  const initialResult = await supabase
    .from("leads")
    .select(LEAD_PAGE_COLUMNS)
    .order("updated_at", { ascending: false });
  let data: unknown = initialResult.data;
  let error = initialResult.error;
  if (error?.code === "42703" || error?.code === "PGRST204") {
    const legacyResult = await supabase
      .from("leads")
      .select(
        `
          id, name, instagram, website, website_status, phone, address,
          lat, lng, problem, notes, status, statuses, contact_date,
          follow_up_date, created_at, updated_at,
          lead_tags ( tags ( id, name, color ) )
        `
      )
      .order("updated_at", { ascending: false });
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error("No se pudieron cargar los leads.", { cause: error });
  }

  return (data as LeadRow[]).map((lead) => mapLeadRow(lead));
});

const LEAD_PAGE_COLUMNS = `
  id,
  name,
  instagram,
  facebook,
  website,
  website_status,
  phone,
  email,
  address,
  lat,
  lng,
  problem,
  notes,
  status,
  statuses,
  contact_date,
  follow_up_date,
  contacted_at,
  replied_at,
  last_contact_at,
  last_outbound_at,
  last_inbound_at,
  contact_channel,
  next_action,
  next_action_at,
  source,
  google_place_id,
  business_categories,
  rating,
  review_count,
  last_review_at,
  photo_count,
  social_links,
  digital_presence_known,
  open_status,
  is_permanently_closed,
  is_chain,
  lead_score,
  lead_grade,
  score_breakdown,
  score_confidence,
  score_version,
  scored_at,
  created_at,
  updated_at,
  lead_tags ( tags ( id, name, color ) )
`;

const LEAD_PAGE_LEGACY_COLUMNS = `
  id,
  name,
  instagram,
  website,
  website_status,
  phone,
  address,
  lat,
  lng,
  problem,
  notes,
  status,
  statuses,
  contact_date,
  follow_up_date,
  created_at,
  updated_at,
  lead_tags ( tags ( id, name, color ) )
`;

function safeSearchTerm(value: string) {
  return value.trim().slice(0, 100).replace(/[,%_()"\\]/g, " ");
}

const LEAD_SORT_CONFIG: Record<
  LeadSortKey,
  {
    column: "updated_at" | "created_at" | "next_action_at" | "name" | "lead_score";
    cursorKey: "updatedAt" | "createdAt" | "nextActionAt" | "name" | "leadScore";
    ascending: boolean;
  }
> = {
  score_desc: { column: "lead_score", cursorKey: "leadScore", ascending: false },
  score_asc: { column: "lead_score", cursorKey: "leadScore", ascending: true },
  updated_desc: {
    column: "updated_at",
    cursorKey: "updatedAt",
    ascending: false,
  },
  created_desc: {
    column: "created_at",
    cursorKey: "createdAt",
    ascending: false,
  },
  created_asc: {
    column: "created_at",
    cursorKey: "createdAt",
    ascending: true,
  },
  follow_up_asc: {
    column: "next_action_at",
    cursorKey: "nextActionAt",
    ascending: true,
  },
  follow_up_desc: {
    column: "next_action_at",
    cursorKey: "nextActionAt",
    ascending: false,
  },
  name_asc: { column: "name", cursorKey: "name", ascending: true },
  name_desc: { column: "name", cursorKey: "name", ascending: false },
};

function postgrestFilterValue(value: string | number) {
  if (typeof value === "number") return String(value);
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export async function getLeadsPage({
  cursor,
  filters = {},
  sort = "updated_desc",
}: {
  cursor?: LeadCursor | null;
  filters?: LeadFilters;
  sort?: LeadSortKey;
} = {}): Promise<LeadPage> {
  const supabase = await createClient();
  const search = filters.search ? safeSearchTerm(filters.search) : "";
  const sortConfig = LEAD_SORT_CONFIG[sort];
  const runQuery = (hasCrmColumns: boolean) => {
    const baseColumns = hasCrmColumns
      ? LEAD_PAGE_COLUMNS
      : LEAD_PAGE_LEGACY_COLUMNS;
    const selectColumns = filters.tagId
      ? `${baseColumns}, filtered_lead_tags:lead_tags!inner(tag_id)`
      : baseColumns;
    let query = supabase
      .from("leads")
      .select(selectColumns, cursor ? undefined : { count: "exact" });

    if (filters.status) {
      query = query.eq("status", filters.status);
    } else {
      query = query.neq("status", "descartado");
    }
    if (filters.nextAction && hasCrmColumns) {
      query = query.eq("next_action", filters.nextAction);
    }
    if (filters.actionTiming && hasCrmColumns) {
      const today = todayISO();
      const tomorrow = new Date(`${today}T12:00:00Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const todayStart = dateInputToStartOfDayTimestamp(today)!;
      const tomorrowStart = dateInputToStartOfDayTimestamp(
        tomorrow.toISOString().slice(0, 10)
      )!;
      if (filters.actionTiming === "overdue") {
        query = query.lt("next_action_at", todayStart);
      } else {
        query = query.or(`next_action_at.is.null,next_action_at.lt.${tomorrowStart}`);
      }
    }
    if (filters.websiteStatus) {
      query = query.eq("website_status", filters.websiteStatus);
    }
    if (filters.leadGrade && hasCrmColumns) {
      query = query.eq("lead_grade", filters.leadGrade);
    }
    if (filters.scoreMin != null && hasCrmColumns) {
      query = query.gte("lead_score", filters.scoreMin);
    }
    if (filters.scoreMax != null && hasCrmColumns) {
      query = query.lte("lead_score", filters.scoreMax);
    }
    if (filters.tagId) {
      query = query.eq("filtered_lead_tags.tag_id", filters.tagId);
    }
    if (filters.createdFrom) {
      query = query.gte("created_at", filters.createdFrom);
    }
    if (filters.createdTo) query = query.lte("created_at", filters.createdTo);
    if (search) {
      const pattern = `*${search}*`;
      query = query.or(
        ["name", "instagram", "website", "phone", "address", "problem", "notes"]
          .map((column) => `${column}.ilike.${pattern}`)
          .join(",")
      );
    }
    if (cursor) {
      const comparison = sortConfig.ascending ? "gt" : "lt";
      const rawCursorValue = cursor[sortConfig.cursorKey];

      if (sortConfig.column === "next_action_at" && rawCursorValue == null) {
        query = query
          .is("next_action_at", null)
          [comparison]("id", cursor.id);
      } else {
        const cursorValue = postgrestFilterValue(rawCursorValue!);
        const nullDates =
          sortConfig.column === "next_action_at"
            ? ",next_action_at.is.null"
            : "";
        query = query.or(
          `${sortConfig.column}.${comparison}.${cursorValue},and(${sortConfig.column}.eq.${cursorValue},id.${comparison}.${cursor.id})${nullDates}`
        );
      }
    }

    return query
      .order(sortConfig.column, {
        ascending: sortConfig.ascending,
        nullsFirst: false,
      })
      .order("id", { ascending: sortConfig.ascending })
      .limit(LEADS_PAGE_SIZE + 1);
  };

  let { data, error, count } = await runQuery(true);
  if (error?.code === "42703" || error?.code === "PGRST204") {
    if (
      filters.nextAction || filters.actionTiming || filters.leadGrade ||
      filters.scoreMin != null || filters.scoreMax != null ||
      sort.startsWith("follow_up") || sort.startsWith("score")
    ) {
      throw new Error(
        "Falta aplicar la migración del modelo de próximas acciones.",
        { cause: error }
      );
    }
    ({ data, error, count } = await runQuery(false));
  }

  if (error) {
    throw new Error("No se pudieron cargar los leads.", { cause: error });
  }

  const rows = (data as unknown as LeadRow[]).map((lead) => mapLeadRow(lead));
  const hasMore = rows.length > LEADS_PAGE_SIZE;
  const leads = hasMore ? rows.slice(0, LEADS_PAGE_SIZE) : rows;
  const lastLead = leads.at(-1);

  const activities = await getRecentActivitiesByLead(
    leads.map((lead) => lead.id)
  );

  return {
    leads: attachActivities(leads, activities),
    total: cursor ? null : (count ?? 0),
    nextCursor:
      hasMore && lastLead
        ? {
            id: lastLead.id,
            name: lastLead.name,
            createdAt: lastLead.createdAt,
            updatedAt: lastLead.updatedAt,
            followUpDate: lastLead.followUpDate,
            nextActionAt: lastLead.nextActionAt,
            leadScore: lastLead.leadScore,
          }
        : null,
  };
}

export async function getLeadWithTags(id: number): Promise<LeadWithTags | null> {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("leads")
    .select(LEAD_PAGE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error?.code === "42703" || error?.code === "PGRST204") {
    ({ data, error } = await supabase
      .from("leads")
      .select(LEAD_PAGE_LEGACY_COLUMNS)
      .eq("id", id)
      .maybeSingle());
  }

  if (error) {
    throw new Error("No se pudo cargar el lead.", { cause: error });
  }

  if (!data) return null;
  const lead = mapLeadRow(data as unknown as LeadRow);
  const activities = await getRecentActivitiesByLead([lead.id]);
  return attachActivities([lead], activities)[0];
}

export async function getLeadActivities(
  id: number,
  limit = 100
): Promise<LeadActivity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_activities")
    .select("id, lead_id, type, occurred_at, metadata, description, origin, template_id")
    .eq("lead_id", id)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 250));

  if (error?.code === "PGRST205" || error?.code === "42P01") return [];
  if (error) throw new Error("No se pudo cargar la actividad del lead.", { cause: error });
  return ((data ?? []) as ActivityRow[]).map(mapActivity);
}

export async function getRecentLeadCreatedDates(days = 30): Promise<string[]> {
  const supabase = await createClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Math.max(1, days));
  const { data, error } = await supabase
    .from("leads")
    .select("created_at")
    .gte("created_at", since.toISOString());

  if (error) {
    throw new Error("No se pudieron cargar las fechas de los leads.", {
      cause: error,
    });
  }

  return data.map((lead) => lead.created_at);
}

export async function getLeadImportComparables(): Promise<LeadImportComparable[]> {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("leads")
    .select(
      "id, name, instagram, website, phone, address, lat, lng, google_place_id, normalized_phone, normalized_instagram, website_domain"
    );

  if (error?.code === "42703" || error?.code === "PGRST204") {
    ({ data, error } = await supabase
      .from("leads")
      .select("id, name, instagram, website, phone, address, lat, lng"));
  }

  if (error) {
    throw new Error("No se pudieron comprobar los leads duplicados.", {
      cause: error,
    });
  }

  return (data ?? []).map((lead) => ({
    id: lead.id,
    name: lead.name,
    instagram: lead.instagram,
    website: lead.website,
    phone: lead.phone,
    address: lead.address,
    lat: lead.lat,
    lng: lead.lng,
    googlePlaceId:
      "google_place_id" in lead ? (lead.google_place_id ?? null) : null,
    normalizedPhone:
      "normalized_phone" in lead ? (lead.normalized_phone ?? null) : null,
    normalizedInstagram:
      "normalized_instagram" in lead
        ? (lead.normalized_instagram ?? null)
        : null,
    websiteDomain:
      "website_domain" in lead ? (lead.website_domain ?? null) : null,
  }));
}

export const getLeadOptions = cache(async (): Promise<LeadOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, instagram")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("No se pudieron cargar las opciones de leads.", {
      cause: error,
    });
  }

  return data as LeadOption[];
});

export const getAllTags = cache(async (): Promise<Tag[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .order("name", { ascending: true });

  if (error) {
    throw new Error("No se pudieron cargar las etiquetas.", { cause: error });
  }

  return data as Tag[];
});
