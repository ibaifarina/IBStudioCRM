"use client";

import { InfoIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { LeadScoreBreakdown } from "@/lib/lead-scoring";
import { cn } from "@/lib/utils";

function scoreTone(score: number) {
  if (score >= 80) return "border-emerald-600/25 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400";
  if (score >= 60) return "border-sky-600/25 bg-sky-600/10 text-sky-700 dark:text-sky-400";
  if (score >= 40) return "border-amber-600/25 bg-amber-600/10 text-amber-700 dark:text-amber-400";
  return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-400";
}

export function LeadScoreBadge({
  score,
  confidence,
  breakdown,
  className,
}: {
  score: number;
  confidence: number;
  breakdown: LeadScoreBreakdown;
  className?: string;
}) {
  const tone = scoreTone(score);
  const details = [...breakdown.details]
    .filter((detail) => detail.points !== 0)
    .sort((left, right) => Math.abs(right.points) - Math.abs(left.points))
    .slice(0, 7);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex min-w-12 cursor-pointer items-center justify-center rounded-lg border px-2 py-1 text-sm font-semibold tabular-nums outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/40",
              tone,
              className
            )}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Lead Score ${score} de 100`}
          />
        }
      >
        <span className="leading-none">{score}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-2">
            <span className={cn("rounded-md border px-1.5 py-0.5 tabular-nums", tone)}>
              {score} / 100
            </span>
          </PopoverTitle>
          <PopoverDescription className="flex items-center gap-1">
            <InfoIcon className="size-3" /> Confianza {confidence}%
          </PopoverDescription>
        </PopoverHeader>
        <div className="divide-y rounded-md border">
          {details.map((detail, index) => (
            <div key={`${detail.label}-${index}`} className="flex items-start gap-3 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 flex-1 leading-5">{detail.label}</span>
              <span className={cn(
                "shrink-0 font-semibold tabular-nums",
                detail.points < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"
              )}>
                {detail.points > 0 ? "+" : ""}{detail.points}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
