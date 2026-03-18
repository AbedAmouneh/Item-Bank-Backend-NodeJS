import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportOptions {
  headers?: string[];
  includeHeaders?: boolean;
  title?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Export data to PDF format
 * @param data Array of objects to export
 * @param options Export options
 * @returns Promise resolving to PDF buffer
 */
export async function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions = {}
): Promise<Buffer> {
  const {
    headers,
    includeHeaders = true,
    title,
    orientation = 'landscape',
  } = options;

  // Determine headers from first row if not provided
  const pdfHeaders =
    headers || (data.length > 0 && data[0] ? Object.keys(data[0]) : []) || [];

  // Create PDF document
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Add title if provided
  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 20);
  }

  // Prepare data for table
  const tableData = data.map(row =>
    pdfHeaders.map(header => {
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
    })
  );

  // Add table
  autoTable(doc, {
    head: includeHeaders ? [pdfHeaders] : [],
    body: tableData,
    startY: title ? 30 : 20,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [224, 224, 224],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: title ? 30 : 20, left: 14, right: 14 },
  });

  // Generate buffer
  const buffer = doc.output('arraybuffer');
  return Buffer.from(buffer);
}
