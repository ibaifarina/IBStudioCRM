import { cache } from "react";
import { normalizeLeadStatuses, type LeadSortKey } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type {
  LeadCursor,
  LeadFilters,
  LeadImportComparable,
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
  website: string | null;
  website_status?: LeadWithTags["websiteStatus"] | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  problem: string | null;
  notes: string | null;
  status: string;
  statuses?: string[] | null;
  contact_date: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
  lead_tags: Array<{ tags: TagRow | TagRow[] | null }>;
};

function mapLeadRow(
  lead: LeadRow,
  hasWebsiteStatusColumn = true
): LeadWithTags {
  const statuses = normalizeLeadStatuses(lead.statuses, lead.status);
  return {
    id: lead.id,
    name: lead.name,
    instagram: lead.instagram,
    website: lead.website,
    websiteStatus:
      hasWebsiteStatusColumn && lead.website_status
        ? lead.website_status
        : lead.website
          ? "tiene_web"
          : "sin_revisar",
    phone: lead.phone,
    address: lead.address,
    lat: lead.lat,
    lng: lead.lng,
    problem: lead.problem,
    notes: lead.notes,
    status: statuses[0],
    statuses,
    contactDate: lead.contact_date,
    followUpDate: lead.follow_up_date,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    tags: lead.lead_tags
      .flatMap((link) =>
        Array.isArray(link.tags) ? link.tags : link.tags ? [link.tags] : []
      )
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
  };
}

export const getLeadsWithTags = cache(async (): Promise<LeadWithTags[]> => {
  const supabase = await createClient();
  const result = await supabase
    .from("leads")
    .select(
      `
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
      `
    )
    .order("updated_at", { ascending: false });
  let data: unknown = result.data;
  let error = result.error;

  let hasWebsiteStatusColumn = true;
  if (
    error?.code === "42703" &&
    error.message.includes("statuses")
  ) {
    const fallback = await supabase
      .from("leads")
      .select(
        `
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
          contact_date,
          follow_up_date,
          created_at,
          updated_at,
          lead_tags ( tags ( id, name, color ) )
        `
      )
      .order("updated_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }
  if (
    error?.code === "42703" &&
    error.message.includes("website_status")
  ) {
    hasWebsiteStatusColumn = false;
    const fallback = await supabase
      .from("leads")
      .select(
        `
          id,
          name,
          instagram,
          website,
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
        `
      )
      .order("updated_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error("No se pudieron cargar los leads.", { cause: error });
  }

  return (data as unknown as LeadRow[]).map((lead) =>
    mapLeadRow(lead, hasWebsiteStatusColumn)
  );
});

const LEAD_PAGE_COLUMNS = `
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

const LEAD_PAGE_COLUMNS_WITHOUT_STATUSES = LEAD_PAGE_COLUMNS.replace(
  "  statuses,\n",
  ""
);

function safeSearchTerm(value: string) {
  return value.trim().slice(0, 100).replace(/[,%_()"\\]/g, " ");
}

const LEAD_SORT_CONFIG: Record<
  LeadSortKey,
  {
    column: "updated_at" | "created_at" | "name";
    cursorKey: "updatedAt" | "createdAt" | "name";
    ascending: boolean;
  }
> = {
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
  name_asc: { column: "name", cursorKey: "name", ascending: true },
  name_desc: { column: "name", cursorKey: "name", ascending: false },
};

function postgrestFilterValue(value: string) {
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
  const runQuery = (hasStatusesColumn: boolean) => {
    const baseColumns = hasStatusesColumn
      ? LEAD_PAGE_COLUMNS
      : LEAD_PAGE_COLUMNS_WITHOUT_STATUSES;
    const selectColumns = filters.tagId
      ? `${baseColumns}, filtered_lead_tags:lead_tags!inner(tag_id)`
      : baseColumns;
    let query = supabase
      .from("leads")
      .select(selectColumns, cursor ? undefined : { count: "exact" });

    if (filters.status) {
      query = hasStatusesColumn
        ? query.contains("statuses", [filters.status])
        : query.eq("status", filters.status);
    } else {
      query = hasStatusesColumn
        ? query.not("statuses", "cs", "{descartado}")
        : query.neq("status", "descartado");
    }
    if (filters.websiteStatus) {
      query = query.eq("website_status", filters.websiteStatus);
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
      const cursorValue = postgrestFilterValue(cursor[sortConfig.cursorKey]);
      query = query.or(
        `${sortConfig.column}.${comparison}.${cursorValue},and(${sortConfig.column}.eq.${cursorValue},id.${comparison}.${cursor.id})`
      );
    }

    return query
      .order(sortConfig.column, { ascending: sortConfig.ascending })
      .order("id", { ascending: sortConfig.ascending })
      .limit(LEADS_PAGE_SIZE + 1);
  };

  let { data, error, count } = await runQuery(true);
  if (error?.code === "42703" && error.message.includes("statuses")) {
    ({ data, error, count } = await runQuery(false));
  }

  if (error) {
    throw new Error("No se pudieron cargar los leads.", { cause: error });
  }

  const rows = (data as unknown as LeadRow[]).map((lead) => mapLeadRow(lead));
  const hasMore = rows.length > LEADS_PAGE_SIZE;
  const leads = hasMore ? rows.slice(0, LEADS_PAGE_SIZE) : rows;
  const lastLead = leads.at(-1);

  return {
    leads,
    total: cursor ? null : (count ?? 0),
    nextCursor:
      hasMore && lastLead
        ? {
            id: lastLead.id,
            name: lastLead.name,
            createdAt: lastLead.createdAt,
            updatedAt: lastLead.updatedAt,
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

  if (error?.code === "42703" && error.message.includes("statuses")) {
    ({ data, error } = await supabase
      .from("leads")
      .select(LEAD_PAGE_COLUMNS_WITHOUT_STATUSES)
      .eq("id", id)
      .maybeSingle());
  }

  if (error) {
    throw new Error("No se pudo cargar el lead.", { cause: error });
  }

  return data ? mapLeadRow(data as unknown as LeadRow) : null;
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
  const { data, error } = await supabase
    .from("leads")
    .select("name, instagram, website, phone, address, lat, lng");

  if (error) {
    throw new Error("No se pudieron comprobar los leads duplicados.", {
      cause: error,
    });
  }

  return data as LeadImportComparable[];
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
