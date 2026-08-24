import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateLeadScore,
  leadScoreDatabaseValues,
  type LeadScoreInput,
} from "@/lib/lead-scoring";

type ScoreRow = {
  id: number;
  name: string;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  website_status: LeadScoreInput["websiteStatus"];
  phone: string | null;
  email: string | null;
  address: string | null;
  business_categories: string[] | null;
  rating: number | string | null;
  review_count: number | null;
  last_review_at: string | null;
  photo_count: number | null;
  social_links: string[] | null;
  digital_presence_known: boolean | null;
  contact_channel: string | null;
  source: string | null;
  open_status: string | null;
  is_permanently_closed: boolean | null;
  is_chain: boolean | null;
  lead_tags: Array<{ tags: { name: string } | Array<{ name: string }> | null }>;
};

export const LEAD_SCORE_SOURCE_COLUMNS = `
  id, name, instagram, facebook, website, website_status, phone, email,
  address, business_categories, rating, review_count, last_review_at,
  photo_count, social_links, digital_presence_known, contact_channel, source,
  open_status, is_permanently_closed, is_chain,
  lead_tags ( tags ( name ) )
`;

export function scoreInputFromDatabaseRow(row: ScoreRow): LeadScoreInput {
  return {
    name: row.name,
    instagram: row.instagram,
    facebook: row.facebook,
    website: row.website,
    websiteStatus: row.website_status,
    phone: row.phone,
    email: row.email,
    address: row.address,
    businessCategories: row.business_categories,
    rating: row.rating == null ? null : Number(row.rating),
    reviewCount: row.review_count,
    lastReviewAt: row.last_review_at,
    photoCount: row.photo_count,
    socialLinks: row.social_links,
    digitalPresenceKnown: row.digital_presence_known,
    contactChannel: row.contact_channel,
    source: row.source,
    openStatus: row.open_status,
    isPermanentlyClosed: row.is_permanently_closed,
    isChain: row.is_chain,
    tags: row.lead_tags.flatMap((link) =>
      Array.isArray(link.tags)
        ? link.tags.map((tag) => tag.name)
        : link.tags
          ? [link.tags.name]
          : []
    ),
  };
}

export function scoreValuesForInput(input: LeadScoreInput) {
  return leadScoreDatabaseValues(calculateLeadScore(input));
}

export async function recalculateLeadScores(
  supabase: SupabaseClient,
  userId: string,
  leadIds: readonly number[]
): Promise<{ updated: number } | { error: string }> {
  const ids = [...new Set(leadIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (ids.length === 0) return { updated: 0 };

  let updated = 0;
  for (let index = 0; index < ids.length; index += 500) {
    const batchIds = ids.slice(index, index + 500);
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_SCORE_SOURCE_COLUMNS)
      .eq("user_id", userId)
      .in("id", batchIds);
    if (error) return { error: "No se pudieron leer los datos para recalcular el score." };

    const scores = (data as unknown as ScoreRow[]).map((row) => ({
      id: row.id,
      ...leadScoreDatabaseValues(calculateLeadScore(scoreInputFromDatabaseRow(row))),
    }));
    const { data: count, error: updateError } = await supabase.rpc(
      "apply_lead_scores",
      { p_scores: scores }
    );
    if (updateError) {
      return { error: "No se pudieron guardar los Lead Scores recalculados." };
    }
    updated += typeof count === "number" ? count : scores.length;
  }

  return { updated };
}
