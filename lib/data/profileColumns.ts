import type { ColumnProfile, RawRow } from "@/types/lead";

/**
 * Profile columns in a dataset
 * Returns basic statistics and sample values for each column
 */
export function profileColumns(rows: RawRow[]): ColumnProfile[] {
  if (!rows.length) return [];

  const columnNames = Object.keys(rows[0]);

  return columnNames.map((name, index) => {
    let populatedRows = 0;
    let emptyRows = 0;
    const sampleValues: string[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const value = row[name];
      const stringValue = String(value ?? "").trim();

      if (!stringValue || stringValue === "null" || stringValue === "undefined") {
        emptyRows++;
      } else {
        populatedRows++;
        // Collect up to 3 diverse samples
        if (seen.size < 3 && !seen.has(stringValue)) {
          seen.add(stringValue);
          sampleValues.push(stringValue);
        }
      }
    }

    return {
      originalName: name,
      index,
      totalRows: rows.length,
      populatedRows,
      emptyRows,
      sampleValues,
    };
  });
}
