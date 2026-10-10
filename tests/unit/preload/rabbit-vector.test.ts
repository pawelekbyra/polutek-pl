import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRabbitSvg } from "@/app/components/preload/rabbit-vector";
import { RABBIT_PUPIL } from "@/app/components/preload/gate-warp-timeline";

const svg = readFileSync(join(process.cwd(), "public/rabbit-gate.svg"), "utf8");

describe("rabbit vector (public/rabbit-gate.svg)", () => {
  it("has the three flat layers in drawing order: silhouette, shading, lines", () => {
    const parsed = parseRabbitSvg(svg)!;
    expect(parsed.size).toBe(1760);
    expect(parsed.layers.map((l) => l.fill)).toEqual(["#ffffff", "#f6f2ee", "#000000"]);
    for (const layer of parsed.layers) expect(layer.d.length).toBeGreaterThan(1000);
  });

  it("is small enough to ship (under 80 KB) and has no scripts or external references", () => {
    expect(svg.length).toBeLessThan(80_000);
    expect(svg).not.toMatch(/<script|href=|xlink|onload/i);
  });

  it("keeps the warp's target (the pupil's black core) inside the picture", () => {
    expect(RABBIT_PUPIL.x).toBeGreaterThan(0);
    expect(RABBIT_PUPIL.x).toBeLessThan(1);
    expect(RABBIT_PUPIL.y).toBeGreaterThan(0);
    expect(RABBIT_PUPIL.y).toBeLessThan(1);
  });

  it("rejects text that is not the traced SVG", () => {
    expect(parseRabbitSvg("<svg></svg>")).toBeNull();
    expect(parseRabbitSvg('<svg viewBox="0 0 10 10"></svg>')).toBeNull();
  });
});
