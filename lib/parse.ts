/** Extrae el usuario de Instagram de un handle o URL completa. */
export function parseInstagramUsername(raw: string): string {
  const value = raw.trim();
  if (!value) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    if (/instagram\.com$/i.test(url.hostname.replace(/^www\./, ""))) {
      const segment = url.pathname
        .split("/")
        .filter(Boolean)
        .find(
          (s) =>
            !["p", "reel", "reels", "stories", "explore", "tv"].includes(
              s.toLowerCase()
            )
        );
      if (segment) return segment.replace(/^@/, "");
    }
  } catch {
    // no es una URL válida; seguir con el texto plano
  }

  return value
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .split(/[/?#]/)[0];
}

/** Intenta sacar lat/lng de un enlace de Google Maps. */
export function parseMapsCoordinates(
  raw: string
): { lat: number; lng: number } | null {
  const value = raw.trim();
  if (!value) return null;

  const atMatch = value.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  const qMatch = value.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/i);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  const llMatch = value.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/i);
  if (llMatch) {
    return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
  }

  return null;
}
