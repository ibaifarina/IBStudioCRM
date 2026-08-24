import type { LeadImportComparable } from "@/lib/types";
import {
  normalizeInstagramUsername,
  normalizePhoneE164,
  normalizeWebsiteDomain,
} from "@/lib/lead-identifiers";

export const MAX_GOOGLE_PLACES_LEADS = 5_000;

export class GooglePlacesJsonError extends Error {}

export type GooglePlacesLeadDraft = {
  sourceIndex: number;
  placeId: string | null;
  name: string;
  instagram: string | null;
  website: string | null;
  websiteStatus: "tiene_web" | "no_tiene_web";
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  categories: string[];
};

const NON_WEBSITE_PLATFORM_DOMAINS = new Set([
  "instagram.com",
  "facebook.com",
  "fb.com",
  "booksy.com",
  "booksy.es",
  "fresha.com",
  "treatwell.com",
  "treatwell.es",
  "tiktok.com",
  "linktr.ee",
  "linktree.com",
  "wa.me",
  "whatsapp.com",
  "sites.google.com",
]);

const INSTAGRAM_NON_PROFILE_PATHS = new Set([
  "accounts",
  "direct",
  "explore",
  "p",
  "reel",
  "reels",
  "stories",
  "tv",
]);

export type AnalyzedGooglePlacesLead = GooglePlacesLeadDraft & {
  duplicate: boolean;
  duplicateReason: string | null;
};

