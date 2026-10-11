import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRabbitSvg, RABBIT_SVG_URL } from "@/app/components/preload/rabbit-vector";
import { RABBIT_PUPIL } from "@/app/components/preload/gate-warp-timeline";
import { GATE_RABBIT, GATE_RABBIT_VARIANT, GATE_RABBIT_VARIANTS } from "@/app/components/preload/gate-rabbit";

const read = (url: string) => readFileSync(join(process.cwd(), "public", url), "utf8");

describe("the gate rabbit's variants (gate-rabbit.ts: one switch)", () => {
  it("has both entries, through the eye and through the dot under the tail, and one is active", () => {
    expect(Object.keys(GATE_RABBIT_VARIANTS).sort()).toEqual(["eye", "rear"]);
    expect(GATE_RABBIT).toBe(GATE_RABBIT_VARIANTS[GATE_RABBIT_VARIANT]);
    // Everything follows the switch.
    expect(RABBIT_SVG_URL).toBe(GATE_RABBIT.svg);
    expect(RABBIT_PUPIL).toBe(GATE_RABBIT.target);
  });

  it("gives each variant its own picture file (a cached picture must never meet another variant's target)", () => {
    const files = Object.values(GATE_RABBIT_VARIANTS).map((v) => v.svg);
    expect(new Set(files).size).toBe(files.length);
  });

  for (const [name, variant] of Object.entries(GATE_RABBIT_VARIANTS)) {
    describe(`"${name}" (public${variant.svg})`, () => {
      const svg = read(variant.svg);

      it("is a traced picture with three flat layers in drawing order: silhouette, shading, lines", () => {
        const parsed = parseRabbitSvg(svg)!;
        expect(parsed.size).toBeGreaterThan(400);
        expect(parsed.layers).toHaveLength(3);
        expect(parsed.layers[0].fill).toBe("#ffffff");
        expect(parsed.layers[2].fill).toBe("#000000");
        for (const layer of parsed.layers) expect(layer.d.length).toBeGreaterThan(1000);
      });

      it("is small enough to ship (under 90 KB) and has no scripts or external references", () => {
        expect(svg.length).toBeLessThan(90_000);
        expect(svg).not.toMatch(/<script|href=|xlink|onload/i);
      });

      it("keeps its target inside the picture, with a small solid core, and a modest shift", () => {
        for (const v of [variant.target.x, variant.target.y]) {
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThan(1);
        }
        expect(variant.target.core).toBeGreaterThan(0);
        expect(variant.target.core).toBeLessThan(0.02);
        expect(Math.abs(variant.shift.x)).toBeLessThan(0.2);
        expect(Math.abs(variant.shift.y)).toBeLessThan(0.2);
      });
    });
  }

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
