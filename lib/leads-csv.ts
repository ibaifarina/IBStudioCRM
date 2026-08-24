import {
  CONTACT_CHANNELS,
  defaultNextActionForStatus,
  isValidContactChannel,
  isValidLeadSource,
  isValidNextAction,
  isValidStatus,
  isValidWebsiteStatus,
  LEAD_SOURCES,
  NEXT_ACTIONS,
  normalizeLeadStatus,
  STATUSES,
  WEBSITE_STATUSES,
  type ContactChannelKey,
  type LeadSourceKey,
  type NextActionKey,
  type StatusKey,
  type WebsiteStatusKey,
} from "@/lib/config";
import { dateInputToTimestamp } from "@/lib/dates";
import { normalizeInstagramUsername } from "@/lib/lead-identifiers";

const HEADERS = [
  "id_original",
  "nombre",
  "instagram",
  "sitio_web",
  "estado_web",
  "telefono",
  "direccion",
  "latitud",
  "longitud",
  "problema",
  "notas",
  "estado",
  "estados_json",
  "fecha_contacto",
  "fecha_seguimiento",
  "etiquetas_json",
  "fecha_creacion",
  "fecha_actualizacion",
  "contacted_at",
  "replied_at",
  "last_contact_at",
  "last_outbound_at",
  "last_inbound_at",
  "contact_channel",
  "next_action",
  "next_action_at",
  "source",
  "google_place_id",
  "email",
  "facebook",
  "categorias_json",
  "rating",
  "numero_resenas",
  "perfiles_digitales_json",
  "presencia_digital_revisada",
] as const;

const MAX_ROWS = 5_000;

