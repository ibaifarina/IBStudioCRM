import { LeadsView } from "@/components/leads-view";
import { PageHeader } from "@/components/page-header";
import { todayISO } from "@/lib/dates";
import {
  getAllTags,
  getLeadsPage,
  getLeadWithTags,
  getMessageTemplates,
  getRecentLeadCreatedDates,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const parsedOpenId = open ? Number(open) : undefined;
  const initialOpenId =
    parsedOpenId != null && Number.isSafeInteger(parsedOpenId) && parsedOpenId > 0
      ? parsedOpenId
      : undefined;
  const [initialPage, tags, createdDates, initialOpenLead, templates] = await Promise.all([
    getLeadsPage(),
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
      />
    </div>
  );
}
