import Link from "next/link";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRightIcon, BellIcon } from "lucide-react";
import {
  ContactsChart,
  StatusChart,
  TagsChart,
  type ContactDatum,
  type StatusDatum,
  type TagDatum,
} from "@/components/dashboard-charts";
import { PageHeader } from "@/components/page-header";
import { StatusBadges } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  areStatusesUncontacted,
  hasPendingStatus,
  STATUSES,
} from "@/lib/config";
import { formatDateShort, isFollowUpOverdue, todayISO } from "@/lib/dates";
import { getLeadsWithTags } from "@/lib/queries";
import type { LeadWithTags } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function buildStats(leads: LeadWithTags[]) {
  const total = leads.length;
  const contacted = leads.filter(
    (lead) => !areStatusesUncontacted(lead.statuses)
  ).length;
  const responded = leads.filter(
    (lead) =>
      lead.statuses.includes("respondio") || lead.statuses.includes("cliente")
  ).length;
  const clients = leads.filter((lead) =>
    lead.statuses.includes("cliente")
  ).length;
  const responseRate = contacted > 0 ? Math.round((responded / contacted) * 100) : 0;

  const today = todayISO();
  const pendingFollowUps = leads.filter(
    (l) =>
      l.followUpDate &&
      l.followUpDate <= today &&
      hasPendingStatus(l.statuses)
  ).length;

  return { total, contacted, responded, clients, responseRate, pendingFollowUps };
}

function buildStatusData(leads: LeadWithTags[]): StatusDatum[] {
  return STATUSES.map((s) => ({
    key: s.value,
    label: s.label,
    value: leads.filter((lead) => lead.statuses.includes(s.value)).length,
    color: s.color,
  }));
}

function buildContactData(leads: LeadWithTags[], days: number): ContactDatum[] {
  const today = parseISO(todayISO());
  const contactsByDate = new Map<string, number>();

  for (const lead of leads) {
    if (!lead.contactDate) continue;
    contactsByDate.set(
      lead.contactDate,
      (contactsByDate.get(lead.contactDate) ?? 0) + 1
    );
  }

  return Array.from({ length: days }, (_, index) => {
    const date = subDays(today, days - index - 1);
    const dateISO = format(date, "yyyy-MM-dd");
    return {
      date: dateISO,
      label: format(date, "d MMM", { locale: es }),
      value: contactsByDate.get(dateISO) ?? 0,
    };
  });
}

function buildTagData(leads: LeadWithTags[]): TagDatum[] {
  const counts = new Map<string, TagDatum>();
  for (const lead of leads) {
    for (const tag of lead.tags) {
      const entry = counts.get(tag.name) ?? {
        name: tag.name,
        value: 0,
        color: tag.color,
      };
      entry.value += 1;
      counts.set(tag.name, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.value - a.value).slice(0, 7);
}

function buildFollowUps(leads: LeadWithTags[]): LeadWithTags[] {
  const today = parseISO(todayISO());

  return leads
    .filter(
      (lead) => lead.followUpDate && hasPendingStatus(lead.statuses)
    )
    .sort((a, b) => {
      const distanceA = Math.abs(
        differenceInCalendarDays(parseISO(a.followUpDate!), today)
      );
      const distanceB = Math.abs(
        differenceInCalendarDays(parseISO(b.followUpDate!), today)
      );

      return (
        distanceA - distanceB ||
        a.followUpDate!.localeCompare(b.followUpDate!) ||
        a.id - b.id
      );
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
  const stats = buildStats(leads);
  const statusData = buildStatusData(leads);
  const weeklyContactData = buildContactData(leads, 7);
  const monthlyContactData = buildContactData(leads, 30);
  const tagData = buildTagData(leads);
  const followUps = buildFollowUps(leads);
  const hasContactData = monthlyContactData.some((day) => day.value > 0);

  const kpis = [
    { label: "Leads totales", value: stats.total, hint: "en el pipeline" },
    { label: "Contactados", value: stats.contacted, hint: "primer mensaje enviado" },
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
        {stats.pendingFollowUps > 0 && (
          <Link
            href="/leads"
            className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
          >
            <BellIcon className="size-4" />
            {stats.pendingFollowUps} follow-up
            {stats.pendingFollowUps !== 1 && "s"} pendiente
            {stats.pendingFollowUps !== 1 && "s"}
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
              Tipos de negocio
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 items-center">
            {tagData.length > 0 ? (
              <TagsChart data={tagData} />
            ) : (
              <EmptyPanel
                title="Aún no hay tipos de negocio"
                description="Etiqueta tus leads para ver cómo se distribuyen."
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
              const overdue = isFollowUpOverdue(
                lead.followUpDate,
                lead.statuses
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
                    {formatDateShort(lead.followUpDate)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {lead.name}
                  </span>
                  <StatusBadges statuses={lead.statuses} />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
