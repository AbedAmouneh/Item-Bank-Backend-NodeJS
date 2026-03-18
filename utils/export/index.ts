/**
 * Universal export function that handles all formats
 */
import { exportToCSV } from './csv';
import { exportToExcel } from './excel';
import { exportToPDF } from './pdf';

export { exportToCSV, type ExportOptions as CSVExportOptions } from './csv';
export {
  exportToExcel,
  type ExportOptions as ExcelExportOptions,
} from './excel';
export { exportToPDF, type ExportOptions as PDFExportOptions } from './pdf';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface UniversalExportOptions {
  headers?: string[];
  includeHeaders?: boolean;
  title?: string;
  sheetName?: string;
  orientation?: 'portrait' | 'landscape';
}

export async function exportData<T extends Record<string, unknown>>(
  data: T[],
  format: ExportFormat,
  options: UniversalExportOptions = {}
): Promise<Buffer> {
  switch (format) {
    case 'csv': {
      const csvOptions: { headers?: string[]; includeHeaders?: boolean } = {};
      if (options.headers !== undefined) csvOptions.headers = options.headers;
      if (options.includeHeaders !== undefined)
        csvOptions.includeHeaders = options.includeHeaders;
      return exportToCSV(data, csvOptions);
    }
    case 'excel': {
      const excelOptions: {
        headers?: string[];
        includeHeaders?: boolean;
        sheetName?: string;
      } = {};
      if (options.headers !== undefined) excelOptions.headers = options.headers;
      if (options.includeHeaders !== undefined)
        excelOptions.includeHeaders = options.includeHeaders;
      if (options.sheetName !== undefined)
        excelOptions.sheetName = options.sheetName;
      return exportToExcel(data, excelOptions);
    }
    case 'pdf': {
      const pdfOptions: {
        headers?: string[];
        includeHeaders?: boolean;
        title?: string;
        orientation?: 'portrait' | 'landscape';
      } = {};
      if (options.headers !== undefined) pdfOptions.headers = options.headers;
      if (options.includeHeaders !== undefined)
        pdfOptions.includeHeaders = options.includeHeaders;
      if (options.title !== undefined) pdfOptions.title = options.title;
      if (options.orientation !== undefined)
        pdfOptions.orientation = options.orientation;
      return exportToPDF(data, pdfOptions);
    }
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
