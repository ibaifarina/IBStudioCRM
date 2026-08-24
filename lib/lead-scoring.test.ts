import assert from "node:assert/strict";
import test from "node:test";
import { calculateLeadScore, classifyWebsite } from "./lead-scoring.ts";

const NOW = new Date("2026-08-24T12:00:00.000Z");

test("classifyWebsite separates owned sites from social, booking and directories", () => {
  assert.equal(classifyWebsite(null), "NONE");
  assert.equal(classifyWebsite("https://instagram.com/demo"), "SOCIAL");
  assert.equal(classifyWebsite("booksy.com/es-es/demo"), "BOOKING_PLATFORM");
  assert.equal(classifyWebsite("https://doctoralia.es/clinica/demo"), "DIRECTORY");
  assert.equal(classifyWebsite("https://negocio.es"), "OWN_WEBSITE");
});

test("strong hair salon is grade A", () => {
  const result = calculateLeadScore({
    name: "Peluquería Demo",
    address: "Terrassa, Barcelona",
    businessCategories: ["Peluquería"],
    reviewCount: 80,
    rating: 4.7,
    instagram: "pelu.demo",
    website: "https://booksy.com/es-es/demo",
    websiteStatus: "no_tiene_web",
    phone: "+34 612 000 000",
    source: "apify",
    digitalPresenceKnown: true,
  }, { now: NOW });
  assert.equal(result.leadGrade, "A");
  assert.ok(result.leadScore >= 80 && result.leadScore <= 95);
});

test("unvalidated hair salon stays grade D despite having no website", () => {
  const result = calculateLeadScore({
    businessCategories: ["Peluquería"],
    reviewCount: 3,
    rating: 4.8,
    websiteStatus: "no_tiene_web",
    phone: "+34 612 000 000",
    digitalPresenceKnown: true,
  }, { now: NOW });
  assert.equal(result.leadGrade, "D");
  assert.ok(result.leadScore >= 35 && result.leadScore <= 50);
  assert.equal(result.scoreBreakdown.penalties, 10);
});

test("dental clinic with traction is grade A", () => {
  const result = calculateLeadScore({
    address: "Sabadell",
    businessCategories: ["Clínica dental"],
    reviewCount: 60,
    rating: 4.6,
    instagram: "dental.demo",
    websiteStatus: "no_tiene_web",
    phone: "+34 612 000 000",
    source: "google_maps",
  }, { now: NOW });
  assert.equal(result.leadGrade, "A");
});

test("restaurant scores below an equivalent clinic", () => {
  const common = {
    reviewCount: 80,
    rating: 4.6,
    instagram: "demo",
    websiteStatus: "no_tiene_web" as const,
    phone: "+34 612 000 000",
    source: "apify",
  };
  const restaurant = calculateLeadScore({ ...common, businessCategories: ["Restaurante"] }, { now: NOW });
  const clinic = calculateLeadScore({ ...common, businessCategories: ["Clínica dental"] }, { now: NOW });
  assert.equal(restaurant.leadGrade, "B");
  assert.ok(restaurant.leadScore < clinic.leadScore);
});

test("a good owned website sharply reduces the opportunity component", () => {
  const result = calculateLeadScore({
    businessCategories: ["Clínica dental"],
    reviewCount: 100,
    rating: 4.8,
    instagram: "dental.demo",
    website: "https://clinicademo.es",
    websiteStatus: "tiene_web",
    phone: "+34 612 000 000",
  }, { now: NOW });
  assert.equal(result.scoreBreakdown.webOpportunity, 5);
});

test("unknown values use neutral points and lower confidence", () => {
  const unknown = calculateLeadScore({ name: "Sin datos" }, { now: NOW });
  const known = calculateLeadScore({
    name: "Con datos",
    address: "Terrassa",
    businessCategories: ["Peluquería"],
    reviewCount: 40,
    rating: 4.6,
    lastReviewAt: "2026-08-20T10:00:00.000Z",
    websiteStatus: "no_tiene_web",
    digitalPresenceKnown: true,
    phone: "+34 612 000 000",
  }, { now: NOW });
  assert.ok(unknown.scoreConfidence < known.scoreConfidence);
  assert.equal(unknown.scoreBreakdown.traction.rating, 3);
});

test("permanently closed business always scores zero", () => {
  const result = calculateLeadScore({
    businessCategories: ["Clínica dental"],
    reviewCount: 100,
    rating: 5,
    websiteStatus: "no_tiene_web",
    phone: "+34 612 000 000",
    isPermanentlyClosed: true,
  }, { now: NOW });
  assert.equal(result.leadScore, 0);
  assert.equal(result.leadGrade, "D");
});
