"use client";

import { useState, useTransition } from "react";
import {
  AtSignIcon,
  CalendarClockIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  HistoryIcon,
  Loader2Icon,
  MapPinIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  StickyNoteIcon,
  Trash2Icon,
  UserXIcon,
  type LucideIcon,
} from "lucide-react";
import { DateField } from "@/components/date-field";
import { NextActionPicker } from "@/components/next-action-badge";
import { StatusSelect } from "@/components/status-badge";
import { TagBadge } from "@/components/tag-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WebsiteStatusBadge } from "@/components/website-status-badge";
import {
  addLeadNote,
  loadLeadActivities,
  setLeadNextAction,
  setLeadStatus,
} from "@/lib/actions";
import {
  CONTACT_CHANNEL_MAP,
  NEXT_ACTION_MAP,
  type NextActionKey,
} from "@/lib/config";
import {
  dateInputToTimestamp,
  formatActionTiming,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  isNextActionOverdue,
  timestampToDateInput,
  todayISO,
} from "@/lib/dates";
import { leadActivityLabel } from "@/lib/lead-activity";
import { instagramUrl, mapsUrl } from "@/lib/lead-links";
import type { LeadActivity, LeadWithTags } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONES = {
  instagram: "#d6249f",
  web: "#2563eb",
  phone: "#0d9488",
  whatsapp: "#16a34a",
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
  onCopy,
  copied,
}: {
  label: string;
  icon: LucideIcon;
  tone: string;
  href?: string;
  value?: string | null;
  tel?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  const empty = !value;
  const body = (
    <>
      <Icon
        className={cn("size-5 shrink-0", empty && "text-muted-foreground/40")}
        style={empty ? undefined : { color: tone }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("block truncate text-sm font-medium", empty && "text-muted-foreground/50")}>
          {value ?? "Sin dato"}
        </span>
      </span>
      {!empty && onCopy ? (
        copied ? (
          <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <CopyIcon className="size-3.5 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
        )
      ) : !empty && !tel ? (
        <ExternalLinkIcon className="size-3.5 text-muted-foreground/40" />
      ) : null}
    </>
  );
  const className = cn(
    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
    empty ? "border border-dashed opacity-75" : "border bg-card hover:bg-muted/40"
  );
  return empty ? (
    <div className={className}>{body}</div>
  ) : onCopy ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className={className}
              onClick={onCopy}
              aria-label="Copiar número de WhatsApp"
              title={copied ? "Número copiado" : "Copiar número"}
            />
          }
        >
          {body}
        </TooltipTrigger>
        <TooltipContent>{copied ? "Número copiado" : "Copiar número"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <a
      href={href}
      {...(tel ? {} : { target: "_blank", rel: "noreferrer" })}
      className={className}
    >
      {body}
    </a>
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date || todayISO()}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function ActivityList({ activities }: { activities: LeadActivity[] }) {
  return (
    <ol className="divide-y overflow-hidden rounded-xl border bg-card">
      {activities.map((activity) => (
        <li key={activity.id} className="flex gap-3 px-3.5 py-2.5">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="block leading-5">{leadActivityLabel(activity)}</span>
            {activity.type === "note_added" && activity.description && (
              <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                {activity.description}
              </span>
            )}
          </span>
          <time
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
            dateTime={activity.occurredAt}
            title={formatDateTime(activity.occurredAt)}
          >
            {formatRelativeTime(activity.occurredAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}

export function LeadDetailsModal({
  lead,
  onClose,
  onEdit,
  onDelete,
  onUseTemplate,
  onLeadChange,
}: {
  lead: LeadWithTags | null;
  onClose: () => void;
  onEdit: (lead: LeadWithTags) => void;
  onDelete: (lead: LeadWithTags) => void;
  onUseTemplate: (lead: LeadWithTags) => void;
  onLeadChange: (lead: LeadWithTags) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [allActivities, setAllActivities] = useState<LeadActivity[] | null>(null);
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!lead) return null;

  const activities = allActivities ?? lead.recentActivities;
  const overdue = isNextActionOverdue(lead.nextAction, lead.nextActionAt);
  const actionInfo = NEXT_ACTION_MAP[lead.nextAction];
  const actionDate = timestampToDateInput(lead.nextActionAt);
  const actionTiming = formatActionTiming(lead.nextAction, lead.nextActionAt);
  const channelLabel = lead.contactChannel
    ? CONTACT_CHANNEL_MAP[lead.contactChannel]
    : "Contacto";

  const updateAction = (nextAction: NextActionKey, nextDate: string) => {
    startTransition(async () => {
      const nextActionAt =
        nextAction === "sin_accion" ? null : dateInputToTimestamp(nextDate);
      const result = await setLeadNextAction(lead.id, nextAction, nextActionAt);
      if (result.error || !result.nextAction) return;
      onLeadChange({
        ...lead,
        nextAction: result.nextAction,
        nextActionAt: result.nextActionAt ?? null,
        followUpDate: result.nextActionAt?.slice(0, 10) ?? null,
      });
    });
  };

  const copyWhatsappNumber = async () => {
    if (!lead.phone) return;
    try {
      await navigator.clipboard.writeText(lead.phone);
      setWhatsappCopied(true);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = lead.phone;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (copied) setWhatsappCopied(true);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="shrink-0 border-b bg-muted/40">
          <div className="flex items-center gap-3.5 px-5 pt-5 pr-14">
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-lg leading-tight break-words">{lead.name}</DialogTitle>
              {lead.instagram && <p className="mt-0.5 truncate text-xs text-muted-foreground">@{lead.instagram}</p>}
            </div>
          </div>
          <DialogDescription className="sr-only">Detalle del lead</DialogDescription>
          <div className="flex flex-wrap items-center gap-1.5 px-5 py-3.5">
            <StatusSelect
              leadId={lead.id}
              status={lead.status}
              onStatusChange={(result) =>
                onLeadChange({
                  ...lead,
                  status: result.status,
                  statuses: [result.status],
                  contactedAt: result.contactedAt,
                  contactDate: result.contactedAt?.slice(0, 10) ?? null,
                  repliedAt: result.repliedAt,
                  lastContactAt: result.lastContactAt,
                  nextAction: result.nextAction,
                  nextActionAt: result.nextActionAt,
                })
              }
            />
            <WebsiteStatusBadge status={lead.websiteStatus} />
            {lead.tags.map((tag) => <TagBadge key={tag.id} tag={tag} />)}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <section>
            <SectionLabel icon={CalendarClockIcon}>Próxima acción</SectionLabel>
            <div className={cn("rounded-xl border p-3.5", overdue ? "border-destructive/25 bg-destructive/[0.04]" : "bg-card")}>
              <div className="flex items-start gap-3">
                <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: actionInfo.color }} />
                <div className="min-w-0 flex-1">
                  <NextActionPicker action={lead.nextAction} disabled={pending} className="min-h-0 border-0 p-0 shadow-none" onChange={(action) => updateAction(action, actionDate)} />
                  <p className={cn("mt-1 text-xs text-muted-foreground", overdue && "font-medium text-destructive")}>
                    {lead.nextActionAt
                      ? `${formatDate(lead.nextActionAt)}${
                          overdue
                            ? " · Vencida"
                            : ["hoy", "mañana"].includes(actionTiming)
                              ? ` · ${actionTiming}`
                              : ""
                        }`
                      : lead.nextAction === "sin_accion"
                        ? "Nada pendiente"
                        : "Pendiente, sin fecha"}
                  </p>
                </div>
                {pending && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
              </div>
              {lead.nextAction !== "sin_accion" && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
                  <Button size="xs" variant="outline" onClick={() => updateAction("sin_accion", "")} disabled={pending}><CheckIcon />Hecho</Button>
                  <Button size="xs" variant="ghost" onClick={() => updateAction(lead.nextAction, addDays(actionDate, 3))} disabled={pending}>Posponer 3 días</Button>
                  <div className="ml-auto w-36">
                    <DateField value={actionDate} onChange={(date) => updateAction(lead.nextAction, date)} placeholder="Cambiar fecha" />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section>
            <SectionLabel icon={AtSignIcon}>Contacto</SectionLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ChannelTile label="Instagram" icon={AtSignIcon} tone={TONES.instagram} href={lead.instagram ? instagramUrl(lead.instagram) : undefined} value={lead.instagram ? `@${lead.instagram}` : null} />
              <ChannelTile label="Web" icon={GlobeIcon} tone={TONES.web} href={lead.website ?? undefined} value={lead.website} />
              <ChannelTile label="Teléfono" icon={PhoneIcon} tone={TONES.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} value={lead.phone} tel />
              <ChannelTile
                label="WhatsApp"
                icon={MessageCircleIcon}
                tone={TONES.whatsapp}
                value={lead.phone}
                onCopy={() => void copyWhatsappNumber()}
                copied={whatsappCopied}
              />
            </div>
          </section>

          <section>
            <SectionLabel icon={HistoryIcon}>Información</SectionLabel>
            <div className="divide-y overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-3 px-3.5 py-2.5">
                <CalendarClockIcon className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Último contacto</span>
                <span className="ml-auto text-right text-sm font-medium">
                  {lead.lastContactAt ? (
                    <><span className="block">{channelLabel} · {formatRelativeTime(lead.lastContactAt)}</span><span className="block text-[11px] font-normal text-muted-foreground">{formatDateTime(lead.lastContactAt)}</span></>
                  ) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-3 px-3.5 py-2.5">
                <MapPinIcon className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Dirección</span>
                <a href={mapsUrl(lead)} target="_blank" rel="noreferrer" className="ml-auto inline-flex min-w-0 items-center gap-1 text-sm font-medium hover:underline">
                  <span className="max-w-56 truncate">{lead.address ?? "Ver en Maps"}</span><ExternalLinkIcon className="size-3" />
                </a>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <SectionLabel icon={HistoryIcon}>Actividad</SectionLabel>
              {(lead.hasMoreActivity || allActivities) && (
                <button type="button" className="text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => {
                  if (allActivities) { setAllActivities(null); return; }
                  startTransition(async () => {
                    const result = await loadLeadActivities(lead.id);
                    if (Array.isArray(result)) setAllActivities(result);
                  });
                }}>{allActivities ? "Ver menos" : "Ver toda la actividad"}</button>
              )}
            </div>
            {activities.length > 0 ? <ActivityList activities={activities} /> : <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">La actividad aparecerá aquí.</p>}
          </section>

          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <SectionLabel icon={StickyNoteIcon}>Notas</SectionLabel>
              <button type="button" onClick={() => setNoteOpen((value) => !value)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"><PlusIcon className="size-3" />Añadir nota</button>
            </div>
            {lead.notes?.trim() ? <div className="rounded-xl border bg-muted/40 p-3.5 text-sm leading-relaxed whitespace-pre-wrap">{lead.notes}</div> : !noteOpen ? <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Sin notas todavía.</p> : null}
            {noteOpen && (
              <div className="mt-2 space-y-2">
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Escribe una nota breve…" className="resize-none" />
                <div className="flex justify-end gap-2">
                  <Button size="xs" variant="ghost" onClick={() => { setNoteOpen(false); setNote(""); }}>Cancelar</Button>
                  <Button size="xs" disabled={!note.trim() || pending} onClick={() => startTransition(async () => {
                    const result = await addLeadNote(lead.id, note);
                    if ("error" in result) return;
                    onLeadChange({ ...lead, notes: result.notes, recentActivities: [result.activity, ...lead.recentActivities].slice(0, 5) });
                    setAllActivities((current) => current ? [result.activity, ...current] : current);
                    setNote("");
                    setNoteOpen(false);
                  })}>Guardar nota</Button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="shrink-0 border-t bg-card p-4">
          <div className="flex items-center gap-2">
            <Button onClick={() => onUseTemplate(lead)} className="flex-1"><MessageSquareTextIcon />Mensaje</Button>
            <Button variant="outline" onClick={() => onEdit(lead)} className="flex-1"><PencilIcon />Editar</Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones" />}><MoreHorizontalIcon /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onEdit(lead)}><PencilIcon />Editar</DropdownMenuItem>
                {lead.status !== "descartado" && (
                  <DropdownMenuItem onClick={() => startTransition(async () => {
                    const result = await setLeadStatus(lead.id, "descartado");
                    if (!result.error && result.status && result.nextAction) onLeadChange({ ...lead, status: result.status, statuses: [result.status], nextAction: result.nextAction, nextActionAt: null });
                  })}><UserXIcon />Descartar</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(lead)}><Trash2Icon />Eliminar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
