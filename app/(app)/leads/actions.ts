"use server";

import {
  isValidLeadSort,
  isValidStatus,
  isValidWebsiteStatus,
} from "@/lib/config";
import {
  getLeadImportComparables,
  getLeadsPage,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type {
  LeadCursor,
  LeadFilters,
  LeadImportComparable,
  LeadPage,
  LeadSort,
} from "@/lib/types";

function validDate(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === "string" && !Number.isNaN(Date.parse(value)))
  );
}

async function isAuthenticated() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return !error && Boolean(data?.claims?.sub);
}

function validCursor(cursor: unknown): cursor is LeadCursor | null | undefined {
  return (
    !cursor ||
    (typeof cursor === "object" &&
      !Array.isArray(cursor) &&
      "id" in cursor &&
      Number.isSafeInteger(cursor.id) &&
      Number(cursor.id) > 0 &&
      "updatedAt" in cursor &&
      typeof cursor.updatedAt === "string" &&
      !Number.isNaN(Date.parse(cursor.updatedAt)) &&
      "createdAt" in cursor &&
      typeof cursor.createdAt === "string" &&
      !Number.isNaN(Date.parse(cursor.createdAt)) &&
      "name" in cursor &&
      typeof cursor.name === "string" &&
      cursor.name.length <= 500 &&
      "followUpDate" in cursor &&
      (cursor.followUpDate === null ||
        (typeof cursor.followUpDate === "string" &&
          !Number.isNaN(Date.parse(cursor.followUpDate)))))
  );
}

function sanitizeFilters(filters: unknown): LeadFilters | null {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return null;
  }
  const values = filters as Record<string, unknown>;
  if (values.search != null && typeof values.search !== "string") return null;
  if (values.status != null && typeof values.status !== "string") return null;
  if (
    values.websiteStatus != null &&
    typeof values.websiteStatus !== "string"
  ) {
    return null;
  }
  const typedFilters = values as LeadFilters;
  if (typedFilters.status && !isValidStatus(typedFilters.status)) return null;
  if (
    typedFilters.websiteStatus &&
    !isValidWebsiteStatus(typedFilters.websiteStatus)
  ) {
    return null;
  }
  if (
    typedFilters.tagId != null &&
    (!Number.isSafeInteger(typedFilters.tagId) || typedFilters.tagId <= 0)
  ) {
    return null;
  }
  if (
    !validDate(typedFilters.createdFrom) ||
    !validDate(typedFilters.createdTo)
  ) {
    return null;
  }

  return {
    search: typedFilters.search?.trim().slice(0, 100) || undefined,
    status: typedFilters.status,
    websiteStatus: typedFilters.websiteStatus,
    tagId: typedFilters.tagId,
    createdFrom: typedFilters.createdFrom,
    createdTo: typedFilters.createdTo,
  };
}

export async function loadLeadsPage(input: {
  cursor?: LeadCursor | null;
  filters?: LeadFilters;
  sort?: LeadSort;
}): Promise<LeadPage | { error: string }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "La solicitud no es válida." };
  }
  if (!(await isAuthenticated())) {
    return { error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  }
  if (!validCursor(input.cursor)) {
    return { error: "El punto de paginación no es válido." };
  }
  const sort = input.sort ?? "updated_desc";
  if (!isValidLeadSort(sort)) return { error: "Orden no válido." };

  const filters = sanitizeFilters(input.filters ?? {});
  if (!filters) return { error: "Los filtros no son válidos." };

  try {
    return await getLeadsPage({ cursor: input.cursor, filters, sort });
  } catch {
    return {
      error: input.cursor
        ? "No se pudieron cargar más leads."
        : "No se pudieron cargar los leads.",
    };
  }
}

export async function loadLeadImportComparables(): Promise<
  LeadImportComparable[] | { error: string }
> {
  if (!(await isAuthenticated())) {
    return { error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  }

  try {
    return await getLeadImportComparables();
  } catch {
    return { error: "No se pudieron comprobar los leads duplicados." };
  }
}
