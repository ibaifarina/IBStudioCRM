"use client";

import { useTransition } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";
import { showContactDateNoticeToast } from "@/components/contact-date-notice";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { setLeadStatus } from "@/lib/actions";
import {
  normalizeLeadStatus,
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
  status,
  onChange,
  disabled,
  className,
}: {
  status: string;
  onChange: (status: StatusKey) => void;
  disabled?: boolean;
  className?: string;
}) {
  const selected = normalizeLeadStatus(status);

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
        <StatusBadge status={selected} />
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-1 p-1.5">
        <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
          Estado comercial
        </p>
        {STATUSES.map((status) => {
          const checked = selected === status.value;
          return (
            <button
              key={status.value}
              type="button"
              role="checkbox"
              aria-checked={checked}
              className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
              onClick={(event) => {
                event.stopPropagation();
                onChange(status.value);
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
  status,
  onStatusChange,
}: {
  leadId: number;
  status: string;
  onStatusChange?: (result: {
    status: StatusKey;
    contactedAt: string | null;
    repliedAt: string | null;
    lastContactAt: string | null;
    nextAction: import("@/lib/config").NextActionKey;
    nextActionAt: string | null;
  }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const selected = normalizeLeadStatus(status);

  return (
    <StatusPicker
      status={selected}
      disabled={pending}
      className={cn("border-0 p-0 shadow-none", pending && "opacity-50")}
      onChange={(nextStatus) => {
        startTransition(async () => {
          const result = await setLeadStatus(leadId, nextStatus);
          if (
            result.error ||
            !result.status ||
            !result.nextAction
          ) {
            toast.error(result.error ?? "No se pudo cambiar el estado.");
            return;
          }
          onStatusChange?.({
            status: result.status,
            contactedAt: result.contactedAt ?? null,
            repliedAt: result.repliedAt ?? null,
            lastContactAt: result.lastContactAt ?? null,
            nextAction: result.nextAction,
            nextActionAt: result.nextActionAt ?? null,
          });
          if (result.status === "contactado" && selected === "por_contactar") {
            showContactDateNoticeToast();
          }
        });
      }}
    />
  );
}
