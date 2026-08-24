import {
  CONTACT_CHANNEL_MAP,
  NEXT_ACTION_MAP,
  STATUS_MAP,
  type ContactChannelKey,
  type NextActionKey,
  type StatusKey,
} from "@/lib/config";
import { formatRelativeTime } from "@/lib/dates";
import type { LeadActivity } from "@/lib/types";

function metadataString(activity: LeadActivity, key: string) {
  const value = activity.metadata[key];
  return typeof value === "string" ? value : null;
}

export function leadActivityLabel(activity: LeadActivity): string {
  if (activity.description?.trim()) return activity.description.trim();

  switch (activity.type) {
    case "lead_created":
      return "Lead creado";
    case "status_changed": {
      const status = metadataString(activity, "to") as StatusKey | null;
      return status && STATUS_MAP[status]
        ? `Estado cambiado a ${STATUS_MAP[status].label}`
        : "Estado actualizado";
    }
    case "next_action_changed": {
      const action = metadataString(activity, "to") as NextActionKey | null;
      return action && NEXT_ACTION_MAP[action]
        ? `Próxima acción: ${NEXT_ACTION_MAP[action].label}`
        : "Próxima acción actualizada";
    }
    case "followup_scheduled":
      return "Follow-up programado";
    case "followup_completed":
      return "Follow-up completado";
    case "note_added":
      return "Nota añadida";
    case "note_updated":
      return "Notas actualizadas";
    case "contact_marked":
      return "Contacto registrado";
    case "reply_marked":
      return "Respuesta registrada";
    case "template_used": {
      const templateName = metadataString(activity, "template_name");
      return templateName
        ? `Plantilla «${templateName}» copiada`
        : "Plantilla utilizada";
    }
    default:
      return activity.type.replaceAll("_", " ");
  }
}

export function leadActivitySummary(activity: LeadActivity): string {
  const channel = metadataString(activity, "channel") as ContactChannelKey | null;
  const prefix =
    channel && CONTACT_CHANNEL_MAP[channel]
      ? CONTACT_CHANNEL_MAP[channel]
      : activity.type === "status_changed"
        ? "Estado actualizado"
        : activity.type === "next_action_changed" ||
            activity.type === "followup_scheduled"
          ? "Próxima acción"
          : activity.type === "lead_created"
            ? "Lead creado"
            : leadActivityLabel(activity);

  return `${prefix} · ${formatRelativeTime(activity.occurredAt)}`;
}
