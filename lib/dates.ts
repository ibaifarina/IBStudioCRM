import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { hasPendingStatus } from "@/lib/config";

const APP_TIME_ZONE = "Europe/Madrid";

export function todayISO(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
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
  statuses: readonly string[]
): boolean {
  if (!followUpDate) return false;
  if (!hasPendingStatus(statuses)) return false;
  return followUpDate < todayISO();
}

export function isFollowUpToday(
  followUpDate: string | null,
  statuses: readonly string[]
): boolean {
  if (!followUpDate) return false;
  if (!hasPendingStatus(statuses)) return false;
  return followUpDate === todayISO();
}
