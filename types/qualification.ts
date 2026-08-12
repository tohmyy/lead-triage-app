import type { NormalizedLead } from "@/types/lead";

export type IntentLevel = "none" | "low" | "medium" | "high";

export type TimelineValue =
  | "immediate"
  | "within_1_month"
  | "1_3_months"
  | "3_6_months"
  | "unknown";

export type UrgencyLevel = "low" | "medium" | "high" | "unknown";

export type Seniority =
  | "executive"
  | "director"
  | "manager"
  | "specialist"
  | "entry_level"
  | "unknown";

export type DecisionMakerLevel =
  | "very_high"
  | "high"
  | "medium"
  | "low"
  | "unknown";

export type LeadClassification = "CONTACT_NOW" | "NURTURE" | "DISQUALIFIED";

export type LeadAISignals = {
  intent: {
    level: IntentLevel;
    readyToPurchase: boolean;
    requestedPricing: boolean;
    requestedQuote: boolean;
    requestedMeeting: boolean;
    activelyComparing: boolean;
    problemIdentified: boolean;
  };
  timeline: {
    value: TimelineValue;
    urgency: UrgencyLevel;
  };
  painPoints: string[];
  buyer: {
    seniority: Seniority;
    department: string | null;
    decisionMaker: DecisionMakerLevel;
  };
  explanationSignals: string[];
};

export type ScoreComponents = {
  budgetFit: number;
  intent: number;
  companyFit: number;
  buyerFit: number;
  source: number;
  recency: number;
};

export type LeadScore = {
  total: number;
  components: ScoreComponents;
  classification: LeadClassification;
  explanation: string;
  reasons: string[];
};

export type RankedLead = {
  rank: number;
  lead: NormalizedLead;
  aiSignals: LeadAISignals;
  score: LeadScore;
  aiAnalyzed: boolean;
};

export type AnalyzeLeadInput = {
  id: string;
  jobTitle?: string | null;
  notes?: string | null;
};
