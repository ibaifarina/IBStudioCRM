import type { LeadImportComparable } from "@/lib/types";

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

function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length < 7) return "";
  return digits.length > 9 ? digits.slice(-9) : digits;
}

function normalizeInstagram(value: string | null | undefined) {
  return value?.trim().replace(/^@/, "").toLocaleLowerCase("es") ?? "";
}

function normalizeWebsite(value: string | null | undefined) {
  if (!value) return "";
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`
      .toLocaleLowerCase("es");
  } catch {
    return normalizeText(value);
  }
}

function coordinatesKey(lat: number | null, lng: number | null) {
  return lat == null || lng == null ? "" : `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function duplicateReason(
  candidate: GooglePlacesLeadDraft,
  existing: LeadImportComparable
) {
  const candidatePhone = normalizePhone(candidate.phone);
  if (candidatePhone && candidatePhone === normalizePhone(existing.phone)) {
    return "Mismo teléfono";
  }

  const candidateInstagram = normalizeInstagram(candidate.instagram);
  if (
    candidateInstagram &&
    candidateInstagram === normalizeInstagram(existing.instagram)
  ) {
    return "Mismo Instagram";
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

  const candidateWebsite = normalizeWebsite(candidate.website);
  if (
    candidateName &&
    candidateName === existingName &&
    candidateWebsite &&
    candidateWebsite === normalizeWebsite(existing.website)
  ) {
    return "Mismo nombre y web";
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
