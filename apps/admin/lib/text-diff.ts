/**
 * Line diff for "Różnica względem domyślnego": longest-common-subsequence over lines, no dependency.
 * Inputs are capped (a template is a few hundred lines), so the O(n*m) table stays small.
 */
export type DiffLine = { kind: "same" | "add" | "del"; text: string };

const MAX_LINES = 600;

export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n?/g, "\n").split("\n").slice(0, MAX_LINES);
  const b = after.replace(/\r\n?/g, "\n").split("\n").slice(0, MAX_LINES);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: "del", text: a[i++] });
    else out.push({ kind: "add", text: b[j++] });
  }
  while (i < a.length) out.push({ kind: "del", text: a[i++] });
  while (j < b.length) out.push({ kind: "add", text: b[j++] });
  return out;
}

export const hasChanges = (lines: DiffLine[]) => lines.some((l) => l.kind !== "same");
