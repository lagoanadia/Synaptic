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
