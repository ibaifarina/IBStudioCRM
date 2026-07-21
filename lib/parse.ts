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

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Algunos enlaces contienen porcentajes sin escapar; usamos el valor original.
  }

  const coordinate = (latValue: string, lngValue: string) => {
    const lat = Number.parseFloat(latValue);
    const lng = Number.parseFloat(lngValue);
    return Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
      ? { lat, lng }
      : null;
  };

  const number = "(-?\\d+(?:\\.\\d+)?)";

  // Enlaces de lugares: las coordenadas del marcador son más precisas que
  // las que aparecen tras @, que solo representan el centro del viewport.
  const placeMatch = decoded.match(
    new RegExp(`!3d${number}!4d${number}`, "i")
  );
  if (placeMatch) return coordinate(placeMatch[1], placeMatch[2]);

  const embedMatch = decoded.match(
    new RegExp(`!2d${number}!3d${number}`, "i")
  );
  if (embedMatch) return coordinate(embedMatch[2], embedMatch[1]);

  const atMatch = decoded.match(new RegExp(`@${number},${number}`, "i"));
  if (atMatch) {
    return coordinate(atMatch[1], atMatch[2]);
  }

  const qMatch = decoded.match(
    new RegExp(`[?&](?:q|query)=${number},${number}`, "i")
  );
  if (qMatch) {
    return coordinate(qMatch[1], qMatch[2]);
  }

  const llMatch = decoded.match(
    new RegExp(`[?&]ll=${number},${number}`, "i")
  );
  if (llMatch) {
    return coordinate(llMatch[1], llMatch[2]);
  }

  return null;
}

/** Indica si el valor es un enlace corto oficial de Google Maps. */
export function isGoogleMapsShortUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (hostname === "maps.app.goo.gl" ||
        (hostname === "goo.gl" && url.pathname.startsWith("/maps/")))
    );
  } catch {
    return false;
  }
}
