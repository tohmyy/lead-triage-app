import type {
  DecisionMakerLevel,
  LeadClassification,
} from "@/types/qualification";

/**
 * Centralized qualification scoring configuration.
 * Adjust these values to match agency ICP / historical conversion data.
 */
export const qualificationConfig = {
  categoryMaximums: {
    budgetFit: 25,
    intent: 30,
    companyFit: 15,
    buyerFit: 15,
    source: 10,
    recency: 5,
  },

  budget: {
    maxPoints: 25,
    /** Missing budget awards this many points (no inventing). */
    missingScore: 0,
    /** Thresholds evaluated in order; first match wins. */
    ranges: [
      // ≥ £5,000 (including anything over £50,000) → full marks
      { min: 5000, max: Infinity, points: 25 },
      { min: 1000, max: 4999, points: 12 },
      { min: 1, max: 999, points: 5 },
    ],
  },

  companyFit: {
    maxPoints: 15,
    missingScore: 0,
    /** Ranges use the lower bound of employee count strings like "10-50". */
    employeeRanges: [
      { min: 20, max: 200, points: 15 },
      { min: 201, max: 1000, points: 12 },
      { min: 10, max: 19, points: 8 },
      { min: 1001, max: Infinity, points: 6 },
      { min: 1, max: 9, points: 3 },
    ],
  },

  buyerFit: {
    maxPoints: 15,
    decisionMakerPoints: {
      very_high: 15,
      high: 12,
      medium: 8,
      low: 3,
      unknown: 0,
    } satisfies Record<DecisionMakerLevel, number>,
  },

  intent: {
    maxPoints: 30,
    weights: {
      readyToPurchase: 10,
      /** requestedPricing and requestedQuote share one award (no double-count). */
      requestedPricingOrQuote: 6,
      requestedMeeting: 5,
      activelyComparing: 4,
      problemIdentified: 3,
      definedTimeline: 2,
      generalResearch: 1,
    },
  },

  source: {
    maxPoints: 10,
    scores: {
      referral: 10,
      website: 8,
      organic_search: 7,
      event: 7,
      linkedin: 6,
      direct_mail: 6,
      email: 5,
      paid_search: 5,
      social: 4,
      cold_outreach: 3,
      other: 2,
    } as Record<string, number>,
    unknownScore: 2,
  },

  recency: {
    maxPoints: 5,
    missingScore: 0,
    bands: [
      { maxDaysInclusive: 3, points: 5 },
      { maxDaysInclusive: 7, points: 4 },
      { maxDaysInclusive: 14, points: 3 },
      { maxDaysInclusive: 30, points: 2 },
    ],
    /** Older than all bands */
    olderPoints: 1,
  },

  classification: {
    thresholds: [
      { min: 65, label: "CONTACT_NOW" as LeadClassification },
      { min: 40, label: "NURTURE" as LeadClassification },
      { min: 0, label: "DISQUALIFIED" as LeadClassification },
    ],
  },
} as const;

export type QualificationConfig = typeof qualificationConfig;
