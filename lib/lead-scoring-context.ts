import { SECTOR_LEARNING } from "./lead-scoring-config.ts";

export type ScoringContextLead = {
  lat?: number | null;
  lng?: number | null;
  status?: string | null;
  tags?: readonly (string | { name: string })[] | null;
};

export type LearnedTagSignal = {
  points: number;
  sampleSize: number;
};

export type LeadScoringContext = {
  territory: {
    centerLat: number;
    centerLng: number;
    sampleSize: number;
  } | null;
  tagSignals: ReadonlyMap<string, LearnedTagSignal>;
};

export type SectorSignal = LearnedTagSignal & {
  label: string;
};

function normalizeTag(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

function tagNames(tags: ScoringContextLead["tags"]) {
  return (tags ?? [])
    .map((tag) => (typeof tag === "string" ? tag : tag.name))
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function buildLeadScoringContext(
  leads: readonly ScoringContextLead[]
): LeadScoringContext {
  const located = leads.filter(
    (lead): lead is ScoringContextLead & { lat: number; lng: number } =>
      typeof lead.lat === "number" &&
      Number.isFinite(lead.lat) &&
      typeof lead.lng === "number" &&
      Number.isFinite(lead.lng)
  );
  const territory = located.length
    ? {
        centerLat: median(located.map((lead) => lead.lat)),
        centerLng: median(located.map((lead) => lead.lng)),
        sampleSize: located.length,
      }
    : null;

  const outcomes = new Map<string, { total: number; outcome: number }>();
  for (const lead of leads) {
    const outcome =
      SECTOR_LEARNING.statusOutcomes[
        lead.status as keyof typeof SECTOR_LEARNING.statusOutcomes
      ];
    if (outcome == null) continue;
    for (const tag of new Set(tagNames(lead.tags).map(normalizeTag))) {
      const current = outcomes.get(tag) ?? { total: 0, outcome: 0 };
      current.total += 1;
      current.outcome += outcome;
      outcomes.set(tag, current);
    }
  }

  const tagSignals = new Map<string, LearnedTagSignal>();
  for (const [tag, value] of outcomes) {
    const learnedRate =
      (value.outcome + SECTOR_LEARNING.priorRate * SECTOR_LEARNING.priorStrength) /
      (value.total + SECTOR_LEARNING.priorStrength);
    const points = Math.round(
      SECTOR_LEARNING.minPoints +
        learnedRate * (SECTOR_LEARNING.maxPoints - SECTOR_LEARNING.minPoints)
    );
    tagSignals.set(tag, { points, sampleSize: value.total });
  }

  return { territory, tagSignals };
}

export function sectorSignalForTags(
  context: LeadScoringContext | null | undefined,
  tags: ScoringContextLead["tags"]
): SectorSignal {
  const names = tagNames(tags);
  const signals = names
    .map((name) => context?.tagSignals.get(normalizeTag(name)))
    .filter((signal): signal is LearnedTagSignal => Boolean(signal));
  if (signals.length === 0) {
    return {
      points: SECTOR_LEARNING.neutralPoints,
      sampleSize: 0,
      label: names.length ? names.join(", ") : "Sin etiqueta",
    };
  }
  return {
    points: Math.round(
      signals.reduce((total, signal) => total + signal.points, 0) / signals.length
    ),
    sampleSize: signals.reduce((total, signal) => total + signal.sampleSize, 0),
    label: names.join(", "),
  };
}
