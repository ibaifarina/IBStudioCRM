import { MapView } from "@/components/map-view";
import { PageHeader } from "@/components/page-header";
import { getLeadsWithTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MapaPage() {
  const leads = await getLeadsWithTags();

  return (
    <div className="mx-auto flex h-[calc(100svh-3rem)] max-w-6xl flex-col px-4 py-8 md:h-svh md:px-8">
      <PageHeader
        title="Mapa"
        subtitle="Zonas de la ciudad que ya has trabajado, por estado de contacto."
      />
      <div className="min-h-0 flex-1 pb-2">
        <MapView leads={leads} />
      </div>
    </div>
  );
}
