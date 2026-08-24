import {
  CONTACTABILITY_POINTS,
  DIGITAL_MATURITY_POINTS,
  LOCATION_DISTANCE_BANDS,
  LOCATION_NEUTRAL_POINTS,
  MIN_TERRITORY_SAMPLE,
  RATING_BANDS,
  REVIEW_BANDS_WITH_RATING,
  REVIEW_BANDS_WITHOUT_RATING,
  SCORE_CONFIDENCE_WEIGHTS,
  SCORE_PENALTIES,
  SCORE_VERSION,
  SECTOR_LEARNING,
  WEB_OPPORTUNITY_POINTS,
  WEBSITE_DOMAINS,
} from "./lead-scoring-config.ts";
import type { LeadScoringContext, SectorSignal } from "./lead-scoring-context.ts";

export type WebsiteClassification =
  | "NONE"
  | "SOCIAL"
  | "BOOKING_PLATFORM"
  | "DIRECTORY"
  | "OWN_WEBSITE";

export type ScoreDetail = { label: string; points: number };

export type LeadScoreBreakdown = {
  reputation: {
    score: number;
    reviews: number;
    rating: number | null;
    model: "WITH_RATING" | "WITHOUT_RATING";
  };
  webOpportunity: number;
  digitalMaturity: number;
  sectorPerformance: number;
  contactability: number;
  locationFit: number;
  penalties: number;
  websiteClassification: WebsiteClassification;
  location: string;
  sector: string;
  reasons: string[];
  details: ScoreDetail[];
};

export type LeadScoreInput = {
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  websiteStatus?: "sin_revisar" | "tiene_web" | "no_tiene_web" | "web_antigua" | null;
  phone?: string | null;
  email?: string | null;
  lat?: number | null;
  lng?: number | null;
  tags?: readonly (string | { name: string })[] | null;
  businessCategories?: readonly string[] | null;
  rating?: number | null;
  reviewCount?: number | null;
  socialLinks?: readonly string[] | null;
  digitalPresenceKnown?: boolean | null;
  contactChannel?: string | null;
  source?: string | null;
  scoringContext?: LeadScoringContext | null;
  sectorSignal?: SectorSignal | null;
};

export type LeadScoreResult = {
  leadScore: number;
  scoreBreakdown: LeadScoreBreakdown;
  scoreConfidence: number;
  scoreVersion: number;
};

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

function pointsFor(value: number, bands: readonly { min: number; points: number }[]) {
  return bands.find((band) => value >= band.min)?.points ?? 0;
}

function uniqueLinks(input: LeadScoreInput) {
  const values = [
    input.website,
    input.facebook,
    ...(input.socialLinks ?? []),
    input.instagram ? `https://instagram.com/${input.instagram}` : null,
  ].filter((value): value is string => Boolean(value?.trim()));
  return [
    ...new Map(
      values.map((value) => [value.trim().toLocaleLowerCase("es"), value.trim()])
    ).values(),
  ];
}

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusKm = 6_371;
  const deltaLat = radians(lat2 - lat1);
  const deltaLng = radians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function locationSignal(input: LeadScoreInput) {
  const territory = input.scoringContext?.territory;
  if (
    territory == null ||
    territory.sampleSize < MIN_TERRITORY_SAMPLE ||
    input.lat == null ||
    input.lng == null ||
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng)
  ) {
    return { points: LOCATION_NEUTRAL_POINTS, label: "Ubicación neutral", known: false };
  }
  const distance = distanceKm(
    input.lat,
    input.lng,
    territory.centerLat,
    territory.centerLng
  );
  const points =
    LOCATION_DISTANCE_BANDS.find((band) => distance <= band.maxKm)?.points ??
    LOCATION_NEUTRAL_POINTS;
  return {
    points,
    label: `${Math.round(distance)} km del centro operativo`,
    known: true,
  };
}

