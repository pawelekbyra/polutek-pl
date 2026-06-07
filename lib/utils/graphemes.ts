export function countGraphemes(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter("pl", { granularity: "grapheme" }).segment(text)].length;
  }

  return Array.from(text).length;
}
