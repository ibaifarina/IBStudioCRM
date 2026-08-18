"use client";

import { useTransition } from "react";
import { ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";
import { showContactDateNoticeToast } from "@/components/contact-date-notice";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLeadStatus } from "@/lib/actions";
import { STATUSES, STATUS_MAP, type StatusKey } from "@/lib/config";
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

/** Badge de estado clicable que despliega el resto de estados. */
export function StatusSelect({
  leadId,
  status,
  onStatusChange,
}: {
  leadId: number;
  status: string;
  onStatusChange?: (status: string, contactDate: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const info = STATUS_MAP[status as StatusKey];
  if (!info) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap transition-opacity outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
          pending && "opacity-50"
        )}
        style={{
          color: info.color,
          backgroundColor: `${info.color}14`,
          borderColor: `${info.color}38`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <StatusDot status={status} />
        {info.label}
        <ChevronDownIcon className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={(e) => {
              e.stopPropagation();
              startTransition(async () => {
                const result = await setLeadStatus(leadId, s.value);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                onStatusChange?.(s.value, result.contactDate ?? null);
                if (s.value === "contactado" && status !== "contactado") {
                  showContactDateNoticeToast();
                }
              });
            }}
          >
            <StatusDot status={s.value} />
            {s.label}
            {s.value === status && (
              <span className="ml-auto text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
