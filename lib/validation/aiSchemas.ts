import { z } from "zod";
import type { SemanticField } from "@/types/column";

/**
 * Zod schemas for validating AI responses
 */

const SemanticFieldSchema = z.enum([
  "leadId",
  "createdAt",
  "name",
  "email",
  "phone",
  "company",
  "employeeCount",
  "website",
  "jobTitle",
  "industry",
  "location",
  "source",
  "budget",
  "productInterest",
  "notes",
  "other",
  "ignore",
] as const);

export const ColumnMappingSchema = z.object({
  originalColumn: z.string(),
  normalizedField: SemanticFieldSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export const ColumnMappingResponseSchema = z.object({
  mappings: z.array(ColumnMappingSchema),
});

export const SemanticChangeSchema = z.object({
  field: z.string(),
  originalValue: z.string().nullable(),
  normalizedValue: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const SemanticNormalizationSchema = z.object({
  leadId: z.string(),
  normalized: z.record(z.string(), z.unknown()).optional(),
  changes: z.array(SemanticChangeSchema),
});

export const SemanticNormalizationBatchResponseSchema = z.object({
  results: z.array(SemanticNormalizationSchema),
  failedIndices: z.array(z.number()).optional(),
});

export const LeadAISignalsSchema = z.object({
  intent: z.object({
    level: z.enum(["none", "low", "medium", "high"]),
    readyToPurchase: z.boolean(),
    requestedPricing: z.boolean(),
    requestedQuote: z.boolean(),
    requestedMeeting: z.boolean(),
    activelyComparing: z.boolean(),
    problemIdentified: z.boolean(),
  }),
  timeline: z.object({
    value: z.enum([
      "immediate",
      "within_1_month",
      "1_3_months",
      "3_6_months",
      "unknown",
    ]),
    urgency: z.enum(["low", "medium", "high", "unknown"]),
  }),
  painPoints: z.array(z.string()),
  buyer: z.object({
    seniority: z.enum([
      "executive",
      "director",
      "manager",
      "specialist",
      "entry_level",
      "unknown",
    ]),
    department: z.string().nullable(),
    decisionMaker: z.enum(["very_high", "high", "medium", "low", "unknown"]),
  }),
  explanationSignals: z.array(z.string()),
});

export const LeadAIAnalysisResultSchema = z.object({
  leadId: z.string(),
  signals: LeadAISignalsSchema,
});

export const LeadAIAnalysisBatchResponseSchema = z.object({
  results: z.array(LeadAIAnalysisResultSchema),
  failedLeadIds: z.array(z.string()).optional(),
});

export type ColumnMappingResponse = z.infer<typeof ColumnMappingResponseSchema>;
export type SemanticNormalizationBatchResponse = z.infer<
  typeof SemanticNormalizationBatchResponseSchema
>;
export type LeadAISignalsValidated = z.infer<typeof LeadAISignalsSchema>;
export type LeadAIAnalysisBatchResponse = z.infer<
  typeof LeadAIAnalysisBatchResponseSchema
>;
