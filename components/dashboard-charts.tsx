"use client";

import { useState } from "react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type StatusDatum = { key: string; label: string; value: number; color: string };
export type ContactDatum = { date: string; label: string; value: number; replies?: number };
export type TagDatum = { name: string; value: number; color: string };
export type FunnelDatum = {
  key: string;
  label: string;
  value: number;
  rate: number | null;
  color: string;
};

const contactChartConfig = {
  value: { label: "Contactos" },
  replies: { label: "Respuestas" },
} satisfies ChartConfig;

const statusChartConfig = {
  value: { label: "Leads" },
} satisfies ChartConfig;

const tagChartConfig = {
  value: { label: "Leads" },
} satisfies ChartConfig;

export function ConversionFunnel({ data }: { data: FunnelDatum[] }) {
  const total = data[0]?.value ?? 0;
  const clients = data.at(-1)?.value ?? 0;
  const overallRate = total > 0 ? Math.round((clients / total) * 100) : 0;

  return (
    <div className="flex min-h-56 w-full flex-col justify-center">
      <div className="mb-4 flex items-end justify-between border-b border-border/70 pb-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Resultado del recorrido
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {clients.toLocaleString("es-ES")}
            </span>{" "}
            {clients === 1 ? "cliente" : "clientes"} de{" "}
            {total.toLocaleString("es-ES")} leads
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {overallRate}%
          </span>
          <p className="text-[10px] text-muted-foreground">conversión total</p>
        </div>
      </div>

      <div
        className="relative grid gap-2.5 before:absolute before:top-3 before:bottom-3 before:left-[5px] before:w-px before:bg-border"
        role="list"
        aria-label="Etapas del embudo de conversión"
      >
        {data.map((step, index) => {
          const shareOfTotal = total > 0 ? (step.value / total) * 100 : 0;

          return (
            <div
              key={step.key}
              role="listitem"
              aria-label={`${step.label}: ${step.value}${step.rate == null ? "" : `, ${step.rate}% de conversión`}`}
              className="relative grid grid-cols-[minmax(6.75rem,0.85fr)_minmax(4.5rem,1.4fr)_2.25rem] items-center gap-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="relative z-10 size-[11px] shrink-0 rounded-full border-2 border-card shadow-[0_0_0_1px_var(--border)]"
                  style={{ backgroundColor: step.color }}
                />
                <span className="truncate text-xs font-medium">{step.label}</span>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                    style={{
                      width: `${shareOfTotal}%`,
                      minWidth: step.value > 0 ? "5px" : 0,
                      backgroundColor: step.color,
                    }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[10px] font-medium text-muted-foreground tabular-nums">
                  {index === 0 ? "100%" : `${step.rate ?? 0}%`}
                </span>
              </div>

              <span className="text-right text-sm font-semibold tabular-nums">
                {step.value.toLocaleString("es-ES")}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-right text-[10px] text-muted-foreground">
        % respecto a la etapa anterior
      </p>
    </div>
  );
}

export function StatusChart({ data }: { data: StatusDatum[] }) {
  return (
    <ChartContainer config={statusChartConfig} className="aspect-auto h-56 w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 28, top: 4, bottom: 4 }}
      >
        <YAxis
          dataKey="label"
          type="category"
          tickLine={false}
          axisLine={false}
          width={98}
          tick={{ fontSize: 12 }}
        />
        <XAxis type="number" hide allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={18}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.color} fillOpacity={0.85} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            className="fill-foreground"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function ContactsChart({
  weeklyData,
  monthlyData,
}: {
  weeklyData: ContactDatum[];
  monthlyData: ContactDatum[];
}) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const data = period === "week" ? weeklyData : monthlyData;
  const hasReplies = data.some((day) => (day.replies ?? 0) > 0);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex justify-end">
        <div
          className="inline-flex rounded-lg bg-muted p-0.5"
          role="group"
          aria-label="Periodo"
        >
          {(["week", "month"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={period === option}
              onClick={() => setPeriod(option)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
            >
              {option === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>
      <ChartContainer
        config={contactChartConfig}
        className="aspect-auto h-52 w-full"
      >
        <BarChart data={data} margin={{ left: 4, right: 4, top: 16, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            interval={period === "week" ? 0 : 4}
          />
          <YAxis hide allowDecimals={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            fill="var(--brand)"
            fillOpacity={0.85}
            radius={[4, 4, 0, 0]}
            maxBarSize={period === "week" ? 34 : 18}
          >
            {period === "week" && (
              <LabelList
                dataKey="value"
                position="top"
                className="fill-muted-foreground"
                fontSize={11}
                formatter={(value) => (Number(value) > 0 ? value : "")}
              />
            )}
          </Bar>
          {hasReplies && (
            <Bar
              dataKey="replies"
              fill="var(--chart-2)"
              fillOpacity={0.8}
              radius={[4, 4, 0, 0]}
              maxBarSize={period === "week" ? 24 : 14}
            />
          )}
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function TagsChart({ data }: { data: TagDatum[] }) {
  return (
    <div className="flex flex-1 items-center justify-start gap-4 sm:gap-8">
      <ChartContainer
        config={tagChartConfig}
        className="aspect-square h-44 shrink-0 sm:h-56"
      >
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} fillOpacity={0.85} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="flex flex-col gap-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="ml-1 font-medium">{d.value}</span>
          </li>
        ))}
        {data.length === 0 && (
          <li className="text-muted-foreground">Sin etiquetas todavía</li>
        )}
      </ul>
    </div>
  );
}
