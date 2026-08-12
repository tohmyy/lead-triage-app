/**
 * Column profile metadata
 */
export type ColumnProfile = {
  originalName: string;
  index: number;
  totalRows: number;
  populatedRows: number;
  emptyRows: number;
  sampleValues: string[];
};

/**
 * Normalized lead structure
 */

export type NormalizedLead = {
  id: string;
  leadId?: string | null;
  createdAt?: string | null;

  name?: string | null;
  email?: string | null;
  phone?: string | null;

  company?: string | null;
  employeeCount?: number | string | null;
  website?: string | null;

  jobTitle?: string | null;
  industry?: string | null;
  location?: string | null;

  source?: string | null;
  budget?: number | string | null;
  productInterest?: string | null;

  notes?: string | null;
  normalizedNotes?: string | null;

  // Preserve columns mapped to "other"
  other?: Record<string, unknown>;
};

export type SemanticChange = {
  field: string;
  originalValue: string | null;
  normalizedValue: string | null;
  confidence: number;
};

export type SemanticNormalization = {
  leadId: string;
  normalized: Partial<NormalizedLead>;
  changes: SemanticChange[];
};

export type RawRow = Record<string, unknown>;
