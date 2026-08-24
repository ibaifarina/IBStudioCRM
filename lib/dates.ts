import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { hasPendingStatus, type NextActionKey } from "@/lib/config";

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

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy · HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "pendiente";
  try {
    return formatDistanceToNowStrict(parseISO(iso), {
      addSuffix: true,
      locale: es,
    });
  } catch {
    return iso;
  }
}

export function dateKeyInAppTimeZone(iso: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateInputToTimestampAtHour(
  value: string | null | undefined,
  hour: number
) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const localHourUtcGuess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    hour
  );
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(localHourUtcGuess));
  const zoned = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  const representedAsUtc = Date.UTC(
    Number(zoned.year),
    Number(zoned.month) - 1,
    Number(zoned.day),
    Number(zoned.hour),
    Number(zoned.minute),
    Number(zoned.second)
  );
  return new Date(localHourUtcGuess - (representedAsUtc - localHourUtcGuess)).toISOString();
}

export function dateInputToTimestamp(value: string | null | undefined) {
  return dateInputToTimestampAtHour(value, 9);
}

export function dateInputToStartOfDayTimestamp(
  value: string | null | undefined
) {
  return dateInputToTimestampAtHour(value, 0);
}

export function timestampToDateInput(value: string | null | undefined) {
  return value ? dateKeyInAppTimeZone(value) : "";
}

export function isNextActionOverdue(
  action: NextActionKey,
  actionAt: string | null
) {
  return Boolean(
    action !== "sin_accion" &&
      actionAt &&
      dateKeyInAppTimeZone(actionAt) < todayISO()
  );
}

export function isNextActionToday(
  action: NextActionKey,
  actionAt: string | null
) {
  return Boolean(
    action !== "sin_accion" &&
      actionAt &&
      dateKeyInAppTimeZone(actionAt) === todayISO()
  );
}

export function formatActionTiming(
  action: NextActionKey,
  actionAt: string | null
): string {
  if (action === "sin_accion") return "";
  if (!actionAt) return "pendiente";
  try {
    const actionDate = parseISO(dateKeyInAppTimeZone(actionAt));
    const today = parseISO(todayISO());
    const distance = differenceInCalendarDays(actionDate, today);
    if (distance === -1) return "ayer";
    if (distance === 0) return "hoy";
    if (distance === 1) return "mañana";
    return format(actionDate, "d MMM", { locale: es });
  } catch {
    return formatDateShort(actionAt);
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
