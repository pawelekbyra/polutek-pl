/**
 * Minimal, dependency-free CSV parser for Mux's daily usage export files. Mux's exact column
 * schema for these CSVs isn't published in their API docs (confirmed while building this — the
 * only documented shape is "a row per asset, columns for input/storage/delivery usage types");
 * getting the column *name* wrong would silently under/over-count the budget check, so this
 * parses generically by header name rather than hard-coding an assumed column index.
 *
 * IMPORTANT: verify against a real exported CSV for this account (see the manual setup notes for
 * check-mux-usage-budget.use-case.ts) before trusting the numbers this produces.
 */

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

/**
 * Sums every numeric value in columns whose header contains "delivery" (case-insensitive) across
 * all data rows. Returns 0 for an empty/header-only CSV, and skips non-numeric cells rather than
 * throwing, since a partially-malformed export shouldn't crash the whole month-to-date total.
 */
export function sumDeliveryUsageFromCsv(csvText: string): number {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return 0;

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const deliveryColumnIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.includes("delivery"))
    .map(({ index }) => index);

  if (deliveryColumnIndexes.length === 0) return 0;

  let total = 0;
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    for (const index of deliveryColumnIndexes) {
      const value = Number(cells[index]);
      if (Number.isFinite(value)) total += value;
    }
  }

  return total;
}
