import { describe, expect, it } from "vitest";
import { cleanHomeBlocks, folderBlocks, homeBlocks } from "./blocks";

describe("homeBlocks", () => {
  const sections = [
    { id: "p", study: false },
    { id: "e", study: true },
  ];
  it("defaults to this week, then the folders and map of the first notebook with study tools", () => {
    expect(homeBlocks(null, sections).map((b) => [b.type, b.sectionId])).toEqual([
      ["week", null],
      ["folders", "e"],
      ["map", "e"],
    ]);
  });
  it("keeps saved blocks and repairs ones pointing at a deleted notebook", () => {
    const saved = [{ id: "a", type: "map", sectionId: "gone" }, { id: "b", type: "nope", sectionId: "e" }];
    expect(homeBlocks(saved, sections)).toEqual([{ id: "a", type: "map", sectionId: "p" }]);
  });
});

describe("folderBlocks", () => {
  it("drops study blocks outside study notebooks", () => {
    const saved = [{ id: "1", type: "pages" }, { id: "2", type: "challenges" }];
    expect(folderBlocks(saved, false).map((b) => b.type)).toEqual(["pages"]);
    expect(folderBlocks(saved, true).map((b) => b.type)).toEqual(["pages", "challenges"]);
  });
  it("has sensible defaults", () => {
    expect(folderBlocks(undefined, true).map((b) => b.type)).toEqual(["pages", "map", "review"]);
    expect(folderBlocks(undefined, false).map((b) => b.type)).toEqual(["pages", "ask"]);
  });
});

describe("cleanHomeBlocks", () => {
  it("keeps every known block type, including this week", () => {
    const sent = [
      { id: "w", type: "week", sectionId: null },
      { id: "f", type: "folders", sectionId: "mine" },
      { id: "m", type: "map", sectionId: "someone-elses" },
      { id: "x", type: "nope", sectionId: "mine" },
    ];
    expect(cleanHomeBlocks(sent, new Set(["mine"]))).toEqual([
      { id: "w", type: "week", sectionId: null },
      { id: "f", type: "folders", sectionId: "mine" },
      { id: "m", type: "map", sectionId: null },
    ]);
  });
  it("survives garbage", () => {
    expect(cleanHomeBlocks(null, new Set())).toEqual([]);
  });
});
