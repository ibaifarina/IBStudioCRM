import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { PENDING_STATUSES, type StatusKey } from "@/lib/config";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM", { locale: es });
  } catch {
    return iso;
  }
}

/** Un follow-up está vencido si la fecha pasó y el lead sigue "en juego". */
export function isFollowUpOverdue(
  followUpDate: string | null,
  status: string
): boolean {
  if (!followUpDate) return false;
  if (!PENDING_STATUSES.includes(status as StatusKey)) return false;
  return followUpDate < todayISO();
}

export function isFollowUpToday(
  followUpDate: string | null,
  status: string
): boolean {
  if (!followUpDate) return false;
  if (!PENDING_STATUSES.includes(status as StatusKey)) return false;
  return followUpDate === todayISO();
}
