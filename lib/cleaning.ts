import * as XLSX from "xlsx";
import { z } from "zod";

export type RowMap = Record<string, string>;
export type Severity = "info" | "warning" | "error";

export type DataIssue = {
  id: string;
  category: string;
  count: number;
  severity: Severity;
  explanation: string;
};

export type CleaningAction = {
  key: string;
  label: string;
  description: string;
  affected: number;
  enabled: boolean;
};

export type QualitySummary = {
  rows: number;
  columns: number;
  duplicateRows: number;
  rowsWithMissingValues: number;
  invalidEmailCount: number;
  invalidPhoneCount: number;
};

export type CleaningResult = {
  rows: RowMap[];
  issues: DataIssue[];
  summary: QualitySummary;
};

const emailSchema = z.string().trim().email();
const phoneSchema = z.string().trim().regex(/^(?:\+?\d[\d\s().-]{7,}\d)$/);

export function normalizeHeader(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function safeString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function buildIssueTemplates(): DataIssue[] {
  return [
    {
      id: "duplicate-records",
      category: "Duplicate records",
      count: 0,
      severity: "warning",
      explanation: "Repeated rows that should be reviewed before downstream lead processing.",
    },
    {
      id: "missing-values",
      category: "Missing values",
      count: 0,
      severity: "warning",
      explanation: "Rows or cells with empty values that may require cleanup.",
    },
    {
      id: "invalid-emails",
      category: "Invalid emails",
      count: 0,
      severity: "error",
      explanation: "Email fields that do not match a standard format.",
    },
    {
      id: "invalid-phone",
      category: "Invalid phone numbers",
      count: 0,
      severity: "error",
      explanation: "Phone fields that appear incomplete, malformed, or inconsistent.",
    },
    {
      id: "empty-rows",
      category: "Empty rows",
      count: 0,
      severity: "info",
      explanation: "Rows with no meaningful values that can be safely removed.",
    },
    {
      id: "inconsistent-values",
      category: "Inconsistent values",
      count: 0,
      severity: "warning",
      explanation: "Spacing, casing, and formatting differences needing normalization.",
    },
  ];
}

function getRowSignature(row: RowMap) {
  return Object.values(row)
    .map((value) => safeString(value).toLowerCase())
    .join("||");
}

export function summarizeRows(rows: RowMap[]): QualitySummary {
  const results = analyzeRows(rows);
  return results.summary;
}

export function buildQualityIssues(rows: RowMap[]): DataIssue[] {
  const results = analyzeRows(rows);
  return results.issues;
}

function analyzeRows(rows: RowMap[]) {
  const issues = buildIssueTemplates();

  const seen = new Set<string>();
  let duplicateRows = 0;
  let rowsWithMissingValues = 0;
  let invalidEmailCount = 0;
  let invalidPhoneCount = 0;

  rows.forEach((row) => {
    const flattened = Object.values(row).map((value) => safeString(value));
    const rowSignature = getRowSignature(row);
    const isEmptyRow = flattened.every((value) => !value);
    const hasMissingValue = flattened.some((value) => !value);

    if (isEmptyRow) {
      issues.find((issue) => issue.id === "empty-rows")!.count += 1;
    }

    if (hasMissingValue) {
      rowsWithMissingValues += 1;
      issues.find((issue) => issue.id === "missing-values")!.count += 1;
    }

    if (seen.has(rowSignature)) {
      duplicateRows += 1;
      issues.find((issue) => issue.id === "duplicate-records")!.count += 1;
    } else {
      seen.add(rowSignature);
    }

    Object.entries(row).forEach(([key, value]) => {
      const normalizedValue = safeString(value);
      if (!normalizedValue) return;

      const lowerKey = key.toLowerCase();
      const isEmailField = lowerKey.includes("email");
      const isPhoneField = lowerKey.includes("phone") || lowerKey.includes("mobile");

      if (isEmailField) {
        try {
          emailSchema.parse(normalizedValue);
        } catch {
          invalidEmailCount += 1;
          issues.find((issue) => issue.id === "invalid-emails")!.count += 1;
        }
      }

      if (isPhoneField) {
        try {
          phoneSchema.parse(normalizedValue);
        } catch {
          invalidPhoneCount += 1;
          issues.find((issue) => issue.id === "invalid-phone")!.count += 1;
        }
      }

      const hasFormattingIssue =
        normalizedValue !== value.trim() || /\s{2,}/.test(normalizedValue) || normalizedValue !== normalizedValue.toLowerCase();
      if (hasFormattingIssue && (isEmailField || isPhoneField || lowerKey.includes("name") || lowerKey.includes("company") || lowerKey.includes("location"))) {
        issues.find((issue) => issue.id === "inconsistent-values")!.count += 1;
      }
    });
  });

  const summary: QualitySummary = {
    rows: rows.length,
    columns: rows[0] ? Object.keys(rows[0]).length : 0,
    duplicateRows,
    rowsWithMissingValues,
    invalidEmailCount,
    invalidPhoneCount,
  };

  return { summary, issues };
}

export function parseCsvFile(file: File): Promise<CleaningResult> {
  return new Promise((resolve, reject) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      reject(new Error("Unsupported file type. Please upload a CSV file."));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      reject(new Error("File is too large. Please upload a CSV under 2 MB."));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data || typeof data !== "string") {
          reject(new Error("The CSV file could not be read."));
          return;
        }

        const workbook = XLSX.read(data, { type: "string", raw: false });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error("The CSV appears to be empty."));
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });

        if (!rawRows.length) {
          reject(new Error("The CSV is empty or has no rows to process."));
          return;
        }

        const headers = Object.keys(rawRows[0]).filter((header) => header && header.trim());
        if (!headers.length) {
          reject(new Error("The CSV appears to be missing valid headers."));
          return;
        }

        const normalizedRows = rawRows.map((row, rowIndex) => {
          const normalized: RowMap = {};
          headers.forEach((header) => {
            const value = row[header];
            normalized[normalizeHeader(header)] = safeString(value);
          });

          if (Object.keys(normalized).length === 0) {
            throw new Error(`Row ${rowIndex + 1} is malformed and cannot be processed.`);
          }

          return normalized;
        });

        const evaluation = analyzeRows(normalizedRows);
        resolve({ rows: normalizedRows, issues: evaluation.issues, summary: evaluation.summary });
      } catch (error) {
        reject(new Error(error instanceof Error ? error.message : "The CSV could not be processed."));
      }
    };

    reader.onerror = () => {
      reject(new Error("The CSV file could not be read. Please try another file."));
    };

    reader.readAsText(file, "UTF-8");
  });
}

