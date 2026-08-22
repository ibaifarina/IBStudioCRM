import { AppSidebar } from "@/components/app-sidebar";
import { LeadsView } from "@/components/leads-view";
import { todayISO } from "@/lib/dates";
import type { LeadWithTags } from "@/lib/types";

const TAGS = [
  { id: 1, name: "Restaurante", color: "#2563eb" },
  { id: 2, name: "Peluquería", color: "#db2777" },
  { id: 3, name: "Gimnasio", color: "#059669" },
];

function lead(
  partial: Partial<LeadWithTags> & Pick<LeadWithTags, "id" | "name">
): LeadWithTags {
  return {
    instagram: null,
    website: null,
    websiteStatus: "sin_revisar",
    phone: null,
    address: null,
    lat: null,
    lng: null,
    problem: null,
    notes: null,
    status: "por_contactar",
    statuses: ["por_contactar"],
    contactDate: null,
    followUpDate: null,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    tags: [],
    ...partial,
  };
}

const leads: LeadWithTags[] = [
  lead({
    id: 1,
    name: "Can Solé",
    instagram: "cansole.barcelona",
    website: "https://cansole.example.com",
    websiteStatus: "web_antigua",
    phone: "+34 612 34 56 78",
    address: "Carrer de Sant Pau, 44",
    status: "seguimiento",
    statuses: ["contactado", "seguimiento"],
    contactDate: "2026-08-14",
    followUpDate: "2026-08-18",
    notes:
      "Interesados en renovar la web y añadir reservas online. Prefieren llamadas por la mañana.",
    tags: [TAGS[0]],
  }),
  lead({
    id: 2,
    name: "Gimnàs Rítmic Gràcia",
    instagram: "ritmic.gracia",
    websiteStatus: "no_tiene_web",
    phone: "+34 690 11 22 33",
    status: "respondio",
    statuses: ["respondio"],
    contactDate: "2026-08-19",
    followUpDate: todayISO(),
    tags: [TAGS[2], TAGS[1], TAGS[0]],
  }),
  lead({
    id: 3,
    name: "Perruqueria La Perla",
    websiteStatus: "tiene_web",
    phone: "+34 655 44 33 22",
    status: "cliente",
    statuses: ["cliente"],
    contactDate: "2026-07-02",
    followUpDate: "2026-09-01",
    tags: [TAGS[1]],
  }),
  lead({
    id: 4,
    name: "Bar Marsella 1920",
    instagram: "barmarsella",
    websiteStatus: "sin_revisar",
    status: "revisar_mas_tarde",
    statuses: ["revisar_mas_tarde"],
    followUpDate: null,
  }),
  lead({
    id: 5,
    name: "Òptica Visió",
    websiteStatus: "no_tiene_web",
    phone: "+34 678 90 12 34",
    address: "Avinguda Diagonal, 405",
    status: "por_contactar",
    statuses: ["por_contactar"],
    followUpDate: "2026-08-10",
  }),
];

export default function LeadsPreviewPage() {
  return (
    <div className="flex min-h-svh">
      <AppSidebar email="ana@ibstudio.es" name="Ana Martínez" />
      <main className="paper-grain min-w-0 flex-1 pt-12 md:ml-[232px] md:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                Leads
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Todos los negocios detectados y su estado de contacto.
              </p>
            </div>
          </header>
          <LeadsView
            initialPage={{ leads, total: leads.length, nextCursor: null }}
            tags={TAGS}
            today={todayISO()}
            createdDates={["2026-08-01", "2026-08-03", todayISO()]}
            initialOpenLead={null}
            templates={[]}
          />
        </div>
      </main>
    </div>
  );
}
