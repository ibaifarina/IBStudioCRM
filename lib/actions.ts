"use server";

import { revalidatePath } from "next/cache";
import { TAG_COLORS, isValidStatus } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { GeocodeResult, LeadInput, Tag } from "@/lib/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function revalidateCrm() {
  revalidatePath("/", "layout");
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    return {
      ok: false,
      error: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    } as const;
  }

  return { ok: true, supabase, userId } as const;
}

export async function saveLead(
  input: LeadInput
): Promise<{ id: number } | { error: string }> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const name = input.name?.trim();
  if (!name) return { error: "El nombre del negocio es obligatorio." };
  if (!isValidStatus(input.status)) return { error: "Estado no válido." };

  const contactDate =
    clean(input.contactDate) ??
    (input.status !== "por_contactar" ? today() : null);
  const values = {
    user_id: auth.userId,
    name,
    instagram: clean(input.instagram)?.replace(/^@/, "") ?? null,
    website: clean(input.website),
    phone: clean(input.phone),
    address: clean(input.address),
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    problem: clean(input.problem),
    notes: clean(input.notes),
    status: input.status,
    contact_date: contactDate,
    follow_up_date: clean(input.followUpDate),
    updated_at: new Date().toISOString(),
  };

  let id: number;
  if (input.id) {
    const { data, error } = await auth.supabase
      .from("leads")
      .update(values)
      .eq("id", input.id)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { error: "No se pudo actualizar el lead." };
    }

    id = data.id;
    const { error: unlinkError } = await auth.supabase
      .from("lead_tags")
      .delete()
      .eq("lead_id", id);

    if (unlinkError) {
      return { error: "El lead se guardó, pero no sus etiquetas." };
    }
  } else {
    const { data, error } = await auth.supabase
      .from("leads")
      .insert(values)
      .select("id")
      .single();

    if (error || !data) {
      return { error: "No se pudo crear el lead." };
    }

    id = data.id;
  }

  const tagIds = [...new Set(input.tagIds)];
  if (tagIds.length > 0) {
    const { error } = await auth.supabase.from("lead_tags").insert(
      tagIds.map((tagId) => ({
        user_id: auth.userId,
        lead_id: id,
        tag_id: tagId,
      }))
    );

    if (error) {
      return { error: "El lead se guardó, pero no sus etiquetas." };
    }
  }

  revalidateCrm();
  return { id };
}

export async function deleteLead(id: number): Promise<{ error?: string }> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const { error } = await auth.supabase.from("leads").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el lead." };

  revalidateCrm();
  return {};
}

export async function setLeadStatus(
  id: number,
  status: string
): Promise<{ error?: string }> {
  if (!isValidStatus(status)) return { error: "Estado no válido." };

  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const { data: lead, error: readError } = await auth.supabase
    .from("leads")
    .select("contact_date")
    .eq("id", id)
    .maybeSingle();

  if (readError || !lead) return { error: "No se encontró el lead." };

  const contactDate =
    lead.contact_date ?? (status !== "por_contactar" ? today() : null);
  const { error } = await auth.supabase
    .from("leads")
    .update({
      status,
      contact_date: contactDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No se pudo cambiar el estado." };

  revalidateCrm();
  return {};
}

export async function createTag(
  name: string
): Promise<Tag | { error: string }> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const trimmed = name.trim();
  if (!trimmed) return { error: "El nombre de la etiqueta está vacío." };

  const { data: existingTags, error: readError } = await auth.supabase
    .from("tags")
    .select("id, name, color")
    .order("name");

  if (readError) return { error: "No se pudieron consultar las etiquetas." };

  const existing = existingTags.find(
    (tag) => tag.name.toLocaleLowerCase("es") === trimmed.toLocaleLowerCase("es")
  );
  if (existing) return existing as Tag;

  const { data, error } = await auth.supabase
    .from("tags")
    .insert({
      user_id: auth.userId,
      name: trimmed,
      color: TAG_COLORS[existingTags.length % TAG_COLORS.length],
    })
    .select("id, name, color")
    .single();

  if (error || !data) return { error: "No se pudo crear la etiqueta." };

  revalidateCrm();
  return data as Tag;
}

export async function geocodeAddress(
  query: string
): Promise<GeocodeResult[]> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return [];

  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", normalizedQuery);
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "es");
  url.searchParams.set("accept-language", "es");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "ib-studio-crm/1.0 (contacto local)" },
    });
    if (!response.ok) return [];

    const data = (await response.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
    }>;
    return data.map((result) => ({
      label: result.display_name,
      lat: Number.parseFloat(result.lat),
      lng: Number.parseFloat(result.lon),
    }));
  } catch {
    return [];
  }
}
