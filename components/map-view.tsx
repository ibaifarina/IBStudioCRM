"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2Icon, MapPinOffIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { locateGoogleMapsLinks } from "@/lib/actions";
import { STATUSES, type StatusKey } from "@/lib/config";
import { isNextActionOverdue } from "@/lib/dates";
import { isGoogleMapsShortUrl } from "@/lib/parse";
import type { LeadWithTags } from "@/lib/types";
import { cn } from "@/lib/utils";

const LeadsMap = dynamic(() => import("@/components/leads-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

export function MapView({ leads }: { leads: LeadWithTags[] }) {
  const [hidden, setHidden] = useState<Set<StatusKey>>(new Set());
  const [operationalFilter, setOperationalFilter] = useState<
    "follow_up" | "overdue" | null
  >(null);
  const [isLocating, startLocating] = useTransition();
  const lastRequestedLinks = useRef("");

  const located = useMemo(
    () => leads.filter((l) => l.lat != null && l.lng != null),
    [leads]
  );
  const unlocated = useMemo(
    () => leads.filter((l) => l.lat == null || l.lng == null),
    [leads]
  );
  const unresolvedMapLinks = useMemo(
    () =>
      unlocated
        .filter((lead) => lead.address && isGoogleMapsShortUrl(lead.address))
        .map((lead) => lead.id)
        .sort((a, b) => a - b)
        .join(","),
    [unlocated]
  );

  useEffect(() => {
    if (
      !unresolvedMapLinks ||
      lastRequestedLinks.current === unresolvedMapLinks
    ) {
      return;
    }

    lastRequestedLinks.current = unresolvedMapLinks;
    startLocating(async () => {
      await locateGoogleMapsLinks();
    });
  }, [unresolvedMapLinks]);

  const visible = located.filter((lead) => {
    if (hidden.has(lead.status)) return false;
    if (operationalFilter === "follow_up") {
      return lead.nextAction === "hacer_follow_up";
    }
    if (operationalFilter === "overdue") {
      return isNextActionOverdue(lead.nextAction, lead.nextActionAt);
    }
    return true;
  });

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
          const count = located.filter((lead) => lead.status === s.value).length;
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
        {[
          { key: "follow_up" as const, label: "Follow-up pendiente" },
          { key: "overdue" as const, label: "Acción vencida" },
        ].map((filter) => {
          const active = operationalFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setOperationalFilter((current) =>
                  current === filter.key ? null : filter.key
                )
              }
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? filter.key === "overdue"
                    ? "border-destructive/35 bg-destructive/10 text-destructive"
                    : "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {filter.label}
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
          {isLocating ? (
            <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
          ) : (
            <MapPinOffIcon className="size-3.5 shrink-0" />
          )}
          {isLocating ? "Ubicando enlaces de Maps…" : "Sin ubicación:"}
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
