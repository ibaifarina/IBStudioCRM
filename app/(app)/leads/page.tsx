import { LeadsView } from "@/components/leads-view";
import { PageHeader } from "@/components/page-header";
import { todayISO } from "@/lib/dates";
import { isValidNextAction } from "@/lib/config";
import {
  getAllTags,
  getLeadsPage,
  getLeadWithTags,
  getMessageTemplates,
  getRecentLeadCreatedDates,
} from "@/lib/queries";
import type { LeadFilters } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; action?: string; due?: string }>;
}) {
  const { open, action, due } = await searchParams;
  const parsedOpenId = open ? Number(open) : undefined;
  const initialOpenId =
    parsedOpenId != null && Number.isSafeInteger(parsedOpenId) && parsedOpenId > 0
      ? parsedOpenId
      : undefined;
  const initialNextAction = action && isValidNextAction(action) ? action : undefined;
  const initialActionTiming = due === "today" || due === "overdue" ? due : undefined;
  const initialFilters: LeadFilters = {
    nextAction: initialNextAction,
    actionTiming: initialActionTiming,
  };
  const [initialPage, tags, createdDates, initialOpenLead, templates] = await Promise.all([
    getLeadsPage({ filters: initialFilters }),
    getAllTags(),
    getRecentLeadCreatedDates(),
    initialOpenId ? getLeadWithTags(initialOpenId) : null,
    getMessageTemplates(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        title="Leads"
        subtitle="Todos los negocios detectados y su estado de contacto."
      />
      <LeadsView
        initialPage={initialPage}
        tags={tags}
        today={todayISO()}
        createdDates={createdDates}
        initialOpenId={initialOpenId}
        initialOpenLead={initialOpenLead}
        templates={templates}
        initialNextAction={initialNextAction}
        initialActionTiming={initialActionTiming}
      />
    </div>
  );
}
