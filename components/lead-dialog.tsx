"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AtSignIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  ContactDateNotice,
  shouldShowContactDateNotice,
} from "@/components/contact-date-notice";
import { DateField } from "@/components/date-field";
import { NextActionPicker } from "@/components/next-action-badge";
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
  CONTACT_CHANNELS,
  LEAD_SOURCES,
  defaultNextActionForStatus,
  WEBSITE_STATUSES,
  type ContactChannelKey,
  type LeadSourceKey,
  type NextActionKey,
  type StatusKey,
  type WebsiteStatusKey,
} from "@/lib/config";
import {
  dateInputToTimestamp,
  timestampToDateInput,
  todayISO,
} from "@/lib/dates";
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
  facebook: string;
  website: string;
  websiteStatus: WebsiteStatusKey;
  phone: string;
  email: string;
  address: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  status: StatusKey;
  contactedDate: string;
  contactChannel: ContactChannelKey | "";
  nextAction: NextActionKey;
  nextActionDate: string;
  source: LeadSourceKey;
  googlePlaceId: string;
  businessCategories: string[];
  rating: number | null;
  reviewCount: number | null;
  lastReviewAt: string;
  photoCount: number | null;
  socialLinks: string[];
  digitalPresenceKnown: boolean;
  openStatus: string;
  isPermanentlyClosed: boolean;
  isChain: boolean;
  tags: Tag[];
};

function fromLead(lead: LeadWithTags): FormState {
  // Si solo hay "problema" antiguo, lo mostramos en notas.
  const notes =
    lead.notes?.trim() || lead.problem?.trim() || "";
  return {
    name: lead.name,
    instagram: lead.instagram ?? "",
    facebook: lead.facebook ?? "",
    website: lead.website ?? "",
    websiteStatus: lead.websiteStatus,
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    address: lead.address ?? "",
    lat: lead.lat,
    lng: lead.lng,
    notes,
    status: lead.status,
    contactedDate: timestampToDateInput(lead.contactedAt),
    contactChannel: lead.contactChannel ?? "",
    nextAction: lead.nextAction,
    nextActionDate: timestampToDateInput(lead.nextActionAt),
    source: lead.source,
    googlePlaceId: lead.googlePlaceId ?? "",
    businessCategories: lead.businessCategories,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    lastReviewAt: timestampToDateInput(lead.lastReviewAt),
    photoCount: lead.photoCount,
    socialLinks: lead.socialLinks,
    digitalPresenceKnown: lead.digitalPresenceKnown,
    openStatus: lead.openStatus ?? "",
    isPermanentlyClosed: lead.isPermanentlyClosed,
    isChain: lead.isChain,
    tags: lead.tags,
  };
}

