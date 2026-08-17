import { revalidatePath } from "next/cache";
import { isUncontactedStatus, TAG_COLORS } from "@/lib/config";
import {
  CsvImportError,
  parseLeadsCsv,
  serializeLeadsCsv,
} from "@/lib/leads-csv";
import { createClient } from "@/lib/supabase/server";

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
  status: string;
  contact_date: string | null;
  follow_up_date: string | null;
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
        contact_date,
        follow_up_date,
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
    contactDate: lead.contact_date,
    followUpDate: lead.follow_up_date,
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
    const rows = batch.map((lead) => ({
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
      contact_date: isUncontactedStatus(lead.status)
        ? null
        : (lead.contactDate ?? now.slice(0, 10)),
      follow_up_date: lead.followUpDate,
      created_at: lead.createdAt ?? now,
      updated_at: lead.updatedAt ?? lead.createdAt ?? now,
    }));
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

  revalidatePath("/", "layout");
  return Response.json({
    imported: insertedLeadIds.length,
    createdTags: newTagNames.length,
  });
}
