"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AtSignIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  MapPinIcon,
  PhoneIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  ContactDateNotice,
  shouldShowContactDateNotice,
} from "@/components/contact-date-notice";
import { DateField } from "@/components/date-field";
import { StatusPicker } from "@/components/status-badge";
import { TagPicker } from "@/components/tag-picker";
import { WebsiteStatusDot } from "@/components/website-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { geocodeAddress, saveLead } from "@/lib/actions";
import {
  areStatusesUncontacted,
  WEBSITE_STATUSES,
  type StatusKey,
  type WebsiteStatusKey,
} from "@/lib/config";
import { todayISO } from "@/lib/dates";
import {
  googleMapsLeadToFormData,
  type GoogleMapsLead,
} from "@/lib/google-maps-lead";
import { parseInstagramUsername, parseMapsCoordinates } from "@/lib/parse";
import type { GeocodeResult, LeadWithTags, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  instagram: string;
  website: string;
  websiteStatus: WebsiteStatusKey;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  statuses: StatusKey[];
  contactDate: string;
  followUpDate: string;
  tags: Tag[];
};

function fromLead(lead: LeadWithTags): FormState {
  // Si solo hay "problema" antiguo, lo mostramos en notas.
  const notes =
    lead.notes?.trim() || lead.problem?.trim() || "";
  return {
    name: lead.name,
    instagram: lead.instagram ?? "",
    website: lead.website ?? "",
    websiteStatus: lead.websiteStatus,
    phone: lead.phone ?? "",
    address: lead.address ?? "",
    lat: lead.lat,
    lng: lead.lng,
    notes,
    statuses: lead.statuses,
    contactDate:
      lead.contactDate ??
      (!areStatusesUncontacted(lead.statuses) ? todayISO() : ""),
    followUpDate: lead.followUpDate ?? "",
    tags: lead.tags,
  };
}

