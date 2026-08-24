import {
  BUSINESS_CATEGORY_RULES,
  CONTACTABILITY_POINTS,
  DEFAULT_LOCATION,
  DIGITAL_MATURITY_POINTS,
  LOCATION_RULES,
  NEUTRAL_SCORES,
  RATING_BANDS,
  REVIEW_BANDS,
  REVIEW_RECENCY_BANDS,
  SCORE_CONFIDENCE_WEIGHTS,
  SCORE_GRADES,
  SCORE_PENALTIES,
  SCORE_VERSION,
  UNKNOWN_CATEGORY,
  WEB_OPPORTUNITY_POINTS,
  WEBSITE_DOMAINS,
  type BusinessProfile,
} from "./lead-scoring-config.ts";

export type LeadGrade = "A" | "B" | "C" | "D";
export type WebsiteClassification =
  | "NONE"
  | "SOCIAL"
  | "BOOKING_PLATFORM"
  | "DIRECTORY"
  | "OWN_WEBSITE";

export type ScoreDetail = { label: string; points: number };

export type LeadScoreBreakdown = {
  traction: {
    score: number;
    reviews: number;
    rating: number;
    recency: number;
  };
  webOpportunity: number;
  digitalMaturity: number;
  sectorFit: number;
  contactability: number;
  locationFit: number;
  penalties: number;
  websiteClassification: WebsiteClassification;
  businessProfile: BusinessProfile;
  categoryTier: "A" | "B" | "C" | "UNKNOWN";
  location: string;
  reasons: string[];
  details: ScoreDetail[];
};

export type LeadScoreInput = {
  name?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  websiteStatus?: "sin_revisar" | "tiene_web" | "no_tiene_web" | "web_antigua" | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  businessCategories?: readonly string[] | null;
  tags?: readonly (string | { name: string })[] | null;
  rating?: number | null;
  reviewCount?: number | null;
  lastReviewAt?: string | null;
  photoCount?: number | null;
  socialLinks?: readonly string[] | null;
  digitalPresenceKnown?: boolean | null;
  contactChannel?: string | null;
  source?: string | null;
  openStatus?: string | null;
  isPermanentlyClosed?: boolean | null;
  isChain?: boolean | null;
};

