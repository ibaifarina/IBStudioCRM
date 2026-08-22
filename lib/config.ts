export const STATUSES = [
  { value: "por_contactar", label: "Por contactar", color: "#64748b" },
  {
    value: "revisar_mas_tarde",
    label: "Revisar más tarde",
    color: "#7c3aed",
  },
  { value: "contactado", label: "Contactado", color: "#d97f06" },
  { value: "seguimiento", label: "Seguimiento", color: "#ea580c" },
  { value: "respondio", label: "Respondió", color: "#0891b2" },
  { value: "cliente", label: "Cliente", color: "#059669" },
  { value: "descartado", label: "Descartado", color: "#e11d48" },
] as const;

export type StatusKey = (typeof STATUSES)[number]["value"];

const UNCONTACTED_STATUSES = new Set<StatusKey>([
  "por_contactar",
  "revisar_mas_tarde",
]);

export const STATUS_MAP: Record<StatusKey, { label: string; color: string }> =
  Object.fromEntries(
    STATUSES.map((s) => [s.value, { label: s.label, color: s.color }])
  ) as Record<StatusKey, { label: string; color: string }>;

/** Estados en los que un follow-up sigue teniendo sentido */
export const PENDING_STATUSES: StatusKey[] = [
  "por_contactar",
  "revisar_mas_tarde",
  "contactado",
  "seguimiento",
];

export function isUncontactedStatus(status: string): boolean {
  return UNCONTACTED_STATUSES.has(status as StatusKey);
}

export function normalizeLeadStatuses(
  statuses: readonly string[] | null | undefined,
  fallback = "por_contactar"
): StatusKey[] {
  const valid = [...new Set((statuses ?? []).filter(isValidStatus))];
  if (valid.length > 0) return valid;
  return [isValidStatus(fallback) ? fallback : "por_contactar"];
}

export function hasLeadStatus(
  statuses: readonly string[],
  status: StatusKey
): boolean {
  return statuses.includes(status);
}

export function areStatusesUncontacted(statuses: readonly string[]): boolean {
  return (
    statuses.length > 0 &&
    statuses.every((status) => isUncontactedStatus(status))
  );
}

export function hasPendingStatus(statuses: readonly string[]): boolean {
  return statuses.some((status) =>
    PENDING_STATUSES.includes(status as StatusKey)
  );
}

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

export const LEAD_SORTS = [
  { value: "updated_desc", label: "Últimos cambios" },
  { value: "follow_up_asc", label: "Follow-up: fecha más próxima" },
  { value: "follow_up_desc", label: "Follow-up: fecha más lejana" },
  { value: "created_desc", label: "Añadidos recientemente" },
  { value: "created_asc", label: "Añadidos hace más tiempo" },
  { value: "name_asc", label: "Nombre A–Z" },
  { value: "name_desc", label: "Nombre Z–A" },
] as const;

export type LeadSortKey = (typeof LEAD_SORTS)[number]["value"];

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

export function isValidLeadSort(value: string): value is LeadSortKey {
  return LEAD_SORTS.some((sort) => sort.value === value);
}
