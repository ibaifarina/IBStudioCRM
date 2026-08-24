import { AppSidebar } from "@/components/app-sidebar";
import { LeadsView } from "@/components/leads-view";
import { todayISO } from "@/lib/dates";
import { calculateLeadScore } from "@/lib/lead-scoring";
import type { LeadWithTags } from "@/lib/types";

const TAGS = [
  { id: 1, name: "Restaurante", color: "#2563eb" },
  { id: 2, name: "Peluquería", color: "#db2777" },
  { id: 3, name: "Gimnasio", color: "#059669" },
];

const TEMPLATES = [
  {
    id: 1,
    name: "Primer contacto",
    icon: "user-round",
    content:
      "Hola [nombre], he visto vuestro negocio y creo que podemos ayudaros con [servicio]. ¿Te apetece que lo comentemos?",
    createdAt: "2026-08-19T09:00:00.000Z",
    updatedAt: "2026-08-19T09:00:00.000Z",
  },
];

function lead(
  partial: Partial<LeadWithTags> & Pick<LeadWithTags, "id" | "name">
): LeadWithTags {
  const value: LeadWithTags = {
    instagram: null,
    facebook: null,
    website: null,
    websiteStatus: "sin_revisar",
    phone: null,
    email: null,
    address: null,
    lat: null,
    lng: null,
    problem: null,
    notes: null,
    status: "por_contactar",
    statuses: ["por_contactar"],
    contactedAt: null,
    repliedAt: null,
    lastContactAt: null,
    lastOutboundAt: null,
    lastInboundAt: null,
    contactChannel: null,
    nextAction: "contactar",
    nextActionAt: null,
    source: "manual",
    googlePlaceId: null,
    businessCategories: [],
    rating: null,
    reviewCount: null,
    socialLinks: [],
    digitalPresenceKnown: false,
    leadScore: 0,
    scoreBreakdown: {
      reputation: { score: 0, reviews: 0, rating: null, model: "WITHOUT_RATING" },
      webOpportunity: 15,
      digitalMaturity: 0,
      sectorPerformance: 8,
      contactability: 0,
      locationFit: 3,
      penalties: 8,
      websiteClassification: "NONE",
      location: "Ubicación neutral",
      sector: "Sin etiqueta",
      reasons: ["Web todavía sin revisar", "Sin etiqueta"],
      details: [],
    },
    scoreConfidence: 0,
    scoreVersion: 2,
    contactDate: null,
    followUpDate: null,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    recentActivities: [],
    hasMoreActivity: false,
    tags: [],
    ...partial,
  };
  return {
    ...value,
    ...calculateLeadScore({
      ...value,
      tags: value.tags,
    }),
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
    businessCategories: ["Restaurante"],
    reviewCount: 80,
    rating: 4.6,
    status: "contactado",
    statuses: ["contactado"],
    contactedAt: "2026-08-14T09:00:00.000Z",
    lastContactAt: "2026-08-14T09:00:00.000Z",
    lastOutboundAt: "2026-08-14T09:00:00.000Z",
    contactChannel: "whatsapp",
    nextAction: "hacer_follow_up",
    nextActionAt: "2026-08-18T09:00:00.000Z",
    contactDate: "2026-08-14",
    followUpDate: "2026-08-18",
    notes:
      "Interesados en renovar la web y añadir reservas online. Prefieren llamadas por la mañana.",
    recentActivities: [
      {
        id: 12,
        leadId: 1,
        type: "followup_scheduled",
        occurredAt: "2026-08-20T09:00:00.000Z",
        metadata: { scheduled_at: "2026-08-18T09:00:00.000Z" },
        description: null,
        origin: "app",
        templateId: null,
      },
      {
        id: 11,
        leadId: 1,
        type: "contact_marked",
        occurredAt: "2026-08-14T09:00:00.000Z",
        metadata: { channel: "whatsapp" },
        description: null,
        origin: "manual",
        templateId: null,
      },
      {
        id: 10,
        leadId: 1,
        type: "lead_created",
        occurredAt: "2026-08-01T09:00:00.000Z",
        metadata: {},
        description: null,
        origin: "app",
        templateId: null,
      },
    ],
    tags: [TAGS[0]],
  }),
  lead({
    id: 2,
    name: "Gimnàs Rítmic Gràcia",
    instagram: "ritmic.gracia",
    website: "https://booksy.com/es-es/ritmic-gracia",
    websiteStatus: "no_tiene_web",
    phone: "+34 690 11 22 33",
    address: "Rambla d'Ègara, Terrassa",
    businessCategories: ["Pilates"],
    reviewCount: 80,
    rating: 4.7,
    digitalPresenceKnown: true,
    status: "respondio",
    statuses: ["respondio"],
    contactedAt: "2026-08-19T09:00:00.000Z",
    repliedAt: "2026-08-23T16:30:00.000Z",
    lastContactAt: "2026-08-23T16:30:00.000Z",
    lastInboundAt: "2026-08-23T16:30:00.000Z",
    contactChannel: "instagram",
    nextAction: "responder",
    nextActionAt: `${todayISO()}T09:00:00.000Z`,
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
    contactedAt: "2026-07-02T09:00:00.000Z",
    repliedAt: "2026-07-04T11:00:00.000Z",
    lastContactAt: "2026-07-04T11:00:00.000Z",
    contactChannel: "phone",
    nextAction: "sin_accion",
    contactDate: "2026-07-02",
    followUpDate: "2026-09-01",
    tags: [TAGS[1]],
  }),
  lead({
    id: 4,
    name: "Bar Marsella 1920",
    instagram: "barmarsella",
    websiteStatus: "sin_revisar",
    status: "por_contactar",
    statuses: ["por_contactar"],
    nextAction: "revisar_mas_tarde",
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
    nextAction: "contactar",
    nextActionAt: "2026-08-10T09:00:00.000Z",
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
            templates={TEMPLATES}
          />
        </div>
      </main>
    </div>
  );
}
