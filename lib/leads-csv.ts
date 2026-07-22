import {
  isValidStatus,
  isValidWebsiteStatus,
  STATUSES,
  WEBSITE_STATUSES,
  type WebsiteStatusKey,
} from "@/lib/config";

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
  "fecha_contacto",
  "fecha_seguimiento",
  "etiquetas_json",
  "fecha_creacion",
  "fecha_actualizacion",
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
  status: string;
  contactDate: string | null;
  followUpDate: string | null;
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
    lead.contactDate,
    lead.followUpDate,
    JSON.stringify(lead.tags),
    lead.createdAt,
    lead.updatedAt,
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

function normalizeStatus(value: string): string | null {
  const normalized = normalizeHeader(value);
  if (isValidStatus(normalized)) return normalized;

  return (
    STATUSES.find((status) => normalizeHeader(status.label) === normalized)?.value ??
    null
  );
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
    const status = normalizeStatus(rawStatus);
    if (!status) {
      throw new CsvImportError(`Fila ${rowNumber}: el estado “${rawStatus}” no es válido.`);
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
      instagram: optional(get(row, columns.instagram))?.replace(/^@/, "") ?? null,
      website: optional(get(row, columns.website)),
      websiteStatus,
      phone: optional(get(row, columns.phone)),
      address: optional(get(row, columns.address)),
      lat: parseNumber(get(row, columns.lat), "la latitud", rowNumber, -90, 90),
      lng: parseNumber(get(row, columns.lng), "la longitud", rowNumber, -180, 180),
      problem: optional(get(row, columns.problem)),
      notes: optional(get(row, columns.notes)),
      status,
      contactDate: parseDate(
        get(row, columns.contactDate),
        "la fecha de contacto",
        rowNumber
      ),
      followUpDate: parseDate(
        get(row, columns.followUpDate),
        "la fecha de seguimiento",
        rowNumber
      ),
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
