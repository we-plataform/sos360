/**
 * CSV Generator Utility
 *
 * Generates CSV files with proper UTF-8 BOM encoding for Excel compatibility.
 * Handles special characters (commas, quotes, newlines) through proper escaping.
 */

export interface CsvGenerateOptions {
  /**
   * Whether to include UTF-8 BOM (Byte Order Mark)
   * @default true
   */
  includeBOM?: boolean;
}

/**
 * Escapes a CSV field value according to RFC 4180
 * - Fields containing quotes, commas, or newlines are wrapped in double quotes
 * - Double quotes within the field are escaped by doubling them ("")
 */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If the field contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Generates CSV content from an array of objects
 *
 * @param data - Array of objects to convert to CSV
 * @param fields - Array of field names (keys) to include in the CSV
 * @param options - CSV generation options
 * @returns CSV string with UTF-8 BOM if enabled
 *
 * @example
 * ```ts
 * const data = [
 *   { name: 'John Doe', email: 'john@example.com' },
 *   { name: 'Jane Smith', email: 'jane@example.com' }
 * ];
 * const csv = generateCSV(data, ['name', 'email']);
 * // Returns: '\uFEFFname,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com'
 * ```
 */
export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  fields: (keyof T & string)[],
  options: CsvGenerateOptions = {}
): string {
  const { includeBOM = true } = options;

  // Start with UTF-8 BOM for Excel compatibility
  let csv = includeBOM ? '\uFEFF' : '';

  // Add header row
  csv += fields.join(',') + '\n';

  // Add data rows
  for (const row of data) {
    const values = fields.map(field => escapeCsvField(row[field]));
    csv += values.join(',') + '\n';
  }

  return csv;
}

/**
 * Generates a CSV filename with timestamp
 *
 * @param basename - Base name for the file (without extension)
 * @returns Filename in format: 'basename-YYYY-MM-DD.csv'
 *
 * @example
 * ```ts
 * const filename = generateCsvFilename('leads');
 * // Returns something like: 'leads-2024-01-27.csv'
 * ```
 */
export function generateCsvFilename(basename: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${basename}-${date}.csv`;
}
