"use client";

import { Bar, BarChart, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type StatusDatum = { key: string; label: string; value: number; color: string };
export type WeekDatum = { week: string; label: string; value: number };
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

export function WeeklyChart({ data }: { data: WeekDatum[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: 4, right: 4, top: 16, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          interval={0}
        />
        <YAxis hide allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar
          dataKey="value"
          fill="var(--brand)"
          fillOpacity={0.85}
          radius={[4, 4, 0, 0]}
          maxBarSize={34}
        >
          <LabelList
            dataKey="value"
            position="top"
            className="fill-muted-foreground"
            fontSize={11}
            formatter={(value) => (Number(value) > 0 ? value : "")}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function TagsChart({ data }: { data: TagDatum[] }) {
  return (
    <div className="flex items-center gap-4">
      <ChartContainer config={chartConfig} className="aspect-square h-44">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={46}
            outerRadius={70}
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