export type LeadScoreResult = {
  leadScore: number;
  leadGrade: LeadGrade;
  scoreBreakdown: LeadScoreBreakdown;
  scoreConfidence: number;
  scoredAt: string;
  scoreVersion: number;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hostname(value: string) {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`)
      .hostname.toLocaleLowerCase("es")
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function matchesDomain(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

export function classifyWebsite(url: string | null | undefined): WebsiteClassification {
  if (!url?.trim()) return "NONE";
  const host = hostname(url.trim());
  if (!host) return "NONE";
  if (WEBSITE_DOMAINS.booking.some((domain) => matchesDomain(host, domain))) {
    return "BOOKING_PLATFORM";
  }
  if (WEBSITE_DOMAINS.social.some((domain) => matchesDomain(host, domain))) {
    return "SOCIAL";
  }
  if (WEBSITE_DOMAINS.directory.some((domain) => matchesDomain(host, domain))) {
    return "DIRECTORY";
  }
  return "OWN_WEBSITE";
}

function tagNames(tags: LeadScoreInput["tags"]) {
  return (tags ?? []).map((tag) => (typeof tag === "string" ? tag : tag.name));
}

function categoryMatch(input: LeadScoreInput) {
  const values = [...(input.businessCategories ?? []), ...tagNames(input.tags)];
  const normalized = normalize(values.join(" | "));
  const containsPhrase = (candidate: string) =>
    normalized === candidate ||
    normalized.startsWith(`${candidate} `) ||
    normalized.endsWith(` ${candidate}`) ||
    normalized.includes(` ${candidate} `);
  for (const rule of BUSINESS_CATEGORY_RULES) {
    const keyword = rule.keywords.find(containsPhrase);
    if (keyword) {
      const label = values.find((value) => {
        const normalizedValue = normalize(value);
        return normalizedValue === keyword || normalizedValue.includes(keyword);
      }) ?? values[0] ?? keyword;
      return { ...rule, label };
    }
  }
  return {
    tier: "UNKNOWN" as const,
    points: UNKNOWN_CATEGORY.points,
    profile: UNKNOWN_CATEGORY.profile,
    label: values[0] ?? UNKNOWN_CATEGORY.label,
  };
}

function locationMatch(address: string | null | undefined) {
  const value = normalize(address);
  const match = LOCATION_RULES.find((rule) =>
    rule.aliases.some((alias) => value.includes(alias))
  );
  return match ?? DEFAULT_LOCATION;
}

function reviewPoints(count: number | null | undefined, profile: BusinessProfile) {
  if (count == null) return NEUTRAL_SCORES.reviews;
  return REVIEW_BANDS[profile].find((band) => count >= band.min)?.points ?? 0;
}

function ratingPoints(rating: number | null | undefined) {
  if (rating == null) return NEUTRAL_SCORES.rating;
  return RATING_BANDS.find((band) => rating >= band.min)?.points ?? 0;
}

function recencyPoints(lastReviewAt: string | null | undefined, now: Date) {
  if (!lastReviewAt) return NEUTRAL_SCORES.reviewRecency;
  const value = new Date(lastReviewAt);
  if (Number.isNaN(value.valueOf())) return NEUTRAL_SCORES.reviewRecency;
  const days = Math.max(0, (now.valueOf() - value.valueOf()) / 86_400_000);
  return REVIEW_RECENCY_BANDS.find((band) => days <= band.maxDays)?.points ?? 0;
}

function uniqueLinks(input: LeadScoreInput) {
  const values = [
    input.website,
    input.facebook,
    ...(input.socialLinks ?? []),
    input.instagram ? `https://instagram.com/${input.instagram}` : null,
  ].filter((value): value is string => Boolean(value?.trim()));
  return [...new Map(values.map((value) => [value.trim().toLocaleLowerCase("es"), value])).values()];
}

function gradeFor(score: number) {
  return SCORE_GRADES.find((grade) => score >= grade.min)!.grade;
}

function hasClosedStatus(input: LeadScoreInput) {
  const status = normalize(input.openStatus);
  return Boolean(
    input.isPermanentlyClosed ||
      status.includes("permanently closed") ||
      status.includes("cerrado permanentemente") ||
      status.includes("tancat permanentment")
  );
}