export function buildCleaningActions(rows: RowMap[]): CleaningAction[] {
  const duplicateCount = countDuplicates(rows);
  const whitespaceCount = rows.reduce((count, row) => {
    return (
      count +
      Object.values(row).filter((value) => {
        const trimmed = safeString(value);
        return trimmed !== value || /\s{2,}/.test(value);
      }).length
    );
  }, 0);
  const emailCaseCount = rows.reduce((count, row) => {
    return (
      count +
      Object.entries(row).filter(([key, value]) => {
        const normalized = safeString(value);
        return key.toLowerCase().includes("email") && normalized && normalized !== normalized.toLowerCase();
      }).length
    );
  }, 0);
  const phoneFormattingCount = rows.reduce((count, row) => {
    return (
      count +
      Object.entries(row).filter(([key, value]) => {
        const normalized = safeString(value);
        return (
          (key.toLowerCase().includes("phone") || key.toLowerCase().includes("mobile")) &&
          normalized &&
          /[\s().-]/.test(normalized)
        );
      }).length
    );
  }, 0);

  return [
    {
      key: "removeEmptyRows",
      label: "Remove completely empty rows",
      description: "Delete rows with no meaningful values.",
      affected: rows.filter((row) => Object.values(row).every((value) => !safeString(value))).length,
      enabled: true,
    },
    {
      key: "removeDuplicates",
      label: "Remove duplicate rows",
      description: "Eliminate exact duplicate records.",
      affected: duplicateCount,
      enabled: true,
    },
    {
      key: "trimWhitespace",
      label: "Trim whitespace",
      description: "Strip leading and trailing spaces from values.",
      affected: whitespaceCount,
      enabled: true,
    },
    {
      key: "normalizeColumnNames",
      label: "Normalize column names",
      description: "Standardize headers for later pipeline stages.",
      affected: rows.length ? Math.max(0, Object.keys(rows[0]).length - 1) : 0,
      enabled: true,
    },
    {
      key: "normalizeEmailCasing",
      label: "Normalize email casing",
      description: "Lowercase email values for consistent matching.",
      affected: emailCaseCount,
      enabled: true,
    },
    {
      key: "normalizePhoneNumbers",
      label: "Normalize phone numbers where possible",
      description: "Clean common separators and formatting issues.",
      affected: phoneFormattingCount,
      enabled: true,
    },
  ];
}

export function countDuplicates(rows: RowMap[]) {
  const seen = new Set<string>();
  let duplicates = 0;

  rows.forEach((row) => {
    const signature = getRowSignature(row);
    if (seen.has(signature)) {
      duplicates += 1;
    } else {
      seen.add(signature);
    }
  });

  return duplicates;
}

export function applyCleaningOps(rows: RowMap[], actions: CleaningAction[]) {
  const active = new Set(actions.filter((action) => action.enabled).map((action) => action.key));

  let nextRows = rows.map((row) => ({ ...row }));

  if (active.has("removeEmptyRows")) {
    nextRows = nextRows.filter((row) => Object.values(row).some((value) => safeString(value)));
  }

  if (active.has("removeDuplicates")) {
    const seen = new Set<string>();
    nextRows = nextRows.filter((row) => {
      const signature = getRowSignature(row);
      if (seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    });
  }

  nextRows = nextRows.map((row) => {
    const normalized: RowMap = {};

    Object.entries(row).forEach(([key, value]) => {
      let nextValue = value;

      if (active.has("trimWhitespace")) {
        nextValue = safeString(nextValue);
      }

      if (active.has("normalizeEmailCasing") && key.toLowerCase().includes("email")) {
        nextValue = nextValue.toLowerCase();
      }

      if (
        active.has("normalizePhoneNumbers") &&
        (key.toLowerCase().includes("phone") || key.toLowerCase().includes("mobile"))
      ) {
        nextValue = nextValue.replace(/[\s().-]/g, "").replace(/^\+/, "+");
      }

      const normalizedKey = active.has("normalizeColumnNames") ? normalizeHeader(key) : key;
      normalized[normalizedKey] = nextValue;
    });

    return normalized;
  });

  return nextRows;
}

export function buildChangePreview(beforeRows: RowMap[], afterRows: RowMap[]) {
  const samples: Array<{ before: string; after: string; field: string }> = [];

  beforeRows.forEach((row, rowIndex) => {
    Object.entries(row).forEach(([key, value]) => {
      const currentAfter = afterRows[rowIndex]?.[key] ?? afterRows[rowIndex]?.[normalizeHeader(key)] ?? "";
      if (value.trim() && currentAfter.trim() && value !== currentAfter) {
        samples.push({ before: String(value), after: String(currentAfter), field: key });
      }
    });

    if (samples.length >= 6) return;
  });

  return samples.slice(0, 6);
}