function addDays(base: string, days: number): string {
  const d = new Date(`${base || todayISO()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    name: "",
    instagram: "",
    facebook: "",
    website: "",
    websiteStatus: "sin_revisar",
    phone: "",
    email: "",
    address: "",
    lat: null,
    lng: null,
    notes: "",
    status: "por_contactar",
    contactedDate: "",
    contactChannel: "",
    nextAction: "contactar",
    nextActionDate: "",
    source: "manual",
    googlePlaceId: "",
    businessCategories: [],
    rating: null,
    reviewCount: null,
    lastReviewAt: "",
    photoCount: null,
    socialLinks: [],
    digitalPresenceKnown: false,
    openStatus: "",
    isPermanentlyClosed: false,
    isChain: false,
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
  const [duplicateWarning, setDuplicateWarning] = useState<
    import("@/lib/types").DuplicateWarning | null
  >(null);
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
                source: "google_maps",
              }
            : emptyForm()
      );
      setGeoResults([]);
      setShowContactDateNotice(false);
      setDuplicateWarning(null);
      setAdvanced(
        Boolean(
          importedMapsLead ||
            (lead &&
              (lead.phone ||
                lead.website ||
                lead.websiteStatus !== "sin_revisar" ||
                lead.nextActionAt ||
                !(
                  lead.status === "por_contactar" &&
                  lead.nextAction === "contactar"
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

  const submit = (keepOpen: boolean, allowDuplicate = false) => {
    startSaving(async () => {
      const result = await saveLead({
        id: lead?.id,
        name: form.name,
        instagram: form.instagram,
        facebook: form.facebook,
        website: form.website,
        websiteStatus: form.websiteStatus,
        phone: form.phone,
        email: form.email,
        address: form.address,
        lat: form.lat,
        lng: form.lng,
        problem: null,
        notes: form.notes,
        status: form.status,
        contactedAt: dateInputToTimestamp(form.contactedDate),
        contactChannel: form.contactChannel || null,
        nextAction: form.nextAction,
        nextActionAt: dateInputToTimestamp(form.nextActionDate),
        source: form.source,
        googlePlaceId: form.googlePlaceId,
        businessCategories: form.businessCategories,
        rating: form.rating,
        reviewCount: form.reviewCount,
        lastReviewAt: form.lastReviewAt
          ? `${form.lastReviewAt}T12:00:00.000Z`
          : null,
        photoCount: form.photoCount,
        socialLinks: form.socialLinks,
        digitalPresenceKnown: form.digitalPresenceKnown,
        openStatus: form.openStatus,
        isPermanentlyClosed: form.isPermanentlyClosed,
        isChain: form.isChain,
        tagIds: form.tags.map((t) => t.id),
        allowDuplicate,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if ("duplicate" in result) {
        setDuplicateWarning(result.duplicate);
        return;
      }

      onSaved?.(result);
      toast.success(isEdit ? "Lead actualizado" : `Lead «${form.name}» creado`);
      if (keepOpen) {
        setForm(emptyForm());
        setGeoResults([]);
        setAdvanced(false);
        setShowContactDateNotice(false);
        setDuplicateWarning(null);
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

                <div className="grid gap-1.5">
                  <Label htmlFor="lead-email" className={FIELD_LABEL_CLS}>
                    Email
                  </Label>
                  <div className="relative">
                    <MailIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="lead-email"
                      type="email"
                      className="pl-7"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="hola@negocio.es"
                      {...NO_AUTOCOMPLETE}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="lead-facebook" className={FIELD_LABEL_CLS}>
                    Facebook
                  </Label>
                  <Input
                    id="lead-facebook"
                    value={form.facebook}
                    onChange={(e) => set("facebook", e.target.value)}
                    placeholder="URL del perfil"
                    {...NO_AUTOCOMPLETE}
                  />
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
                  <Label className={FIELD_LABEL_CLS}>Estado comercial</Label>
                  <StatusPicker
                    status={form.status}
                    className="w-full"
                    onChange={(status) => {
                      const changedToContacted =
                        status === "contactado" &&
                        form.status === "por_contactar";
                      const previousDefault = defaultNextActionForStatus(form.status);
                      setForm((current) => ({
                        ...current,
                        status,
                        contactedDate:
                          changedToContacted && !current.contactedDate
                            ? todayISO()
                            : current.contactedDate,
                        nextAction:
                          status === "cliente" || status === "descartado"
                            ? "sin_accion"
                            : current.nextAction === previousDefault
                              ? defaultNextActionForStatus(status)
                              : current.nextAction,
                        nextActionDate:
                          status === "cliente" || status === "descartado"
                            ? ""
                            : current.nextActionDate,
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

                {form.contactedDate && (
                  <div className="grid gap-1.5">
                    <Label className={FIELD_LABEL_CLS}>
                      Fecha de contacto
                    </Label>
                    <DateField
                      value={form.contactedDate}
                      onChange={(v) => set("contactedDate", v)}
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

                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="lead-categories" className={FIELD_LABEL_CLS}>
                    Categorías del negocio
                  </Label>
                  <Input
                    id="lead-categories"
                    value={form.businessCategories.join(", ")}
                    onChange={(event) =>
                      set(
                        "businessCategories",
                        event.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder="Peluquería, centro de belleza…"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="lead-rating" className={FIELD_LABEL_CLS}>
                    Rating de Google
                  </Label>
                  <Input
                    id="lead-rating"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={form.rating ?? ""}
                    onChange={(event) =>
                      set("rating", event.target.value ? Number(event.target.value) : null)
                    }
                    placeholder="4,7"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="lead-reviews" className={FIELD_LABEL_CLS}>
                    Número de reseñas
                  </Label>
                  <Input
                    id="lead-reviews"
                    type="number"
                    min="0"
                    step="1"
                    value={form.reviewCount ?? ""}
                    onChange={(event) =>
                      set("reviewCount", event.target.value ? Number(event.target.value) : null)
                    }
                    placeholder="80"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className={FIELD_LABEL_CLS}>Última reseña</Label>
                  <DateField
                    value={form.lastReviewAt}
                    onChange={(value) => set("lastReviewAt", value)}
                  />
                </div>

                <div className="flex flex-col justify-end gap-2 rounded-lg border px-3 py-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isChain}
                      onChange={(event) => set("isChain", event.target.checked)}
                      className="size-4 accent-primary"
                    />
                    Franquicia o cadena confirmada
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isPermanentlyClosed}
                      onChange={(event) => set("isPermanentlyClosed", event.target.checked)}
                      className="size-4 accent-primary"
                    />
                    Cerrado permanentemente
                  </label>
                </div>

                <div className="grid gap-1.5">
                  <Label className={FIELD_LABEL_CLS}>Próxima acción</Label>
                  <NextActionPicker
                    action={form.nextAction}
                    className="w-full"
                    onChange={(nextAction) => {
                      set("nextAction", nextAction);
                      if (nextAction === "sin_accion") set("nextActionDate", "");
                    }}
                  />
                </div>

                {form.nextAction !== "sin_accion" && (
                  <div className="grid gap-1.5">
                    <Label className={FIELD_LABEL_CLS}>Fecha de la acción</Label>
                  <DateField
                    value={form.nextActionDate}
                    onChange={(v) => set("nextActionDate", v)}
                  />
                  <div className="flex gap-1">
                    {[3, 7, 14].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        onClick={() =>
                          set("nextActionDate", addDays(form.contactedDate, d))
                        }
                      >
                        +{d} días
                      </button>
                    ))}
                  </div>
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label className={FIELD_LABEL_CLS}>Canal de contacto</Label>
                  <Select
                    value={form.contactChannel || "none"}
                    onValueChange={(value) =>
                      set(
                        "contactChannel",
                        value === "none" ? "" : (value as ContactChannelKey)
                      )
                    }
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin especificar</SelectItem>
                      {CONTACT_CHANNELS.map((channel) => (
                        <SelectItem key={channel.value} value={channel.value}>
                          {channel.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label className={FIELD_LABEL_CLS}>Fuente</Label>
                  <Select
                    value={form.source}
                    onValueChange={(value) => set("source", value as LeadSourceKey)}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t px-5 py-3.5">
            {duplicateWarning && (
              <div className="mb-1 flex w-full flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <span className="min-w-0 flex-1">
                  Posible duplicado: <strong>{duplicateWarning.leadName}</strong> ya existe · {duplicateWarning.reason}.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={saving}
                  onClick={() => submit(false, true)}
                >
                  Crear de todos modos
                </Button>
              </div>
            )}
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
