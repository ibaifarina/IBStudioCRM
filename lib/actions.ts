"use server";

import { revalidatePath } from "next/cache";
import {
  TAG_COLORS,
  areStatusesUncontacted,
  isValidStatus,
  isValidWebsiteStatus,
  normalizeLeadStatuses,
} from "@/lib/config";
import { captureLeadChangeSet } from "@/lib/lead-history";
import { resolveMapsCoordinates } from "@/lib/maps";
import { isGoogleMapsShortUrl } from "@/lib/parse";
import { getLeadWithTags } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type {
  BulkLeadUpdate,
  GeocodeResult,
  LeadChangeSet,
  LeadInput,
  LeadWithTags,
  Tag,
} from "@/lib/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isMissingWebsiteStatusColumn(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "42703" &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.includes("website_status")
  );
}

function websiteStatusMigrationError() {
  return {
    error:
      "Falta aplicar la migración 20260722000000_add_website_status.sql en Supabase.",
  } as const;
}

function isMissingStatusesColumn(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "42703" || error.code === "PGRST204") &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.includes("statuses")
  );
}

function statusesMigrationError() {
  return {
    error:
      "Falta aplicar la migración 20260822010000_add_multiple_lead_statuses.sql en Supabase.",
  } as const;
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

export async function loadLeadChangeHistory(): Promise<
  LeadChangeSet[] | { error: string }
> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const { error: pruneError } = await auth.supabase.rpc(
    "prune_lead_change_history"
  );

  if (pruneError) {
    return {
      error:
        "No se pudo aplicar la retención del historial. Comprueba que la última migración esté aplicada.",
    };
  }

  const { data, error } = await auth.supabase
    .from("lead_change_sets")
    .select(
      "id, description, lead_count, created_at, restored_at, restores_change_set_id"
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(75);

  if (error) {
    return {
      error:
        "No se pudo cargar el historial. Comprueba que la migración esté aplicada.",
    };
  }

  return data.map((change) => ({
    id: change.id,
    description: change.description,
    leadCount: change.lead_count,
    createdAt: change.created_at,
    restoredAt: change.restored_at,
    restoresChangeSetId: change.restores_change_set_id,
  }));
}

export async function restoreLeadChangeSet(
  changeSetId: number
): Promise<{ restored: number } | { error: string }> {
  if (!Number.isSafeInteger(changeSetId) || changeSetId <= 0) {
    return { error: "La versión seleccionada no es válida." };
  }

  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const { data, error } = await auth.supabase.rpc("restore_lead_change_set", {
    p_change_set_id: changeSetId,
  });

  if (error || typeof data !== "number") {
    return {
      error:
        error?.message === "This change set was already restored"
          ? "Esta versión ya se había restaurado."
          : "No se pudo restaurar la versión seleccionada.",
    };
  }

  revalidateCrm();
  return { restored: data };
}

export async function saveLead(
  input: LeadInput
): Promise<LeadWithTags | { error: string }> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const name = input.name?.trim();
  if (!name) return { error: "El nombre del negocio es obligatorio." };
  if (
    input.statuses.length === 0 ||
    input.statuses.some((status) => !isValidStatus(status))
  ) {
    return { error: "Selecciona al menos un estado válido." };
  }
  const statuses = normalizeLeadStatuses(input.statuses);
  if (!isValidWebsiteStatus(input.websiteStatus)) {
    return { error: "Estado de la web no válido." };
  }

  let contactDate = areStatusesUncontacted(statuses)
    ? null
    : (clean(input.contactDate) ?? today());

  if (input.id && statuses.includes("contactado")) {
    const { data: currentLead, error: readError } = await auth.supabase
      .from("leads")
      .select("statuses")
      .eq("id", input.id)
      .maybeSingle();

    if (readError || !currentLead) {
      return { error: "No se encontró el lead." };
    }

    if (!currentLead.statuses?.includes("contactado")) contactDate = today();
  }

  const address = clean(input.address);
  let lat = input.lat ?? null;
  let lng = input.lng ?? null;
  if (address && (lat == null || lng == null)) {
    const resolved = await resolveMapsCoordinates(address);
    if (resolved) {
      lat = resolved.lat;
      lng = resolved.lng;
    }
  }

  const values = {
    user_id: auth.userId,
    name,
    instagram: clean(input.instagram)?.replace(/^@/, "") ?? null,
    website: clean(input.website),
    website_status: input.websiteStatus,
    phone: clean(input.phone),
    address,
    lat,
    lng,
    problem: clean(input.problem),
    notes: clean(input.notes),
    status: statuses[0],
    statuses,
    contact_date: contactDate,
    follow_up_date: clean(input.followUpDate),
    updated_at: new Date().toISOString(),
  };

  let id: number;
  if (input.id) {
    const history = await captureLeadChangeSet(
      auth.supabase,
      [input.id],
      `Edición de «${name}»`
    );
    if ("error" in history) return history;

    const { data, error } = await auth.supabase
      .from("leads")
      .update(values)
      .eq("id", input.id)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      if (isMissingStatusesColumn(error)) return statusesMigrationError();
      if (isMissingWebsiteStatusColumn(error)) {
        return websiteStatusMigrationError();
      }
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
      if (isMissingStatusesColumn(error)) return statusesMigrationError();
      if (isMissingWebsiteStatusColumn(error)) {
        return websiteStatusMigrationError();
      }
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

  if (!input.id) {
    const history = await captureLeadChangeSet(
      auth.supabase,
      [id],
      `Creación de «${name}»`,
      false
    );
    if ("error" in history) {
      await auth.supabase.from("leads").delete().eq("id", id);
      return history;
    }
  }

  let savedLead;
  try {
    savedLead = await getLeadWithTags(id);
  } catch {
    return {
      error: "El lead se guardó, pero no se pudo actualizar la vista.",
    };
  }
  if (!savedLead) return { error: "No se encontró el lead guardado." };

  if (!input.id) revalidateCrm();
  return savedLead;
}

export async function deleteLead(id: number): Promise<{ error?: string }> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  if (!Number.isSafeInteger(id) || id <= 0) {
    return { error: "El lead no es válido." };
  }

  const { data: lead, error: readError } = await auth.supabase
    .from("leads")
    .select("id, name")
    .eq("user_id", auth.userId)
    .eq("id", id)
    .maybeSingle();
  if (readError || !lead) return { error: "No se encontró el lead." };

  const history = await captureLeadChangeSet(
    auth.supabase,
    [id],
    `Eliminación de «${lead.name}»`
  );
  if ("error" in history) return history;

  const { error } = await auth.supabase
    .from("leads")
    .delete()
    .eq("user_id", auth.userId)
    .eq("id", id);
  if (error) return { error: "No se pudo eliminar el lead." };

  return {};
}

