"use client";

import { useTransition } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { setLeadNextAction } from "@/lib/actions";
import {
  NEXT_ACTION_MAP,
  NEXT_ACTIONS,
  type NextActionKey,
} from "@/lib/config";
import { cn } from "@/lib/utils";

export function NextActionDot({
  action,
  className,
}: {
  action: string;
  className?: string;
}) {
  const info = NEXT_ACTION_MAP[action as NextActionKey];
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: info?.color ?? "#94a3b8" }}
    />
  );
}

export function NextActionBadge({
  action,
  className,
}: {
  action: NextActionKey;
  className?: string;
}) {
  const info = NEXT_ACTION_MAP[action];
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
      <NextActionDot action={action} />
      {info.label}
    </span>
  );
}

export function NextActionPicker({
  action,
  onChange,
  disabled,
  className,
}: {
  action: NextActionKey;
  onChange: (action: NextActionKey) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "inline-flex min-h-8 max-w-full items-center gap-1 rounded-lg border border-input px-1.5 py-1 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <NextActionBadge action={action} />
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
          Próxima acción
        </p>
        {NEXT_ACTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
            onClick={(event) => {
              event.stopPropagation();
              onChange(item.value);
            }}
          >
            <NextActionDot action={item.value} />
            <span className="flex-1">{item.label}</span>
            <CheckIcon className={cn("size-4", action !== item.value && "opacity-0")} />
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function NextActionSelect({
  leadId,
  action,
  actionAt,
  onActionChange,
}: {
  leadId: number;
  action: NextActionKey;
  actionAt: string | null;
  onActionChange?: (action: NextActionKey, actionAt: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <NextActionPicker
      action={action}
      disabled={pending}
      className={cn("border-0 p-0 shadow-none", pending && "opacity-50")}
      onChange={(nextAction) => {
        startTransition(async () => {
          const result = await setLeadNextAction(leadId, nextAction, actionAt);
          if (result.error || !result.nextAction) {
            toast.error(result.error ?? "No se pudo cambiar la próxima acción.");
            return;
          }
          onActionChange?.(result.nextAction, result.nextActionAt ?? null);
        });
      }}
    />
  );
}
