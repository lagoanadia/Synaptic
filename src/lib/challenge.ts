// Coding challenges: shape, validation, and the test harnesses that run
// a solution against its tests. Pure, so it's unit-tested and shared by
// the server (generation) and the browser (running).

export const LANGUAGES = ["javascript", "typescript", "python", "react"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_INFO: Record<Language, { label: string; short: string; hint: string }> = {
  javascript: { label: "JavaScript", short: "JS", hint: "El lenguaje de la web: funciones, listas y objetos." },
  typescript: { label: "TypeScript", short: "TS", hint: "JavaScript con tipos: dices qué es cada dato (number, string…) y te avisa de errores." },
  python: { label: "Python", short: "PY", hint: "Sencillo de leer; el de datos y scripts." },
  react: { label: "React", short: "JSX", hint: "Componentes de pantalla: funciones que devuelven HTML (JSX) según sus props." },
};
export const asLanguage = (v: unknown): Language => (LANGUAGES as readonly unknown[]).includes(v) ? (v as Language) : "javascript";
// TypeScript and React are compiled (Babel, in the sandbox) before running.
export const needsCompile = (l: Language) => l === "typescript" || l === "react";
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

// JavaScript: the body of a function run inside a Worker. Defines the
// user's code, then calls `entry` once per test with a deep copy of the
// args, collecting console.log output. Compiled TypeScript/React code is
// CommonJS (imports become require, `export default` sets exports), so
// those are provided too.
//
// React: `entry` is a component; each test renders it with args[0] as
// props (React + ReactDOMServer are globals in that worker) and compares
// the visible text, whitespace-normalized.
export function jsHarness(code: string, entry: string, tests: ChallengeTest[], kind: "plain" | "react" = "plain"): string {
  if (!IDENTIFIER.test(entry)) throw new Error("bad entry name");
  return `
const __logs = [];
const __fmt = (v) => { try { return typeof v === "string" ? v : JSON.stringify(v); } catch { return String(v); } };
const console = { log: (...a) => __logs.push(a.map(__fmt).join(" ")), error: (...a) => __logs.push(a.map(__fmt).join(" ")), warn: () => {} };
const __eq = ${deepEqual.toString()};
const __module = { exports: {} };
const __require = (m) => {
  if (m === "react" && typeof React !== "undefined") return Object.assign({ default: React }, React);
  throw new Error("Can't import " + m + " here");
};
let __fn;
try {
  // Compiled separately so a syntax error in the solution is reported,
  // not a crash of the harness itself.
  __fn = new Function("console", "deepEqual", "require", "module", "exports", ${JSON.stringify(
    `${code}
;return typeof ${entry} === "function" ? ${entry} : (exports[${JSON.stringify(entry)}] || exports.default || (module.exports !== exports ? module.exports : undefined));`,
  )})(console, __eq, __require, __module, __module.exports);
} catch (e) {
  return { results: [], logs: __logs, error: String(e && e.message || e) };
}
if (typeof __fn !== "function") return { results: [], logs: __logs, error: "No encuentro ${kind === "react" ? "un componente" : "una función"} llamada ${entry}" };
const __tests = ${JSON.stringify(tests)};
${
  kind === "react"
    ? `const __text = (html) => html.replace(/<[^>]*>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\\s+/g, " ").trim();
const results = __tests.map((t) => {
  try {
    const got = __text(ReactDOMServer.renderToStaticMarkup(React.createElement(__fn, t.args[0] || {})));
    return { ok: got === __text(String(t.expected)), got };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
});`
    : `const results = __tests.map((t) => {
  try {
    const got = __fn(...JSON.parse(JSON.stringify(t.args)));
    return { ok: __eq(JSON.parse(JSON.stringify(got === undefined ? null : got)), t.expected), got: got === undefined ? null : got };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
});`
}
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
            _out["error"] = "No encuentro una función llamada " + ENTRY
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

// A code review is stored as text: a header line per section ("Good",
// "Fix", "Next" — older reviews used "What works", "Could be better",
// "Learn next") followed by "- " lines.
export type ReviewSections = { good: string[]; fix: string[]; next: string[] };
const REVIEW_HEADERS: Record<string, keyof ReviewSections> = {
  good: "good", "what works": "good", fix: "fix", "could be better": "fix", next: "next", "learn next": "next",
};
export function parseReview(text: string): ReviewSections {
  const out: ReviewSections = { good: [], fix: [], next: [] };
  let current: keyof ReviewSections | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const header = REVIEW_HEADERS[line.replace(/[:*#]/g, "").trim().toLowerCase()];
    if (header) current = header;
    else if (line.startsWith("-") && current) out[current].push(line.replace(/^-\s*/, ""));
  }
  return out;
}
export const formatReview = (r: ReviewSections) =>
  (["good", "fix", "next"] as const)
    .filter((k) => r[k].length)
    .map((k) => `${k[0].toUpperCase()}${k.slice(1)}\n${r[k].map((l) => `- ${l}`).join("\n")}`)
    .join("\n");

// "Theory turned into code": the answers are sentences, or the solution is
// mostly a table of prewritten strings. Those aren't coding practice.
// A React component's expected value is the whole text it renders, so long
// strings are normal there: only its solution's literals are checked.
export function isTheoryLookup(d: Pick<ChallengeDraft, "tests" | "solution">, react = false): boolean {
  const strings = react ? [] : d.tests.map((t) => t.expected).filter((e): e is string => typeof e === "string");
  if (strings.some((e) => e.length > 60)) return true;
  if (new Set(strings.filter((e) => e.length > 20)).size >= 3) return true;
  const literals = d.solution.match(/(["'`])(?:(?!\1)[^\\\n]|\\.){20,}\1/g) ?? [];
  return literals.length >= 3;
}