function addDays(base: string, days: number): string {
  const d = new Date(`${base || todayISO()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  const today = todayISO();
  return {
    name: "",
    instagram: "",
    website: "",
    websiteStatus: "sin_revisar",
    phone: "",
    address: "",
    lat: null,
    lng: null,
    notes: "",
    statuses: ["por_contactar"],
    contactDate: today,
    followUpDate: addDays(today, 7),
    tags: [],
  };
}

const WEBSITE_STATUS_ITEMS = WEBSITE_STATUSES.map((status) => ({
  value: status.value,
  label: status.label,
}));

const NO_AUTOCOMPLETE = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
} as const;

const FIELD_LABEL_CLS = "text-xs font-medium text-muted-foreground";

function FieldSection({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
        {title}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function LeadDialog({
  open,
  onOpenChange,
  allTags,
  lead,
  importedMapsLead,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTags: Tag[];
  lead?: LeadWithTags | null;
  importedMapsLead?: GoogleMapsLead | null;
  onSaved?: (lead: LeadWithTags) => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [geoResults, setGeoResults] = useState<GeocodeResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [showContactDateNotice, setShowContactDateNotice] = useState(false);
  const [saving, startSaving] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(lead);

  const [prevOpen, setPrevOpen] = useState(false);
  const [prevImportedMapsLead, setPrevImportedMapsLead] =
    useState<GoogleMapsLead | null | undefined>(importedMapsLead);
  if (open !== prevOpen || importedMapsLead !== prevImportedMapsLead) {
    setPrevOpen(open);
    setPrevImportedMapsLead(importedMapsLead);
    if (open) {
      setForm(
        lead
          ? fromLead(lead)
          : importedMapsLead
            ? {
                ...emptyForm(),
                ...googleMapsLeadToFormData(importedMapsLead),
              }
            : emptyForm()
      );
      setGeoResults([]);
      setShowContactDateNotice(false);
      setAdvanced(
        Boolean(
          importedMapsLead ||
            (lead &&
              (lead.phone ||
                lead.website ||
                lead.websiteStatus !== "sin_revisar" ||
                lead.followUpDate ||
                !(
                  lead.statuses.length === 1 &&
                  lead.statuses[0] === "por_contactar"
                )))
        )
      );
    }
  }

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => nameRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleInstagramChange = (raw: string) => {
    set("instagram", parseInstagramUsername(raw));
  };

  const handleMapsChange = (raw: string) => {
    const coords = parseMapsCoordinates(raw);
    setForm((f) => ({
      ...f,
      address: raw,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    }));
  };

  const handleGeocode = async () => {
    if (!form.address.trim() || geoLoading) return;

    const coords = parseMapsCoordinates(form.address);
    if (coords) {
      setForm((f) => ({ ...f, lat: coords.lat, lng: coords.lng }));
      toast.success("Coordenadas detectadas del enlace");
      return;
    }

    setGeoLoading(true);
    const query = form.address.includes(",")
      ? form.address
      : `${form.address}, Barcelona`;
    const results = await geocodeAddress(query);
    setGeoResults(results);
    setGeoLoading(false);
    if (results.length === 0) {
      toast.warning("No se encontró la ubicación. Prueba un enlace o dirección más concreta.");
    }
  };

  const submit = (keepOpen: boolean) => {
    startSaving(async () => {
      const result = await saveLead({
        id: lead?.id,
        name: form.name,
        instagram: form.instagram,
        website: form.website,
        websiteStatus: form.websiteStatus,
        phone: form.phone,
        address: form.address,
        lat: form.lat,
        lng: form.lng,
        problem: null,
        notes: form.notes,
        statuses: form.statuses,
        contactDate: areStatusesUncontacted(form.statuses)
          ? ""
          : form.contactDate,
        followUpDate: form.followUpDate,
        tagIds: form.tags.map((t) => t.id),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      onSaved?.(result);
      toast.success(isEdit ? "Lead actualizado" : `Lead «${form.name}» creado`);
      if (keepOpen) {
        setForm(emptyForm());
        setGeoResults([]);
        setAdvanced(false);
        setShowContactDateNotice(false);
        nameRef.current?.focus();
      } else {
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 pr-14">
          <DialogTitle className="truncate text-base font-semibold tracking-tight">
            {isEdit ? `Editar ${lead?.name}` : "Nuevo lead"}
          </DialogTitle>
          <DialogDescription className="truncate text-xs">
            {isEdit
              ? "Actualiza la información del negocio."
              : "Solo el nombre es obligatorio. El resto es opcional."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
            <div className="grid gap-1.5">
              <Label htmlFor="lead-name" className={FIELD_LABEL_CLS}>
                Negocio <span className="text-brand">*</span>
              </Label>
              <Input
                id="lead-name"
                name="lead-negocio"
                ref={nameRef}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nombre del negocio"
                required
                {...NO_AUTOCOMPLETE}
              />
            </div>

            <section className="flex flex-col gap-3">
              <FieldSection title="Ubicación" />
              <div className="grid gap-1.5">
                <Label htmlFor="lead-maps" className={FIELD_LABEL_CLS}>
                  Enlace de Maps
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="lead-maps"
                    name="lead-maps"
                    value={form.address}
                    onChange={(e) => handleMapsChange(e.target.value)}
                    placeholder="URL de Google Maps o dirección"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleGeocode();
                      }
                    }}
                    {...NO_AUTOCOMPLETE}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGeocode}
                    disabled={geoLoading || !form.address.trim()}
                    className="shrink-0"
                    title="Localizar en el mapa"
                  >
                    {geoLoading ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <MapPinIcon />
                    )}
                  </Button>
                </div>
                {form.lat != null && form.lng != null && (
                  <p className="flex items-center gap-1.5 self-start rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
                    <CheckIcon className="size-3" />
                    Ubicado ({form.lat.toFixed(4)}, {form.lng.toFixed(4)})
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:opacity-70"
                      onClick={() => {
                        set("lat", null);
                        set("lng", null);
                      }}
                    >
                      quitar
                    </button>
                  </p>
                )}
                {geoResults.length > 0 && (
                  <div className="divide-y divide-border/60 overflow-hidden rounded-lg border bg-popover shadow-xs">
                    {geoResults.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        className="flex w-full items-center gap-2 truncate px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          setForm((f) => ({ ...f, lat: r.lat, lng: r.lng }));
                          setGeoResults([]);
                          toast.success("Ubicación fijada");
                        }}
                      >
                        <MapPinIcon className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{r.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <FieldSection title="Contacto" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="lead-instagram" className={FIELD_LABEL_CLS}>
                    Instagram
                  </Label>
                  <div className="relative">
                    <AtSignIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="lead-instagram"
                      name="lead-instagram"
                      className="pl-7"
                      value={form.instagram}
                      onChange={(e) => handleInstagramChange(e.target.value)}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text");
                        if (text && /instagram\.com/i.test(text)) {
                          e.preventDefault();
                          handleInstagramChange(text);
                        }
                      }}
                      placeholder="usuario o URL"
                      {...NO_AUTOCOMPLETE}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="lead-phone" className={FIELD_LABEL_CLS}>
                    Teléfono
                  </Label>
                  <div className="relative">
                    <PhoneIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="lead-phone"
                      name="lead-phone"
                      className="pl-7"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="+34 …"
                      {...NO_AUTOCOMPLETE}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <FieldSection title="Detalles" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className={FIELD_LABEL_CLS}>Estado de la web</Label>
                  <Select
                    items={WEBSITE_STATUS_ITEMS}
                    value={form.websiteStatus}
                    onValueChange={(value) => {
                      if (typeof value === "string") {
                        set("websiteStatus", value as WebsiteStatusKey);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEBSITE_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <WebsiteStatusDot status={status.value} />
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label className={FIELD_LABEL_CLS}>Etiquetas</Label>
                  <TagPicker
                    allTags={allTags}
                    selected={form.tags}
                    onChange={(tags) => set("tags", tags)}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lead-notes" className={FIELD_LABEL_CLS}>
                  Notas
                </Label>
                <Textarea
                  id="lead-notes"
                  name="lead-notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Problema, ángulo de venta, próximos pasos…"
                  className="resize-none"
                  {...NO_AUTOCOMPLETE}
                />
              </div>
            </section>

            <button
              type="button"
              onClick={() => setAdvanced((v) => !v)}
              aria-expanded={advanced}
              className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ChevronDownIcon
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  advanced && "rotate-180"
                )}
              />
              {advanced ? "Ocultar opciones avanzadas" : "Más opciones"}
              {!advanced && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  estado, fechas, web…
                </span>
              )}
            </button>

            {advanced && (
              <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className={FIELD_LABEL_CLS}>Estados</Label>
                  <StatusPicker
                    statuses={form.statuses}
                    className="w-full"
                    onChange={(statuses) => {
                      const changedToContacted =
                        statuses.includes("contactado") &&
                        !form.statuses.includes("contactado");
                      setForm((current) => ({
                        ...current,
                        statuses,
                        contactDate:
                          areStatusesUncontacted(statuses)
                            ? ""
                            : changedToContacted || !current.contactDate
                              ? todayISO()
                              : current.contactDate,
                      }));
                      if (
                        changedToContacted &&
                        shouldShowContactDateNotice()
                      ) {
                        setShowContactDateNotice(true);
                      }
                    }}
                  />
                </div>

                {!areStatusesUncontacted(form.statuses) && (
                  <div className="grid gap-1.5">
                    <Label className={FIELD_LABEL_CLS}>
                      Fecha de contacto
                    </Label>
                    <DateField
                      value={form.contactDate}
                      onChange={(v) => set("contactDate", v)}
                    />
                  </div>
                )}

                {showContactDateNotice && (
                  <div className="sm:col-span-2">
                    <ContactDateNotice
                      onDismiss={() => setShowContactDateNotice(false)}
                    />
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label htmlFor="lead-website" className={FIELD_LABEL_CLS}>
                    URL de la web / Linktree
                  </Label>
                  <Input
                    id="lead-website"
                    name="lead-website"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://…"
                    {...NO_AUTOCOMPLETE}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className={FIELD_LABEL_CLS}>Follow-up</Label>
                  <DateField
                    value={form.followUpDate}
                    onChange={(v) => set("followUpDate", v)}
                  />
                  <div className="flex gap-1">
                    {[3, 7, 14].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        onClick={() =>
                          set("followUpDate", addDays(form.contactDate, d))
                        }
                      >
                        +{d} días
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t px-5 py-3.5">
            {!isEdit && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={saving}
                onClick={() => submit(true)}
              >
                Guardar y añadir otro
              </Button>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={saving}
              className="ml-auto"
            >
              {saving ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <CheckIcon />
              )}
              {isEdit ? "Guardar cambios" : "Guardar lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
