import { describe, expect, it } from "vitest";
import { boardSvg, cleanShapes } from "./whiteboard";

describe("whiteboard", () => {
  it("keeps valid shapes, clamps points, drops junk", () => {
    const s = cleanShapes([{ t: "line", c: 1, a: [-5, 10], b: [5000, 20] }, { t: "nope" }, { t: "text", c: 9, a: [1, 1], s: "  " }, "x"]);
    expect(s).toEqual([{ t: "line", c: 1, a: [-5, 10], b: [3600, 20] }]);
  });
  it("escapes text in the SVG", () => {
    const svg = boardSvg(cleanShapes([{ t: "text", c: 0, a: [10, 10], s: '<script>"' }]));
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&quot;");
  });
});
