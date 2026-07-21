import "server-only";

import {
  isGoogleMapsShortUrl,
  parseMapsCoordinates,
} from "@/lib/parse";

const RESOLVE_TIMEOUT_MS = 8_000;

/**
 * Resuelve enlaces cortos oficiales de Google Maps y extrae las coordenadas
 * del destino. Los enlaces que ya contienen coordenadas no hacen red.
 */
export async function resolveMapsCoordinates(
  raw: string
): Promise<{ lat: number; lng: number } | null> {
  const direct = parseMapsCoordinates(raw);
  if (direct) return direct;
  if (!isGoogleMapsShortUrl(raw)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);

  try {
    const response = await fetch(raw.trim(), {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "ib-studio-crm/1.0",
      },
    });

    return parseMapsCoordinates(response.url);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
