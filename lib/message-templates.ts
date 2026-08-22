import type { LeadWithTags } from "@/lib/types";

export type TemplateVariable = {
  key: string;
  label: string;
};

export type MessageTemplatePart =
  | { type: "text"; value: string }
  | { type: "variable"; key: string; label: string };

const TEMPLATE_VARIABLE_PATTERN = /\[([^\[\]\r\n]{1,50})\]/g;

export function normalizeTemplateVariable(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export function extractTemplateVariables(content: string): TemplateVariable[] {
  const variables = new Map<string, TemplateVariable>();

  for (const match of content.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
    const label = match[1].trim().replace(/\s+/g, " ");
    const key = normalizeTemplateVariable(label);
    if (key && !variables.has(key)) variables.set(key, { key, label });
  }

  return [...variables.values()];
}

export function splitMessageTemplate(content: string): MessageTemplatePart[] {
  const parts: MessageTemplatePart[] = [];
  let cursor = 0;

  for (const match of content.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({ type: "text", value: content.slice(cursor, index) });
    }
    const label = match[1].trim().replace(/\s+/g, " ");
    parts.push({
      type: "variable",
      key: normalizeTemplateVariable(label),
      label,
    });
    cursor = index + match[0].length;
  }

  if (cursor < content.length) {
    parts.push({ type: "text", value: content.slice(cursor) });
  }

  return parts;
}

export function fillMessageTemplate(
  content: string,
  values: Record<string, string>
) {
  return content.replace(TEMPLATE_VARIABLE_PATTERN, (placeholder, label) => {
    const value = values[normalizeTemplateVariable(String(label))]?.trim();
    return value || placeholder;
  });
}

export function leadTemplateValues(
  content: string,
  lead: LeadWithTags
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const variable of extractTemplateVariables(content)) {
    switch (variable.key) {
      case "nombre":
      case "nombre del negocio":
      case "negocio":
        values[variable.key] = lead.name;
        break;
      case "instagram":
        values[variable.key] = lead.instagram ? `@${lead.instagram}` : "";
        break;
      case "teléfono":
      case "telefono":
      case "móvil":
      case "movil":
        values[variable.key] = lead.phone ?? "";
        break;
      case "web":
      case "sitio web":
        values[variable.key] = lead.website ?? "";
        break;
      case "dirección":
      case "direccion":
        values[variable.key] = lead.address ?? "";
        break;
    }
  }

  return values;
}
