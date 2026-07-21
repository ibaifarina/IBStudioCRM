"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPinOffIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUSES, type StatusKey } from "@/lib/config";
import type { LeadWithTags } from "@/lib/types";
import { cn } from "@/lib/utils";

const LeadsMap = dynamic(() => import("@/components/leads-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

export function MapView({ leads }: { leads: LeadWithTags[] }) {
  const [hidden, setHidden] = useState<Set<StatusKey>>(new Set());

  const located = useMemo(
    () => leads.filter((l) => l.lat != null && l.lng != null),
    [leads]
  );
  const unlocated = useMemo(
    () => leads.filter((l) => l.lat == null || l.lng == null),
    [leads]
  );

  const visible = located.filter(
    (l) => !hidden.has(l.status as StatusKey)
  );

  const toggle = (status: StatusKey) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUSES.map((s) => {
          const count = located.filter((l) => l.status === s.value).length;
          const off = hidden.has(s.value);
          return (
            <button
              key={s.value}
              onClick={() => toggle(s.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                off
                  ? "border-border bg-transparent text-muted-foreground opacity-50"
                  : "shadow-xs"
              )}
              style={
                off
                  ? undefined
                  : {
                      color: s.color,
                      backgroundColor: `${s.color}14`,
                      borderColor: `${s.color}38`,
                    }
              }
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: off ? "#a8a29e" : s.color }}
              />
              {s.label}
              <span className="opacity-70">{count}</span>
            </button>
          );
        })}
        <span className="ml-auto text-sm text-muted-foreground">
          {visible.length} en el mapa
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border shadow-xs">
        <LeadsMap leads={visible} />
      </div>

      {unlocated.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <MapPinOffIcon className="size-3.5 shrink-0" />
          Sin ubicación:
          {unlocated.map((l) => (
            <Link
              key={l.id}
              href={`/leads?open=${l.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {l.name}
            </Link>
          ))}
          <span>— edítalos y usa «Localizar» para situarlos.</span>
        </div>
      )}
    </div>
  );
}
