import { MessageTemplatesView } from "@/components/message-templates-view";
import { getMessageTemplates } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MessageTemplatesPage() {
  const templates = await getMessageTemplates();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <MessageTemplatesView initialTemplates={templates} />
    </div>
  );
}