export async function deleteLeadsBulk(
  ids: number[]
): Promise<{ deleted: number } | { error: string }> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const leadIds = [
    ...new Set(
      ids.filter((id) => Number.isSafeInteger(id) && id > 0)
    ),
  ];
  if (leadIds.length === 0) return { error: "No hay leads seleccionados." };
  if (leadIds.length > 1000) {
    return { error: "Selecciona un máximo de 1000 leads cada vez." };
  }

  const { data: ownedLeads, error: readError } = await auth.supabase
    .from("leads")
    .select("id")
    .eq("user_id", auth.userId)
    .in("id", leadIds);

  if (readError || ownedLeads.length !== leadIds.length) {
    return { error: "Uno o más leads no existen o no se pueden eliminar." };
  }

  const history = await captureLeadChangeSet(
    auth.supabase,
    leadIds,
    `Eliminación masiva de ${leadIds.length} ${
      leadIds.length === 1 ? "lead" : "leads"
    }`
  );
  if ("error" in history) return history;

  const { data: deletedLeads, error } = await auth.supabase
    .from("leads")
    .delete()
    .eq("user_id", auth.userId)
    .in("id", leadIds)
    .select("id");

  if (error || deletedLeads.length !== leadIds.length) {
    return { error: "No se pudieron eliminar todos los leads." };
  }

  revalidateCrm();
  return { deleted: deletedLeads.length };
}

