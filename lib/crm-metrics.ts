import {
  type NextActionKey,
  type StatusKey,
} from "@/lib/config";
import { dateKeyInAppTimeZone, todayISO } from "@/lib/dates";
import type { LeadWithTags } from "@/lib/types";

const CONTACTED_STAGES = new Set<StatusKey>([
  "contactado",
  "respondio",
  "interesado",
  "cliente",
]);
const RESPONDED_STAGES = new Set<StatusKey>([
  "respondio",
  "interesado",
  "cliente",
]);
const INTERESTED_STAGES = new Set<StatusKey>(["interesado", "cliente"]);

export function hasBeenContacted(lead: LeadWithTags) {
  return Boolean(lead.contactedAt || CONTACTED_STAGES.has(lead.status));
}

export function hasReplied(lead: LeadWithTags) {
  return Boolean(lead.repliedAt || RESPONDED_STAGES.has(lead.status));
}

export function isInterested(lead: LeadWithTags) {
  return INTERESTED_STAGES.has(lead.status);
}

export function buildCrmStats(leads: LeadWithTags[]) {
  const total = leads.length;
  const contacted = leads.filter(hasBeenContacted).length;
  const responded = leads.filter(hasReplied).length;
  const interested = leads.filter(isInterested).length;
  const clients = leads.filter((lead) => lead.status === "cliente").length;

  return {
    total,
    contacted,
    responded,
    interested,
    clients,
    responseRate: contacted > 0 ? Math.round((responded / contacted) * 100) : 0,
  };
}

export type FunnelStep = {
  key: "leads" | "contacted" | "responded" | "interested" | "clients";
  label: string;
  value: number;
  rate: number | null;
  color: string;
};

export function buildConversionFunnel(leads: LeadWithTags[]): FunnelStep[] {
  const contacted = leads.filter(hasBeenContacted).length;
  const responded = leads.filter(hasReplied).length;
  const interested = leads.filter(isInterested).length;
  const clients = leads.filter((lead) => lead.status === "cliente").length;
  const stages = [leads.length, contacted, responded, interested, clients];
  const rate = (value: number, previous: number) =>
    previous > 0 ? Math.round((value / previous) * 100) : 0;

  return [
    { key: "leads", label: "Leads", value: stages[0], rate: null, color: "#64748b" },
    { key: "contacted", label: "Contactados", value: stages[1], rate: rate(stages[1], stages[0]), color: "#d97f06" },
    { key: "responded", label: "Respondieron", value: stages[2], rate: rate(stages[2], stages[1]), color: "#0891b2" },
    { key: "interested", label: "Interesados", value: stages[3], rate: rate(stages[3], stages[2]), color: "#7c3aed" },
    { key: "clients", label: "Clientes", value: stages[4], rate: rate(stages[4], stages[3]), color: "#059669" },
  ];
}

function isDueByToday(lead: LeadWithTags) {
  if (
    lead.nextAction === "sin_accion" ||
    lead.nextAction === "esperar_respuesta"
  ) return false;
  if (!lead.nextActionAt) return true;
  return dateKeyInAppTimeZone(lead.nextActionAt) <= todayISO();
}

export type TodayActionGroup = {
  action: NextActionKey;
  label: string;
  count: number;
  color: string;
};

export function buildTodayActionGroups(leads: LeadWithTags[]): TodayActionGroup[] {
  const actionable = leads.filter(
    (lead) => lead.status !== "descartado" && isDueByToday(lead)
  );
  const groups: Array<Omit<TodayActionGroup, "count">> = [
    { action: "contactar", label: "por contactar", color: "#2563eb" },
    { action: "responder", label: "por responder", color: "#0891b2" },
    { action: "hacer_follow_up", label: "follow-ups", color: "#d97706" },
    { action: "revisar_mas_tarde", label: "para revisar", color: "#7c3aed" },
  ];

  return groups.map((group) => ({
    ...group,
    count: actionable.filter((lead) => lead.nextAction === group.action).length,
  }));
}

export function firstPendingLead(leads: LeadWithTags[]) {
  return leads
    .filter((lead) => lead.status !== "descartado" && isDueByToday(lead))
    .sort((left, right) => {
      if (!left.nextActionAt && right.nextActionAt) return -1;
      if (left.nextActionAt && !right.nextActionAt) return 1;
      return (
        (left.nextActionAt ?? "").localeCompare(right.nextActionAt ?? "") ||
        left.id - right.id
      );
    })[0];
}
