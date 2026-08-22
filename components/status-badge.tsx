"use client";

import { useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { showContactDateNoticeToast } from "@/components/contact-date-notice";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { setLeadStatuses } from "@/lib/actions";
import {
  normalizeLeadStatuses,
  STATUSES,
  STATUS_MAP,
  type StatusKey,
} from "@/lib/config";
import { cn } from "@/lib/utils";

export function StatusDot({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const color = STATUS_MAP[status as StatusKey]?.color ?? "#78716c";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center",
        className
      )}
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const info = STATUS_MAP[status as StatusKey];
  if (!info) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        className
      )}
      style={{
        color: info.color,
        backgroundColor: `${info.color}14`,
        borderColor: `${info.color}38`,
      }}
    >
      <StatusDot status={status} />
      {info.label}
    </span>
  );
}

export function StatusBadges({
  statuses,
  className,
}: {
  statuses: readonly string[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {normalizeLeadStatuses(statuses).map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </span>
  );
}

export function StatusPicker({
  statuses,
  onChange,
  disabled,
  className,
}: {
  statuses: readonly string[];
  onChange: (statuses: StatusKey[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const selected = normalizeLeadStatuses(statuses);

  const toggle = (status: StatusKey) => {
    if (selected.includes(status)) {
      if (selected.length === 1) {
        toast.warning("Cada lead debe tener al menos un estado.");
        return;
      }
      onChange(selected.filter((item) => item !== status));
      return;
    }
    onChange([...selected, status]);
  };

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "flex min-h-8 max-w-full cursor-pointer items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <StatusBadges statuses={selected} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-1 p-1.5">
        <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
          Puedes seleccionar varios estados
        </p>
        {STATUSES.map((status) => {
          const checked = selected.includes(status.value);
          return (
            <button
              key={status.value}
              type="button"
              role="checkbox"
              aria-checked={checked}
              className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
              onClick={(event) => {
                event.stopPropagation();
                toggle(status.value);
              }}
            >
              <StatusDot status={status.value} />
              <span className="flex-1">{status.label}</span>
              <CheckIcon
                className={cn("size-4", !checked && "opacity-0")}
              />
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/** Selector de estados que guarda el cambio inmediatamente. */
export function StatusSelect({
  leadId,
  statuses,
  onStatusesChange,
}: {
  leadId: number;
  statuses: readonly string[];
  onStatusesChange?: (
    statuses: StatusKey[],
    contactDate: string | null
  ) => void;
}) {
  const [pending, startTransition] = useTransition();
  const selected = normalizeLeadStatuses(statuses);

  return (
    <StatusPicker
      statuses={selected}
      disabled={pending}
      className={cn("border-0 p-0 shadow-none", pending && "opacity-50")}
      onChange={(nextStatuses) => {
        startTransition(async () => {
          const result = await setLeadStatuses(leadId, nextStatuses);
          if (result.error || !result.statuses) {
            toast.error(result.error ?? "No se pudieron cambiar los estados.");
            return;
          }
          onStatusesChange?.(result.statuses, result.contactDate ?? null);
          if (
            result.statuses.includes("contactado") &&
            !selected.includes("contactado")
          ) {
            showContactDateNoticeToast();
          }
        });
      }}
    />
  );
}