export function calculateLeadScore(
  input: LeadScoreInput,
  options: { now?: Date } = {}
): LeadScoreResult {
  const now = options.now ?? new Date();
  const category = categoryMatch(input);
  const location = locationMatch(input.address);
  const links = uniqueLinks(input);
  const classifications = links.map(classifyWebsite);
  const rawWebsiteClassification = classifyWebsite(input.website);
  const websiteClassification: WebsiteClassification =
    input.websiteStatus === "web_antigua" || input.websiteStatus === "tiene_web"
      ? "OWN_WEBSITE"
      : input.websiteStatus === "no_tiene_web" && rawWebsiteClassification === "OWN_WEBSITE"
        ? "NONE"
        : rawWebsiteClassification;
  const hasInstagram = Boolean(input.instagram?.trim()) || links.some((link) =>
    matchesDomain(hostname(link), "instagram.com")
  );
  const hasFacebook = Boolean(input.facebook?.trim()) || links.some((link) =>
    ["facebook.com", "fb.com"].some((domain) => matchesDomain(hostname(link), domain))
  );
  const hasBooking = classifications.includes("BOOKING_PLATFORM");
  const hasDirectory = classifications.includes("DIRECTORY");
  const hasSocial = hasInstagram || hasFacebook || classifications.includes("SOCIAL");
  const hasPhone = Boolean(input.phone?.trim());
  const hasWhatsapp =
    input.contactChannel === "whatsapp" ||
    hasPhone ||
    links.some((link) => ["wa.me", "whatsapp.com"].some((domain) => matchesDomain(hostname(link), domain)));
  const hasEmail = Boolean(input.email?.trim());

  const reviews = reviewPoints(input.reviewCount, category.profile);
  const rating = ratingPoints(input.rating);
  const recency = recencyPoints(input.lastReviewAt, now);
  const traction = reviews + rating + recency;

  let webOpportunity: number;
  if (input.websiteStatus === "web_antigua") webOpportunity = WEB_OPPORTUNITY_POINTS.oldWebsite;
  else if (websiteClassification === "OWN_WEBSITE") webOpportunity = WEB_OPPORTUNITY_POINTS.ownWebsite;
  else if (websiteClassification === "BOOKING_PLATFORM" || websiteClassification === "SOCIAL" || websiteClassification === "DIRECTORY") webOpportunity = WEB_OPPORTUNITY_POINTS.platformOrProfile;
  else if (input.websiteStatus === "sin_revisar" || input.websiteStatus == null) {
    webOpportunity = input.website ? WEB_OPPORTUNITY_POINTS.ownWebsite : WEB_OPPORTUNITY_POINTS.unknown;
  } else webOpportunity = WEB_OPPORTUNITY_POINTS.none;

  let digitalMaturity = 0;
  if (hasInstagram) digitalMaturity += DIGITAL_MATURITY_POINTS.instagram;
  else if (hasFacebook) digitalMaturity += DIGITAL_MATURITY_POINTS.facebookWithoutInstagram;
  if (hasBooking) digitalMaturity += DIGITAL_MATURITY_POINTS.booking;
  if (hasDirectory || (hasSocial && !hasInstagram && !hasFacebook)) digitalMaturity += DIGITAL_MATURITY_POINTS.additionalProfile;
  if (input.photoCount != null) {
    if (input.photoCount >= DIGITAL_MATURITY_POINTS.manyPhotosThreshold) digitalMaturity += DIGITAL_MATURITY_POINTS.manyPhotos;
    else if (input.photoCount >= DIGITAL_MATURITY_POINTS.somePhotosThreshold) digitalMaturity += DIGITAL_MATURITY_POINTS.somePhotos;
  }
  digitalMaturity = Math.min(DIGITAL_MATURITY_POINTS.max, digitalMaturity);

  const contactability = Math.min(
    CONTACTABILITY_POINTS.max,
    (hasPhone ? CONTACTABILITY_POINTS.phone : 0) +
      (hasWhatsapp ? CONTACTABILITY_POINTS.whatsapp : 0) +
      (hasSocial ? CONTACTABILITY_POINTS.social : 0) +
      (hasEmail ? CONTACTABILITY_POINTS.email : 0)
  );

  let penalties = 0;
  const penaltyDetails: ScoreDetail[] = [];
  if (input.reviewCount != null && input.reviewCount < SCORE_PENALTIES.unvalidated.maxReviewsExclusive && !hasSocial && !hasBooking) {
    penalties += SCORE_PENALTIES.unvalidated.points;
    penaltyDetails.push({ label: "Negocio todavía poco validado", points: -SCORE_PENALTIES.unvalidated.points });
  }
  if (input.rating != null && input.rating < SCORE_PENALTIES.lowRating.threshold) {
    penalties += SCORE_PENALTIES.lowRating.points;
    penaltyDetails.push({ label: "Rating inferior a 4,0", points: -SCORE_PENALTIES.lowRating.points });
  }
  if (!hasPhone && !hasWhatsapp && !hasEmail && !hasSocial) {
    penalties += SCORE_PENALTIES.noContact;
    penaltyDetails.push({ label: "Sin forma útil de contacto", points: -SCORE_PENALTIES.noContact });
  }
  if (input.isChain) {
    penalties += SCORE_PENALTIES.chain;
    penaltyDetails.push({ label: "Franquicia o cadena confirmada", points: -SCORE_PENALTIES.chain });
  }

  const details: ScoreDetail[] = [
    {
      label:
        input.websiteStatus === "web_antigua"
          ? "Web antigua con oportunidad de mejora"
          : websiteClassification === "OWN_WEBSITE"
            ? "Ya tiene web propia"
            : websiteClassification === "BOOKING_PLATFORM"
              ? "Solo plataforma de reservas"
              : websiteClassification === "SOCIAL" || websiteClassification === "DIRECTORY"
                ? "Solo perfil o directorio digital"
                : input.websiteStatus === "sin_revisar" || input.websiteStatus == null
                  ? "Web todavía sin revisar"
                  : "Sin web propia",
      points: webOpportunity,
    },
    { label: input.reviewCount == null ? "Reseñas sin datos (valor neutral)" : `${input.reviewCount} reseñas`, points: reviews },
    { label: input.rating == null ? "Rating sin datos (valor neutral)" : `Rating ${input.rating.toFixed(1)}`, points: rating },
    { label: category.label, points: category.points },
    { label: location.name, points: location.points },
  ];
  if (hasInstagram) details.push({ label: "Instagram", points: DIGITAL_MATURITY_POINTS.instagram });
  else if (hasFacebook) details.push({ label: "Facebook", points: DIGITAL_MATURITY_POINTS.facebookWithoutInstagram });
  if (hasBooking) details.push({ label: "Sistema de reservas", points: DIGITAL_MATURITY_POINTS.booking });
  if (input.photoCount != null && input.photoCount >= DIGITAL_MATURITY_POINTS.somePhotosThreshold) {
    details.push({
      label: `${input.photoCount} fotos en Google Maps`,
      points: input.photoCount >= DIGITAL_MATURITY_POINTS.manyPhotosThreshold
        ? DIGITAL_MATURITY_POINTS.manyPhotos
        : DIGITAL_MATURITY_POINTS.somePhotos,
    });
  }
  if (contactability > 0) details.push({ label: "Canales de contacto", points: contactability });
  details.push(...penaltyDetails);

  const baseScore = traction + webOpportunity + digitalMaturity + category.points + contactability + location.points;
  const closed = hasClosedStatus(input);
  const leadScore = closed ? 0 : Math.max(0, Math.min(100, Math.round(baseScore - penalties)));
  if (closed) {
    details.push({ label: "Negocio cerrado permanentemente", points: -baseScore });
  }

  const importedPresenceKnown = ["apify", "google_maps"].includes(input.source ?? "");
  const knownSignals = {
    reviewCount: input.reviewCount != null,
    rating: input.rating != null,
    category: Boolean((input.businessCategories?.length ?? 0) || tagNames(input.tags).length),
    website: Boolean(input.website?.trim()) || (input.websiteStatus != null && input.websiteStatus !== "sin_revisar"),
    social: Boolean(input.digitalPresenceKnown || importedPresenceKnown || hasSocial),
    booking: Boolean(input.digitalPresenceKnown || importedPresenceKnown || hasBooking),
    contact: hasPhone || hasEmail || hasSocial,
    location: Boolean(input.address?.trim()),
    reviewRecency: Boolean(input.lastReviewAt),
  };
  const scoreConfidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Object.entries(SCORE_CONFIDENCE_WEIGHTS).reduce(
          (total, [key, weight]) => total + (knownSignals[key as keyof typeof knownSignals] ? weight : 0),
          0
        )
      )
    )
  );

  return {
    leadScore,
    leadGrade: gradeFor(leadScore),
    scoreConfidence,
    scoredAt: now.toISOString(),
    scoreVersion: SCORE_VERSION,
    scoreBreakdown: {
      traction: { score: traction, reviews, rating, recency },
      webOpportunity,
      digitalMaturity,
      sectorFit: category.points,
      contactability,
      locationFit: location.points,
      penalties: closed ? baseScore : penalties,
      websiteClassification,
      businessProfile: category.profile,
      categoryTier: category.tier,
      location: location.name,
      reasons: details
        .filter((detail) => detail.points !== 0)
        .sort((left, right) => Math.abs(right.points) - Math.abs(left.points))
        .slice(0, 8)
        .map((detail) => detail.label),
      details,
    },
  };
}

export function leadScoreDatabaseValues(result: LeadScoreResult) {
  return {
    lead_score: result.leadScore,
    lead_grade: result.leadGrade,
    score_breakdown: result.scoreBreakdown,
    score_confidence: result.scoreConfidence,
    scored_at: result.scoredAt,
    score_version: result.scoreVersion,
  };
}
