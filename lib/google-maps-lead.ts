import { parseInstagramUsername, parseMapsCoordinates } from "@/lib/parse";
import { classifyWebsite } from "@/lib/lead-scoring";

export const GOOGLE_MAPS_LEAD_PREFIX = "IBSTUDIO_CRM_LEAD_V1";
export const GOOGLE_MAPS_LEAD_HASH_KEY = "maps-lead";
export const GOOGLE_MAPS_LEAD_MESSAGE_TYPE = "IBSTUDIO_CRM_MAPS_LEAD";
export const GOOGLE_MAPS_LEAD_ACK_TYPE = "IBSTUDIO_CRM_MAPS_LEAD_ACK";
export const GOOGLE_MAPS_CRM_WINDOW_NAME = "ibstudio-crm";

type GoogleMapsDetail = {
  label: string;
  value: string;
};

export type GoogleMapsLead = {
  version: 1;
  source: "google_maps";
  capturedAt?: string;
  name: string;
  url?: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  category?: string;
  rating?: string;
  reviewCount?: string;
  priceLevel?: string;
  hours?: string[];
  plusCode?: string;
  coordinates?: { lat: number; lng: number };
  socialLinks?: string[];
  details?: GoogleMapsDetail[];
};

export type GoogleMapsLeadFormData = {
  name: string;
  instagram: string;
  facebook: string;
  website: string;
  websiteStatus: "tiene_web" | "no_tiene_web";
  phone: string;
  email: string;
  address: string;
  lat: number | null;
  lng: number | null;
  businessCategories: string[];
  rating: number | null;
  reviewCount: number | null;
  socialLinks: string[];
  digitalPresenceKnown: true;
};

function optionalString(value: unknown, maxLength = 2_000): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

function stringArray(value: unknown, maxItems = 20): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value
    .map((item) => optionalString(item, 500))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
  return values.length ? values : undefined;
}

/**
 * Parses only the versioned payload emitted by the IBStudio CRM Google Maps
 * bookmarklet. Ordinary clipboard content is intentionally ignored.
 */
export function parseGoogleMapsLead(raw: string): GoogleMapsLead | null {
  const text = raw.trim();
  if (!text.startsWith(`${GOOGLE_MAPS_LEAD_PREFIX}\n`)) return null;

  try {
    const value: unknown = JSON.parse(
      text.slice(GOOGLE_MAPS_LEAD_PREFIX.length).trim()
    );
    if (!value || typeof value !== "object") return null;

    const candidate = value as Record<string, unknown>;
    const name = optionalString(candidate.name, 300);
    if (
      candidate.version !== 1 ||
      candidate.source !== "google_maps" ||
      !name
    ) {
      return null;
    }

    let coordinates: GoogleMapsLead["coordinates"];
    if (candidate.coordinates && typeof candidate.coordinates === "object") {
      const rawCoordinates = candidate.coordinates as Record<string, unknown>;
      const lat = rawCoordinates.lat;
      const lng = rawCoordinates.lng;
      if (
        typeof lat === "number" &&
        typeof lng === "number" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        coordinates = { lat, lng };
      }
    }

    let details: GoogleMapsDetail[] | undefined;
    if (Array.isArray(candidate.details)) {
      const parsedDetails = candidate.details
        .map((detail) => {
          if (!detail || typeof detail !== "object") return null;
          const record = detail as Record<string, unknown>;
          const label = optionalString(record.label, 120);
          const detailValue = optionalString(record.value, 1_000);
          return label && detailValue ? { label, value: detailValue } : null;
        })
        .filter((detail): detail is GoogleMapsDetail => detail !== null)
        .slice(0, 30);
      details = parsedDetails.length ? parsedDetails : undefined;
    }

    return {
      version: 1,
      source: "google_maps",
      name,
      capturedAt: optionalString(candidate.capturedAt, 100),
      url: optionalString(candidate.url, 4_000),
      address: optionalString(candidate.address),
      phone: optionalString(candidate.phone, 100),
      website: optionalString(candidate.website, 4_000),
      email: optionalString(candidate.email, 320),
      category: optionalString(candidate.category, 300),
      rating: optionalString(candidate.rating, 50),
      reviewCount: optionalString(candidate.reviewCount, 100),
      priceLevel: optionalString(candidate.priceLevel, 100),
      hours: stringArray(candidate.hours),
      plusCode: optionalString(candidate.plusCode, 200),
      coordinates,
      socialLinks: stringArray(candidate.socialLinks, 10),
      details,
    };
  } catch {
    return null;
  }
}

/** Decodes the client-only URL fragment used when no CRM tab is open yet. */
export function parseGoogleMapsLeadHash(hash: string): GoogleMapsLead | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get(GOOGLE_MAPS_LEAD_HASH_KEY);
  if (!encoded) return null;

  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0)
    );
    return parseGoogleMapsLead(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function isInstagramUrl(value: string): boolean {
  try {
    return /(^|\.)instagram\.com$/i.test(new URL(value).hostname);
  } catch {
    return /instagram\.com/i.test(value);
  }
}

function isFacebookUrl(value: string): boolean {
  try {
    return /(^|\.)(facebook\.com|fb\.com)$/i.test(new URL(value).hostname);
  } catch {
    return /(facebook\.com|fb\.com)/i.test(value);
  }
}

function parseLocalizedNumber(value: string | undefined) {
  if (!value) return null;
  const compact = value.replace(/\s/g, "");
  const match = compact.match(/[0-9]+(?:[.,][0-9]+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Converts a parsed Maps payload into the fields supported by the lead form. */
export function googleMapsLeadToFormData(
  lead: GoogleMapsLead
): GoogleMapsLeadFormData {
  const instagramUrl = [lead.website, ...(lead.socialLinks ?? [])].find(
    (value): value is string => Boolean(value && isInstagramUrl(value))
  );
  const facebookUrl = [lead.website, ...(lead.socialLinks ?? [])].find(
    (value): value is string => Boolean(value && isFacebookUrl(value))
  );
  const website = lead.website ?? "";
  const websiteKind = classifyWebsite(website);
  const mapsCoordinates = lead.url ? parseMapsCoordinates(lead.url) : null;
  const coordinates = lead.coordinates ?? mapsCoordinates;

  return {
    name: lead.name,
    instagram: instagramUrl ? parseInstagramUsername(instagramUrl) : "",
    facebook: facebookUrl ?? "",
    website,
    websiteStatus: websiteKind === "OWN_WEBSITE" ? "tiene_web" : "no_tiene_web",
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    address: lead.url ?? lead.address ?? "",
    lat: coordinates?.lat ?? null,
    lng: coordinates?.lng ?? null,
    businessCategories: lead.category ? [lead.category] : [],
    rating: parseLocalizedNumber(lead.rating),
    reviewCount: parseLocalizedNumber(lead.reviewCount),
    socialLinks: lead.socialLinks ?? [],
    digitalPresenceKnown: true,
  };
}