export function calculateLeadScore(input: LeadScoreInput): LeadScoreResult {
  const links = uniqueLinks(input);
  const classifications = links.map(classifyWebsite);
  const rawWebsiteClassification = classifyWebsite(input.website);
  const websiteClassification: WebsiteClassification =
    input.websiteStatus === "web_antigua" || input.websiteStatus === "tiene_web"
      ? "OWN_WEBSITE"
      : input.websiteStatus === "no_tiene_web" &&
          rawWebsiteClassification === "OWN_WEBSITE"
        ? "NONE"
        : rawWebsiteClassification;
  const hasInstagram =
    Boolean(input.instagram?.trim()) ||
    links.some((link) => matchesDomain(hostname(link), "instagram.com"));
  const hasFacebook =
    Boolean(input.facebook?.trim()) ||
    links.some((link) =>
      ["facebook.com", "fb.com"].some((domain) =>
        matchesDomain(hostname(link), domain)
      )
    );
  const hasBooking = classifications.includes("BOOKING_PLATFORM");
  const hasDirectory = classifications.includes("DIRECTORY");
  const hasSocial =
    hasInstagram || hasFacebook || classifications.includes("SOCIAL");
  const hasPhone = Boolean(input.phone?.trim());
  const hasWhatsapp =
    input.contactChannel === "whatsapp" ||
    links.some((link) =>
      ["wa.me", "whatsapp.com"].some((domain) =>
        matchesDomain(hostname(link), domain)
      )
    );
  const hasEmail = Boolean(input.email?.trim());
  const hasRating = input.rating != null && Number.isFinite(input.rating);
  const reviewCount = Math.max(0, input.reviewCount ?? 0);

  const reviewPoints = pointsFor(
    reviewCount,
    hasRating ? REVIEW_BANDS_WITH_RATING : REVIEW_BANDS_WITHOUT_RATING
  );
  const ratingPoints = hasRating ? pointsFor(input.rating!, RATING_BANDS) : null;
  const reputation = reviewPoints + (ratingPoints ?? 0);

  let webOpportunity: number;
  if (input.websiteStatus === "web_antigua") {
    webOpportunity = WEB_OPPORTUNITY_POINTS.oldWebsite;
  } else if (websiteClassification === "OWN_WEBSITE") {
    webOpportunity = WEB_OPPORTUNITY_POINTS.ownWebsite;
  } else if (
    websiteClassification === "BOOKING_PLATFORM" ||
    websiteClassification === "SOCIAL" ||
    websiteClassification === "DIRECTORY"
  ) {
    webOpportunity = WEB_OPPORTUNITY_POINTS.platformOrProfile;
  } else if (
    input.websiteStatus === "sin_revisar" ||
    input.websiteStatus == null
  ) {
    webOpportunity = input.website
      ? WEB_OPPORTUNITY_POINTS.ownWebsite
      : WEB_OPPORTUNITY_POINTS.unknown;
  } else {
    webOpportunity = WEB_OPPORTUNITY_POINTS.none;
  }

  let digitalMaturity = 0;
  if (hasInstagram) digitalMaturity += DIGITAL_MATURITY_POINTS.instagram;
  else if (hasFacebook) {
    digitalMaturity += DIGITAL_MATURITY_POINTS.facebookWithoutInstagram;
  }
  if (hasBooking) digitalMaturity += DIGITAL_MATURITY_POINTS.booking;
  if (hasDirectory || (hasSocial && !hasInstagram && !hasFacebook)) {
    digitalMaturity += DIGITAL_MATURITY_POINTS.additionalProfile;
  }
  digitalMaturity = Math.min(DIGITAL_MATURITY_POINTS.max, digitalMaturity);

  const contactability = Math.min(
    CONTACTABILITY_POINTS.max,
    (hasPhone ? CONTACTABILITY_POINTS.phone : 0) +
      (hasWhatsapp ? CONTACTABILITY_POINTS.whatsapp : 0) +
      (hasSocial ? CONTACTABILITY_POINTS.social : 0) +
      (hasEmail ? CONTACTABILITY_POINTS.email : 0)
  );
  const sector = input.sectorSignal ?? {
    points: SECTOR_LEARNING.neutralPoints,
    sampleSize: 0,
    label:
      [...(input.businessCategories ?? []), ...(input.tags ?? []).map((tag) =>
        typeof tag === "string" ? tag : tag.name
      )].filter(Boolean).join(", ") || "Sin etiqueta",
  };
  const location = locationSignal(input);

  let penalties = 0;
  const penaltyDetails: ScoreDetail[] = [];
  if (
    reviewCount < SCORE_PENALTIES.unvalidated.maxReviewsExclusive &&
    !hasSocial &&
    !hasBooking
  ) {
    penalties += SCORE_PENALTIES.unvalidated.points;
    penaltyDetails.push({
      label: "Pocas señales de validación",
      points: -SCORE_PENALTIES.unvalidated.points,
    });
  }
  if (hasRating && input.rating! < SCORE_PENALTIES.lowRating.threshold) {
    penalties += SCORE_PENALTIES.lowRating.points;
    penaltyDetails.push({
      label: "Rating inferior a 4,0",
      points: -SCORE_PENALTIES.lowRating.points,
    });
  }
  if (!hasPhone && !hasWhatsapp && !hasEmail && !hasSocial) {
    penalties += SCORE_PENALTIES.noContact;
    penaltyDetails.push({
      label: "Sin forma útil de contacto",
      points: -SCORE_PENALTIES.noContact,
    });
  }

  const details: ScoreDetail[] = [
    {
      label:
        input.websiteStatus === "web_antigua"
          ? "Web antigua"
          : websiteClassification === "OWN_WEBSITE"
            ? "Ya tiene web propia"
            : websiteClassification === "BOOKING_PLATFORM"
              ? "Solo plataforma de reservas"
              : websiteClassification === "SOCIAL" ||
                  websiteClassification === "DIRECTORY"
                ? "Solo perfil o directorio digital"
                : input.websiteStatus === "sin_revisar" ||
                    input.websiteStatus == null
                  ? "Web todavía sin revisar"
                  : "Sin web propia",
      points: webOpportunity,
    },
    {
      label: `${reviewCount} reseñas${hasRating ? "" : " · fórmula sin rating"}`,
      points: reviewPoints,
    },
    ...(hasRating
      ? [{ label: `Rating ${input.rating!.toFixed(1)}`, points: ratingPoints! }]
      : []),
    {
      label:
        sector.sampleSize > 0
          ? `${sector.label} · aprendido con ${sector.sampleSize} resultados`
          : `${sector.label} · valor inicial`,
      points: sector.points,
    },
    { label: location.label, points: location.points },
  ];
  if (hasInstagram) {
    details.push({ label: "Instagram", points: DIGITAL_MATURITY_POINTS.instagram });
  } else if (hasFacebook) {
    details.push({
      label: "Facebook",
      points: DIGITAL_MATURITY_POINTS.facebookWithoutInstagram,
    });
  }
  if (hasBooking) {
    details.push({
      label: "Sistema de reservas",
      points: DIGITAL_MATURITY_POINTS.booking,
    });
  }
  if (contactability > 0) {
    details.push({ label: "Canales de contacto", points: contactability });
  }
  details.push(...penaltyDetails);

  const rawScore =
    reputation +
    webOpportunity +
    digitalMaturity +
    sector.points +
    contactability +
    location.points -
    penalties;
  const leadScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const importedPresenceKnown = ["apify", "google_maps"].includes(
    input.source ?? ""
  );
  const knownSignals = {
    reviewCount: input.reviewCount != null,
    rating: hasRating,
    sectorHistory: sector.sampleSize > 0,
    website:
      Boolean(input.website?.trim()) ||
      (input.websiteStatus != null && input.websiteStatus !== "sin_revisar"),
    digital: Boolean(
      input.digitalPresenceKnown || importedPresenceKnown || links.length
    ),
    contact: hasPhone || hasEmail || hasSocial,
    location: location.known,
  };
  const scoreConfidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Object.entries(SCORE_CONFIDENCE_WEIGHTS).reduce(
          (total, [key, weight]) =>
            total +
            (knownSignals[key as keyof typeof knownSignals] ? weight : 0),
          0
        )
      )
    )
  );

  return {
    leadScore,
    scoreConfidence,
    scoreVersion: SCORE_VERSION,
    scoreBreakdown: {
      reputation: {
        score: reputation,
        reviews: reviewPoints,
        rating: ratingPoints,
        model: hasRating ? "WITH_RATING" : "WITHOUT_RATING",
      },
      webOpportunity,
      digitalMaturity,
      sectorPerformance: sector.points,
      contactability,
      locationFit: location.points,
      penalties,
      websiteClassification,
      location: location.label,
      sector: sector.label,
      reasons: details
        .filter((detail) => detail.points !== 0)
        .sort((left, right) => Math.abs(right.points) - Math.abs(left.points))
        .slice(0, 8)
        .map((detail) => detail.label),
      details,
    },
  };
}
