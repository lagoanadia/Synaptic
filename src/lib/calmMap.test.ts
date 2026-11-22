import { describe, expect, it } from "vitest";
import { calmLayout, markOf } from "./calmMap";
import type { MapNode } from "./knowledgeMap";

const n = (id: string, parentId: string | null, status: MapNode["status"] = "NEW"): MapNode => ({ id, title: id, status, statusAt: new Date().toISOString(), depth: parentId ? 1 : 0, parentId, href: `/c/${id}` });

describe("calm map", () => {
  it("groups a concept with the ones under it, and loose ones together", () => {
    const { groups } = calmLayout([n("Despliegue", null), n("SaaS", "Despliegue"), n("On-Premise", "Despliegue"), n("PID", null), n("Hilo", null)]);
    expect(groups.map((g) => [g.title, g.dots.length])).toEqual([["Despliegue", 3], ["Otros conceptos", 2]]);
    expect(groups[0].lines).toHaveLength(2);
    expect(groups[0].dots[0].main).toBe(true);
  });
  it("keeps everything inside the picture", () => {
    const nodes = [n("r", null), ...Array.from({ length: 30 }, (_, i) => n(`c${i}`, "r")), ...Array.from({ length: 40 }, (_, i) => n(`l${i}`, null))];
    const { groups, width, height } = calmLayout(nodes);
    for (const d of groups.flatMap((g) => g.dots)) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThanOrEqual(width);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeLessThanOrEqual(height);
    }
  });
  it("marks: known, half, review, new", () => {
    expect(markOf({ status: "MASTERED", statusAt: new Date() })).toBe("k");
    expect(markOf({ status: "SEEN", statusAt: null })).toBe("p");
    expect(markOf({ status: "REREAD", statusAt: null })).toBe("r");
    expect(markOf({ status: "NEW", statusAt: null })).toBe("n");
  });
});
