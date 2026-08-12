/**
 * Column profiling and mapping types
 */

export type SemanticField =
  | "leadId"
  | "createdAt"
  | "name"
  | "email"
  | "phone"
  | "company"
  | "employeeCount"
  | "website"
  | "jobTitle"
  | "industry"
  | "location"
  | "source"
  | "budget"
  | "productInterest"
  | "notes"
  | "other"
  | "ignore";

export type ColumnProfile = {
  originalName: string;
  index: number;
  totalRows: number;
  populatedRows: number;
  emptyRows: number;
  sampleValues: string[];
};

export type ColumnMapping = {
  originalColumn: string;
  normalizedField: SemanticField;
  confidence: number;
  reason: string;
};

export type ColumnMappingRequest = {
  columns: Array<{
    name: string;
    samples: string[];
  }>;
};

export type ColumnMappingResponse = {
  mappings: ColumnMapping[];
};

export type UserColumnMappingOverride = {
  originalColumn: string;
  selectedField: SemanticField;
};
