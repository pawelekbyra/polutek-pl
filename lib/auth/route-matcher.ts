/**
 * Minimal path matcher for the proxy. Patterns are literal paths where `(.*)` matches anything
 * (the notation the proxy route lists have always used).
 */
export function createRouteMatcher(patterns: readonly string[]) {
  const expressions = patterns.map((pattern) => {
    const source = pattern
      .split("(.*)")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${source}$`);
  });
  return (pathname: string) => expressions.some((expression) => expression.test(pathname));
}
