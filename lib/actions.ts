"use server";

import { revalidatePath } from "next/cache";
import {
  TAG_COLORS,
  defaultNextActionForStatus,
  isValidContactChannel,
  isValidLeadSource,
  isValidNextAction,
  isValidStatus,
  isValidWebsiteStatus,
  normalizeLeadStatus,
  type ContactChannelKey,
  type NextActionKey,
  type StatusKey,
} from "@/lib/config";
import { captureLeadChangeSet } from "@/lib/lead-history";
import {
  findDuplicateLead,
  normalizeInstagramUsername,
  normalizePhoneE164,
  normalizeWebsiteDomain,
} from "@/lib/lead-identifiers";
import { resolveMapsCoordinates } from "@/lib/maps";
import { scoreValuesForInput, recalculateLeadScores } from "@/lib/lead-scoring-server";
import { isGoogleMapsShortUrl } from "@/lib/parse";
import { getLeadActivities, getLeadWithTags } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type {
  BulkLeadUpdate,
  DuplicateWarning,
  GeocodeResult,
  LeadActivity,
  LeadChangeSet,
  LeadInput,
  LeadWithTags,
  Tag,
} from "@/lib/types";

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

function isMissingCrmColumns(error: unknown): boolean {
  const message =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : "";
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "42703" || error.code === "PGRST204") &&
      [
        "next_action",
        "contacted_at",
        "source",
        "lead_score",
        "score_breakdown",
        "business_categories",
        "digital_presence_known",
      ].some((column) =>
        message.includes(column)
      )
  );
}

function crmMigrationError() {
  return {
    error:
      "Falta aplicar la migración 20260824010000_action_oriented_crm.sql en Supabase.",
  } as const;
}

function revalidateCrm() {
  revalidatePath("/", "layout");
}

function revalidateCrmViews() {
  revalidatePath("/");
  revalidatePath("/mapa");
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
): Promise<
  LeadWithTags | { error: string } | { duplicate: DuplicateWarning }
> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const name = input.name?.trim();
  if (!name) return { error: "El nombre del negocio es obligatorio." };
  if (!isValidStatus(input.status)) return { error: "Estado no válido." };
  if (!isValidNextAction(input.nextAction)) {
    return { error: "Próxima acción no válida." };
  }
  if (!isValidWebsiteStatus(input.websiteStatus)) {
    return { error: "Estado de la web no válido." };
  }
  if (input.contactChannel && !isValidContactChannel(input.contactChannel)) {
    return { error: "Canal de contacto no válido." };
  }
  if (input.source && !isValidLeadSource(input.source)) {
    return { error: "Fuente del lead no válida." };
  }
  if (input.contactedAt && Number.isNaN(Date.parse(input.contactedAt))) {
    return { error: "Fecha de contacto no válida." };
  }
  if (input.nextActionAt && Number.isNaN(Date.parse(input.nextActionAt))) {
    return { error: "Fecha de próxima acción no válida." };
  }

  const now = new Date().toISOString();
  const contactedStages = new Set<StatusKey>([
    "contactado",
    "respondio",
    "interesado",
    "cliente",
  ]);
  const repliedStages = new Set<StatusKey>([
    "respondio",
    "interesado",
    "cliente",
  ]);
  let currentLead: {
    status: string;
    contacted_at: string | null;
    replied_at: string | null;
    last_contact_at: string | null;
    notes: string | null;
    facebook: string | null;
    email: string | null;
    business_categories: string[];
    rating: number | string | null;
    review_count: number | null;
    last_review_at: string | null;
    photo_count: number | null;
    social_links: string[];
    digital_presence_known: boolean;
    open_status: string | null;
    is_permanently_closed: boolean;
    is_chain: boolean;
  } | null = null;

  if (input.id) {
    const { data, error } = await auth.supabase
      .from("leads")
      .select("status, contacted_at, replied_at, last_contact_at, notes, facebook, email, business_categories, rating, review_count, last_review_at, photo_count, social_links, digital_presence_known, open_status, is_permanently_closed, is_chain")
      .eq("user_id", auth.userId)
      .eq("id", input.id)
      .maybeSingle();
    if (error || !data) return { error: "No se encontró el lead." };
    currentLead = data;
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

  const instagram = normalizeInstagramUsername(input.instagram) || null;
  const website = clean(input.website);
  const phone = clean(input.phone);
  const googlePlaceId = clean(input.googlePlaceId);
  const facebook = input.facebook === undefined ? currentLead?.facebook ?? null : clean(input.facebook);
  const email = input.email === undefined ? currentLead?.email ?? null : clean(input.email);
  const businessCategories = input.businessCategories ?? currentLead?.business_categories ?? [];
  const rating = input.rating === undefined
    ? currentLead?.rating == null ? null : Number(currentLead.rating)
    : input.rating;
  const reviewCount = input.reviewCount === undefined
    ? currentLead?.review_count ?? null
    : input.reviewCount;
  const lastReviewAt = input.lastReviewAt === undefined
    ? currentLead?.last_review_at ?? null
    : clean(input.lastReviewAt);
  const photoCount = input.photoCount === undefined
    ? currentLead?.photo_count ?? null
    : input.photoCount;
  const socialLinks = input.socialLinks ?? currentLead?.social_links ?? [];
  const digitalPresenceKnown = input.digitalPresenceKnown ?? currentLead?.digital_presence_known ?? false;
  const openStatus = input.openStatus === undefined
    ? currentLead?.open_status ?? null
    : clean(input.openStatus);
  const isPermanentlyClosed = input.isPermanentlyClosed ?? currentLead?.is_permanently_closed ?? false;
  const isChain = input.isChain ?? currentLead?.is_chain ?? false;
  if (rating != null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
    return { error: "El rating debe estar entre 0 y 5." };
  }
  if (reviewCount != null && (!Number.isInteger(reviewCount) || reviewCount < 0)) {
    return { error: "El número de reseñas no es válido." };
  }
  if (lastReviewAt != null && !Number.isFinite(Date.parse(lastReviewAt))) {
    return { error: "La fecha de la última reseña no es válida." };
  }
  const tagIds = [...new Set(input.tagIds)];
  const { data: selectedTags, error: selectedTagsError } = tagIds.length
    ? await auth.supabase
        .from("tags")
        .select("id, name")
        .eq("user_id", auth.userId)
        .in("id", tagIds)
    : { data: [], error: null };
  if (selectedTagsError || selectedTags.length !== tagIds.length) {
    return { error: "Una o más etiquetas no son válidas." };
  }

  if (!input.id && !input.allowDuplicate) {
    const { data: comparableRows, error } = await auth.supabase
      .from("leads")
      .select(
        "id, name, instagram, website, phone, address, lat, lng, google_place_id, normalized_phone, normalized_instagram, website_domain"
      )
      .eq("user_id", auth.userId);
    if (error) {
      if (isMissingCrmColumns(error)) return crmMigrationError();
      return { error: "No se pudieron comprobar posibles duplicados." };
    }
    const duplicate = findDuplicateLead(
      {
        name,
        instagram,
        website,
        phone,
        address,
        lat,
        lng,
        googlePlaceId,
      },
      comparableRows.map((lead) => ({
        id: lead.id,
        name: lead.name,
        instagram: lead.instagram,
        website: lead.website,
        phone: lead.phone,
        address: lead.address,
        lat: lead.lat,
        lng: lead.lng,
        googlePlaceId: lead.google_place_id,
        normalizedPhone: lead.normalized_phone,
        normalizedInstagram: lead.normalized_instagram,
        websiteDomain: lead.website_domain,
      }))
    );
    if (duplicate) return { duplicate };
  }

  let contactedAt = clean(input.contactedAt) ?? currentLead?.contacted_at ?? null;
  let repliedAt = currentLead?.replied_at ?? null;
  let lastContactAt = currentLead?.last_contact_at ?? null;
  let lastOutboundAt: string | null | undefined;
  let lastInboundAt: string | null | undefined;
  if (contactedStages.has(input.status) && !contactedAt) {
    contactedAt = now;
    lastContactAt = now;
    lastOutboundAt = now;
  }
  if (repliedStages.has(input.status) && !repliedAt) {
    repliedAt = now;
    lastContactAt = now;
    lastInboundAt = now;
  }
  const nextAction = ["cliente", "descartado"].includes(input.status)
    ? "sin_accion"
    : input.nextAction;
  const nextActionAt =
    nextAction === "sin_accion" ? null : clean(input.nextActionAt);

  const values = {
    user_id: auth.userId,
    name,
    instagram,
    facebook,
    website,
    website_status: input.websiteStatus,
    phone,
    email,
    address,
    lat,
    lng,
    problem: clean(input.problem),
    notes: clean(input.notes),
    status: input.status,
    statuses: [input.status],
    contacted_at: contactedAt,
    replied_at: repliedAt,
    last_contact_at: lastContactAt,
    ...(lastOutboundAt !== undefined ? { last_outbound_at: lastOutboundAt } : {}),
    ...(lastInboundAt !== undefined ? { last_inbound_at: lastInboundAt } : {}),
    contact_channel: input.contactChannel ?? null,
    next_action: nextAction,
    next_action_at: nextActionAt,
    source: input.source ?? "manual",
    google_place_id: googlePlaceId,
    business_categories: businessCategories,
    rating,
    review_count: reviewCount,
    last_review_at: lastReviewAt,
    photo_count: photoCount,
    social_links: socialLinks,
    digital_presence_known: digitalPresenceKnown,
    open_status: openStatus,
    is_permanently_closed: isPermanentlyClosed,
    is_chain: isChain,
    normalized_phone: normalizePhoneE164(phone) || null,
    normalized_instagram: instagram,
    website_domain: normalizeWebsiteDomain(website) || null,
    ...scoreValuesForInput({
      name,
      instagram,
      facebook,
      website,
      websiteStatus: input.websiteStatus,
      phone,
      email,
      address,
      businessCategories,
      rating,
      reviewCount,
      lastReviewAt,
      photoCount,
      socialLinks,
      digitalPresenceKnown,
      contactChannel: input.contactChannel,
      source: input.source ?? "manual",
      openStatus,
      isPermanentlyClosed,
      isChain,
      tags: selectedTags.map((tag) => tag.name),
    }),
    updated_at: now,
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
      if (isMissingCrmColumns(error)) return crmMigrationError();
      if (isMissingWebsiteStatusColumn(error)) {
        return websiteStatusMigrationError();
      }
      return { error: "No se pudo actualizar el lead." };
    }

    id = data.id;
    if ((currentLead?.notes ?? null) !== (values.notes ?? null)) {
      const { error: activityError } = await auth.supabase
        .from("lead_activities")
        .insert({
          user_id: auth.userId,
          lead_id: id,
          type: "note_updated",
          description: "Notas actualizadas",
          origin: "manual",
        });
      if (activityError) {
        return { error: "El lead se guardó, pero no se pudo registrar la actividad." };
      }
    }
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
      if (isMissingCrmColumns(error)) return crmMigrationError();
      if (isMissingWebsiteStatusColumn(error)) {
        return websiteStatusMigrationError();
      }
      return { error: "No se pudo crear el lead." };
    }

    id = data.id;
  }

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

