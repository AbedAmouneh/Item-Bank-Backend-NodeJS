import { describe, expect, test } from 'vitest';

import { exportData } from '../../utils/export';
import { exportToCSV } from '../../utils/export/csv';
import { exportToExcel } from '../../utils/export/excel';
import { exportToPDF } from '../../utils/export/pdf';

describe('export utilities', () => {
  const rows = [
    {
      id: 1,
      name: 'Alice',
      notes: 'Contains,comma and "quotes"',
      tags: ['a', 'b'],
    },
  ];

  // --- CSV ---

  test('exports CSV with escaped values', async () => {
    const csv = await exportToCSV(rows);
    const text = csv.toString('utf8');

    expect(text).toContain('id,name,notes,tags');
    expect(text).toContain('"Contains,comma and ""quotes"""');
    expect(text).toContain('a; b');
  });

  test('exports empty CSV when data array is empty', async () => {
    const csv = await exportToCSV([]);
    const text = csv.toString('utf8');

    expect(text).toBe('');
  });

  test('exports CSV without header row when includeHeaders is false', async () => {
    const csv = await exportToCSV([{ x: 1, y: 2 }], {
      headers: ['x', 'y'],
      includeHeaders: false,
    });
    const text = csv.toString('utf8');

    expect(text).not.toContain('x,y');
    expect(text).toBe('1,2');
  });

  test('renders null and undefined cell values as empty strings', async () => {
    const csv = await exportToCSV([{ a: null, b: undefined, c: 'ok' }] as any);
    const text = csv.toString('utf8');

    expect(text).toContain(',,ok');
  });

  test('serializes nested objects as JSON in CSV cells', async () => {
    const csv = await exportToCSV([{ data: { nested: true } }] as any);
    const text = csv.toString('utf8');

    // JSON contains quotes, so CSV wraps and escapes: "{""nested"":true}"
    expect(text).toContain('nested');
    expect(text).toContain('true');
  });

  test('escapes cells containing newlines in CSV', async () => {
    const csv = await exportToCSV([{ msg: 'line1\nline2' }]);
    const text = csv.toString('utf8');

    expect(text).toContain('"line1\nline2"');
  });

  test('uses custom headers to select CSV columns', async () => {
    const csv = await exportToCSV([{ a: 1, b: 2, c: 3 }], {
      headers: ['c', 'a'],
    });
    const text = csv.toString('utf8');
    const lines = text.split('\n');

    expect(lines[0]).toBe('c,a');
    expect(lines[1]).toBe('3,1');
  });

  // --- Excel ---

  test('exports Excel buffer', async () => {
    const excel = await exportToExcel(rows, { sheetName: 'Fixture' });

    expect(Buffer.isBuffer(excel)).toBe(true);
    expect(excel.length).toBeGreaterThan(0);
  });

  test('exports Excel without headers when includeHeaders is false', async () => {
    const excel = await exportToExcel([{ x: 1 }], { includeHeaders: false });

    expect(Buffer.isBuffer(excel)).toBe(true);
    expect(excel.length).toBeGreaterThan(0);
  });

  test('exports Excel with single-row data', async () => {
    const excel = await exportToExcel([{ a: 'hello' }]);

    expect(Buffer.isBuffer(excel)).toBe(true);
    expect(excel.length).toBeGreaterThan(0);
  });

  // --- PDF ---

  test('exports PDF buffer', async () => {
    const pdf = await exportToPDF(rows, { title: 'Fixture Export' });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
  });

  test('exports PDF without title', async () => {
    const pdf = await exportToPDF([{ a: 1 }]);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
  });

  test('exports PDF in portrait orientation', async () => {
    const pdf = await exportToPDF([{ a: 1 }], { orientation: 'portrait' });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
  });

  test('exports PDF without headers when includeHeaders is false', async () => {
    const pdf = await exportToPDF([{ a: 1 }], { includeHeaders: false });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
  });

  // --- universal export ---

  test('routes through universal export function', async () => {
    const csv = await exportData(rows, 'csv');
    const excel = await exportData(rows, 'excel');
    const pdf = await exportData(rows, 'pdf');

    expect(csv.length).toBeGreaterThan(0);
    expect(excel.length).toBeGreaterThan(0);
    expect(pdf.length).toBeGreaterThan(0);
  });

  test('throws on unsupported export format', async () => {
    await expect(exportData(rows, 'xml' as any)).rejects.toThrow(
      /unsupported export format/i
    );
  });

  test('passes options through universal export to each format', async () => {
    const csv = await exportData([{ a: 1, b: 2 }], 'csv', {
      headers: ['b'],
      includeHeaders: true,
    });
    const text = csv.toString('utf8');

    expect(text).toContain('b');
    expect(text).not.toContain('a');
  });

  test('passes includeHeaders and sheetName to excel via exportData', async () => {
    const excel = await exportData([{ a: 1 }], 'excel', {
      includeHeaders: false,
      sheetName: 'Custom Sheet',
    });

    expect(Buffer.isBuffer(excel)).toBe(true);
    expect(excel.length).toBeGreaterThan(0);
  });

  test('passes includeHeaders and orientation to pdf via exportData', async () => {
    const pdf = await exportData([{ a: 1 }], 'pdf', {
      includeHeaders: false,
      orientation: 'portrait',
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
  });

  // --- excel null/object cell values ---

  test('exportToExcel renders null cell as empty string', async () => {
    const excel = await exportToExcel([{ a: null, b: { key: 'val' } }] as any);

    expect(Buffer.isBuffer(excel)).toBe(true);
    expect(excel.length).toBeGreaterThan(0);
  });

  // --- pdf null/object cell values ---

  test('exportToPDF renders null cell as empty string and objects as JSON', async () => {
    const pdf = await exportToPDF([{ a: null, b: { key: 'val' } }] as any);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
  });
});
