import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRabbitSvg } from "@/app/components/preload/rabbit-vector";
import { RABBIT_PUPIL } from "@/app/components/preload/gate-warp-timeline";

const svg = readFileSync(join(process.cwd(), "public/rabbit-gate-2.svg"), "utf8");

describe("rabbit vector (public/rabbit-gate-2.svg)", () => {
  it("has the three flat layers in drawing order: silhouette, shading, lines", () => {
    const parsed = parseRabbitSvg(svg)!;
    expect(parsed.size).toBe(1926);
    expect(parsed.layers.map((l) => l.fill)).toEqual(["#ffffff", "#f7f3ef", "#000000"]);
    for (const layer of parsed.layers) expect(layer.d.length).toBeGreaterThan(1000);
  });

  it("is small enough to ship (under 90 KB, about 30 KB gzipped) and has no scripts or external references", () => {
    expect(svg.length).toBeLessThan(90_000);
    expect(svg).not.toMatch(/<script|href=|xlink|onload/i);
  });

  it("keeps the warp's target (the black dot) inside the picture", () => {
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

describe("after the entry", () => {
  it("lets go of the parsed rabbit", async () => {
    const { releaseRabbitVector, getRabbitVector } = await import("@/app/components/preload/rabbit-vector");
    releaseRabbitVector();
    expect(getRabbitVector()).toBeNull();
  });
});
