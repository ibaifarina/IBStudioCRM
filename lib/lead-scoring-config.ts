export const SCORE_VERSION = 2;

export const SCORE_LIMITS = {
  reputation: 25,
  webOpportunity: 30,
  digitalMaturity: 15,
  sectorPerformance: 15,
  contactability: 10,
  locationFit: 5,
} as const;

export const WEBSITE_DOMAINS = {
  social: [
    "instagram.com", "facebook.com", "fb.com", "tiktok.com", "x.com",
    "twitter.com", "youtube.com", "wa.me", "whatsapp.com",
  ],
  booking: [
    "booksy.com", "booksy.es", "treatwell.com", "treatwell.es", "fresha.com",
    "planity.com", "timify.com", "setmore.com", "calendly.com", "simplybook.me",
  ],
  directory: [
    "linktr.ee", "linktree.com", "doctoralia.es", "doctoralia.com", "google.com",
    "goo.gl", "business.site", "sites.google.com", "tripadvisor.es",
    "tripadvisor.com", "yelp.es", "yelp.com", "paginasamarillas.es",
  ],
} as const;

type ScoreBand = { min: number; points: number };

// With rating, reviews describe demand and rating describes quality.
export const REVIEW_BANDS_WITH_RATING: readonly ScoreBand[] = [
  { min: 150, points: 16 },
  { min: 75, points: 15 },
  { min: 40, points: 13 },
  { min: 20, points: 10 },
  { min: 10, points: 7 },
  { min: 5, points: 4 },
  { min: 1, points: 2 },
  { min: 0, points: 0 },
];

// Alternative model: without rating, review volume occupies the complete
// reputation component instead of inventing neutral rating points.
export const REVIEW_BANDS_WITHOUT_RATING: readonly ScoreBand[] = [
  { min: 150, points: 25 },
  { min: 75, points: 23 },
  { min: 40, points: 20 },
  { min: 20, points: 16 },
  { min: 10, points: 12 },
  { min: 5, points: 7 },
  { min: 1, points: 3 },
  { min: 0, points: 0 },
];

export const RATING_BANDS: readonly ScoreBand[] = [
  { min: 4.8, points: 9 },
  { min: 4.6, points: 8 },
  { min: 4.4, points: 6 },
  { min: 4.2, points: 4 },
  { min: 4, points: 2 },
  { min: 0, points: 0 },
];

export const WEB_OPPORTUNITY_POINTS = {
  none: 30,
  platformOrProfile: 27,
  ownWebsite: 5,
  oldWebsite: 18,
  unknown: 15,
} as const;

export const DIGITAL_MATURITY_POINTS = {
  instagram: 6,
  facebookWithoutInstagram: 4,
  booking: 5,
  additionalProfile: 2,
  max: 15,
} as const;

export const CONTACTABILITY_POINTS = {
  phone: 4,
  whatsapp: 3,
  social: 2,
  email: 1,
  max: 10,
} as const;

export const LOCATION_DISTANCE_BANDS = [
  { maxKm: 15, points: 5 },
  { maxKm: 35, points: 4 },
  { maxKm: 60, points: 3 },
  { maxKm: 100, points: 2 },
  { maxKm: Number.POSITIVE_INFINITY, points: 1 },
] as const;

export const LOCATION_NEUTRAL_POINTS = 3;
export const MIN_TERRITORY_SAMPLE = 5;

export const SECTOR_LEARNING = {
  minPoints: 3,
  maxPoints: 15,
  priorRate: 0.45,
  priorStrength: 6,
  neutralPoints: 8,
  statusOutcomes: {
    contactado: 0.15,
    respondio: 0.5,
    interesado: 0.8,
    cliente: 1,
    descartado: 0,
  },
} as const;

export const SCORE_CONFIDENCE_WEIGHTS = {
  reviewCount: 18,
  rating: 20,
  sectorHistory: 15,
  website: 15,
  digital: 10,
  contact: 12,
  location: 10,
} as const;

export const SCORE_PENALTIES = {
  unvalidated: { points: 8, maxReviewsExclusive: 5 },
  lowRating: { points: 10, threshold: 4 },
  noContact: 8,
} as const;
