"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  AtSignIcon,
  CheckIcon,
  FileTextIcon,
  Loader2Icon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import { MessageTemplateFillForm } from "@/components/message-template-fill-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { leadTemplateValues } from "@/lib/message-templates";
import { markLeadContacted, trackTemplateUsage } from "@/lib/actions";
import type { ContactChannelKey } from "@/lib/config";
import { instagramUrl, whatsappMessageUrl } from "@/lib/lead-links";
import type { LeadWithTags, MessageTemplate } from "@/lib/types";
import { TemplateIcon } from "@/components/template-icon";

export function UseMessageTemplateDialog({
  lead,
  templates,
  open,
  onOpenChange,
  onLeadUpdated,
}: {
  lead: LeadWithTags;
  templates: MessageTemplate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated?: (lead: LeadWithTags) => void;
}) {
  const firstTemplate = templates[0];
  const [selectedId, setSelectedId] = useState<number | null>(
    firstTemplate?.id ?? null
  );
  const [channel, setChannel] = useState<Extract<ContactChannelKey, "whatsapp" | "instagram">>(
    lead.contactChannel === "instagram"
      ? "instagram"
      : lead.phone
        ? "whatsapp"
        : "instagram"
  );
  const [pending, startTransition] = useTransition();
  const contactRequestRef = useRef(false);
  const selected =
    templates.find((template) => template.id === selectedId) ?? firstTemplate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preparar mensaje para {lead.name}</DialogTitle>
          <DialogDescription>
            Elige una plantilla, completa sus variables y copia el resultado.
          </DialogDescription>
        </DialogHeader>

        {selected ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={channel} onValueChange={(value) => setChannel(value as typeof channel)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="whatsapp"><MessageCircleIcon />WhatsApp</SelectItem>
                    <SelectItem value="instagram"><AtSignIcon />Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plantilla</Label>
              <Select
                value={String(selected.id)}
                onValueChange={(value) => setSelectedId(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{selected.name}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={String(template.id)}>
                      <TemplateIcon name={template.icon} />
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            </div>

            <MessageTemplateFillForm
              key={`${lead.id}-${selected.id}`}
              content={selected.content}
              initialValues={leadTemplateValues(selected.content, lead)}
              onCopied={async () => {
                const result = await trackTemplateUsage({
                  leadId: lead.id,
                  templateId: selected.id,
                  channel,
                });
                if ("error" in result) toast.warning(result.error);
              }}
              secondaryAction={{
                label: channel === "whatsapp" ? "Abrir WhatsApp" : "Abrir Instagram",
                disabled:
                  channel === "whatsapp" ? !lead.phone : !lead.instagram,
                onClick: (output) => {
                  const url =
                    channel === "whatsapp" && lead.phone
                      ? whatsappMessageUrl(lead.phone, output)
                      : lead.instagram
                        ? instagramUrl(lead.instagram)
                        : null;
                  if (url) window.open(url, "_blank", "noopener,noreferrer");
                },
              }}
            />

            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-xs leading-5 text-muted-foreground">
                  Abrir o copiar no marca el mensaje como enviado. Registra el contacto solo cuando realmente lo hayas hecho.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || (channel === "whatsapp" ? !lead.phone : !lead.instagram)}
                  onClick={() => startTransition(async () => {
                    if (contactRequestRef.current) return;
                    contactRequestRef.current = true;
                    try {
                      const result = await markLeadContacted(lead.id, channel);
                      if ("error" in result) {
                        toast.error(result.error);
                        return;
                      }
                      onLeadUpdated?.(result);
                      toast.success("Contacto registrado");
                    } finally {
                      contactRequestRef.current = false;
                    }
                  })}
                >
                  {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
                  Marcar como contactado
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                render={<Link href="/plantillas" />}
              >
                <FileTextIcon />
                Gestionar plantillas
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
            <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <MessageSquareTextIcon className="size-5" />
            </span>
            <p className="text-sm font-medium">Todavía no tienes plantillas</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              Crea una y usa variables como [nombre] para personalizar cada mensaje.
            </p>
            <Button
              nativeButton={false}
              className="mt-4"
              size="sm"
              render={<Link href="/plantillas" />}
            >
              <PlusIcon />
              Crear plantilla
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
