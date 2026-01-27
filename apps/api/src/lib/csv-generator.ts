/**
 * CSV Generator Utility
 *
 * Generates CSV files with proper UTF-8 BOM encoding for Excel compatibility.
 * Handles special characters (commas, quotes, newlines) through proper escaping.
 * Supports streaming for large datasets.
 */

import type { Response } from 'express';

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

/**
 * Streams CSV data to an HTTP response
 *
 * This function is optimized for large datasets and streams data incrementally
 * to avoid loading everything into memory.
 *
 * @param res - Express response object
 * @param dataGenerator - Async generator that yields data rows one at a time
 * @param fields - Array of field names (keys) to include in the CSV
 * @param options - CSV generation options
 *
 * @example
 * ```ts
 * async function* generateLeads() {
 *   const cursor = null;
 *   let hasMore = true;
 *   while (hasMore) {
 *     const batch = await prisma.lead.findMany({ ... });
 *     for (const lead of batch) yield lead;
 *     hasMore = batch.length === batchSize;
 *   }
 * }
 * await streamCSV(res, generateLeads(), ['name', 'email']);
 * ```
 */
export async function streamCSV<T extends Record<string, unknown>>(
  res: Response,
  dataGenerator: AsyncGenerator<T>,
  fields: (keyof T & string)[],
  options: CsvGenerateOptions = {}
): Promise<void> {
  const { includeBOM = true } = options;

  // Set headers for CSV download with streaming
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  // Write UTF-8 BOM for Excel compatibility
  if (includeBOM) {
    res.write('\uFEFF');
  }

  // Write header row
  const headerRow = fields.map(f => escapeCsvField(f)).join(',') + '\n';
  res.write(headerRow);

  // Stream data rows
  try {
    for await (const row of dataGenerator) {
      const values = fields.map(field => escapeCsvField(row[field]));
      const csvRow = values.join(',') + '\n';
      res.write(csvRow);
    }

    // End the response
    res.end();
  } catch (error) {
    // Ensure response is closed on error
    if (!res.writableEnded) {
      res.end();
    }
    throw error;
  }
}

/**
 * Creates a batch data generator for streaming large datasets
 *
 * This helper function creates an async generator that fetches data in batches
 * using cursor-based pagination, making it ideal for streaming large database results.
 *
 * @param fetchBatch - Function that fetches a batch of data given a cursor
 * @param batchSize - Number of items to fetch per batch
 * @returns Async generator that yields individual data items
 *
 * @example
 * ```ts
 * const fetchBatch = async (cursor: string | null) => {
 *   return await prisma.lead.findMany({
 *     take: batchSize,
 *     skip: cursor ? 1 : 0,
 *     cursor: cursor ? { id: cursor } : undefined,
 *     orderBy: { id: 'asc' }
 *   });
 * };
 * const generator = createBatchGenerator(fetchBatch, 100);
 * ```
 */
export function createBatchGenerator<T>(
  fetchBatch: (cursor: string | null) => Promise<T[]>,
  batchSize: number
): AsyncGenerator<T> {
  return async function* batchGenerator() {
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const batch = await fetchBatch(cursor);

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      // Yield each item in the batch
      for (const item of batch) {
        yield item;
      }

      // If we got fewer items than the batch size, we're done
      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        // Set cursor to the last item's ID for next batch
        const lastItem = batch[batch.length - 1] as Record<string, unknown>;
        cursor = lastItem.id as string;
      }
    }
  }();
}