// From the AI's candidates, the ones to keep: one per skill, at most one
// close to an exercise from class, skills you haven't practised first.
export function pickBySkill<T extends { skill: string | null; fromClass: boolean }>(candidates: T[], practised: string[], max = 3): T[] {
  const key = (s: string | null) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const done = new Set(practised.map(key));
  const ordered = [...candidates].sort((a, b) => Number(done.has(key(a.skill))) - Number(done.has(key(b.skill))));
  const out: T[] = [];
  const skills = new Set<string>();
  let fromClass = 0;
  for (const c of ordered) {
    const k = key(c.skill);
    if (k && skills.has(k)) continue;
    if (c.fromClass && fromClass >= 1) continue;
    out.push(c);
    if (k) skills.add(k);
    if (c.fromClass) fromClass++;
    if (out.length === max) break;
  }
  return out;
}

// The parameter names of the function the learner writes, read from the
// starter code's signature, to label example inputs ("items", "days"…).
// Falls back to arg1, arg2… when the signature can't be read.
export function paramNames(starterCode: string, entry: string, count: number): string[] {
  const esc = entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sig =
    new RegExp(`(?:function\\s+${esc}|def\\s+${esc}|${esc}\\s*=\\s*(?:async\\s*)?(?:function)?)\\s*(?:<[^>]*>)?\\s*\\(`).exec(starterCode);
  const names: string[] = [];
  if (sig) {
    // Walk to the matching ")" and split on top-level commas.
    let depth = 0;
    let part = "";
    for (const ch of starterCode.slice(sig.index + sig[0].length)) {
      if (ch === "(" || ch === "{" || ch === "[" || ch === "<") depth++;
      if ((ch === ")" || ch === "}" || ch === "]" || ch === ">") && depth-- === 0) break;
      if (ch === "," && depth === 0) {
        names.push(part);
        part = "";
      } else part += ch;
    }
    if (part.trim()) names.push(part);
  }
  const clean = names.map((n) => /^\s*\.{0,3}([A-Za-z_$][\w$]*)/.exec(n)?.[1]).filter((n): n is string => !!n && n !== "self");
  return Array.from({ length: count }, (_, i) => clean[i] ?? `arg${i + 1}`);
}

// Is this text English rather than Spanish? Counts common words of each.
export function looksEnglish(text: string): boolean {
  const en = text.match(/\b(the|and|return|returns|given|of|with|which|whose|an|is|are|from|each|that|this|should|will)\b/gi)?.length ?? 0;
  const es = text.match(/\b(el|la|los|las|de|del|que|devuelve|recibe|con|una|un|y|cada|por|para|es|se)\b/gi)?.length ?? 0;
  return en > es;
}

// Starter comments that came out in English → Spanish.
export const spanishComments = (code: string) =>
  code.replace(/(\/\/|#)\s*(TODO:?\s*implement(?: me)?|your code here|write your code here|implement me)\b\.?/gi, "$1 Escribe tu código aquí");
