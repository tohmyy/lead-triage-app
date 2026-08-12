import type { LeadAISignals } from "@/types/qualification";

/** Neutral signals used when AI analysis is unavailable. */
export const UNKNOWN_AI_SIGNALS: LeadAISignals = {
  intent: {
    level: "none",
    readyToPurchase: false,
    requestedPricing: false,
    requestedQuote: false,
    requestedMeeting: false,
    activelyComparing: false,
    problemIdentified: false,
  },
  timeline: {
    value: "unknown",
    urgency: "unknown",
  },
  painPoints: [],
  buyer: {
    seniority: "unknown",
    department: null,
    decisionMaker: "unknown",
  },
  explanationSignals: [],
};
