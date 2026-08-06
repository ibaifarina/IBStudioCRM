import { LeadsView } from "@/components/leads-view";
import { PageHeader } from "@/components/page-header";
import { todayISO } from "@/lib/dates";
import { getAllTags, getLeadsWithTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const [leads, tags] = await Promise.all([
    getLeadsWithTags(),
    getAllTags(),
  ]);
  const initialOpenId = open ? Number(open) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        title="Leads"
        subtitle="Todos los negocios detectados y su estado de contacto."
      />
      <LeadsView
        leads={leads}
        tags={tags}
        today={todayISO()}
        initialOpenId={
          initialOpenId != null && !Number.isNaN(initialOpenId)
            ? initialOpenId
            : undefined
        }
      />
    </div>
  );
}
