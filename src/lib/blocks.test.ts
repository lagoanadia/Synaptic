import { describe, expect, it } from "vitest";
import { cleanHomeBlocks, folderBlocks, homeBlocks } from "./blocks";
import { cleanFolderBlock, templateBlocks } from "./blocks";

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
  it("a trip starts with Alojamiento, Vuelos and Presupuesto", () => {
    const b = templateBlocks("trip");
    expect(b.map((x) => [x.type, x.title ?? null, x.icon ?? null])).toEqual([
      ["options", "Alojamiento", "bed"],
      ["options", "Vuelos", "plane"],
      ["budget", null, null],
    ]);
  });

  it("a blank folder is just pages; a project has tasks first", () => {
    expect(templateBlocks("blank").map((b) => b.type)).toEqual(["pages"]);
    expect(templateBlocks("project").map((b) => b.type)).toEqual(["project", "pages"]);
  });

  it("cleans what the browser sends", () => {
    expect(cleanFolderBlock({ id: "a", type: "options", title: "  Restaurantes ", icon: "food" })).toEqual({ id: "a", type: "options", title: "Restaurantes", icon: "food" });
    expect(cleanFolderBlock({ id: "b", type: "options", icon: "nope" as never })).toEqual({ id: "b", type: "options", title: "Opciones", icon: "list" });
    expect(cleanFolderBlock({ id: "c", type: "budget", people: 4 })).toEqual({ id: "c", type: "budget", people: 4 });
    expect(cleanFolderBlock({ id: "d", type: "budget", people: 0 })).toEqual({ id: "d", type: "budget", people: null });
    expect(cleanFolderBlock({ id: "e", type: "hack" as never })).toBeNull();
    expect(cleanFolderBlock({ id: "f", type: "project", view: "list" })).toEqual({ id: "f", type: "project", view: "list" });
  });
});