function cleanString(value: unknown, maxLength?: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseUrl(value: string) {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function normalizedHostname(value: string) {
  return parseUrl(value)?.hostname.toLocaleLowerCase("es").replace(/^www\./, "") ?? "";
}

function matchesDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function instagramUsername(value: string) {
  const url = parseUrl(value);
  if (!url) return null;
  const firstPathSegment = url.pathname.split("/").filter(Boolean)[0];
  if (!firstPathSegment) return null;

  let username = firstPathSegment;
  try {
    username = decodeURIComponent(username);
  } catch {
    // Keep the original segment if it contains malformed escapes.
  }
  username = username.replace(/^@/, "").trim();
  if (
    !username ||
    INSTAGRAM_NON_PROFILE_PATHS.has(username.toLocaleLowerCase("es"))
  ) {
    return null;
  }
  return username.slice(0, 80);
}

function onlinePresence(rawWebsite: string | null) {
  if (!rawWebsite) {
    return {
      instagram: null,
      website: null,
      websiteStatus: "no_tiene_web" as const,
    };
  }

  const hostname = normalizedHostname(rawWebsite);
  const platformDomain = [...NON_WEBSITE_PLATFORM_DOMAINS].find((domain) =>
    matchesDomain(hostname, domain)
  );
  if (!platformDomain) {
    return {
      instagram: null,
      website: rawWebsite,
      websiteStatus: "tiene_web" as const,
    };
  }

  return {
    instagram:
      platformDomain === "instagram.com"
        ? instagramUsername(rawWebsite)
        : null,
    website: rawWebsite,
    websiteStatus: "no_tiene_web" as const,
  };
}

function normalizeText(value: string | null | undefined) {
  return value
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

function coordinatesKey(lat: number | null, lng: number | null) {
  return lat == null || lng == null ? "" : `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function duplicateReason(
  candidate: GooglePlacesLeadDraft,
  existing: LeadImportComparable | GooglePlacesLeadDraft
) {
  const existingPlaceId =
    "placeId" in existing ? existing.placeId : existing.googlePlaceId;
  if (candidate.placeId && candidate.placeId === existingPlaceId) {
    return "Mismo Google Maps Place ID";
  }

  const candidatePhone = normalizePhoneE164(candidate.phone);
  const existingPhone =
    "normalizedPhone" in existing
      ? existing.normalizedPhone || normalizePhoneE164(existing.phone)
      : normalizePhoneE164(existing.phone);
  if (candidatePhone && candidatePhone === existingPhone) {
    return "Mismo teléfono";
  }

  const candidateInstagram = normalizeInstagramUsername(candidate.instagram);
  const existingInstagram =
    "normalizedInstagram" in existing
      ? existing.normalizedInstagram ||
        normalizeInstagramUsername(existing.instagram)
      : normalizeInstagramUsername(existing.instagram);
  if (
    candidateInstagram &&
    candidateInstagram === existingInstagram
  ) {
    return "Mismo Instagram";
  }

  const candidateWebsite = normalizeWebsiteDomain(candidate.website);
  const existingWebsite =
    "websiteDomain" in existing
      ? existing.websiteDomain || normalizeWebsiteDomain(existing.website)
      : normalizeWebsiteDomain(existing.website);
  if (candidateWebsite && candidateWebsite === existingWebsite) {
    return "Mismo dominio web";
  }

  const candidateName = normalizeText(candidate.name);
  const existingName = normalizeText(existing.name);
  const candidateAddress = normalizeText(candidate.address);
  if (
    candidateName &&
    candidateName === existingName &&
    candidateAddress &&
    candidateAddress === normalizeText(existing.address)
  ) {
    return "Mismo nombre y dirección";
  }

  const candidateCoordinates = coordinatesKey(candidate.lat, candidate.lng);
  if (
    candidateName &&
    candidateName === existingName &&
    candidateCoordinates &&
    candidateCoordinates === coordinatesKey(existing.lat, existing.lng)
  ) {
    return "Mismo nombre y ubicación";
  }

  return null;
}

export function parseGooglePlacesJson(text: string): GooglePlacesLeadDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GooglePlacesJsonError(
      "No se ha podido leer el JSON. Comprueba que el archivo sea válido."
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new GooglePlacesJsonError(
      "El JSON debe contener una lista no vacía de lugares de Google Maps."
    );
  }
  if (parsed.length > MAX_GOOGLE_PLACES_LEADS) {
    throw new GooglePlacesJsonError(
      `El JSON no puede contener más de ${MAX_GOOGLE_PLACES_LEADS.toLocaleString("es-ES")} leads.`
    );
  }

  return parsed.map((value, sourceIndex) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new GooglePlacesJsonError(
        `El elemento ${sourceIndex + 1} no es un lugar válido.`
      );
    }

    const record = value as Record<string, unknown>;
    const name = cleanString(record.title, 200);
    if (!name) {
      throw new GooglePlacesJsonError(
        `Falta «title» en el elemento ${sourceIndex + 1}.`
      );
    }

    const location =
      record.location &&
      typeof record.location === "object" &&
      !Array.isArray(record.location)
        ? (record.location as Record<string, unknown>)
        : {};
    const categoryValues = Array.isArray(record.categories)
      ? record.categories
      : [record.categoryName];
    const categories = [
      ...new Set(
        categoryValues
          .map((category) => cleanString(category, 80))
          .filter((category): category is string => Boolean(category))
      ),
    ];
    const presence = onlinePresence(cleanString(record.website));

    return {
      sourceIndex,
      placeId: cleanString(record.placeId),
      name,
      ...presence,
      phone:
        cleanString(record.phone) ?? cleanString(record.phoneUnformatted),
      address: cleanString(record.address),
      lat: finiteNumber(location.lat),
      lng: finiteNumber(location.lng),
      categories,
    };
  });
}

export function analyzeGooglePlacesLeads(
  candidates: GooglePlacesLeadDraft[],
  existingLeads: LeadImportComparable[]
): AnalyzedGooglePlacesLead[] {
  const accepted: GooglePlacesLeadDraft[] = [];
  const seenPlaceIds = new Set<string>();

  return candidates.map((candidate) => {
    let reason = existingLeads
      .map((lead) => duplicateReason(candidate, lead))
      .find(Boolean) ?? null;

    if (!reason && candidate.placeId && seenPlaceIds.has(candidate.placeId)) {
      reason = "Place ID repetido en el archivo";
    }
    if (!reason) {
      reason = accepted
        .map((lead) => duplicateReason(candidate, lead))
        .find(Boolean) ?? null;
      if (reason) reason = `${reason} en el archivo`;
    }

    if (!reason) {
      accepted.push(candidate);
      if (candidate.placeId) seenPlaceIds.add(candidate.placeId);
    }

    return {
      ...candidate,
      duplicate: Boolean(reason),
      duplicateReason: reason,
    };
  });
}
