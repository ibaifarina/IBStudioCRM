import type { LeadWithTags } from "@/lib/types";

export function instagramUrl(handle: string) {
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}

export function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  return `https://wa.me/${digits}`;
}

export function mapsUrl(lead: LeadWithTags) {
  if (lead.lat != null && lead.lng != null) {
    return `https://www.google.com/maps?q=${lead.lat},${lead.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${lead.name} ${lead.address ?? "Barcelona"}`
  )}`;
}
