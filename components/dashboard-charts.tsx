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
export type ContactDatum = { date: string; label: string; value: number };
export type TagDatum = { name: string; value: number; color: string };

const chartConfig = {
  value: { label: "Leads" },
} satisfies ChartConfig;

export function StatusChart({ data }: { data: StatusDatum[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
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
        config={chartConfig}
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
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function TagsChart({ data }: { data: TagDatum[] }) {
  return (
    <div className="flex flex-1 items-center justify-start gap-4 sm:gap-8">
      <ChartContainer
        config={chartConfig}
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
