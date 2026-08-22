"use client";

import {
  AtSignIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MapPinIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  PencilIcon,
  PhoneIcon,
  StickyNoteIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusSelect } from "@/components/status-badge";
import { TagBadge } from "@/components/tag-badge";
import { WebsiteStatusBadge } from "@/components/website-status-badge";
import type { StatusKey } from "@/lib/config";
import { instagramUrl, mapsUrl, whatsappUrl } from "@/lib/lead-links";
import { formatDate, isFollowUpOverdue } from "@/lib/dates";
import type { LeadWithTags } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONES = {
  instagram: "#d6249f",
  web: "#2563eb",
  phone: "#0d9488",
  whatsapp: "#16a34a",
  map: "#7c3aed",
} as const;

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      <Icon className="size-3" aria-hidden />
      {children}
    </p>
  );
}

function ChannelTile({
  label,
  icon: Icon,
  tone,
  href,
  value,
  tel,
}: {
  label: string;
  icon: LucideIcon;
  tone?: string;
  href?: string;
  value?: string | null;
  tel?: boolean;
}) {
  const empty = !value;

  const body = (
    <>
      <Icon
        className={cn("size-5 shrink-0", empty && "text-muted-foreground/40")}
        style={empty ? undefined : { color: tone ?? TONES.web }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "block truncate text-sm font-medium",
            empty && "text-muted-foreground/50"
          )}
        >
          {value ?? "Sin dato"}
        </span>
      </span>
      {!empty && !tel && (
        <ExternalLinkIcon
          className="size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover/tile:text-foreground/60"
          aria-hidden
        />
      )}
    </>
  );

  const className = cn(
    "group/tile flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
    empty
      ? "border border-dashed opacity-75"
      : "border bg-card hover:border-foreground/15 hover:bg-muted/40"
  );

  if (empty) return <div className={className}>{body}</div>;

  return (
    <a
      href={href}
      {...(tel ? {} : { target: "_blank", rel: "noreferrer" })}
      className={className}
    >
      {body}
    </a>
  );
}

function InfoLine({
  icon: Icon,
  label,
  children,
  color,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <Icon
        className={cn("size-4 shrink-0", !color && "text-muted-foreground")}
        style={color ? { color } : undefined}
        aria-hidden
      />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="ml-auto flex min-w-0 items-center justify-end gap-1.5 text-sm font-medium tabular-nums">
        {children}
      </span>
    </div>
  );
}

export function LeadDetailsModal({
  lead,
  onClose,
  onEdit,
  onDelete,
  onUseTemplate,
  onStatusChange,
}: {
  lead: LeadWithTags | null;
  onClose: () => void;
  onEdit: (lead: LeadWithTags) => void;
  onDelete: (lead: LeadWithTags) => void;
  onUseTemplate: (lead: LeadWithTags) => void;
  onStatusChange: (
    leadId: number,
    statuses: StatusKey[],
    contactDate: string | null
  ) => void;
}) {
  const followUpOverdue = lead
    ? isFollowUpOverdue(lead.followUpDate, lead.statuses)
    : false;

  return (
    <Dialog open={lead != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {lead && (
          <>
            <div className="relative shrink-0 overflow-hidden border-b bg-muted/40">
              <div className="relative flex items-center gap-3.5 px-5 pt-5 pr-14">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="font-heading text-lg leading-tight break-words">
                    {lead.name}
                  </DialogTitle>
                  {lead.instagram && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      @{lead.instagram}
                    </p>
                  )}
                </div>
              </div>
              <DialogDescription className="sr-only">
                Detalle del lead
              </DialogDescription>
              <div className="relative flex flex-wrap items-center gap-1.5 px-5 py-3.5">
                <StatusSelect
                  leadId={lead.id}
                  statuses={lead.statuses}
                  onStatusesChange={(statuses, contactDate) =>
                    onStatusChange(lead.id, statuses, contactDate)
                  }
                />
                <WebsiteStatusBadge status={lead.websiteStatus} />
                {lead.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
              <section>
                <SectionLabel icon={AtSignIcon}>Contacto</SectionLabel>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ChannelTile
                    label="Instagram"
                    icon={AtSignIcon}
                    tone={TONES.instagram}
                    href={lead.instagram ? instagramUrl(lead.instagram) : undefined}
                    value={lead.instagram ? `@${lead.instagram}` : null}
                  />
                  <ChannelTile
                    label="Web"
                    icon={GlobeIcon}
                    tone={TONES.web}
                    href={lead.website ?? undefined}
                    value={lead.website}
                  />
                  <ChannelTile
                    label="Teléfono"
                    icon={PhoneIcon}
                    tone={TONES.phone}
                    href={lead.phone ? `tel:${lead.phone}` : undefined}
                    value={lead.phone}
                    tel
                  />
                  <ChannelTile
                    label="WhatsApp"
                    icon={MessageCircleIcon}
                    tone={TONES.whatsapp}
                    href={lead.phone ? whatsappUrl(lead.phone) : undefined}
                    value={lead.phone}
                  />
                </div>
              </section>

              <section>
                <SectionLabel icon={CalendarClockIcon}>Seguimiento</SectionLabel>
                <div className="divide-y overflow-hidden rounded-xl border bg-card">
                  <InfoLine icon={CalendarDaysIcon} label="Último contacto">
                    {formatDate(lead.contactDate)}
                  </InfoLine>
                  <InfoLine
                    icon={CalendarClockIcon}
                    label="Follow-up"
                    color={followUpOverdue ? "var(--destructive)" : undefined}
                  >
                    <span className={cn(followUpOverdue && "font-semibold text-destructive")}>
                      {formatDate(lead.followUpDate)}
                    </span>
                    {followUpOverdue && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase dark:bg-destructive/15">
                        Vencido
                      </span>
                    )}
                  </InfoLine>
                  <InfoLine icon={MapPinIcon} label="Dirección">
                    <a
                      href={mapsUrl(lead)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full min-w-0 items-center gap-1 font-normal hover:underline"
                    >
                      <span className="truncate font-medium">
                        {lead.address ?? "Ver en Maps"}
                      </span>
                      <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground/50" />
                    </a>
                  </InfoLine>
                </div>
              </section>

              {(lead.notes?.trim() || lead.problem?.trim()) && (
                <section>
                  <SectionLabel icon={StickyNoteIcon}>Notas</SectionLabel>
                  <div className="rounded-xl border bg-muted/40 p-3.5">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {lead.notes?.trim() || lead.problem}
                    </p>
                  </div>
                </section>
              )}
            </div>

            <div className="shrink-0 border-t bg-card p-4">
              <div className="flex items-center gap-2">
                <Button onClick={() => onUseTemplate(lead)} className="flex-1">
                  <MessageSquareTextIcon />
                  Mensaje
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onEdit(lead)}
                  className="flex-1"
                >
                  <PencilIcon />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => onDelete(lead)}
                  aria-label="Eliminar lead"
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