export async function setLeadStatus(
  id: number,
  status: string
): Promise<{
  error?: string;
  status?: StatusKey;
  statuses?: StatusKey[];
  contactDate?: string | null;
  contactedAt?: string | null;
  repliedAt?: string | null;
  lastContactAt?: string | null;
  nextAction?: NextActionKey;
  nextActionAt?: string | null;
}> {
  if (!isValidStatus(status)) return { error: "Estado no válido." };

  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const { data: lead, error: readError } = await auth.supabase
    .from("leads")
    .select(
      "name, status, contacted_at, replied_at, last_contact_at, next_action, next_action_at"
    )
    .eq("user_id", auth.userId)
    .eq("id", id)
    .maybeSingle();

  if (readError || !lead) return { error: "No se encontró el lead." };
  if (lead.status === status) {
    return {
      status,
      statuses: [status],
      contactDate: lead.contacted_at?.slice(0, 10) ?? null,
      contactedAt: lead.contacted_at,
      repliedAt: lead.replied_at,
      lastContactAt: lead.last_contact_at,
      nextAction: lead.next_action as NextActionKey,
      nextActionAt: lead.next_action_at,
    };
  }

  const history = await captureLeadChangeSet(
    auth.supabase,
    [id],
    `Cambio de estado de «${lead.name}»`
  );
  if ("error" in history) return history;

  const now = new Date().toISOString();
  const contactedStages: StatusKey[] = [
    "contactado",
    "respondio",
    "interesado",
    "cliente",
  ];
  const repliedStages: StatusKey[] = ["respondio", "interesado", "cliente"];
  const contactedAt =
    lead.contacted_at ?? (contactedStages.includes(status) ? now : null);
  const repliedAt = lead.replied_at ?? (repliedStages.includes(status) ? now : null);
  const terminal = status === "cliente" || status === "descartado";
  const previousStatus = normalizeLeadStatus(lead.status);
  const currentAction = isValidNextAction(lead.next_action)
    ? lead.next_action
    : defaultNextActionForStatus(previousStatus);
  const shouldAdvanceDefault =
    currentAction === "sin_accion" ||
    currentAction === defaultNextActionForStatus(previousStatus);
  const nextAction = terminal
    ? "sin_accion"
    : shouldAdvanceDefault
      ? defaultNextActionForStatus(status)
      : currentAction;
  const nextActionAt =
    terminal || nextAction !== currentAction ? null : lead.next_action_at;
  const { error } = await auth.supabase
    .from("leads")
    .update({
      status,
      statuses: [status],
      contacted_at: contactedAt,
      replied_at: repliedAt,
      last_contact_at:
        repliedAt !== lead.replied_at || contactedAt !== lead.contacted_at
          ? now
          : lead.last_contact_at,
      ...(contactedAt !== lead.contacted_at ? { last_outbound_at: now } : {}),
      ...(repliedAt !== lead.replied_at ? { last_inbound_at: now } : {}),
      next_action: nextAction,
      next_action_at: nextActionAt,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    if (isMissingCrmColumns(error)) return crmMigrationError();
    return { error: "No se pudo cambiar el estado." };
  }

  revalidateCrmViews();
  return {
    status,
    statuses: [status],
    contactDate: contactedAt?.slice(0, 10) ?? null,
    contactedAt,
    repliedAt,
    lastContactAt:
      repliedAt !== lead.replied_at || contactedAt !== lead.contacted_at
        ? now
        : lead.last_contact_at,
    nextAction,
    nextActionAt,
  };
}

/** Temporary compatibility wrapper for clients deployed before the CRM migration. */
export async function setLeadStatuses(id: number, statuses: string[]) {
  return setLeadStatus(id, statuses[0] ?? "por_contactar");
}

export async function setLeadNextAction(
  id: number,
  action: string,
  actionAt: string | null
): Promise<{
  error?: string;
  nextAction?: NextActionKey;
  nextActionAt?: string | null;
}> {
  if (!Number.isSafeInteger(id) || id <= 0) return { error: "Lead no válido." };
  if (!isValidNextAction(action)) return { error: "Próxima acción no válida." };
  if (actionAt && Number.isNaN(Date.parse(actionAt))) {
    return { error: "Fecha de próxima acción no válida." };
  }

  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };
  const { data: lead, error: readError } = await auth.supabase
    .from("leads")
    .select("name, next_action, next_action_at")
    .eq("user_id", auth.userId)
    .eq("id", id)
    .maybeSingle();
  if (readError || !lead) return { error: "No se encontró el lead." };

  const nextActionAt = action === "sin_accion" ? null : actionAt;
  if (lead.next_action === action && lead.next_action_at === nextActionAt) {
    return { nextAction: action, nextActionAt };
  }

  const history = await captureLeadChangeSet(
    auth.supabase,
    [id],
    `Cambio de próxima acción de «${lead.name}»`
  );
  if ("error" in history) return history;

  const { error } = await auth.supabase
    .from("leads")
    .update({
      next_action: action,
      next_action_at: nextActionAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", auth.userId)
    .eq("id", id);
  if (error) {
    if (isMissingCrmColumns(error)) return crmMigrationError();
    return { error: "No se pudo cambiar la próxima acción." };
  }

  revalidateCrmViews();
  return { nextAction: action, nextActionAt };
}

export async function addLeadNote(
  id: number,
  text: string
): Promise<{ notes: string; activity: LeadActivity } | { error: string }> {
  const note = text.trim();
  if (!note) return { error: "Escribe una nota." };
  if (note.length > 2_000) return { error: "La nota no puede superar 2.000 caracteres." };

  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };
  const { data: lead, error: readError } = await auth.supabase
    .from("leads")
    .select("name, notes")
    .eq("user_id", auth.userId)
    .eq("id", id)
    .maybeSingle();
  if (readError || !lead) return { error: "No se encontró el lead." };

  const history = await captureLeadChangeSet(
    auth.supabase,
    [id],
    `Nota añadida a «${lead.name}»`
  );
  if ("error" in history) return history;

  const notes = [lead.notes?.trim(), note].filter(Boolean).join("\n\n");
  const occurredAt = new Date().toISOString();
  const { error: updateError } = await auth.supabase
    .from("leads")
    .update({ notes, updated_at: occurredAt })
    .eq("user_id", auth.userId)
    .eq("id", id);
  if (updateError) return { error: "No se pudo guardar la nota." };

  const { data: activity, error: activityError } = await auth.supabase
    .from("lead_activities")
    .insert({
      user_id: auth.userId,
      lead_id: id,
      type: "note_added",
      occurred_at: occurredAt,
      description: note,
      origin: "manual",
    })
    .select("id, lead_id, type, occurred_at, metadata, description, origin, template_id")
    .single();
  if (activityError || !activity) {
    return { error: "La nota se guardó, pero no se pudo registrar la actividad." };
  }

  revalidateCrmViews();
  return {
    notes,
    activity: {
      id: activity.id,
      leadId: activity.lead_id,
      type: activity.type,
      occurredAt: activity.occurred_at,
      metadata: (activity.metadata ?? {}) as Record<string, unknown>,
      description: activity.description,
      origin: activity.origin,
      templateId: activity.template_id,
    },
  };
}

export async function loadLeadActivities(
  id: number
): Promise<LeadActivity[] | { error: string }> {
  if (!Number.isSafeInteger(id) || id <= 0) return { error: "Lead no válido." };
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };
  try {
    return await getLeadActivities(id, 200);
  } catch {
    return { error: "No se pudo cargar toda la actividad." };
  }
}

