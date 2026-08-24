export const STATUSES = [
  { value: "por_contactar", label: "Por contactar", color: "#64748b" },
  { value: "contactado", label: "Contactado", color: "#d97f06" },
  { value: "respondio", label: "Respondió", color: "#0891b2" },
  { value: "interesado", label: "Interesado", color: "#7c3aed" },
  { value: "cliente", label: "Cliente", color: "#059669" },
  { value: "descartado", label: "Descartado", color: "#e11d48" },
] as const;

export type StatusKey = (typeof STATUSES)[number]["value"];

const LEGACY_STATUS_ALIASES: Record<string, StatusKey> = {
  revisar_mas_tarde: "por_contactar",
  seguimiento: "contactado",
};

export const STATUS_MAP: Record<StatusKey, { label: string; color: string }> =
  Object.fromEntries(
    STATUSES.map((s) => [s.value, { label: s.label, color: s.color }])
  ) as Record<StatusKey, { label: string; color: string }>;

export const PENDING_STATUSES: StatusKey[] = [
  "por_contactar",
  "contactado",
  "respondio",
  "interesado",
];

export function isUncontactedStatus(status: string): boolean {
  return normalizeLeadStatus(status) === "por_contactar";
}

export function normalizeLeadStatus(
  status: string | null | undefined,
  legacyStatuses?: readonly string[] | null
): StatusKey {
  const values = [status, ...(legacyStatuses ?? [])].filter(
    (value): value is string => Boolean(value)
  );

  if (values.includes("descartado") && status === "descartado") {
    return "descartado";
  }
  if (values.includes("cliente")) return "cliente";
  if (values.includes("interesado")) return "interesado";
  if (values.includes("respondio")) return "respondio";
  if (values.some((value) => value === "contactado" || value === "seguimiento")) {
    return "contactado";
  }
  if (values.includes("descartado")) return "descartado";
  if (status && isValidStatus(status)) return status;
  if (status && LEGACY_STATUS_ALIASES[status]) return LEGACY_STATUS_ALIASES[status];
  return "por_contactar";
}

export function normalizeLeadStatuses(
  statuses: readonly string[] | null | undefined,
  fallback = "por_contactar"
): StatusKey[] {
  return [normalizeLeadStatus(fallback, statuses)];
}

export function hasLeadStatus(
  statuses: readonly string[],
  status: StatusKey
): boolean {
  return statuses.includes(status);
}

export function areStatusesUncontacted(statuses: readonly string[]): boolean {
  return normalizeLeadStatus(statuses[0], statuses) === "por_contactar";
}

export function hasPendingStatus(statuses: readonly string[]): boolean {
  return PENDING_STATUSES.includes(normalizeLeadStatus(statuses[0], statuses));
}

export const NEXT_ACTIONS = [
  { value: "contactar", label: "Contactar", shortLabel: "Contactar", color: "#2563eb" },
  {
    value: "esperar_respuesta",
    label: "Esperar respuesta",
    shortLabel: "Esperar respuesta",
    color: "#64748b",
  },
  {
    value: "hacer_follow_up",
    label: "Hacer follow-up",
    shortLabel: "Follow-up",
    color: "#d97706",
  },
  { value: "responder", label: "Responder", shortLabel: "Responder", color: "#0891b2" },
  {
    value: "revisar_mas_tarde",
    label: "Revisar más tarde",
    shortLabel: "Revisar",
    color: "#7c3aed",
  },
  { value: "sin_accion", label: "Sin acción", shortLabel: "Sin acción", color: "#94a3b8" },
] as const;

export type NextActionKey = (typeof NEXT_ACTIONS)[number]["value"];

export const NEXT_ACTION_MAP = Object.fromEntries(
  NEXT_ACTIONS.map((action) => [action.value, action])
) as Record<NextActionKey, (typeof NEXT_ACTIONS)[number]>;

export const CONTACT_CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "phone", label: "Teléfono" },
  { value: "other", label: "Otro" },
] as const;

export type ContactChannelKey = (typeof CONTACT_CHANNELS)[number]["value"];

export const CONTACT_CHANNEL_MAP = Object.fromEntries(
  CONTACT_CHANNELS.map((channel) => [channel.value, channel.label])
) as Record<ContactChannelKey, string>;

export const LEAD_SOURCES = [
  { value: "google_maps", label: "Google Maps" },
  { value: "instagram", label: "Instagram" },
  { value: "manual", label: "Manual" },
  { value: "importacion", label: "Importación" },
  { value: "apify", label: "Apify" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
] as const;

export type LeadSourceKey = (typeof LEAD_SOURCES)[number]["value"];

export const LEAD_SOURCE_MAP = Object.fromEntries(
  LEAD_SOURCES.map((source) => [source.value, source.label])
) as Record<LeadSourceKey, string>;

export function isValidNextAction(value: string): value is NextActionKey {
  return NEXT_ACTIONS.some((action) => action.value === value);
}

export function isValidContactChannel(value: string): value is ContactChannelKey {
  return CONTACT_CHANNELS.some((channel) => channel.value === value);
}

export function isValidLeadSource(value: string): value is LeadSourceKey {
  return LEAD_SOURCES.some((source) => source.value === value);
}

export function defaultNextActionForStatus(status: StatusKey): NextActionKey {
  switch (status) {
    case "por_contactar":
      return "contactar";
    case "contactado":
      return "esperar_respuesta";
    case "respondio":
      return "responder";
    case "interesado":
      return "hacer_follow_up";
    case "cliente":
    case "descartado":
      return "sin_accion";
  }
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
