import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LeadOption, LeadWithTags, Tag } from "@/lib/types";

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

export const getLeadsWithTags = cache(async (): Promise<LeadWithTags[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
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

  if (error) {
    throw new Error("No se pudieron cargar los leads.", { cause: error });
  }

  return (data as unknown as LeadRow[]).map((lead) => ({
    id: lead.id,
    name: lead.name,
    instagram: lead.instagram,
    website: lead.website,
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
  }));
});

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
