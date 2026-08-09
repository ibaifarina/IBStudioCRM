import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  LeadCursor,
  LeadFilters,
  LeadImportComparable,
  LeadOption,
  LeadPage,
  LeadWithTags,
  Tag,
} from "@/lib/types";

export const LEADS_PAGE_SIZE = 50;

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
    status: lead.status,
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
  contact_date,
  follow_up_date,
  created_at,
  updated_at,
  lead_tags ( tags ( id, name, color ) )
`;

function safeSearchTerm(value: string) {
  return value.trim().slice(0, 100).replace(/[,%_()"\\]/g, " ");
}

export async function getLeadsPage({
  cursor,
  filters = {},
}: {
  cursor?: LeadCursor | null;
  filters?: LeadFilters;
} = {}): Promise<LeadPage> {
  const supabase = await createClient();
  const selectColumns = filters.tagId
    ? `${LEAD_PAGE_COLUMNS}, filtered_lead_tags:lead_tags!inner(tag_id)`
    : LEAD_PAGE_COLUMNS;
  let query = supabase
    .from("leads")
    .select(selectColumns, cursor ? undefined : { count: "exact" });

  if (filters.status) query = query.eq("status", filters.status);
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

  const search = filters.search ? safeSearchTerm(filters.search) : "";
  if (search) {
    const pattern = `*${search}*`;
    query = query.or(
      ["name", "instagram", "website", "phone", "address", "problem", "notes"]
        .map((column) => `${column}.ilike.${pattern}`)
        .join(",")
    );
  }

  if (cursor) {
    query = query.or(
      `updated_at.lt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.lt.${cursor.id})`
    );
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(LEADS_PAGE_SIZE + 1);

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
        ? { id: lastLead.id, updatedAt: lastLead.updatedAt }
        : null,
  };
}

export async function getLeadWithTags(id: number): Promise<LeadWithTags | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_PAGE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

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
