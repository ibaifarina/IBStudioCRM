import { AppSidebar } from "@/components/app-sidebar";
import { MessageTemplatesView } from "@/components/message-templates-view";
import type { MessageTemplate } from "@/lib/types";

const templates: MessageTemplate[] = [
  {
    id: 1,
    name: "Primer contacto",
    icon: "user-round",
    content:
      "Hola, [nombre].\n\nHe visto vuestro negocio y creo que podríamos ayudaros con [servicio].\n\n¿Te parece si hablamos esta semana?",
    createdAt: "2026-08-19T09:00:00.000Z",
    updatedAt: "2026-08-19T09:00:00.000Z",
  },
  {
    id: 2,
    name: "Seguimiento",
    icon: "send",
    content:
      "Hola, [nombre]. Solo quería dar seguimiento a mi mensaje anterior sobre [servicio]. ¿Has podido revisarlo?",
    createdAt: "2026-08-19T09:00:00.000Z",
    updatedAt: "2026-08-19T09:00:00.000Z",
  },
  {
    id: 3,
    name: "Propuesta web",
    icon: "file-signature",
    content:
      "Hola, [nombre]. Te comparto una propuesta inicial para renovar la web de [negocio].",
    createdAt: "2026-08-19T09:00:00.000Z",
    updatedAt: "2026-08-19T09:00:00.000Z",
  },
];

export default function TemplatePreviewPage() {
  return (
    <div className="flex min-h-svh">
      <AppSidebar email="ana@ibstudio.es" name="Ana Martínez" />
      <main className="paper-grain min-w-0 flex-1 pt-12 md:ml-[232px] md:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <MessageTemplatesView initialTemplates={templates} />
        </div>
      </main>
    </div>
  );
}
