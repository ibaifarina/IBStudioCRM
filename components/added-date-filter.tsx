"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  eachDayOfInterval,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDaysIcon, ChevronDownIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type AddedDateFilterProps = {
  createdDates: string[];
  today: string;
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
};

function rangeLabel(range: DateRange | undefined) {
  if (!range?.from) return "Añadidos";
  if (!range.to || isSameDay(range.from, range.to)) {
    return format(range.from, "d MMM", { locale: es });
  }
  return `${format(range.from, "d MMM", { locale: es })} – ${format(
    range.to,
    "d MMM",
    { locale: es }
  )}`;
}

function isDayInRange(day: Date, range: DateRange | undefined) {
  if (!range?.from) return false;
  const end = range.to ?? range.from;
  return isWithinInterval(day, {
    start: startOfDay(range.from),
    end: startOfDay(end),
  });
}

export function AddedDateFilter({
  createdDates,
  today,
  value,
  onChange,
}: AddedDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(value);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const dragStartIndex = useRef<number | null>(null);
  const draggedAcrossDays = useRef(false);

  const volumeByDay = useMemo(() => {
    const end = startOfDay(parseISO(today));
    const start = subDays(end, 29);
    const counts = new Map<string, number>();

    for (const iso of createdDates) {
      const parsed = parseISO(iso);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = format(parsed, "yyyy-MM-dd");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return eachDayOfInterval({ start, end }).map((date) => ({
      date,
      count: counts.get(format(date, "yyyy-MM-dd")) ?? 0,
    }));
  }, [createdDates, today]);

  const todayDate = useMemo(() => parseISO(today), [today]);

  const maxVolume = Math.max(1, ...volumeByDay.map((day) => day.count));
  const totalVolume = volumeByDay.reduce((sum, day) => sum + day.count, 0);

  const indexFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = Math.min(
      Math.max(event.clientX - bounds.left, 0),
      Math.max(bounds.width - 1, 0)
    );
    return Math.min(
      volumeByDay.length - 1,
      Math.floor((offset / bounds.width) * volumeByDay.length)
    );
  };

  const selectIndexRange = (firstIndex: number, lastIndex: number) => {
    const startIndex = Math.min(firstIndex, lastIndex);
    const endIndex = Math.max(firstIndex, lastIndex);
    setDraft({
      from: volumeByDay[startIndex].date,
      to: volumeByDay[endIndex].date,
    });
  };

  const updateDragSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartIndex.current == null) return;
    const currentIndex = indexFromPointer(event);
    if (currentIndex !== dragStartIndex.current) {
      draggedAcrossDays.current = true;
    }
    selectIndexRange(dragStartIndex.current, currentIndex);
  };

  return (
    <DropdownMenuSub
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setDraft(value);
          setShowAdvanced(false);
        }
      }}
    >
      <DropdownMenuSubTrigger>
        <CalendarDaysIcon />
        <span>Añadidos</span>
        <span className="ml-auto max-w-24 truncate text-right text-xs font-normal text-muted-foreground">
          {value?.from ? rangeLabel(value) : "Cualquier fecha"}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="border-b px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-sm font-medium">Fecha de alta</h2>
              <p className="sr-only">
                Arrastra en el gráfico para elegir un intervalo.
              </p>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium tabular-nums">
              {totalVolume} en 30 días
            </span>
          </div>
        </div>

        <figure className="border-b px-4 pt-3 pb-3">
          <figcaption className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium">Volumen de leads añadidos</span>
            <span className="text-muted-foreground">Últimos 30 días</span>
          </figcaption>
          <div
            className="grid h-20 touch-none cursor-ew-resize grid-cols-[repeat(30,minmax(0,1fr))] items-end gap-0.5 select-none"
            role="group"
            aria-label="Volumen diario de leads añadidos. Arrastra para seleccionar un intervalo de fechas."
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              const index = indexFromPointer(event);
              dragStartIndex.current = index;
              draggedAcrossDays.current = false;
              event.currentTarget.setPointerCapture(event.pointerId);
              selectIndexRange(index, index);
            }}
            onPointerMove={updateDragSelection}
            onPointerUp={(event) => {
              updateDragSelection(event);
              dragStartIndex.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {
              dragStartIndex.current = null;
              draggedAcrossDays.current = false;
            }}
          >
            {volumeByDay.map(({ date, count }) => {
              const selected = isDayInRange(date, draft);
              const height = count === 0 ? 4 : Math.max(8, (count / maxVolume) * 64);
              const label = `${format(date, "d 'de' MMMM", {
                locale: es,
              })}: ${count} ${count === 1 ? "lead" : "leads"}`;

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  className="group flex h-full items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  title={label}
                  aria-label={label}
                  aria-pressed={selected}
                  onClick={() => {
                    if (draggedAcrossDays.current) {
                      draggedAcrossDays.current = false;
                      return;
                    }
                    setDraft({ from: date, to: date });
                  }}
                >
                  <span
                    className={cn(
                      "block w-full rounded-t-sm transition-colors",
                      selected
                        ? "bg-primary"
                        : count > 0
                          ? "bg-primary/35 group-hover:bg-primary/55"
                          : "bg-muted"
                    )}
                    style={{ height }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{format(volumeByDay[0].date, "d MMM", { locale: es })}</span>
            <span>{format(volumeByDay[14].date, "d MMM", { locale: es })}</span>
            <span>{format(volumeByDay[29].date, "d MMM", { locale: es })}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {draft?.from
              ? `Selección: ${rangeLabel(draft)}`
              : "Haz clic en un día o arrastra para seleccionar varios."}
          </p>
        </figure>

        <div className="border-b">
          <Button
            variant="ghost"
            className="h-10 w-full justify-between rounded-none px-4"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((current) => !current)}
          >
            Avanzado
            <ChevronDownIcon
              className={cn(
                "transition-transform",
                showAdvanced && "rotate-180"
              )}
            />
          </Button>
          {showAdvanced && (
            <div className="flex max-h-72 justify-center overflow-y-auto border-t px-2 py-1">
              <Calendar
                mode="range"
                selected={draft}
                onSelect={setDraft}
                defaultMonth={draft?.from ?? todayDate}
                locale={es}
                disabled={{ after: todayDate }}
                showOutsideDays={false}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(undefined);
              onChange(undefined);
              setOpen(false);
            }}
            disabled={!draft?.from && !value?.from}
          >
            Borrar
          </Button>
          <Button
            size="sm"
            disabled={!draft?.from}
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            Aplicar fechas
          </Button>
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
