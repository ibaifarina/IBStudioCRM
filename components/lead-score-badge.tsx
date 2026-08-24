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
import { SCORE_GRADES } from "@/lib/lead-scoring-config";
import type { LeadGrade, LeadScoreBreakdown } from "@/lib/lead-scoring";
import { cn } from "@/lib/utils";

const GRADE_TONES: Record<LeadGrade, string> = {
  A: "border-emerald-600/25 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  B: "border-sky-600/25 bg-sky-600/10 text-sky-700 dark:text-sky-400",
  C: "border-amber-600/25 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  D: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

export function LeadScoreBadge({
  score,
  grade,
  confidence,
  breakdown,
  className,
}: {
  score: number;
  grade: LeadGrade;
  confidence: number;
  breakdown: LeadScoreBreakdown;
  className?: string;
}) {
  const gradeInfo = SCORE_GRADES.find((item) => item.grade === grade)!;
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
              "inline-flex min-w-[4.15rem] cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold tabular-nums outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/40",
              GRADE_TONES[grade],
              className
            )}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Lead Score ${score} de 100, grado ${grade}`}
          />
        }
      >
        <span className="text-sm leading-none">{score}</span>
        <span className="opacity-40">·</span>
        <span>{grade}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-2">
            <span className={cn("rounded-md border px-1.5 py-0.5 tabular-nums", GRADE_TONES[grade])}>
              {score} / 100 · {grade}
            </span>
            <span>{gradeInfo.label}</span>
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
