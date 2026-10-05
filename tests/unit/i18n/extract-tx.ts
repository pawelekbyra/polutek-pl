import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * Finds every interface text written as `tx("polish", "english", ...)` or
 * `txRich(tx, "polish", "english", ...)` in the public app code, so tests can compare them with the
 * translation catalogs. Calls whose texts are not plain string literals are reported separately:
 * they could not be checked, so they are not allowed.
 */
export type TxCall = { pl: string; en: string; file: string; line: number };
export type TxProblem = { file: string; line: number; reason: string };

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", "admin"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function literalText(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

export function sourceFiles(): string[] {
  return SOURCE_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)))
    .filter((file) => !/app[\\/]api[\\/]admin/.test(file))
    // The translation machinery itself calls tx(pl, en) with variables.
    .filter((file) => !/lib[\\/]i18n[\\/](ui|rich)\.tsx?$/.test(file))
    .sort();
}

export function extractTxCalls(): { calls: TxCall[]; problems: TxProblem[] } {
  const calls: TxCall[] = [];
  const problems: TxProblem[] = [];
  for (const file of sourceFiles()) {
    const source = fs.readFileSync(file, "utf8");
    if (!/\btx(Rich)?\(/.test(source)) continue;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const rel = path.relative(ROOT, file);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        if (name === "tx" || name === "txRich") {
          const offset = name === "txRich" ? 1 : 0;
          const pl = literalText(node.arguments[offset]);
          const en = literalText(node.arguments[offset + 1]);
          const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          if (pl === null || en === null) problems.push({ file: rel, line, reason: "tx() texts must be plain string literals" });
          else calls.push({ pl, en, file: rel, line });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { calls, problems };
}

/** English text -> the Polish texts and places that use it. */
export function groupByEnglish(calls: TxCall[]): Map<string, { pl: Set<string>; places: string[] }> {
  const map = new Map<string, { pl: Set<string>; places: string[] }>();
  for (const call of calls) {
    const entry = map.get(call.en) ?? { pl: new Set<string>(), places: [] };
    entry.pl.add(call.pl);
    entry.places.push(`${call.file}:${call.line}`);
    map.set(call.en, entry);
  }
  return map;
}