export async function markLeadContacted(
  id: number,
  channel: ContactChannelKey
): Promise<LeadWithTags | { error: string }> {
  if (!isValidContactChannel(channel)) return { error: "Canal no válido." };
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };
  const { data: lead, error: readError } = await auth.supabase
    .from("leads")
    .select("name, status, next_action")
    .eq("user_id", auth.userId)
    .eq("id", id)
    .maybeSingle();
  if (readError || !lead) return { error: "No se encontró el lead." };

  const history = await captureLeadChangeSet(
    auth.supabase,
    [id],
    `Contacto registrado con «${lead.name}»`
  );
  if ("error" in history) return history;

  const now = new Date().toISOString();
  const status = lead.status === "por_contactar" ? "contactado" : lead.status;
  const nextAction =
    lead.next_action === "contactar" ? "esperar_respuesta" : lead.next_action;
  const { error } = await auth.supabase
    .from("leads")
    .update({
      status,
      statuses: [status],
      contacted_at: now,
      last_contact_at: now,
      last_outbound_at: now,
      contact_channel: channel,
      next_action: nextAction,
      updated_at: now,
    })
    .eq("user_id", auth.userId)
    .eq("id", id);
  if (error) return { error: "No se pudo registrar el contacto." };

  revalidateCrmViews();
  const saved = await getLeadWithTags(id);
  return saved ?? { error: "No se pudo actualizar la ficha del lead." };
}

