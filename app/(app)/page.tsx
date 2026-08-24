import Link from "next/link";
import { format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRightIcon, BellIcon } from "lucide-react";
import {
  ContactsChart,
  ConversionFunnel,
  StatusChart,
  type ContactDatum,
  type FunnelDatum,
  type StatusDatum,
} from "@/components/dashboard-charts";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  CardAction,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STATUSES } from "@/lib/config";
import {
  dateKeyInAppTimeZone,
  formatActionTiming,
  isNextActionOverdue,
  todayISO,
} from "@/lib/dates";
import {
  buildConversionFunnel,
  buildCrmStats,
  buildTodayActionGroups,
  firstPendingLead,
} from "@/lib/crm-metrics";
import { getLeadsWithTags } from "@/lib/queries";
import type { LeadWithTags } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function buildStatusData(leads: LeadWithTags[]): StatusDatum[] {
  return STATUSES.map((s) => ({
    key: s.value,
    label: s.label,
    value: leads.filter((lead) => lead.status === s.value).length,
    color: s.color,
  }));
}

function buildContactData(leads: LeadWithTags[], days: number): ContactDatum[] {
  const today = parseISO(todayISO());
  const contactsByDate = new Map<string, number>();
  const repliesByDate = new Map<string, number>();

  for (const lead of leads) {
    if (lead.contactedAt) {
      const date = dateKeyInAppTimeZone(lead.contactedAt);
      contactsByDate.set(date, (contactsByDate.get(date) ?? 0) + 1);
    }
    if (lead.repliedAt) {
      const date = dateKeyInAppTimeZone(lead.repliedAt);
      repliesByDate.set(date, (repliesByDate.get(date) ?? 0) + 1);
    }
  }

  return Array.from({ length: days }, (_, index) => {
    const date = subDays(today, days - index - 1);
    const dateISO = format(date, "yyyy-MM-dd");
    return {
      date: dateISO,
      label: format(date, "d MMM", { locale: es }),
      value: contactsByDate.get(dateISO) ?? 0,
      replies: repliesByDate.get(dateISO) ?? 0,
    };
  });
}

function buildFollowUps(leads: LeadWithTags[]): LeadWithTags[] {
  return leads
    .filter(
      (lead) => lead.nextAction === "hacer_follow_up"
    )
    .sort((a, b) => {
      if (!a.nextActionAt && b.nextActionAt) return 1;
      if (a.nextActionAt && !b.nextActionAt) return -1;
      return (a.nextActionAt ?? "").localeCompare(b.nextActionAt ?? "") || a.id - b.id;
    })
    .slice(0, 8);
}

function EmptyPanel({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-56 flex-col items-center justify-center px-6 text-center",
        className
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const leads = await getLeadsWithTags();
  const stats = buildCrmStats(leads);
  const statusData = buildStatusData(leads);
  const funnelData = buildConversionFunnel(leads) satisfies FunnelDatum[];
  const todayGroups = buildTodayActionGroups(leads);
  const firstPending = firstPendingLead(leads);
  const weeklyContactData = buildContactData(leads, 7);
  const monthlyContactData = buildContactData(leads, 30);
  const followUps = buildFollowUps(leads);
  const hasContactData = monthlyContactData.some((day) => day.value > 0);

  const kpis = [
    { label: "Leads totales", value: stats.total, hint: "en el pipeline" },
    { label: "Contactados", value: stats.contacted, hint: "con contacto registrado" },
    {
      label: "Tasa de respuesta",
      value: `${stats.responseRate}%`,
      hint: `${stats.responded} respondieron`,
    },
    { label: "Clientes", value: stats.clients, hint: "cerrados" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        title="Resumen"
        subtitle={format(parseISO(todayISO()), "EEEE, d 'de' MMMM yyyy", {
          locale: es,
        })}
      >
        {todayGroups.some((group) => group.count > 0) && (
          <Link
            href="/leads?due=today"
            className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
          >
            <BellIcon className="size-4" />
            {todayGroups.reduce((sum, group) => sum + group.count, 0)} acciones pendientes
          </Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="gap-1 py-4">
            <CardHeader className="pb-0">
              <CardTitle className="font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-heading text-3xl font-semibold">
                {kpi.value}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4 gap-0 py-0">
        <CardHeader className="items-center border-b px-5 py-4">
          <div>
            <CardTitle className="font-heading text-base">Para hoy</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Trabajo pendiente ordenado por la siguiente acción.</p>
          </div>
          {firstPending && (
            <CardAction className="self-center">
              <Button size="sm" render={<Link href={`/leads?open=${firstPending.id}`} />}>
                Empezar <ArrowRightIcon />
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2 lg:grid-cols-4">
          {todayGroups.map((group) => (
            <Link
              key={group.action}
              href={`/leads?action=${group.action}&due=today`}
              className="flex items-center gap-3 bg-card px-5 py-4 transition-colors hover:bg-muted/40"
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: group.color }} />
              <span className="text-2xl font-semibold tabular-nums">{group.count}</span>
              <span className="text-sm text-muted-foreground">{group.label}</span>
              <ArrowRightIcon className="ml-auto size-3.5 text-muted-foreground/50" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              Pipeline por estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leads.length > 0 ? (
              <StatusChart data={statusData} />
            ) : (
              <EmptyPanel
                title="Tu pipeline está listo"
                description="Los leads se distribuirán aquí según avancen por cada estado."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              Conversión comercial
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 items-center">
            {leads.length > 0 ? (
              <ConversionFunnel data={funnelData} />
            ) : (
              <EmptyPanel
                title="Aún no hay conversión que medir"
                description="El embudo aparecerá cuando añadas tus primeros leads."
                className="h-44"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              Contactos por día
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 items-center">
            {hasContactData ? (
              <ContactsChart
                weeklyData={weeklyContactData}
                monthlyData={monthlyContactData}
              />
            ) : (
              <EmptyPanel
                title="Aún no hay contactos registrados"
                description="La actividad diaria de la última semana o mes aparecerá aquí."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-heading text-base">
              Próximos follow-ups
            </CardTitle>
            <Link
              href="/leads"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Ver todos
              <ArrowRightIcon className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {followUps.length === 0 && (
              <EmptyPanel
                title="No hay follow-ups programados"
                description="Tus próximas tareas de seguimiento aparecerán aquí."
                className="h-44"
              />
            )}
            {followUps.map((lead) => {
              const overdue = isNextActionOverdue(
                lead.nextAction,
                lead.nextActionAt
              );
              return (
                <Link
                  key={lead.id}
                  href={`/leads?open=${lead.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <span
                    className={cn(
                      "w-14 shrink-0 text-xs font-semibold",
                      overdue ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {formatActionTiming(lead.nextAction, lead.nextActionAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {lead.name}
                  </span>
                  <StatusBadge status={lead.status} />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
