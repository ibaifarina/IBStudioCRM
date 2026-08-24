import { revalidatePath } from "next/cache";
import {
  TAG_COLORS,
  type ContactChannelKey,
  type LeadSourceKey,
  type NextActionKey,
  type StatusKey,
} from "@/lib/config";
import {
  CsvImportError,
  parseLeadsCsv,
  serializeLeadsCsv,
} from "@/lib/leads-csv";
import { captureLeadChangeSet } from "@/lib/lead-history";
import { findDuplicateLead } from "@/lib/lead-identifiers";
import { createClient } from "@/lib/supabase/server";
import type { LeadImportComparable } from "@/lib/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const INSERT_BATCH_SIZE = 250;

type TagRow = { id: number; name: string; color: string };

type ExportRow = {
  id: number;
  name: string;
  instagram: string | null;
  website: string | null;
  website_status: "sin_revisar" | "tiene_web" | "no_tiene_web" | "web_antigua";
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  problem: string | null;
  notes: string | null;
  status: StatusKey;
  statuses: StatusKey[];
  contact_date: string | null;
  follow_up_date: string | null;
  contacted_at: string | null;
  replied_at: string | null;
  last_contact_at: string | null;
  last_outbound_at: string | null;
  last_inbound_at: string | null;
  contact_channel: ContactChannelKey | null;
  next_action: NextActionKey;
  next_action_at: string | null;
  source: LeadSourceKey;
  google_place_id: string | null;
  created_at: string;
  updated_at: string;
  lead_tags: Array<{ tags: { name: string } | Array<{ name: string }> | null }>;
};

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return error || !userId ? null : { supabase, userId };
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function tagKey(name: string) {
  return name.trim().toLocaleLowerCase("es");
}

