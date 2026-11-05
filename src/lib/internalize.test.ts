import { describe, expect, it } from "vitest";
import {
  excerptInSource,
  nextUp,
  parseRepoUrl,
  pickRepoFiles,
  progress,
  statusAfterCheck,
  statusAfterOpen,
  statusAfterReview,
  type PathConcept,
} from "./internalize";

describe("status rules", () => {
  it("explain-back promotes, keeps, or sends to reread", () => {
    expect(statusAfterCheck("NEW", "got_it")).toBe("UNDERSTOOD");
    expect(statusAfterCheck("UNDERSTOOD", "got_it")).toBe("MASTERED");
    expect(statusAfterCheck("REREAD", "partly")).toBe("REREAD");
    expect(statusAfterCheck("NEW", "partly")).toBe("SEEN");
    expect(statusAfterCheck("MASTERED", "not_yet")).toBe("REREAD");
  });
  it("reviews only promote what's already understood", () => {
    expect(statusAfterReview("SEEN", true)).toBe("SEEN");
    expect(statusAfterReview("UNDERSTOOD", true)).toBe("MASTERED");
    expect(statusAfterReview("MASTERED", false)).toBe("REREAD");
  });
  it("opening never demotes", () => {
    expect(statusAfterOpen("NEW")).toBe("SEEN");
    expect(statusAfterOpen("MASTERED")).toBe("MASTERED");
  });
});

describe("nextUp", () => {
  const c = (id: string, status: PathConcept["status"], order: number): PathConcept => ({
    id, status, order, depth: 0, parentId: null,
  });
  it("prefers rereads", () => {
    expect(nextUp([c("a", "NEW", 0), c("b", "REREAD", 1)], [])).toBe("b");
  });
  it("skips concepts whose prerequisites aren't understood", () => {
    const concepts = [c("a", "SEEN", 0), c("b", "NEW", 1), c("x", "NEW", 2)];
    // a is needed for b; x is free
    expect(nextUp(concepts, [{ fromId: "a", toId: "b" }], "a")).toBe("x");
  });
  it("returns null when everything is solid", () => {
    expect(nextUp([c("a", "MASTERED", 0)], [])).toBeNull();
  });
});

describe("helpers", () => {
  it("counts progress", () => {
    expect(progress(["NEW", "MASTERED", "MASTERED", "REREAD"])).toMatchObject({ total: 4, mastered: 2, reread: 1, fresh: 1 });
  });
  it("accepts only real excerpts", () => {
    const src = "function add(a, b) {\n  return a + b;\n}";
    expect(excerptInSource("return   a + b;", src)).toBe(true);
    expect(excerptInSource("return a - b;", src)).toBe(false);
    expect(excerptInSource("a", src)).toBe(false);
  });
  it("picks readme first and skips junk", () => {
    const picked = pickRepoFiles([
      { path: "src/deep/nested/big.ts", size: 5000 },
      { path: "README.md", size: 2000 },
      { path: "node_modules/x/index.js", size: 10 },
      { path: "package-lock.json", size: 10 },
      { path: "src/app.ts", size: 3000 },
      { path: "logo.png", size: 3000 },
    ]);
    expect(picked).toEqual(["README.md", "src/app.ts", "src/deep/nested/big.ts"]);
  });
  it("respects the byte budget", () => {
    expect(pickRepoFiles([{ path: "a.ts", size: 9000 }, { path: "b.ts", size: 9000 }], 10000)).toEqual(["a.ts"]);
  });
  it("parses repo urls", () => {
    expect(parseRepoUrl("https://github.com/lagoanadia/Synaptic/tree/main/src")).toEqual({ owner: "lagoanadia", repo: "Synaptic" });
    expect(parseRepoUrl("vercel/next.js.git")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(parseRepoUrl("nope")).toBeNull();
  });
});
