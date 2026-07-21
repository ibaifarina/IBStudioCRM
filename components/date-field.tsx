"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function DateField({
  value,
  onChange,
  placeholder = "Elegir fecha",
  showTodayButton = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showTodayButton?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <div className={cn("flex gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          className={cn(
            "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0 opacity-60" />
          <span className="truncate">
            {selected
              ? format(selected, "d MMM yyyy", { locale: es })
              : placeholder}
          </span>
          {value && (
            <span
              role="button"
              tabIndex={0}
              className="ml-auto rounded p-0.5 opacity-50 hover:opacity-100"
              aria-label="Quitar fecha"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }
              }}
            >
              <XIcon className="size-3" />
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={es}
            selected={selected}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
            defaultMonth={selected}
          />
        </PopoverContent>
      </Popover>
      {showTodayButton && (
        <Button
          type="button"
          variant="outline"
          className="h-8 shrink-0"
          onClick={() => onChange(todayISO())}
        >
          Hoy
        </Button>
      )}
    </div>
  );
}
