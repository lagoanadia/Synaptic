// Coding challenges: shape, validation, and the test harnesses that run
// a solution against its tests. Pure, so it's unit-tested and shared by
// the server (generation) and the browser (running).

export type Language = "javascript" | "python";
export type ChallengeTest = { args: unknown[]; expected: unknown };
export type TestResult = { ok: boolean; got?: unknown; error?: string };
export type RunOutput = { results: TestResult[]; logs: string[]; error: string | null };

export const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

// Order-sensitive structural equality for JSON-like values.
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    return deepEqual(ka, kb) && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

export type ChallengeDraft = {
  title: string;
  prompt: string;
  entry: string;
  starterCode: string;
  tests: ChallengeTest[];
  solution: string;
};

// Whatever the AI returned → a challenge we can trust, or null.
export function parseChallenge(raw: unknown): ChallengeDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const entry = s(o.entry, 60);
  if (!IDENTIFIER.test(entry)) return null;
  const tests = (Array.isArray(o.tests) ? o.tests : [])
    .filter((t): t is { args: unknown[]; expected: unknown } =>
      !!t && typeof t === "object" && Array.isArray((t as { args?: unknown }).args) && "expected" in (t as object),
    )
    .map((t) => ({ args: t.args, expected: t.expected }))
    .slice(0, 12);
  const draft = {
    title: s(o.title, 120),
    prompt: s(o.prompt, 4000),
    entry,
    starterCode: s(o.starter_code, 4000),
    tests,
    solution: s(o.solution, 6000),
  };
  return draft.title && draft.prompt && draft.starterCode && tests.length >= 2 ? draft : null;
}

// JavaScript: the body of a function run inside a Worker (or node:vm).
// Defines the user's code, then calls `entry` once per test with a deep
// copy of the args, collecting console.log output.
export function jsHarness(code: string, entry: string, tests: ChallengeTest[]): string {
  if (!IDENTIFIER.test(entry)) throw new Error("bad entry name");
  return `
const __logs = [];
const __fmt = (v) => { try { return typeof v === "string" ? v : JSON.stringify(v); } catch { return String(v); } };
const console = { log: (...a) => __logs.push(a.map(__fmt).join(" ")), error: (...a) => __logs.push(a.map(__fmt).join(" ")) };
const __eq = ${deepEqual.toString()};
let __fn;
try {
  // Compiled separately so a syntax error in the solution is reported,
  // not a crash of the harness itself.
  __fn = new Function("console", "deepEqual", ${JSON.stringify(`${code}\n;return typeof ${entry} === "function" ? ${entry} : undefined;`)})(console, __eq);
} catch (e) {
  return { results: [], logs: __logs, error: String(e && e.message || e) };
}
if (!__fn) return { results: [], logs: __logs, error: "Couldn't find a function called ${entry}" };
const __tests = ${JSON.stringify(tests)};
const results = __tests.map((t) => {
  try {
    const got = __fn(...JSON.parse(JSON.stringify(t.args)));
    return { ok: __eq(JSON.parse(JSON.stringify(got === undefined ? null : got)), t.expected), got: got === undefined ? null : got };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
});
return { results, logs: __logs, error: null };`;
}

// Python (Pyodide): USER_CODE, ENTRY and TESTS_JSON are set as globals
// before this runs; prints are captured; returns a JSON string.
export const PY_HARNESS = `
import json, io, contextlib, traceback
_buf = io.StringIO()
_out = {"results": [], "logs": [], "error": None}
_g = {}
try:
    with contextlib.redirect_stdout(_buf):
        exec(USER_CODE, _g)
        _fn = _g.get(ENTRY)
        if not callable(_fn):
            _out["error"] = "Couldn't find a function called " + ENTRY
        else:
            for _t in json.loads(TESTS_JSON):
                try:
                    _got = json.loads(json.dumps(_fn(*_t["args"])))
                    _ok = _got == _t["expected"] or (isinstance(_got, float) and isinstance(_t["expected"], (int, float)) and abs(_got - _t["expected"]) < 1e-9)
                    _out["results"].append({"ok": _ok, "got": _got})
                except Exception as _e:
                    _out["results"].append({"ok": False, "error": type(_e).__name__ + ": " + str(_e)})
except Exception as _e:
    _out["error"] = "".join(traceback.format_exception_only(type(_e), _e)).strip()
_out["logs"] = [l for l in _buf.getvalue().split("\\n") if l]
json.dumps(_out)
`;
