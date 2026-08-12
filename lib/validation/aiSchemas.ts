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

export type ColumnMappingResponse = z.infer<typeof ColumnMappingResponseSchema>;
export type SemanticNormalizationBatchResponse = z.infer<typeof SemanticNormalizationBatchResponseSchema>;
