"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { showContactDateNoticeToast } from "@/components/contact-date-notice";
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
  DialogFooter,
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
import { updateLeadsBulk } from "@/lib/actions";
import {
  WEBSITE_STATUSES,
  type NextActionKey,
  type StatusKey,
  type WebsiteStatusKey,
} from "@/lib/config";
import { dateInputToTimestamp } from "@/lib/dates";
import type { Tag } from "@/lib/types";

type TagMode = "add" | "remove" | "replace";

const TAG_MODE_LABELS: Record<TagMode, string> = {
  add: "Añadir a las existentes",
  remove: "Quitar de las existentes",
  replace: "Reemplazar todas",
};

function FieldToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}

export function BulkEditLeadsDialog({
  open,
  onOpenChange,
  leadIds,
  allTags,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: number[];
  allTags: Tag[];
  onUpdated: () => void;
}) {
  const [applyStatus, setApplyStatus] = useState(false);
  const [status, setStatus] = useState<StatusKey>("por_contactar");
  const [applyWebsiteStatus, setApplyWebsiteStatus] = useState(false);
  const [websiteStatus, setWebsiteStatus] =
    useState<WebsiteStatusKey>("sin_revisar");
  const [applyTags, setApplyTags] = useState(false);
  const [tagMode, setTagMode] = useState<TagMode>("add");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [applyNextAction, setApplyNextAction] = useState(false);
  const [nextAction, setNextAction] = useState<NextActionKey>("contactar");
  const [nextActionDate, setNextActionDate] = useState("");
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setApplyStatus(false);
    setStatus("por_contactar");
    setApplyWebsiteStatus(false);
    setWebsiteStatus("sin_revisar");
    setApplyTags(false);
    setTagMode("add");
    setSelectedTags([]);
    setApplyNextAction(false);
    setNextAction("contactar");
    setNextActionDate("");
  };

  const canSubmit =
    (applyStatus || applyWebsiteStatus || applyTags || applyNextAction) &&
    (!applyTags || tagMode === "replace" || selectedTags.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return;
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Editar {leadIds.length} {leadIds.length === 1 ? "lead" : "leads"}
          </DialogTitle>
          <DialogDescription>
            Activa solo los campos que quieras cambiar. Los demás se conservarán.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2 rounded-lg border p-3">
            <FieldToggle
              checked={applyStatus}
              onChange={setApplyStatus}
              label="Cambiar estado"
            />
            {applyStatus && (
              <StatusPicker
                status={status}
                onChange={setStatus}
                className="w-full"
              />
            )}
          </div>

          <div className="grid gap-2 rounded-lg border p-3">
            <FieldToggle
              checked={applyWebsiteStatus}
              onChange={setApplyWebsiteStatus}
              label="Cambiar estado de la web"
            />
            {applyWebsiteStatus && (
              <Select
                value={websiteStatus}
                onValueChange={(value) =>
                  setWebsiteStatus(value as WebsiteStatusKey)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <WebsiteStatusDot status={websiteStatus} />
                    {
                      WEBSITE_STATUSES.find(
                        (item) => item.value === websiteStatus
                      )?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {WEBSITE_STATUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      <WebsiteStatusDot status={item.value} />
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-2 rounded-lg border p-3">
            <FieldToggle
              checked={applyTags}
              onChange={setApplyTags}
              label="Cambiar etiquetas"
            />
            {applyTags && (
              <>
                <Select
                  value={tagMode}
                  onValueChange={(value) => setTagMode(value as TagMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{TAG_MODE_LABELS[tagMode]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {(Object.entries(TAG_MODE_LABELS) as [TagMode, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <TagPicker
                  allTags={allTags}
                  selected={selectedTags}
                  onChange={setSelectedTags}
                />
                {tagMode === "replace" && selectedTags.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Se quitarán todas las etiquetas de los leads seleccionados.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="grid gap-2 rounded-lg border p-3">
            <FieldToggle
              checked={applyNextAction}
              onChange={setApplyNextAction}
              label="Cambiar próxima acción"
            />
            {applyNextAction && (
              <>
                <NextActionPicker
                  action={nextAction}
                  onChange={setNextAction}
                  className="w-full"
                />
                {nextAction !== "sin_accion" && (
                  <>
                    <Label className="sr-only">Fecha de la próxima acción</Label>
                    <DateField
                      value={nextActionDate}
                      onChange={setNextActionDate}
                      placeholder="Pendiente, sin fecha"
                      showTodayButton
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit || pending}
            onClick={() => {
              startTransition(async () => {
                const result = await updateLeadsBulk({
                  leadIds,
                  ...(applyStatus ? { status } : {}),
                  ...(applyWebsiteStatus ? { websiteStatus } : {}),
                  ...(applyTags
                    ? {
                        tags: {
                          mode: tagMode,
                          tagIds: selectedTags.map((tag) => tag.id),
                        },
                      }
                    : {}),
                  ...(applyNextAction
                    ? {
                        nextAction,
                        nextActionAt:
                          nextAction === "sin_accion" || !nextActionDate
                            ? null
                            : dateInputToTimestamp(nextActionDate),
                      }
                    : {}),
                });

                if ("error" in result) {
                  toast.error(result.error);
                  return;
                }

                toast.success(
                  `${result.updated} ${result.updated === 1 ? "lead actualizado" : "leads actualizados"}`
                );
                if (applyStatus && status === "contactado") {
                  showContactDateNoticeToast();
                }
                reset();
                onOpenChange(false);
                onUpdated();
              });
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Aplicar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
