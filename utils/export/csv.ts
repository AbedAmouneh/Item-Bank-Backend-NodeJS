export interface ExportOptions {
  headers?: string[];
  includeHeaders?: boolean;
}

/**
 * Export data to CSV format
 * @param data Array of objects to export
 * @param options Export options
 * @returns Promise resolving to CSV buffer
 */
export async function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions = {}
): Promise<Buffer> {
  const { headers, includeHeaders = true } = options;

  // Determine headers from first row if not provided
  const csvHeaders =
    headers || (data.length > 0 && data[0] ? Object.keys(data[0]) : []) || [];

  const rows: string[][] = [];

  // Add header row if requested
  if (includeHeaders && csvHeaders.length > 0) {
    rows.push(csvHeaders);
  }

  // Add data rows
  for (const row of data) {
    const values = csvHeaders.map(header => {
      const value = row[header];
      if (value === null || value === undefined) {
        return '';
      }
      // Handle arrays and objects
      if (Array.isArray(value)) {
        return value.join('; ');
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
    rows.push(values);
  }

  // Build CSV string manually for better control
  const csvString = rows
    .map(row =>
      row
        .map(cell => {
          // Escape quotes and wrap in quotes if contains comma, newline, or quote
          const cellStr = String(cell);
          if (
            cellStr.includes(',') ||
            cellStr.includes('\n') ||
            cellStr.includes('"')
          ) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(',')
    )
    .join('\n');

  return Buffer.from(csvString, 'utf-8');
}
