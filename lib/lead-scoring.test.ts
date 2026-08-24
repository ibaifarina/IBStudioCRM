import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLeadScoringContext,
  sectorSignalForTags,
} from "./lead-scoring-context.ts";
import { calculateLeadScore, classifyWebsite } from "./lead-scoring.ts";

test("classifyWebsite separates owned sites from associated profiles", () => {
  assert.equal(classifyWebsite("https://example.com"), "OWN_WEBSITE");
  assert.equal(classifyWebsite("https://instagram.com/example"), "SOCIAL");
  assert.equal(classifyWebsite("https://booksy.com/example"), "BOOKING_PLATFORM");
  assert.equal(classifyWebsite("https://linktr.ee/example"), "DIRECTORY");
});

test("rating is used when present", () => {
  const common = {
    websiteStatus: "no_tiene_web" as const,
    phone: "+34600000000",
    reviewCount: 40,
    tags: ["Peluquería"],
  };
  const excellent = calculateLeadScore({ ...common, rating: 4.8 });
  const weak = calculateLeadScore({ ...common, rating: 3.7 });
  assert.equal(excellent.scoreBreakdown.reputation.model, "WITH_RATING");
  assert.ok(excellent.leadScore > weak.leadScore);
});

test("missing rating activates the alternative model without fake points", () => {
  const result = calculateLeadScore({
    websiteStatus: "no_tiene_web",
    phone: "+34600000000",
    reviewCount: 40,
    tags: ["Peluquería"],
  });
  assert.equal(result.scoreBreakdown.reputation.model, "WITHOUT_RATING");
  assert.equal(result.scoreBreakdown.reputation.rating, null);
  assert.equal(result.scoreBreakdown.reputation.reviews, 20);
});

test("arbitrary new tags are recognized with a neutral prior", () => {
  const context = buildLeadScoringContext([]);
  const signal = sectorSignalForTags(context, ["Cerámica artesanal espacial"]);
  assert.equal(signal.points, 8);
  assert.equal(signal.sampleSize, 0);
  assert.equal(signal.label, "Cerámica artesanal espacial");
});

test("tag scoring learns from CRM outcomes without a sector dictionary", () => {
  const context = buildLeadScoringContext([
    ...Array.from({ length: 8 }, () => ({ status: "cliente", tags: ["Clínicas premium"] })),
    ...Array.from({ length: 8 }, () => ({ status: "descartado", tags: ["Baja conversión"] })),
  ]);
  const strong = sectorSignalForTags(context, ["Clínicas premium"]);
  const weak = sectorSignalForTags(context, ["Baja conversión"]);
  assert.ok(strong.points > weak.points);
  assert.equal(strong.sampleSize, 8);
});

test("location uses distance to the portfolio median, not city names", () => {
  const context = buildLeadScoringContext([
    { lat: 41.56, lng: 2.01 },
    { lat: 41.57, lng: 2.02 },
    { lat: 41.55, lng: 2.03 },
    { lat: 41.56, lng: 2.04 },
    { lat: 41.57, lng: 2.03 },
  ]);
  const near = calculateLeadScore({ lat: 41.56, lng: 2.02, scoringContext: context });
  const far = calculateLeadScore({ lat: 40.4, lng: -3.7, scoringContext: context });
  assert.equal(near.scoreBreakdown.locationFit, 5);
  assert.equal(far.scoreBreakdown.locationFit, 1);
  assert.match(near.scoreBreakdown.location, /km del centro operativo/);
});

test("score is always clamped from zero to one hundred", () => {
  const high = calculateLeadScore({
    websiteStatus: "no_tiene_web",
    instagram: "example",
    phone: "+34600000000",
    contactChannel: "whatsapp",
    rating: 5,
    reviewCount: 500,
    sectorSignal: { points: 15, sampleSize: 100, label: "Sector aprendido" },
  });
  const low = calculateLeadScore({ rating: 1, reviewCount: 0 });
  assert.ok(high.leadScore <= 100);
  assert.ok(low.leadScore >= 0);
});
