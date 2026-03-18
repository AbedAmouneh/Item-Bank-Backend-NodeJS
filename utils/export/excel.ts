import ExcelJS from 'exceljs';

export interface ExportOptions {
  headers?: string[];
  includeHeaders?: boolean;
  sheetName?: string;
}

/**
 * Export data to Excel format
 * @param data Array of objects to export
 * @param options Export options
 * @returns Promise resolving to Excel buffer
 */
export async function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions = {}
): Promise<Buffer> {
  const { headers, includeHeaders = true, sheetName = 'Sheet1' } = options;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Determine headers from first row if not provided
  const excelHeaders =
    headers || (data.length > 0 && data[0] ? Object.keys(data[0]) : []) || [];

  // Add header row if requested
  if (includeHeaders && excelHeaders.length > 0) {
    const headerRow = worksheet.addRow(excelHeaders);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  // Add data rows
  for (const row of data) {
    const values = excelHeaders.map(header => {
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
      return value;
    });
    worksheet.addRow(values);
  }

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    if (column.header) {
      column.width = Math.max(
        column.header.toString().length + 2,
        column.width || 10
      );
    }
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
