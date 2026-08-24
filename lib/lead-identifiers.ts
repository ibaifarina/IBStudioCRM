import type { DuplicateWarning, LeadImportComparable } from "@/lib/types";

export type DuplicateCandidate = {
  name: string;
  phone?: string | null;
  instagram?: string | null;
  website?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  googlePlaceId?: string | null;
};

export function normalizePhoneE164(
  value: string | null | undefined,
  defaultCountryCode = "34"
): string {
  let digits = value?.replace(/\D/g, "") ?? "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9) digits = `${defaultCountryCode}${digits}`;
  if (digits.length < 8 || digits.length > 15) return "";
  return `+${digits}`;
}

export function normalizeInstagramUsername(
  value: string | null | undefined
): string {
  if (!value) return "";
  let username = value.trim();
  try {
    const parsed = new URL(
      username.includes("://") ? username : `https://${username}`
    );
    if (/(^|\.)instagram\.com$/i.test(parsed.hostname)) {
      username = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    }
  } catch {
    // Plain usernames are expected here.
  }
  return username.replace(/^@/, "").toLocaleLowerCase("es").trim();
}

export function normalizeWebsiteDomain(
  value: string | null | undefined
): string {
  if (!value) return "";
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return parsed.hostname.toLocaleLowerCase("es").replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeText(value: string | null | undefined) {
  return (
    value
      ?.normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("es")
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? ""
  );
}

function coordinatesKey(lat: number | null | undefined, lng: number | null | undefined) {
  return lat == null || lng == null ? "" : `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export function findDuplicateLead(
  candidate: DuplicateCandidate,
  existingLeads: LeadImportComparable[]
): DuplicateWarning | null {
  const candidatePlaceId = candidate.googlePlaceId?.trim() ?? "";
  const candidatePhone = normalizePhoneE164(candidate.phone);
  const candidateInstagram = normalizeInstagramUsername(candidate.instagram);
  const candidateDomain = normalizeWebsiteDomain(candidate.website);
  const candidateName = normalizeText(candidate.name);
  const candidateAddress = normalizeText(candidate.address);
  const candidateCoordinates = coordinatesKey(candidate.lat, candidate.lng);

  for (const lead of existingLeads) {
    const strongReason =
      candidatePlaceId && candidatePlaceId === lead.googlePlaceId?.trim()
        ? "Mismo Google Maps Place ID"
        : candidatePhone &&
            candidatePhone ===
              (lead.normalizedPhone || normalizePhoneE164(lead.phone))
          ? "Mismo teléfono"
          : candidateInstagram &&
              candidateInstagram ===
                (lead.normalizedInstagram ||
                  normalizeInstagramUsername(lead.instagram))
            ? "Mismo Instagram"
            : candidateDomain &&
                candidateDomain ===
                  (lead.websiteDomain || normalizeWebsiteDomain(lead.website))
              ? "Mismo dominio web"
              : null;

    if (strongReason) {
      return {
        leadId: lead.id,
        leadName: lead.name,
        reason: strongReason,
        confidence: "strong",
      };
    }

    if (
      candidateName &&
      candidateName === normalizeText(lead.name) &&
      ((candidateAddress && candidateAddress === normalizeText(lead.address)) ||
        (candidateCoordinates &&
          candidateCoordinates === coordinatesKey(lead.lat, lead.lng)))
    ) {
      return {
        leadId: lead.id,
        leadName: lead.name,
        reason: candidateAddress ? "Mismo nombre y dirección" : "Mismo nombre y ubicación",
        confidence: "possible",
      };
    }
  }

  return null;
}
