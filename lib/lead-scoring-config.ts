export const SCORE_VERSION = 1;

export const SCORE_LIMITS = {
  traction: 25,
  webOpportunity: 25,
  digitalMaturity: 15,
  sectorFit: 20,
  contactability: 10,
  locationFit: 5,
} as const;

export const SCORE_GRADES = [
  { grade: "A", min: 80, label: "Excelente lead" },
  { grade: "B", min: 65, label: "Buen lead" },
  { grade: "C", min: 50, label: "Lead medio" },
  { grade: "D", min: 0, label: "Baja prioridad" },
] as const;

export const WEBSITE_DOMAINS = {
  social: [
    "instagram.com",
    "facebook.com",
    "fb.com",
    "tiktok.com",
    "x.com",
    "twitter.com",
    "youtube.com",
    "wa.me",
    "whatsapp.com",
  ],
  booking: [
    "booksy.com",
    "booksy.es",
    "treatwell.com",
    "treatwell.es",
    "fresha.com",
    "planity.com",
    "timify.com",
    "setmore.com",
    "calendly.com",
    "simplybook.me",
  ],
  directory: [
    "linktr.ee",
    "linktree.com",
    "doctoralia.es",
    "doctoralia.com",
    "google.com",
    "goo.gl",
    "business.site",
    "sites.google.com",
    "tripadvisor.es",
    "tripadvisor.com",
    "yelp.es",
    "yelp.com",
    "paginasamarillas.es",
  ],
} as const;

export type BusinessProfile =
  | "HIGH_TICKET"
  | "APPOINTMENT"
  | "HIGH_VOLUME"
  | "GENERAL";

type ReviewBand = { min: number; points: number };

export const REVIEW_BANDS: Record<BusinessProfile, readonly ReviewBand[]> = {
  HIGH_TICKET: [
    { min: 400, points: 11 },
    { min: 150, points: 14 },
    { min: 50, points: 15 },
    { min: 20, points: 12 },
    { min: 10, points: 8 },
    { min: 5, points: 4 },
    { min: 0, points: 0 },
  ],
  APPOINTMENT: [
    { min: 400, points: 11 },
    { min: 150, points: 14 },
    { min: 50, points: 15 },
    { min: 20, points: 11 },
    { min: 10, points: 7 },
    { min: 5, points: 3 },
    { min: 0, points: 0 },
  ],
  HIGH_VOLUME: [
    { min: 500, points: 13 },
    { min: 150, points: 15 },
    { min: 50, points: 10 },
    { min: 20, points: 6 },
    { min: 10, points: 3 },
    { min: 0, points: 0 },
  ],
  GENERAL: [
    { min: 400, points: 12 },
    { min: 150, points: 14 },
    { min: 50, points: 15 },
    { min: 20, points: 10 },
    { min: 10, points: 6 },
    { min: 5, points: 3 },
    { min: 0, points: 0 },
  ],
};

type CategoryRule = {
  tier: "A" | "B" | "C";
  points: number;
  profile: BusinessProfile;
  keywords: readonly string[];
};

export const BUSINESS_CATEGORY_RULES: readonly CategoryRule[] = [
  {
    tier: "A",
    points: 20,
    profile: "HIGH_TICKET",
    keywords: [
      "medicina estetica", "clinica estetica", "depilacion laser", "laser hair removal",
      "dentista", "dental", "odontologia", "fisioterapia", "physiotherapy", "podologia",
      "reformas", "renovation", "electricista", "electrician", "fontaneria", "plumber",
      "climatizacion", "aire acondicionado", "hvac", "placas solares", "energia solar",
      "piscinas", "pool contractor", "detailing", "taller especializado", "inmobiliaria",
      "real estate", "gestoria", "asesoria", "asesoria fiscal", "abogado", "law firm",
    ],
  },
  {
    tier: "B",
    points: 15,
    profile: "APPOINTMENT",
    keywords: [
      "peluqueria", "hair salon", "barberia", "barber shop", "unas", "nail salon",
      "centro de belleza", "beauty salon", "estetica", "tattoo", "tatuaje", "piercing",
      "veterinario", "veterinary", "autoescuela", "driving school", "crossfit", "pilates",
      "gimnasio boutique", "boutique gym", "fotografo", "photographer", "academia",
      "academy", "nutricionista", "nutritionist", "psicologo", "psychologist",
      "masajista", "massage", "osteopata", "osteopath",
    ],
  },
  {
    tier: "C",
    points: 8,
    profile: "HIGH_VOLUME",
    keywords: [
      "restaurante", "restaurant", "cafeteria", "coffee shop", "cafe", "bar",
      "cocktail bar", "tienda", "retail", "comercio", "boutique", "bakery", "panaderia",
    ],
  },
] as const;

export const UNKNOWN_CATEGORY = {
  points: 10,
  profile: "GENERAL" as const,
  label: "Sector sin clasificar",
};

export const LOCATION_RULES = [
  { name: "Terrassa", aliases: ["terrassa"], points: 5 },
  { name: "Sabadell", aliases: ["sabadell"], points: 5 },
  { name: "Mataró", aliases: ["mataro"], points: 5 },
  { name: "Granollers", aliases: ["granollers"], points: 4 },
  { name: "Rubí", aliases: ["rubi"], points: 4 },
  { name: "Cerdanyola", aliases: ["cerdanyola"], points: 4 },
  { name: "Mollet", aliases: ["mollet"], points: 4 },
  { name: "Sant Cugat", aliases: ["sant cugat"], points: 4 },
  { name: "Badalona", aliases: ["badalona"], points: 3 },
  { name: "Sitges", aliases: ["sitges"], points: 3 },
  { name: "Barcelona", aliases: ["barcelona"], points: 2 },
] as const;

export const DEFAULT_LOCATION = { name: "Otra zona", points: 2 } as const;

export const SCORE_CONFIDENCE_WEIGHTS = {
  reviewCount: 14,
  rating: 14,
  category: 13,
  website: 13,
  social: 10,
  booking: 8,
  contact: 12,
  location: 8,
  reviewRecency: 8,
} as const;

export const NEUTRAL_SCORES = {
  reviews: 7,
  rating: 3,
  reviewRecency: 1,
  unknownWebsite: 12,
} as const;

export const RATING_BANDS = [
  { min: 4.7, points: 7 },
  { min: 4.5, points: 6 },
  { min: 4.2, points: 4 },
  { min: 4, points: 2 },
  { min: 0, points: 0 },
] as const;

export const REVIEW_RECENCY_BANDS = [
  { maxDays: 30, points: 3 },
  { maxDays: 90, points: 2 },
  { maxDays: 365, points: 1 },
  { maxDays: Number.POSITIVE_INFINITY, points: 0 },
] as const;

export const WEB_OPPORTUNITY_POINTS = {
  none: 25,
  platformOrProfile: 23,
  ownWebsite: 5,
  oldWebsite: 15,
  unknown: 12,
} as const;

export const DIGITAL_MATURITY_POINTS = {
  instagram: 6,
  facebookWithoutInstagram: 3,
  booking: 5,
  additionalProfile: 2,
  somePhotos: 1,
  manyPhotos: 2,
  somePhotosThreshold: 3,
  manyPhotosThreshold: 10,
  max: 15,
} as const;

export const CONTACTABILITY_POINTS = {
  phone: 4,
  whatsapp: 3,
  social: 2,
  email: 1,
  max: 10,
} as const;

export const SCORE_PENALTIES = {
  unvalidated: { points: 10, maxReviewsExclusive: 10 },
  lowRating: { points: 7, threshold: 4 },
  noContact: 8,
  chain: 20,
} as const;
