"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AtSignIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  MapPinIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  ContactDateNotice,
  shouldShowContactDateNotice,
} from "@/components/contact-date-notice";
import { DateField } from "@/components/date-field";
import { StatusDot } from "@/components/status-badge";
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
  isUncontactedStatus,
  STATUSES,
  WEBSITE_STATUSES,
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
  status: string;
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
    status: lead.status,
    contactDate:
      lead.contactDate ?? (!isUncontactedStatus(lead.status) ? todayISO() : ""),
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
    status: "por_contactar",
    contactDate: today,
    followUpDate: addDays(today, 7),
    tags: [],
  };
}

const STATUS_ITEMS = STATUSES.map((s) => ({ value: s.value, label: s.label }));
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
                (lead.status && lead.status !== "por_contactar")))
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
        status: form.status,
        contactDate: isUncontactedStatus(form.status) ? "" : form.contactDate,
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
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEdit ? `Editar ${lead?.name}` : "Nuevo lead"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza la información del negocio."
              : "Solo el nombre es obligatorio. El resto es opcional."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3.5"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="lead-name">Negocio *</Label>
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

          <div className="grid gap-1.5">
            <Label htmlFor="lead-maps">Enlace de Maps</Label>
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
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckIcon className="size-3 text-emerald-600" />
                Ubicado ({form.lat.toFixed(4)}, {form.lng.toFixed(4)})
                <button
                  type="button"
                  className="ml-1 underline hover:text-foreground"
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
              <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-1.5">
                {geoResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    className="rounded-md px-2 py-1 text-left text-xs hover:bg-accent"
                    onClick={() => {
                      setForm((f) => ({ ...f, lat: r.lat, lng: r.lng }));
                      setGeoResults([]);
                      toast.success("Ubicación fijada");
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="lead-instagram">Instagram</Label>
            <div className="relative">
              <AtSignIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
            <Label>Estado de la web</Label>
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
            <Label>Etiquetas</Label>
            <TagPicker
              allTags={allTags}
              selected={form.tags}
              onChange={(tags) => set("tags", tags)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="lead-notes">Notas</Label>
            <Textarea
              id="lead-notes"
              name="lead-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Problema, ángulo de venta, próximos pasos…"
              {...NO_AUTOCOMPLETE}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="lead-phone">Teléfono</Label>
            <Input
              id="lead-phone"
              name="lead-phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+34 …"
              {...NO_AUTOCOMPLETE}
            />
          </div>

          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="flex w-full items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform",
                advanced && "rotate-180"
              )}
            />
            {advanced ? "Ocultar opciones avanzadas" : "Más opciones"}
            <span className="ml-auto text-xs opacity-70">
              estado, fechas, web…
            </span>
          </button>

          {advanced && (
            <div className="grid gap-3.5 border-t pt-3.5">
              <div className="grid gap-1.5">
                <Label>Estado</Label>
                <Select
                  items={STATUS_ITEMS}
                  value={form.status}
                  onValueChange={(v) => {
                    if (typeof v !== "string") return;
                    const changedToContacted =
                      v === "contactado" && form.status !== "contactado";
                    setForm((current) => ({
                      ...current,
                      status: v,
                      contactDate:
                        isUncontactedStatus(v)
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
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ITEMS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <StatusDot status={s.value} />
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isUncontactedStatus(form.status) && (
                <div className="grid gap-1.5">
                  <Label>Fecha de contacto</Label>
                  <DateField
                    value={form.contactDate}
                    onChange={(v) => set("contactDate", v)}
                  />
                </div>
              )}

              {showContactDateNotice && (
                <ContactDateNotice
                  onDismiss={() => setShowContactDateNotice(false)}
                />
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="lead-website">URL de la web / Linktree</Label>
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
                <Label>Follow-up</Label>
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

          <div className="mt-1 flex justify-end gap-2">
            {!isEdit && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => submit(true)}
              >
                Guardar y añadir otro
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />}
              {isEdit ? "Guardar cambios" : "Guardar lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
