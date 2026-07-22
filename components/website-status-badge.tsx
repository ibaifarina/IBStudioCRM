"use client";

import { useTransition } from "react";
import { ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLeadWebsiteStatus } from "@/lib/actions";
import {
  WEBSITE_STATUSES,
  WEBSITE_STATUS_MAP,
  type WebsiteStatusKey,
} from "@/lib/config";
import { cn } from "@/lib/utils";

export function WebsiteStatusDot({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const color =
    WEBSITE_STATUS_MAP[status as WebsiteStatusKey]?.color ?? "#64748b";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center",
        className
      )}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

export function WebsiteStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const info = WEBSITE_STATUS_MAP[status as WebsiteStatusKey];
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
      <WebsiteStatusDot status={status} />
      {info.label}
    </span>
  );
}

export function WebsiteStatusSelect({
  leadId,
  status,
}: {
  leadId: number;
  status: WebsiteStatusKey;
}) {
  const [pending, startTransition] = useTransition();
  const info = WEBSITE_STATUS_MAP[status];

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
        onClick={(event) => event.stopPropagation()}
      >
        <WebsiteStatusDot status={status} />
        {info.label}
        <ChevronDownIcon className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {WEBSITE_STATUSES.map((item) => (
          <DropdownMenuItem
            key={item.value}
            onClick={(event) => {
              event.stopPropagation();
              startTransition(async () => {
                const result = await setLeadWebsiteStatus(leadId, item.value);
                if (result.error) toast.error(result.error);
              });
            }}
          >
            <WebsiteStatusDot status={item.value} />
            {item.label}
            {item.value === status && (
              <span className="ml-auto text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
