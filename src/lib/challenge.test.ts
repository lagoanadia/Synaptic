import { describe, expect, it } from "vitest";
import { deepEqual, formatReview, isTheoryLookup, jsHarness, parseChallenge, parseReview, type RunOutput } from "./challenge";

// The harness is a function body; run it the way the Worker does.
const run = (code: string, entry: string, tests: { args: unknown[]; expected: unknown }[]) =>
  new Function(jsHarness(code, entry, tests))() as RunOutput;

describe("deepEqual", () => {
  it("compares nested JSON values", () => {
    expect(deepEqual({ a: [1, 2, { b: "x" }] }, { a: [1, 2, { b: "x" }] })).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual(0.1 + 0.2, 0.3)).toBe(true);
  });
});

describe("jsHarness", () => {
  const tests = [
    { args: [2, 3], expected: 5 },
    { args: [-1, 1], expected: 0 },
  ];
  it("passes a correct solution", () => {
    const out = run("function add(a, b) { return a + b; }", "add", tests);
    expect(out.error).toBeNull();
    expect(out.results.map((r) => r.ok)).toEqual([true, true]);
  });
  it("reports wrong answers with what came back", () => {
    const out = run("function add(a, b) { return a - b; }", "add", tests);
    expect(out.results[0]).toEqual({ ok: false, got: -1 });
  });
  it("captures console.log and runtime errors per test", () => {
    const out = run("function add(a, b) { console.log('hi', a); if (a < 0) throw new Error('neg'); return a + b; }", "add", tests);
    expect(out.logs).toEqual(["hi 2", "hi -1"]);
    expect(out.results[1]).toEqual({ ok: false, error: "neg" });
  });
  it("reports syntax errors and a missing function", () => {
    expect(run("function add(a, b) { return a + ; }", "add", tests).error).toBeTruthy();
    expect(run("const x = 1;", "add", tests).error).toContain("add");
  });
  it("doesn't let a test mutate its own args for the next one", () => {
    const out = run("function f(arr) { arr.push(1); return arr.length; }", "f", [
      { args: [[]], expected: 1 },
      { args: [[]], expected: 1 },
    ]);
    expect(out.results.every((r) => r.ok)).toBe(true);
  });
  it("refuses an entry name that isn't an identifier", () => {
    expect(() => jsHarness("", "x; alert(1)", [])).toThrow();
  });
});

describe("parseChallenge", () => {
  const good = {
    title: "Sum",
    prompt: "Add two numbers",
    entry: "add",
    starter_code: "function add(a, b) {}",
    tests: [{ args: [1, 2], expected: 3 }, { args: [0, 0], expected: 0 }, { nope: true }],
    solution: "function add(a,b){return a+b}",
  };
  it("accepts a valid challenge and drops malformed tests", () => {
    expect(parseChallenge(good)?.tests).toHaveLength(2);
  });
  it("rejects bad entries or too few tests", () => {
    expect(parseChallenge({ ...good, entry: "1bad" })).toBeNull();
    expect(parseChallenge({ ...good, tests: [{ args: [], expected: 1 }] })).toBeNull();
    expect(parseChallenge(null)).toBeNull();
  });
});

describe("jsHarness for compiled code", () => {
  it("finds a CommonJS default export", () => {
    const out = run('"use strict"; exports.default = function sum(a, b) { return a + b; };', "sum", [{ args: [1, 2], expected: 3 }]);
    expect(out.results[0].ok).toBe(true);
  });
  it("renders a React component and compares its text", async () => {
    const React = await import("react");
    const ReactDOMServer = await import("react-dom/server");
    Object.assign(globalThis, { React, ReactDOMServer });
    const code = `function List({ items }) { return React.createElement("ul", null, items.length ? items.map((i) => React.createElement("li", { key: i }, i)) : "Empty"); }`;
    const harness = jsHarness(code, "List", [
      { args: [{ items: ["Milk", "Eggs"] }], expected: "Milk Eggs" },
      { args: [{ items: [] }], expected: "Empty" },
      { args: [{ items: ["A"] }], expected: "B" },
    ], "react");
    const out = new Function(harness)() as RunOutput;
    expect(out.results.map((r) => r.ok)).toEqual([true, true, false]);
  });
});

describe("reviews", () => {
  it("reads old and new section headers", () => {
    const old = parseReview("What works\n- Uses match.\nCould be better\n- Prints instead of returning.\nLearn next\n- Dictionaries.");
    expect(old).toEqual({ good: ["Uses match."], fix: ["Prints instead of returning."], next: ["Dictionaries."] });
    expect(parseReview(formatReview(old))).toEqual(old);
  });
});

describe("isTheoryLookup", () => {
  it("rejects lookup tables of theory text", () => {
    const solution = `function Phase({ phase }) { const d = { 1: "Descubrimiento: el usuario la encuentra", 2: "Instalación: se verifica la firma", 3: "Ejecución: se piden permisos" }; return <p>{d[phase] ?? "Invalid phase"}</p>; }`;
    expect(isTheoryLookup({ tests: [{ args: [{ phase: 1 }], expected: "Descubrimiento: el usuario la encuentra" }], solution })).toBe(true);
  });
  it("keeps real logic with short outputs", () => {
    const solution = "function finalState(events) { let s = 'installed'; for (const e of events) { if (e === 'open' && s !== 'removed') s = 'running'; } return s; }";
    expect(isTheoryLookup({ tests: [{ args: [["open"]], expected: "running" }, { args: [[]], expected: "installed" }], solution })).toBe(false);
  });
});