export async function trackTemplateUsage(input: {
  leadId: number;
  templateId: number;
  channel: ContactChannelKey;
}): Promise<{ tracked: true } | { error: string }> {
  if (
    !Number.isSafeInteger(input.leadId) ||
    input.leadId <= 0 ||
    !Number.isSafeInteger(input.templateId) ||
    input.templateId <= 0 ||
    !isValidContactChannel(input.channel)
  ) {
    return { error: "Uso de plantilla no válido." };
  }
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return { error: auth.error };

  const [{ data: lead }, { data: template }] = await Promise.all([
    auth.supabase
      .from("leads")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("id", input.leadId)
      .maybeSingle(),
    auth.supabase
      .from("message_templates")
      .select("id, name")
      .eq("user_id", auth.userId)
      .eq("id", input.templateId)
      .maybeSingle(),
  ]);
  if (!lead || !template) return { error: "Lead o plantilla no disponibles." };

  const { error } = await auth.supabase.from("lead_activities").insert({
    user_id: auth.userId,
    lead_id: input.leadId,
    type: "template_used",
    metadata: { channel: input.channel, template_name: template.name },
    origin: "manual",
    template_id: template.id,
  });
  return error ? { error: "No se pudo registrar el uso de la plantilla." } : { tracked: true };
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

  const recalculated = await recalculateLeadScores(auth.supabase, auth.userId, [id]);
  if ("error" in recalculated) return { error: recalculated.error };

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

  const hasStatus = input.status !== undefined;
  const hasWebsiteStatus = input.websiteStatus !== undefined;
  const hasTags = input.tags !== undefined;
  const hasNextAction = input.nextAction !== undefined;
  const hasNextActionAt = Object.hasOwn(input, "nextActionAt");

  if (!hasStatus && !hasWebsiteStatus && !hasTags && !hasNextAction && !hasNextActionAt) {
    return { error: "Selecciona al menos un cambio para aplicar." };
  }
  if (hasStatus && !isValidStatus(input.status!)) return { error: "Estado no válido." };
  if (hasNextAction && !isValidNextAction(input.nextAction!)) {
    return { error: "Próxima acción no válida." };
  }
  if (
    hasWebsiteStatus &&
    !isValidWebsiteStatus(input.websiteStatus!)
  ) {
    return { error: "Estado de la web no válido." };
  }

  const { data: ownedLeads, error: leadError } = await auth.supabase
    .from("leads")
    .select("id, status, contacted_at, replied_at")
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
    next_action?: string;
    next_action_at?: string | null;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if (input.status) {
    leadValues.status = input.status;
    leadValues.statuses = [input.status];
    if (input.status === "cliente" || input.status === "descartado") {
      leadValues.next_action = "sin_accion";
      leadValues.next_action_at = null;
    }
  }
  if (hasWebsiteStatus) leadValues.website_status = input.websiteStatus;
  if (hasNextAction && leadValues.next_action !== "sin_accion") {
    leadValues.next_action = input.nextAction;
  }
  if (hasNextActionAt && leadValues.next_action !== "sin_accion") {
    leadValues.next_action_at = clean(input.nextActionAt);
  }
  if (leadValues.next_action === "sin_accion") leadValues.next_action_at = null;

  if (hasStatus || hasWebsiteStatus || hasNextAction || hasNextActionAt) {
    const { error } = await auth.supabase
      .from("leads")
      .update(leadValues)
      .eq("user_id", auth.userId)
      .in("id", leadIds);

    if (error) {
      if (isMissingCrmColumns(error)) return crmMigrationError();
      if (isMissingWebsiteStatusColumn(error)) {
        return websiteStatusMigrationError();
      }
      return { error: "No se pudieron actualizar los leads." };
    }

    if (input.status) {
      const contactedStages: StatusKey[] = [
        "contactado",
        "respondio",
        "interesado",
        "cliente",
      ];
      const repliedStages: StatusKey[] = ["respondio", "interesado", "cliente"];
      const now = new Date().toISOString();
      const needsContact = contactedStages.includes(input.status)
        ? ownedLeads.filter((lead) => !lead.contacted_at).map((lead) => lead.id)
        : [];
      if (needsContact.length > 0) {
        const { error: contactError } = await auth.supabase
          .from("leads")
          .update({
            contacted_at: now,
            last_contact_at: now,
            last_outbound_at: now,
          })
          .eq("user_id", auth.userId)
          .in("id", needsContact);
        if (contactError) return { error: "Se cambió el estado, pero no la fecha de contacto." };
      }
      const needsReply = repliedStages.includes(input.status)
        ? ownedLeads.filter((lead) => !lead.replied_at).map((lead) => lead.id)
        : [];
      if (needsReply.length > 0) {
        const { error: replyError } = await auth.supabase
          .from("leads")
          .update({ replied_at: now, last_contact_at: now, last_inbound_at: now })
          .eq("user_id", auth.userId)
          .in("id", needsReply);
        if (replyError) return { error: "Se cambió el estado, pero no la fecha de respuesta." };
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

  if (hasWebsiteStatus || hasTags) {
    const recalculated = await recalculateLeadScores(
      auth.supabase,
      auth.userId,
      leadIds
    );
    if ("error" in recalculated) return { error: recalculated.error };
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
