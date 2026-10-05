/**
 * CSV writing that is safe to open in Excel, LibreOffice and Google Sheets (OWASP "CSV Injection").
 * A cell that starts with = + - @ (or a tab / carriage return, which spreadsheets also treat as the start of
 * a formula or a hidden prefix) is executed as a formula. A user controls fields such as the nickname, so every
 * text cell is neutralised: a single quote is put in front (spreadsheets then show text and hide the quote) and
 * the cell is always quoted, with inner quotes doubled (RFC 4180). Numbers we compute ourselves (negative
 * amounts) go through `csvNumber`, which is never prefixed, so they stay numbers.
 */
const FORMULA_START = /^[\s\u0000-\u001f\u007f ﻿]*[=+\-@]/;
const LEADING_CONTROL = /^[\t\r\n]/;

export function csvText(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Line breaks inside a cell are legal in a quoted field but break naive importers; flatten them.
  text = text.replace(/\r\n|\r|\n/g, " ");
  if (FORMULA_START.test(text) || LEADING_CONTROL.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** A number we computed: never prefixed (a leading minus is a sign, not a formula). Non-finite becomes empty. */
export function csvNumber(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

export type CsvCell = { text: string } | { number: number | null | undefined };

/** Rows of cells to one CSV document (CRLF line ends per RFC 4180, UTF-8 BOM so Excel reads Polish letters). */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header.map(csvText).join(","), ...rows.map((row) => row.map((c) => ("text" in c ? csvText(c.text) : csvNumber(c.number))).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
