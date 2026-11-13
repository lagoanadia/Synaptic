import { describe, expect, it } from "vitest";
import { blocksFromTemplate, cleanFolderBlock, cleanHomeBlocks, folderBlocks, homeBlocks, optionColumns } from "./blocks";
import { templateBlocks } from "./blocks";

describe("homeBlocks", () => {
  const sections = [
    { id: "p", study: false },
    { id: "e", study: true },
  ];
  it("defaults to just this week", () => {
    expect(homeBlocks(null, sections).map((b) => [b.type, b.sectionId])).toEqual([["week", null]]);
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
    expect(folderBlocks(undefined, false).map((b) => b.type)).toEqual(["project", "pages"]);
    expect(folderBlocks(undefined, false, true).map((b) => b.type)).toEqual(["project", "tasks", "pages"]);
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

describe("cleanHomeBlocks projects", () => {
  it("keeps a project block's project only if it's yours", () => {
    const sent = [
      { id: "p", type: "project", sectionId: null, pursuitId: "mine" },
      { id: "q", type: "project", sectionId: null, pursuitId: "theirs" },
      { id: "t", type: "today", sectionId: "x" },
    ];
    expect(cleanHomeBlocks(sent, new Set(), new Set(["mine"]))).toEqual([
      { id: "p", type: "project", sectionId: null, pursuitId: "mine" },
      { id: "q", type: "project", sectionId: null, pursuitId: null },
      { id: "t", type: "today", sectionId: null },
    ]);
  });
});

describe("folder templates and options/budget blocks", () => {
  it("options keep only known columns, in order; defaults when missing", () => {
    expect(optionColumns(["note", "price", "x"])).toEqual(["price", "note"]);
    expect(optionColumns(undefined)).toEqual(["status", "price", "votes"]);
    expect(cleanFolderBlock({ type: "options", columns: ["rating"] as never })?.columns).toEqual(["rating"]);
  });

  it("a saved template gives fresh blocks with new ids", () => {
    const saved = [{ id: "a", type: "options", title: "Pisos", icon: "bed", columns: ["price", "rating"] }, { id: "b", type: "nope" }];
    const b = blocksFromTemplate(saved);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ type: "options", title: "Pisos", columns: ["price", "rating"] });
    expect(b[0].id).not.toBe("a");
    expect(blocksFromTemplate(null).map((x) => x.type)).toEqual(["pages"]);
  });

  it("a plan starts with Opciones and Presupuesto", () => {
    const b = templateBlocks("plan");
    expect(b.map((x) => [x.type, x.title ?? null, x.icon ?? null])).toEqual([
      ["options", "Opciones", "list"],
      ["budget", null, null],
    ]);
  });

  it("a blank folder is just pages; a project has tasks first", () => {
    expect(templateBlocks("blank").map((b) => b.type)).toEqual(["pages"]);
    expect(templateBlocks("project").map((b) => b.type)).toEqual(["project", "pages"]);
  });

  it("cleans what the browser sends", () => {
    expect(cleanFolderBlock({ id: "a", type: "options", title: "  Restaurantes ", icon: "food" })).toEqual({ id: "a", type: "options", title: "Restaurantes", icon: "food", columns: ["status", "price", "votes"] });
    expect(cleanFolderBlock({ id: "b", type: "options", icon: "nope" as never })).toEqual({ id: "b", type: "options", title: "Opciones", icon: "list", columns: ["status", "price", "votes"] });
    expect(cleanFolderBlock({ id: "c", type: "budget", people: 4 })).toEqual({ id: "c", type: "budget", people: 4 });
    expect(cleanFolderBlock({ id: "d", type: "budget", people: 0 })).toEqual({ id: "d", type: "budget", people: null });
    expect(cleanFolderBlock({ id: "e", type: "hack" as never })).toBeNull();
    expect(cleanFolderBlock({ id: "f", type: "project", view: "list" })).toEqual({ id: "f", type: "project", view: "list" });
  });
});
