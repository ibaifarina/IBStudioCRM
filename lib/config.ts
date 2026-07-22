export const STATUSES = [
  { value: "por_contactar", label: "Por contactar", color: "#64748b" },
  { value: "contactado", label: "Contactado", color: "#d97f06" },
  { value: "seguimiento", label: "Seguimiento", color: "#ea580c" },
  { value: "respondio", label: "Respondió", color: "#0891b2" },
  { value: "cliente", label: "Cliente", color: "#059669" },
  { value: "descartado", label: "Descartado", color: "#e11d48" },
] as const;

export type StatusKey = (typeof STATUSES)[number]["value"];

export const STATUS_MAP: Record<StatusKey, { label: string; color: string }> =
  Object.fromEntries(
    STATUSES.map((s) => [s.value, { label: s.label, color: s.color }])
  ) as Record<StatusKey, { label: string; color: string }>;

/** Estados en los que un follow-up sigue teniendo sentido */
export const PENDING_STATUSES: StatusKey[] = [
  "por_contactar",
  "contactado",
  "seguimiento",
];

export const WEBSITE_STATUSES = [
  { value: "sin_revisar", label: "Sin revisar", color: "#64748b" },
  { value: "tiene_web", label: "Tiene web", color: "#059669" },
  { value: "no_tiene_web", label: "No tiene web", color: "#e11d48" },
  { value: "web_antigua", label: "Web antigua", color: "#d97706" },
] as const;

export type WebsiteStatusKey = (typeof WEBSITE_STATUSES)[number]["value"];

export const WEBSITE_STATUS_MAP: Record<
  WebsiteStatusKey,
  { label: string; color: string }
> = Object.fromEntries(
  WEBSITE_STATUSES.map((status) => [
    status.value,
    { label: status.label, color: status.color },
  ])
) as Record<WebsiteStatusKey, { label: string; color: string }>;

export const TAG_COLORS = [
  "#2563eb", // azul
  "#0891b2", // cian
  "#7c3aed", // violeta
  "#db2777", // rosa
  "#059669", // esmeralda
  "#4f46e5", // índigo
  "#0284c7", // azul cielo
  "#c026d3", // fucsia
  "#0d9488", // verde azulado
  "#6366f1", // lavanda
];

export const BARCELONA_CENTER: [number, number] = [41.3874, 2.1686];

export function isValidStatus(value: string): value is StatusKey {
  return STATUSES.some((s) => s.value === value);
}

export function isValidWebsiteStatus(
  value: string
): value is WebsiteStatusKey {
  return WEBSITE_STATUSES.some((status) => status.value === value);
}
