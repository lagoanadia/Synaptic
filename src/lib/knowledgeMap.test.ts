import { describe, expect, it } from "vitest";
import { dotState, layoutMap, type MapCluster } from "./knowledgeMap";

const now = new Date("2026-11-06").getTime();

describe("dotState", () => {
  it("shows what you know, what's left and what's slipping", () => {
    expect(dotState({ status: "NEW", statusAt: null }, now)).toBe("todo");
    expect(dotState({ status: "MASTERED", statusAt: new Date(now - 40 * 86400000) }, now)).toBe("known");
    expect(dotState({ status: "UNDERSTOOD", statusAt: new Date(now - 2 * 86400000) }, now)).toBe("known");
    expect(dotState({ status: "UNDERSTOOD", statusAt: new Date(now - 30 * 86400000) }, now)).toBe("fading");
    expect(dotState({ status: "REREAD", statusAt: null }, now)).toBe("fading");
  });
});

describe("layoutMap", () => {
  const node = (id: string, parentId: string | null) => ({ id, title: id, status: "NEW" as const, statusAt: null, depth: parentId ? 1 : 0, parentId, href: "#" });
  const clusters: MapCluster[] = [
    { id: "a", label: "A", color: "#000", nodes: [node("a1", null), node("a2", "a1"), node("a3", "a1")] },
    { id: "b", label: "B", color: "#111", nodes: [node("b1", null)] },
  ];
  it("puts each cluster in its own cell, roots in the middle, linked to children", () => {
    const { clusters: placed, height } = layoutMap(clusters, 800, { now });
    expect(placed[0].x).toBe(200);
    expect(placed[1].x).toBe(600);
    expect(placed[0].nodes[0]).toMatchObject({ id: "a1", x: 200, r: 8 });
    expect(placed[0].links.map(([p, c]) => `${p.id}>${c.id}`)).toEqual(["a1>a2", "a1>a3"]);
    expect(height).toBe(210);
  });
  it("is deterministic", () => {
    expect(layoutMap(clusters, 800, { now })).toEqual(layoutMap(clusters, 800, { now }));
  });
});
