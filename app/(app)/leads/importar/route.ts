import { revalidatePath } from "next/cache";
import { TAG_COLORS } from "@/lib/config";
import {
  analyzeGooglePlacesLeads,
  type AnalyzedGooglePlacesLead,
  GooglePlacesJsonError,
  parseGooglePlacesJson,
} from "@/lib/google-places-json";
import { captureLeadChangeSet } from "@/lib/lead-history";
import { createClient } from "@/lib/supabase/server";
import { findSimilarTag, normalizeTagName } from "@/lib/tag-similarity";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const INSERT_BATCH_SIZE = 250;

type ExistingLeadRow = {
  id: number;
  name: string;
  instagram: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  google_place_id: string | null;
  normalized_phone: string | null;
  normalized_instagram: string | null;
  website_domain: string | null;
};

type TagRow = { id: number; name: string; color: string };

type ImportItemRequest = {
  sourceIndex: number;
  tagId: number | null;
  tagName: string;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return jsonError("Tu sesión ha caducado.", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("No se pudo leer el archivo.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError("Selecciona un archivo JSON.", 400);
  }
  if (!file.name.toLocaleLowerCase("es").endsWith(".json")) {
    return jsonError("El archivo debe tener extensión .json.", 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return jsonError("El JSON no puede superar 5 MB.", 413);
  }

  let parsed;
  try {
    parsed = parseGooglePlacesJson(await file.text());
  } catch (error) {
    return jsonError(
      error instanceof GooglePlacesJsonError
        ? error.message
        : "El JSON no es válido.",
      400
    );
  }

  const rawItems = formData.get("items");
  if (typeof rawItems !== "string") {
    return jsonError("Selecciona los leads que quieres importar.", 400);
  }

  let requestedItems: ImportItemRequest[];
  try {
    const value = JSON.parse(rawItems) as unknown;
    if (!Array.isArray(value) || value.length === 0 || value.length > parsed.length) {
      throw new Error();
    }

    const seenSourceIndexes = new Set<number>();
    requestedItems = value.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error();
      }
      const record = item as Record<string, unknown>;
      const sourceIndex = record.sourceIndex;
      const rawTagId = record.tagId;
      const tagId =
        typeof rawTagId === "number" &&
        Number.isSafeInteger(rawTagId) &&
        rawTagId > 0
          ? rawTagId
          : null;
      const tagName =
        typeof record.tagName === "string"
          ? record.tagName.trim().slice(0, 80)
          : "";

      if (
        typeof sourceIndex !== "number" ||
        !Number.isSafeInteger(sourceIndex) ||
        sourceIndex < 0 ||
        sourceIndex >= parsed.length ||
        seenSourceIndexes.has(sourceIndex) ||
        (!tagId && !tagName)
      ) {
        throw new Error();
      }
      seenSourceIndexes.add(sourceIndex);
      return { sourceIndex, tagId, tagName };
    });
  } catch {
    return jsonError("La selección de leads o etiquetas no es válida.", 400);
  }

  const { data: existingData, error: existingError } = await supabase
    .from("leads")
    .select(
      "id, name, instagram, website, phone, address, lat, lng, google_place_id, normalized_phone, normalized_instagram, website_domain"
    )
    .eq("user_id", userId);
  if (existingError) {
    return jsonError("No se pudieron comprobar los leads duplicados.", 500);
  }

  const analyzed = analyzeGooglePlacesLeads(
    parsed,
    (existingData as ExistingLeadRow[]).map((lead) => ({
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
  const requestedLeads = requestedItems.map((request) => ({
    request,
    lead: analyzed[request.sourceIndex],
  }));
  const skipped = requestedLeads.filter(({ lead }) => lead.duplicate).length;
  const leads = requestedLeads.filter(({ lead }) => !lead.duplicate);
  if (leads.length === 0) {
    return Response.json({ imported: 0, skipped, createdTags: 0 });
  }

  const { data: currentTags, error: tagsError } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", userId)
    .order("id", { ascending: true });
  if (tagsError) return jsonError("No se pudieron consultar las etiquetas.", 500);

  const tags = [...(currentTags as TagRow[])];
  const createdTagIds: number[] = [];
  const cleanupCreatedTags = async () => {
    if (createdTagIds.length > 0) {
      await supabase.from("tags").delete().in("id", createdTagIds);
    }
  };
  let reusedSimilarTag = false;
  const resolvedTags = new Map<string, TagRow>();
  const resolvedLeads: Array<{
    lead: AnalyzedGooglePlacesLead;
    tag: TagRow;
  }> = [];

  for (const { lead, request } of leads) {
    const key = request.tagId
      ? `id:${request.tagId}`
      : `name:${normalizeTagName(request.tagName)}`;
    let selectedTag = resolvedTags.get(key) ?? null;

    if (!selectedTag && request.tagId) {
      selectedTag = tags.find((tag) => tag.id === request.tagId) ?? null;
      if (!selectedTag) {
        await cleanupCreatedTags();
        return jsonError("Una de las etiquetas seleccionadas ya no existe.", 400);
      }
    } else if (!selectedTag) {
      const similar = findSimilarTag(request.tagName, tags);
      if (similar) {
        selectedTag = similar.tag;
        reusedSimilarTag ||= !similar.exact;
      } else {
        const { data, error } = await supabase
          .from("tags")
          .insert({
            user_id: userId,
            name: request.tagName,
            color: TAG_COLORS[tags.length % TAG_COLORS.length],
          })
          .select("id, name, color")
          .single();
        if (error || !data) {
          await cleanupCreatedTags();
          return jsonError("No se pudo crear una de las etiquetas.", 500);
        }
        selectedTag = data as TagRow;
        createdTagIds.push(selectedTag.id);
        tags.push(selectedTag);
      }
    }

    resolvedTags.set(key, selectedTag);
    resolvedLeads.push({ lead, tag: selectedTag });
  }

  const insertedLeadIds: number[] = [];
  const tagLinks: Array<{ user_id: string; lead_id: number; tag_id: number }> = [];

  const cleanup = async () => {
    for (const batch of chunks(insertedLeadIds, INSERT_BATCH_SIZE)) {
      await supabase.from("leads").delete().in("id", batch);
    }
    await cleanupCreatedTags();
  };

  for (const batch of chunks(resolvedLeads, INSERT_BATCH_SIZE)) {
    const { data: inserted, error } = await supabase
      .from("leads")
      .insert(
        batch.map(({ lead }) => ({
          user_id: userId,
          name: lead.name,
          instagram: lead.instagram,
          facebook: lead.facebook,
          website: lead.website,
          website_status: lead.websiteStatus,
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
          lat: lead.lat,
          lng: lead.lng,
          status: "por_contactar",
          statuses: ["por_contactar"],
          next_action: "contactar",
          source: "apify",
          google_place_id: lead.placeId,
          business_categories: lead.categories,
          rating: lead.rating,
          review_count: lead.reviewCount,
          social_links: lead.socialLinks,
          digital_presence_known: lead.digitalPresenceKnown,
        }))
      )
      .select("id");

    if (error || !inserted || inserted.length !== batch.length) {
      await cleanup();
      return jsonError("No se pudieron importar los leads.", 500);
    }

    inserted.forEach((insertedLead, index) => {
      insertedLeadIds.push(insertedLead.id);
      tagLinks.push({
        user_id: userId,
        lead_id: insertedLead.id,
        tag_id: batch[index].tag.id,
      });
    });
  }

  for (const batch of chunks(tagLinks, 500)) {
    const { error } = await supabase.from("lead_tags").insert(batch);
    if (error) {
      await cleanup();
      return jsonError(
        "No se pudieron asociar las etiquetas. No se importó ningún lead.",
        500
      );
    }
  }

  const history = await captureLeadChangeSet(
    supabase,
    insertedLeadIds,
    `Importación de ${insertedLeadIds.length} ${
      insertedLeadIds.length === 1 ? "lead" : "leads"
    } desde Google Maps`,
    false
  );
  if ("error" in history) {
    await cleanup();
    return jsonError(history.error, 500);
  }

  const usedTags = [
    ...new Map(resolvedLeads.map(({ tag }) => [tag.id, tag])).values(),
  ];

  revalidatePath("/", "layout");
  return Response.json({
    imported: insertedLeadIds.length,
    skipped,
    createdTags: createdTagIds.length,
    tag: usedTags.length === 1 ? usedTags[0] : undefined,
    tagCount: usedTags.length,
    reusedSimilarTag,
  });
}