export async function GET() {
  const auth = await getAuthenticatedClient();
  if (!auth) return new Response("No autorizado", { status: 401 });

  const { data, error } = await auth.supabase
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
        created_at,
        updated_at,
        lead_tags ( tags ( name ) )
      `
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: true });

  if (error) {
    return new Response("No se pudieron exportar los leads.", { status: 500 });
  }

  const leads = (data as unknown as ExportRow[]).map((lead) => ({
    id: lead.id,
    name: lead.name,
    instagram: lead.instagram,
    website: lead.website,
    websiteStatus: lead.website_status,
    phone: lead.phone,
    address: lead.address,
    lat: lead.lat,
    lng: lead.lng,
    problem: lead.problem,
    notes: lead.notes,
    status: lead.status,
    statuses: lead.statuses,
    contactDate: lead.contact_date,
    followUpDate: lead.follow_up_date,
    contactedAt: lead.contacted_at,
    repliedAt: lead.replied_at,
    lastContactAt: lead.last_contact_at,
    lastOutboundAt: lead.last_outbound_at,
    lastInboundAt: lead.last_inbound_at,
    contactChannel: lead.contact_channel,
    nextAction: lead.next_action,
    nextActionAt: lead.next_action_at,
    source: lead.source,
    googlePlaceId: lead.google_place_id,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    tags: lead.lead_tags.flatMap((link) =>
      Array.isArray(link.tags) ? link.tags.map((tag) => tag.name) : link.tags ? [link.tags.name] : []
    ),
  }));
  const date = new Date().toISOString().slice(0, 10);

  return new Response(serializeLeadsCsv(leads), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedClient();
  if (!auth) return jsonError("Tu sesión ha caducado.", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("No se pudo leer el archivo.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError("Selecciona un archivo CSV.", 400);
  }
  if (!file.name.toLocaleLowerCase("es").endsWith(".csv")) {
    return jsonError("El archivo debe tener extensión .csv.", 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return jsonError("El CSV no puede superar 5 MB.", 413);
  }

  let leads;
  try {
    leads = parseLeadsCsv(await file.text());
  } catch (error) {
    return jsonError(
      error instanceof CsvImportError ? error.message : "El CSV no es válido.",
      400
    );
  }

  const { data: comparableData, error: comparableError } = await auth.supabase
    .from("leads")
    .select(
      "id, name, instagram, website, phone, address, lat, lng, google_place_id, normalized_phone, normalized_instagram, website_domain"
    )
    .eq("user_id", auth.userId);
  if (comparableError) {
    return jsonError("No se pudieron comprobar los leads duplicados.", 500);
  }

  const comparables: LeadImportComparable[] = comparableData.map((lead) => ({
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
  }));
  const accepted = [] as typeof leads;
  let skippedDuplicates = 0;
  let possibleDuplicates = 0;
  for (const lead of leads) {
    const duplicate = findDuplicateLead(lead, comparables);
    if (duplicate?.confidence === "strong") {
      skippedDuplicates += 1;
      continue;
    }
    if (duplicate?.confidence === "possible") possibleDuplicates += 1;
    accepted.push(lead);
    comparables.push({
      id: -(accepted.length),
      name: lead.name,
      instagram: lead.instagram,
      website: lead.website,
      phone: lead.phone,
      address: lead.address,
      lat: lead.lat,
      lng: lead.lng,
      googlePlaceId: lead.googlePlaceId,
    });
  }
  leads = accepted;
  if (leads.length === 0) {
    return Response.json({
      imported: 0,
      createdTags: 0,
      skippedDuplicates,
      possibleDuplicates,
    });
  }

  const { data: currentTags, error: tagsError } = await auth.supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", auth.userId)
    .order("id", { ascending: true });

  if (tagsError) return jsonError("No se pudieron consultar las etiquetas.", 500);

  const existingByName = new Map(
    (currentTags as TagRow[]).map((tag) => [tagKey(tag.name), tag])
  );
  const requestedTags = new Map<string, string>();
  for (const lead of leads) {
    for (const tag of lead.tags) {
      const key = tagKey(tag);
      if (!existingByName.has(key) && !requestedTags.has(key)) {
        requestedTags.set(key, tag);
      }
    }
  }

  const newTagNames = [...requestedTags.values()];
  if (newTagNames.length > 0) {
    const { error } = await auth.supabase.from("tags").insert(
      newTagNames.map((name, index) => ({
        user_id: auth.userId,
        name,
        color: TAG_COLORS[(currentTags.length + index) % TAG_COLORS.length],
      }))
    );
    if (error) return jsonError("No se pudieron crear las etiquetas del CSV.", 500);
  }

  const { data: allTags, error: allTagsError } = await auth.supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", auth.userId);
  if (allTagsError) return jsonError("No se pudieron preparar las etiquetas.", 500);

  const tagByName = new Map(
    (allTags as TagRow[]).map((tag) => [tagKey(tag.name), tag])
  );
  const newTagIds = newTagNames
    .map((name) => tagByName.get(tagKey(name))?.id)
    .filter((id): id is number => id != null);
  const insertedLeadIds: number[] = [];
  const tagLinks: Array<{ user_id: string; lead_id: number; tag_id: number }> = [];

  const cleanup = async () => {
    for (const batch of chunks(insertedLeadIds, INSERT_BATCH_SIZE)) {
      await auth.supabase.from("leads").delete().in("id", batch);
    }
    for (const batch of chunks(newTagIds, INSERT_BATCH_SIZE)) {
      await auth.supabase.from("tags").delete().in("id", batch);
    }
  };

  for (const batch of chunks(leads, INSERT_BATCH_SIZE)) {
    const now = new Date().toISOString();
    const rows = batch.map((lead) => {
      const contactedStage = [
        "contactado",
        "respondio",
        "interesado",
        "cliente",
      ].includes(lead.status);
      const repliedStage = ["respondio", "interesado", "cliente"].includes(
        lead.status
      );
      const contactedAt = lead.contactedAt ?? (contactedStage ? now : null);
      const repliedAt = lead.repliedAt ?? (repliedStage ? now : null);
      return {
        user_id: auth.userId,
        name: lead.name,
        instagram: lead.instagram,
        website: lead.website,
        website_status: lead.websiteStatus,
        phone: lead.phone,
        address: lead.address,
        lat: lead.lat,
        lng: lead.lng,
        problem: lead.problem,
        notes: lead.notes,
        status: lead.status,
        statuses: [lead.status],
        contact_date: contactedAt?.slice(0, 10) ?? null,
        follow_up_date: lead.nextActionAt?.slice(0, 10) ?? null,
        contacted_at: contactedAt,
        replied_at: repliedAt,
        last_contact_at:
          lead.lastContactAt ?? repliedAt ?? contactedAt,
        last_outbound_at: lead.lastOutboundAt ?? contactedAt,
        last_inbound_at: lead.lastInboundAt ?? repliedAt,
        contact_channel: lead.contactChannel,
        next_action: lead.nextAction,
        next_action_at: lead.nextActionAt,
        source: lead.source,
        google_place_id: lead.googlePlaceId,
        created_at: lead.createdAt ?? now,
        updated_at: lead.updatedAt ?? lead.createdAt ?? now,
      };
    });
    const { data: inserted, error } = await auth.supabase
      .from("leads")
      .insert(rows)
      .select("id");

    if (error || !inserted || inserted.length !== batch.length) {
      await cleanup();
      return jsonError("No se pudieron importar los leads.", 500);
    }

    inserted.forEach((lead, index) => {
      insertedLeadIds.push(lead.id);
      for (const tagName of batch[index].tags) {
        const tag = tagByName.get(tagKey(tagName));
        if (tag) {
          tagLinks.push({
            user_id: auth.userId,
            lead_id: lead.id,
            tag_id: tag.id,
          });
        }
      }
    });
  }

  for (const batch of chunks(tagLinks, 500)) {
    const { error } = await auth.supabase.from("lead_tags").insert(batch);
    if (error) {
      await cleanup();
      return jsonError("No se pudieron asociar las etiquetas. No se importó ningún lead.", 500);
    }
  }

  const history = await captureLeadChangeSet(
    auth.supabase,
    insertedLeadIds,
    `Importación CSV de ${insertedLeadIds.length} ${
      insertedLeadIds.length === 1 ? "lead" : "leads"
    }`,
    false
  );
  if ("error" in history) {
    await cleanup();
    return jsonError(history.error, 500);
  }

  revalidatePath("/", "layout");
  return Response.json({
    imported: insertedLeadIds.length,
    createdTags: newTagNames.length,
    skippedDuplicates,
    possibleDuplicates,
  });
}
