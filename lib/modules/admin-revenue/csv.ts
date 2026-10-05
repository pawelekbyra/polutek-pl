/**
 * CSV for exports from the panel. Spreadsheet programs run a cell that starts with = + - @ (or TAB/CR) as a
 * formula, so such a cell gets a leading apostrophe (OWASP "CSV Injection"). Quotes are doubled, cells with
 * separators/quotes/newlines are quoted, lines end with CRLF (RFC 4180), the file starts with a BOM for Excel.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
