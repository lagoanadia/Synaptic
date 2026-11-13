import { describe, expect, it } from "vitest";
import { hitShape, moveShape, resizeShape, shapeBox, tooSmall, type Shape } from "./whiteboard";

const rect: Shape = { t: "rect", c: 1, a: [100, 100], b: [200, 160] };
const line: Shape = { t: "line", c: 0, a: [0, 0], b: [100, 100] };

describe("whiteboard editing", () => {
  it("finds the topmost shape under the point", () => {
    expect(hitShape([rect, line], [150, 130])).toBe(0);
    expect(hitShape([rect, line], [50, 52])).toBe(1);
    expect(hitShape([rect, line], [400, 300])).toBe(-1);
  });
  it("moves and resizes", () => {
    expect(moveShape(rect, 10, -20)).toEqual({ t: "rect", c: 1, a: [110, 80], b: [210, 140] });
    expect(shapeBox(resizeShape(rect, [300, 250]))).toEqual({ x0: 100, y0: 100, x1: 300, y1: 250 });
    expect(resizeShape(line, [50, 80])).toEqual({ ...line, b: [50, 80] });
  });
  it("drops click-dots", () => {
    expect(tooSmall({ t: "rect", c: 0, a: [5, 5], b: [6, 7] })).toBe(true);
    expect(tooSmall(rect)).toBe(false);
  });
});

describe("connectors", () => {
  const a: Shape = { t: "rect", c: 0, a: [0, 0], b: [100, 100], id: "boxa" };
  const b: Shape = { t: "rect", c: 0, a: [300, 0], b: [400, 100], id: "boxb" };
  it("an attached end sits on the shape's edge and follows it", async () => {
    const { lineGeometry, moveShape: mv } = await import("./whiteboard");
    const l = { t: "line" as const, c: 0, a: [50, 50] as [number, number], b: [350, 50] as [number, number], fa: "boxa", fb: "boxb" };
    const g = lineGeometry(l, [a, b, l]);
    expect(g.A[0]).toBeCloseTo(104);
    expect(g.B[0]).toBeCloseTo(296);
    const moved = mv(b, 0, 200);
    expect(lineGeometry(l, [a, moved, l]).B[1]).toBeGreaterThan(150);
  });
  it("draws arrowheads and curves", async () => {
    const { shapeSvg, bendFor, lineMiddle } = await import("./whiteboard");
    const l = { t: "line" as const, c: 0, a: [0, 100] as [number, number], b: [200, 100] as [number, number], arrow: "end" as const };
    expect(shapeSvg(l)).toContain("Z");
    const bend = bendFor(l, [], [100, 60]);
    expect(lineMiddle({ ...l, bend }, [])[1]).toBeCloseTo(60, 0);
    expect(shapeSvg({ ...l, bend })).toContain("Q");
  });
});

describe("mind map", () => {
  it("lays out topic, ideas and details as connected, on-board shapes", async () => {
    const { cleanMindMap, layoutMindMap } = await import("./mindmap");
    const { BOARD_W, BOARD_H, cleanShapes } = await import("./whiteboard");
    const m = cleanMindMap({ center: "Redes", branches: [{ label: "TCP/IP", children: ["Aplicación", "Transporte"] }, { label: "Direcciones", children: ["IP", "Puertos", "localhost"] }, { label: "Sockets", children: [] }, { label: "" }] });
    expect(m?.branches).toHaveLength(3);
    const shapes = layoutMindMap(m!);
    expect(shapes.filter((s) => s.t === "line")).toHaveLength(3 + 5);
    for (const s of shapes) if (s.t === "rect" || s.t === "ellipse") expect(s.b[0] <= BOARD_W && s.b[1] <= BOARD_H && s.a[0] >= 0 && s.a[1] >= 0).toBe(true);
    expect(cleanShapes(shapes)).toHaveLength(shapes.length);
  });
});