export type CsvLead = {
  name: string;
  instagram: string | null;
  website: string | null;
  websiteStatus: WebsiteStatusKey;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  problem: string | null;
  notes: string | null;
  status: StatusKey;
  statuses: StatusKey[];
  contactDate: string | null;
  followUpDate: string | null;
  contactedAt: string | null;
  repliedAt: string | null;
  lastContactAt: string | null;
  lastOutboundAt: string | null;
  lastInboundAt: string | null;
  contactChannel: ContactChannelKey | null;
  nextAction: NextActionKey;
  nextActionAt: string | null;
  source: LeadSourceKey;
  googlePlaceId: string | null;
  email: string | null;
  facebook: string | null;
  businessCategories: string[];
  rating: number | null;
  reviewCount: number | null;
  socialLinks: string[];
  digitalPresenceKnown: boolean;
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

type ExportLead = CsvLead & { id: number };

export class CsvImportError extends Error {}

function csvCell(value: string | number | null): string {
  let text = value == null ? "" : String(value);

  // Evita que Excel/Sheets interprete contenido del usuario como una fórmula.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeLeadsCsv(leads: ExportLead[]): string {
  const rows = leads.map((lead) => [
    lead.id,
    lead.name,
    lead.instagram,
    lead.website,
    lead.websiteStatus,
    lead.phone,
    lead.address,
    lead.lat,
    lead.lng,
    lead.problem,
    lead.notes,
    lead.status,
    JSON.stringify(lead.statuses),
    lead.contactDate,
    lead.followUpDate,
    JSON.stringify(lead.tags),
    lead.createdAt,
    lead.updatedAt,
    lead.contactedAt,
    lead.repliedAt,
    lead.lastContactAt,
    lead.lastOutboundAt,
    lead.lastInboundAt,
    lead.contactChannel,
    lead.nextAction,
    lead.nextActionAt,
    lead.source,
    lead.googlePlaceId,
    lead.email,
    lead.facebook,
    JSON.stringify(lead.businessCategories),
    lead.rating,
    lead.reviewCount,
    JSON.stringify(lead.socialLinks),
    lead.digitalPresenceKnown ? "true" : "false",
  ]);

  // BOM para que Excel detecte UTF-8 y CRLF para máxima compatibilidad.
  return `\uFEFF${[HEADERS, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")}\r\n`;
}

function detectDelimiter(input: string): "," | ";" {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;

  for (const character of input.replace(/^\uFEFF/, "")) {
    if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") commas += 1;
    else if (!quoted && character === ";") semicolons += 1;
    else if (!quoted && (character === "\n" || character === "\r")) break;
  }

  return semicolons > commas ? ";" : ",";
}

function parseCsv(input: string): string[][] {
  const source = input.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell === "") quoted = true;
    else if (character === delimiter) {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new CsvImportError("El CSV contiene una comilla sin cerrar.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

function normalizeStatus(value: string): StatusKey | null {
  const normalized = normalizeHeader(value);
  if (isValidStatus(normalized)) return normalized;

  if (normalized === "seguimiento" || normalized === "revisar_mas_tarde") {
    return normalizeLeadStatus(normalized);
  }

  return (
    STATUSES.find((status) => normalizeHeader(status.label) === normalized)?.value ??
    null
  );
}

function normalizeNextAction(value: string): NextActionKey | null {
  const normalized = normalizeHeader(value);
  if (isValidNextAction(normalized)) return normalized;
  return (
    NEXT_ACTIONS.find(
      (action) => normalizeHeader(action.label) === normalized
    )?.value ?? null
  );
}

function normalizeContactChannel(value: string): ContactChannelKey | null {
  const normalized = normalizeHeader(value);
  if (isValidContactChannel(normalized)) return normalized;
  return (
    CONTACT_CHANNELS.find(
      (channel) => normalizeHeader(channel.label) === normalized
    )?.value ?? null
  );
}

function normalizeLeadSource(value: string): LeadSourceKey | null {
  const normalized = normalizeHeader(value);
  if (isValidLeadSource(normalized)) return normalized;
  return (
    LEAD_SOURCES.find(
      (source) => normalizeHeader(source.label) === normalized
    )?.value ?? null
  );
}

function parseStatuses(value: string, fallback: string, rowNumber: number) {
  const normalized = optional(value);
  const rawValues = normalized
    ? (() => {
        if (normalized.startsWith("[")) {
          try {
            const parsed: unknown = JSON.parse(normalized);
            if (
              !Array.isArray(parsed) ||
              parsed.some((status) => typeof status !== "string")
            ) {
              throw new Error();
            }
            return parsed;
          } catch {
            throw new CsvImportError(
              `Fila ${rowNumber}: estados_json no contiene una lista válida.`
            );
          }
        }
        return normalized.split(/[|;]/);
      })()
    : [fallback];

  const statuses = [
    ...new Set(
      rawValues.map((rawStatus) => normalizeStatus(rawStatus.trim()))
    ),
  ];
  if (statuses.some((status) => status == null)) {
    throw new CsvImportError(
      `Fila ${rowNumber}: uno de los estados no es válido.`
    );
  }
  if (statuses.length === 0) {
    throw new CsvImportError(
      `Fila ${rowNumber}: selecciona al menos un estado.`
    );
  }
  return statuses as StatusKey[];
}

function normalizeWebsiteStatus(value: string): WebsiteStatusKey | null {
  const normalized = normalizeHeader(value);
  if (isValidWebsiteStatus(normalized)) return normalized;

  return (
    WEBSITE_STATUSES.find(
      (status) => normalizeHeader(status.label) === normalized
    )?.value ?? null
  );
}

function unprotectFormula(value: string): string {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function optional(value: string): string | null {
  const trimmed = unprotectFormula(value).trim();
  return trimmed || null;
}

function parseNumber(
  value: string,
  label: string,
  rowNumber: number,
  min: number,
  max: number
): number | null {
  const normalized = optional(value);
  if (normalized == null) return null;

  const parsed = Number(normalized.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new CsvImportError(
      `Fila ${rowNumber}: ${label} debe ser un número entre ${min} y ${max}.`
    );
  }
  return parsed;
}

function parseInteger(
  value: string,
  label: string,
  rowNumber: number,
  max: number
): number | null {
  const parsed = parseNumber(value, label, rowNumber, 0, max);
  if (parsed != null && !Number.isInteger(parsed)) {
    throw new CsvImportError(`Fila ${rowNumber}: ${label} debe ser un número entero.`);
  }
  return parsed;
}

function parseDate(value: string, label: string, rowNumber: number): string | null {
  const normalized = optional(value);
  if (normalized == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new CsvImportError(
      `Fila ${rowNumber}: ${label} debe tener el formato AAAA-MM-DD.`
    );
  }

  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new CsvImportError(`Fila ${rowNumber}: ${label} no es una fecha válida.`);
  }
  return normalized;
}

function parseTimestamp(
  value: string,
  label: string,
  rowNumber: number
): string | null {
  const normalized = optional(value);
  if (normalized == null) return null;
  if (Number.isNaN(Date.parse(normalized))) {
    throw new CsvImportError(`Fila ${rowNumber}: ${label} no es una fecha válida.`);
  }
  return new Date(normalized).toISOString();
}

function parseTags(value: string, rowNumber: number): string[] {
  const normalized = optional(value);
  if (normalized == null) return [];

  let values: unknown;
  if (normalized.startsWith("[")) {
    try {
      values = JSON.parse(normalized);
    } catch {
      throw new CsvImportError(
        `Fila ${rowNumber}: la columna etiquetas_json no contiene una lista válida.`
      );
    }
  } else {
    values = normalized.split(/[|;]/);
  }

  if (!Array.isArray(values) || values.some((tag) => typeof tag !== "string")) {
    throw new CsvImportError(
      `Fila ${rowNumber}: las etiquetas deben ser una lista de nombres.`
    );
  }

  const uniqueTags = new Map<string, string>();
  for (const tag of values) {
    const trimmed = tag.trim();
    const key = trimmed.toLocaleLowerCase("es");
    if (trimmed && !uniqueTags.has(key)) uniqueTags.set(key, trimmed);
  }
  const tags = [...uniqueTags.values()];
  const tooLong = tags.find((tag) => tag.length > 80);
  if (tooLong) {
    throw new CsvImportError(
      `Fila ${rowNumber}: la etiqueta “${tooLong.slice(0, 30)}” supera 80 caracteres.`
    );
  }
  return tags;
}

function parseBoolean(value: string, label: string, rowNumber: number): boolean {
  const normalized = optional(value)?.toLocaleLowerCase("es");
  if (!normalized) return false;
  if (["true", "1", "si", "sí", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new CsvImportError(`Fila ${rowNumber}: ${label} debe ser true o false.`);
}

function findColumn(headers: string[], ...aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

export function parseLeadsCsv(input: string): CsvLead[] {
  const parsed = parseCsv(input);
  if (parsed.length < 2) {
    throw new CsvImportError("El CSV no contiene ningún lead.");
  }

  const headers = parsed[0].map(normalizeHeader);
  if (new Set(headers).size !== headers.length) {
    throw new CsvImportError("El CSV contiene columnas duplicadas.");
  }

  const columns = {
    name: findColumn(headers, "nombre", "name"),
    instagram: findColumn(headers, "instagram"),
    website: findColumn(headers, "sitio_web", "website", "web"),
    websiteStatus: findColumn(
      headers,
      "estado_web",
      "website_status",
      "estado_de_la_web"
    ),
    phone: findColumn(headers, "telefono", "phone"),
    address: findColumn(headers, "direccion", "address"),
    lat: findColumn(headers, "latitud", "lat"),
    lng: findColumn(headers, "longitud", "lng", "lon"),
    problem: findColumn(headers, "problema", "problem"),
    notes: findColumn(headers, "notas", "notes"),
    status: findColumn(headers, "estado", "status"),
    statuses: findColumn(headers, "estados_json", "statuses", "estados"),
    contactDate: findColumn(headers, "fecha_contacto", "contact_date"),
    followUpDate: findColumn(
      headers,
      "fecha_seguimiento",
      "follow_up_date",
      "followup"
    ),
    tags: findColumn(headers, "etiquetas_json", "etiquetas", "tags"),
    createdAt: findColumn(headers, "fecha_creacion", "created_at"),
    updatedAt: findColumn(headers, "fecha_actualizacion", "updated_at"),
    contactedAt: findColumn(headers, "contacted_at"),
    repliedAt: findColumn(headers, "replied_at"),
    lastContactAt: findColumn(headers, "last_contact_at"),
    lastOutboundAt: findColumn(headers, "last_outbound_at"),
    lastInboundAt: findColumn(headers, "last_inbound_at"),
    contactChannel: findColumn(headers, "contact_channel", "canal_contacto"),
    nextAction: findColumn(headers, "next_action", "proxima_accion"),
    nextActionAt: findColumn(
      headers,
      "next_action_at",
      "fecha_proxima_accion"
    ),
    source: findColumn(headers, "source", "fuente"),
    googlePlaceId: findColumn(headers, "google_place_id", "place_id"),
    email: findColumn(headers, "email", "correo"),
    facebook: findColumn(headers, "facebook"),
    businessCategories: findColumn(headers, "categorias_json", "business_categories", "categorias"),
    rating: findColumn(headers, "rating", "valoracion"),
    reviewCount: findColumn(headers, "numero_resenas", "review_count", "reviews_count"),
    socialLinks: findColumn(headers, "perfiles_digitales_json", "social_links"),
    digitalPresenceKnown: findColumn(headers, "presencia_digital_revisada", "digital_presence_known"),
  };

  if (columns.name < 0) {
    throw new CsvImportError('Falta la columna obligatoria “nombre”.');
  }

  const dataRows = parsed.slice(1);
  if (dataRows.length > MAX_ROWS) {
    throw new CsvImportError(`El CSV no puede superar ${MAX_ROWS} leads.`);
  }

  const get = (row: string[], column: number) =>
    column < 0 ? "" : (row[column] ?? "");

  return dataRows.map((row, index) => {
    const rowNumber = index + 2;
    const name = optional(get(row, columns.name));
    if (!name) {
      throw new CsvImportError(`Fila ${rowNumber}: el nombre es obligatorio.`);
    }
    if (name.length > 200) {
      throw new CsvImportError(
        `Fila ${rowNumber}: el nombre supera los 200 caracteres.`
      );
    }

    const rawStatus = optional(get(row, columns.status)) ?? "por_contactar";
    const statuses = parseStatuses(
      get(row, columns.statuses),
      rawStatus,
      rowNumber
    );
    const status = normalizeLeadStatus(statuses[0], [rawStatus, ...statuses]);
    const workflowText = `${get(row, columns.statuses)} ${rawStatus}`
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s-]+/g, "_");

    const rawContactDate = parseDate(
      get(row, columns.contactDate),
      "la fecha de contacto",
      rowNumber
    );
    const rawFollowUpDate = parseDate(
      get(row, columns.followUpDate),
      "la fecha de seguimiento",
      rowNumber
    );

    const explicitNextActionValue = optional(get(row, columns.nextAction));
    const explicitNextAction = explicitNextActionValue
      ? normalizeNextAction(explicitNextActionValue)
      : null;
    if (explicitNextActionValue && !explicitNextAction) {
      throw new CsvImportError(
        `Fila ${rowNumber}: la próxima acción “${explicitNextActionValue}” no es válida.`
      );
    }
    const nextAction = explicitNextAction ??
      (workflowText.includes("revisar_mas_tarde")
        ? "revisar_mas_tarde"
        : workflowText.includes("seguimiento") || rawFollowUpDate
          ? "hacer_follow_up"
          : defaultNextActionForStatus(status));
    const finalNextAction =
      status === "cliente" || status === "descartado"
        ? "sin_accion"
        : nextAction;

    const rawContactChannel = optional(get(row, columns.contactChannel));
    const contactChannel = rawContactChannel
      ? normalizeContactChannel(rawContactChannel)
      : null;
    if (rawContactChannel && !contactChannel) {
      throw new CsvImportError(
        `Fila ${rowNumber}: el canal “${rawContactChannel}” no es válido.`
      );
    }

    const rawSource = optional(get(row, columns.source));
    const source = rawSource ? normalizeLeadSource(rawSource) : "importacion";
    if (!source) {
      throw new CsvImportError(
        `Fila ${rowNumber}: la fuente “${rawSource}” no es válida.`
      );
    }

    const rawWebsiteStatus =
      optional(get(row, columns.websiteStatus)) ?? "sin_revisar";
    const websiteStatus = normalizeWebsiteStatus(rawWebsiteStatus);
    if (!websiteStatus) {
      throw new CsvImportError(
        `Fila ${rowNumber}: el estado web “${rawWebsiteStatus}” no es válido.`
      );
    }

    return {
      name,
      instagram:
        normalizeInstagramUsername(optional(get(row, columns.instagram))) || null,
      website: optional(get(row, columns.website)),
      websiteStatus,
      phone: optional(get(row, columns.phone)),
      address: optional(get(row, columns.address)),
      lat: parseNumber(get(row, columns.lat), "la latitud", rowNumber, -90, 90),
      lng: parseNumber(get(row, columns.lng), "la longitud", rowNumber, -180, 180),
      problem: optional(get(row, columns.problem)),
      notes: optional(get(row, columns.notes)),
      status,
      statuses: [status],
      contactDate: rawContactDate,
      followUpDate: rawFollowUpDate,
      contactedAt:
        parseTimestamp(
          get(row, columns.contactedAt),
          "contacted_at",
          rowNumber
        ) ?? (rawContactDate ? dateInputToTimestamp(rawContactDate) : null),
      repliedAt: parseTimestamp(
        get(row, columns.repliedAt),
        "replied_at",
        rowNumber
      ),
      lastContactAt: parseTimestamp(
        get(row, columns.lastContactAt),
        "last_contact_at",
        rowNumber
      ),
      lastOutboundAt: parseTimestamp(
        get(row, columns.lastOutboundAt),
        "last_outbound_at",
        rowNumber
      ),
      lastInboundAt: parseTimestamp(
        get(row, columns.lastInboundAt),
        "last_inbound_at",
        rowNumber
      ),
      contactChannel,
      nextAction: finalNextAction,
      nextActionAt:
        finalNextAction === "sin_accion"
          ? null
          : parseTimestamp(
              get(row, columns.nextActionAt),
              "next_action_at",
              rowNumber
            ) ?? (rawFollowUpDate ? dateInputToTimestamp(rawFollowUpDate) : null),
      source,
      googlePlaceId: optional(get(row, columns.googlePlaceId)),
      email: optional(get(row, columns.email)),
      facebook: optional(get(row, columns.facebook)),
      businessCategories: parseTags(get(row, columns.businessCategories), rowNumber),
      rating: parseNumber(get(row, columns.rating), "el rating", rowNumber, 0, 5),
      reviewCount: parseInteger(get(row, columns.reviewCount), "el número de reseñas", rowNumber, 10_000_000),
      socialLinks: parseTags(get(row, columns.socialLinks), rowNumber),
      digitalPresenceKnown: parseBoolean(get(row, columns.digitalPresenceKnown), "presencia_digital_revisada", rowNumber),
      tags: parseTags(get(row, columns.tags), rowNumber),
      createdAt: parseTimestamp(
        get(row, columns.createdAt),
        "la fecha de creación",
        rowNumber
      ),
      updatedAt: parseTimestamp(
        get(row, columns.updatedAt),
        "la fecha de actualización",
        rowNumber
      ),
    };
  });
}