export async function setLeadStatuses(
  id: number,
  requestedStatuses: string[]
): Promise<{
  error?: string;
  statuses?: ReturnType<typeof normalizeLeadStatuses>;
  contactDate?: string | null;
}> {
  if (
    requestedStatuses.length === 0 ||
    requestedStatuses.some((status) => !isValidStatus(status))
  ) {
    return { error: "Selecciona al menos un estado válido." };
  }
  const statuses = normalizeLeadStatuses(requestedStatuses);

  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const { data: lead, error: readError } = await auth.supabase
    .from("leads")
    .select("name, status, statuses, contact_date")
    .eq("user_id", auth.userId)
    .eq("id", id)
    .maybeSingle();

  if (readError || !lead) return { error: "No se encontró el lead." };
  const previousStatuses = normalizeLeadStatuses(lead.statuses, lead.status);
  if (
    previousStatuses.length === statuses.length &&
    previousStatuses.every((status, index) => status === statuses[index])
  ) {
    return { statuses, contactDate: lead.contact_date };
  }

  const history = await captureLeadChangeSet(
    auth.supabase,
    [id],
    `Cambio de estado de «${lead.name}»`
  );
  if ("error" in history) return history;

  const contactDate = areStatusesUncontacted(statuses)
    ? null
    : statuses.includes("contactado") &&
        !previousStatuses.includes("contactado")
      ? today()
      : (lead.contact_date ?? today());
  const { error } = await auth.supabase
    .from("leads")
    .update({
      status: statuses[0],
      statuses,
      contact_date: contactDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (isMissingStatusesColumn(error)) return statusesMigrationError();
    return { error: "No se pudieron cambiar los estados." };
  }

  revalidateCrm();
  return { statuses, contactDate };
}

export async function setLeadWebsiteStatus(
  id: number,
  websiteStatus: string
): Promise<{ error?: string }> {
  if (!isValidWebsiteStatus(websiteStatus)) {
    return { error: "Estado de la web no válido." };
  }

  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const { data: lead, error: readError } = await auth.supabase
    .from("leads")
    .select("name, website_status")
    .eq("user_id", auth.userId)
    .eq("id", id)
    .maybeSingle();
  if (readError || !lead) return { error: "No se encontró el lead." };
  if (lead.website_status === websiteStatus) return {};

  const history = await captureLeadChangeSet(
    auth.supabase,
    [id],
    `Cambio de web de «${lead.name}»`
  );
  if ("error" in history) return history;

  const { error } = await auth.supabase
    .from("leads")
    .update({
      website_status: websiteStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (isMissingWebsiteStatusColumn(error)) {
      return websiteStatusMigrationError();
    }
    return { error: "No se pudo cambiar el estado de la web." };
  }

  return {};
}

export async function updateLeadsBulk(
  input: BulkLeadUpdate
): Promise<{ updated: number } | { error: string }> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const leadIds = [
    ...new Set(
      input.leadIds.filter(
        (id) => Number.isSafeInteger(id) && id > 0
      )
    ),
  ];
  if (leadIds.length === 0) return { error: "No hay leads seleccionados." };
  if (leadIds.length > 1000) {
    return { error: "Selecciona un máximo de 1000 leads cada vez." };
  }

  const hasStatuses = input.statuses !== undefined;
  const hasWebsiteStatus = input.websiteStatus !== undefined;
  const hasTags = input.tags !== undefined;
  const hasFollowUpDate = Object.hasOwn(input, "followUpDate");

  if (!hasStatuses && !hasWebsiteStatus && !hasTags && !hasFollowUpDate) {
    return { error: "Selecciona al menos un cambio para aplicar." };
  }
  if (
    hasStatuses &&
    (input.statuses!.length === 0 ||
      input.statuses!.some((status) => !isValidStatus(status)))
  ) {
    return { error: "Selecciona al menos un estado válido." };
  }
  const statuses = hasStatuses
    ? normalizeLeadStatuses(input.statuses)
    : undefined;
  if (
    hasWebsiteStatus &&
    !isValidWebsiteStatus(input.websiteStatus!)
  ) {
    return { error: "Estado de la web no válido." };
  }

  const { data: ownedLeads, error: leadError } = await auth.supabase
    .from("leads")
    .select("id, status, statuses, contact_date")
    .eq("user_id", auth.userId)
    .in("id", leadIds);

  if (leadError || ownedLeads.length !== leadIds.length) {
    return { error: "Uno o más leads no existen o no se pueden editar." };
  }

  const tagIds = [
    ...new Set(
      (input.tags?.tagIds ?? []).filter(
        (id) => Number.isSafeInteger(id) && id > 0
      )
    ),
  ];

  if (
    input.tags &&
    input.tags.mode !== "replace" &&
    tagIds.length === 0
  ) {
    return { error: "Selecciona al menos una etiqueta." };
  }

  if (tagIds.length > 0) {
    const { data: ownedTags, error: tagError } = await auth.supabase
      .from("tags")
      .select("id")
      .eq("user_id", auth.userId)
      .in("id", tagIds);

    if (tagError || ownedTags.length !== tagIds.length) {
      return { error: "Una o más etiquetas no existen." };
    }
  }

  const history = await captureLeadChangeSet(
    auth.supabase,
    leadIds,
    `Edición masiva de ${leadIds.length} ${
      leadIds.length === 1 ? "lead" : "leads"
    }`
  );
  if ("error" in history) return history;

  const leadValues: {
    status?: string;
    statuses?: string[];
    website_status?: string;
    contact_date?: string | null;
    follow_up_date?: string | null;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if (statuses) {
    leadValues.status = statuses[0];
    leadValues.statuses = statuses;
    if (areStatusesUncontacted(statuses)) leadValues.contact_date = null;
  }
  if (hasWebsiteStatus) leadValues.website_status = input.websiteStatus;
  if (hasFollowUpDate) leadValues.follow_up_date = clean(input.followUpDate);

  if (hasStatuses || hasWebsiteStatus || hasFollowUpDate) {
    const { error } = await auth.supabase
      .from("leads")
      .update(leadValues)
      .eq("user_id", auth.userId)
      .in("id", leadIds);

    if (error) {
      if (isMissingStatusesColumn(error)) return statusesMigrationError();
      if (isMissingWebsiteStatusColumn(error)) {
        return websiteStatusMigrationError();
      }
      return { error: "No se pudieron actualizar los leads." };
    }

    if (statuses && !areStatusesUncontacted(statuses)) {
      const needsContactDate = ownedLeads
        .filter((lead) =>
          statuses.includes("contactado")
            ? !normalizeLeadStatuses(lead.statuses, lead.status).includes(
                "contactado"
              )
            : !lead.contact_date
        )
        .map((lead) => lead.id);

      if (needsContactDate.length > 0) {
        const { error: contactDateError } = await auth.supabase
          .from("leads")
          .update({ contact_date: today() })
          .eq("user_id", auth.userId)
          .in("id", needsContactDate);

        if (contactDateError) {
          return {
            error:
              "Se cambió el estado, pero no se pudo actualizar la fecha de contacto.",
          };
        }
      }
    }
  }

  if (input.tags) {
    if (input.tags.mode === "replace") {
      const { error } = await auth.supabase
        .from("lead_tags")
        .delete()
        .eq("user_id", auth.userId)
        .in("lead_id", leadIds);

      if (error) {
        return { error: "Los leads se actualizaron, pero no sus etiquetas." };
      }
    } else if (input.tags.mode === "remove") {
      const { error } = await auth.supabase
        .from("lead_tags")
        .delete()
        .eq("user_id", auth.userId)
        .in("lead_id", leadIds)
        .in("tag_id", tagIds);

      if (error) {
        return { error: "Los leads se actualizaron, pero no sus etiquetas." };
      }
    }

    if (input.tags.mode !== "remove" && tagIds.length > 0) {
      const links = leadIds.flatMap((leadId) =>
        tagIds.map((tagId) => ({
          user_id: auth.userId,
          lead_id: leadId,
          tag_id: tagId,
        }))
      );
      const { error } = await auth.supabase.from("lead_tags").upsert(links, {
        onConflict: "lead_id,tag_id",
        ignoreDuplicates: true,
      });

      if (error) {
        return { error: "Los leads se actualizaron, pero no sus etiquetas." };
      }
    }
  }

  revalidateCrm();
  return { updated: leadIds.length };
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

  const mapsCoordinates = await resolveMapsCoordinates(normalizedQuery);
  if (mapsCoordinates) {
    return [{
      label: "Ubicación de Google Maps",
      ...mapsCoordinates,
    }];
  }

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

export async function locateGoogleMapsLinks(): Promise<
  { located: number; failed: number } | { error: string }
> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const { data: leads, error } = await auth.supabase
    .from("leads")
    .select("id, address, lat, lng")
    .eq("user_id", auth.userId)
    .or("lat.is.null,lng.is.null");

  if (error) return { error: "No se pudieron localizar los enlaces de Maps." };

  const candidates = leads.filter(
    (lead) => lead.address && isGoogleMapsShortUrl(lead.address)
  );
  let failed = 0;
  const resolvedLeads: Array<{
    id: number;
    coordinates: { lat: number; lng: number };
  }> = [];

  // Resolvemos en grupos pequeños para no abrir demasiadas conexiones a Google.
  for (let index = 0; index < candidates.length; index += 5) {
    const batch = candidates.slice(index, index + 5);
    const results = await Promise.all(
      batch.map(async (lead) => ({
        lead,
        coordinates: await resolveMapsCoordinates(lead.address!),
      }))
    );

    for (const { lead, coordinates } of results) {
      if (!coordinates) failed += 1;
      else resolvedLeads.push({ id: lead.id, coordinates });
    }
  }

  if (resolvedLeads.length === 0) return { located: 0, failed };

  const history = await captureLeadChangeSet(
    auth.supabase,
    resolvedLeads.map((lead) => lead.id),
    `Actualización de ubicación de ${resolvedLeads.length} ${
      resolvedLeads.length === 1 ? "lead" : "leads"
    }`
  );
  if ("error" in history) return history;

  let located = 0;
  for (let index = 0; index < resolvedLeads.length; index += 5) {
    const batch = resolvedLeads.slice(index, index + 5);
    await Promise.all(
      batch.map(async ({ id, coordinates }) => {
        const { error: updateError } = await auth.supabase
          .from("leads")
          .update({
            lat: coordinates.lat,
            lng: coordinates.lng,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", auth.userId)
          .eq("id", id);

        if (updateError) failed += 1;
        else located += 1;
      })
    );
  }

  if (located > 0) revalidateCrm();
  return { located, failed };
}
