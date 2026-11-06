"use client";

import { jsHarness, needsCompile, PY_HARNESS, type ChallengeTest, type Language, type RunOutput } from "@/lib/challenge";

// Solutions run in a sandboxed iframe (allow-scripts only: opaque origin, no
// cookies) inside a Web Worker, so a loop can be killed by a timeout.
// Python is Pyodide (CPython in WebAssembly), loaded once. TypeScript and
// React are compiled by Babel (in its own worker) and then run like JS;
// React's worker also has React + ReactDOMServer to render components.

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js";
const BABEL = "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.26.4/babel.min.js";
const REACT = "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js";
const REACT_SERVER = "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom-server-legacy.browser.production.min.js";

// A JS worker is kept warm, and the time limit starts only once a worker is
// alive, so a slow start isn't mistaken for an infinite loop.
const FRAME = `<!doctype html><script>
const JS_SRC = 'postMessage("ready");onmessage=(e)=>{try{postMessage(new Function(e.data)())}catch(err){postMessage({results:[],logs:[],error:String(err&&err.message||err)})}}';
const PY_SRC = 'importScripts(${JSON.stringify(PYODIDE)});let py=null;postMessage("ready");onmessage=async(e)=>{try{py=py||await loadPyodide();py.globals.set("USER_CODE",e.data.code);py.globals.set("ENTRY",e.data.entry);py.globals.set("TESTS_JSON",e.data.tests);postMessage(JSON.parse(py.runPython(e.data.harness)))}catch(err){postMessage({results:[],logs:[],error:String(err&&err.message||err)})}}';
const REACT_SRC = 'importScripts(${JSON.stringify(REACT)},${JSON.stringify(REACT_SERVER)});' + JS_SRC;
const BABEL_SRC = 'importScripts(${JSON.stringify(BABEL)});postMessage("ready");onmessage=(e)=>{try{postMessage({code:Babel.transform(e.data.code,{filename:"solution.tsx",presets:e.data.react?[["react",{runtime:"classic"}],"typescript"]:["typescript"],plugins:["transform-modules-commonjs"]}).code})}catch(err){postMessage({error:String(err&&err.message||err)})}}';
const spawn = (src) => {
  const w = new Worker("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
  const ready = new Promise((res) => w.addEventListener("message", (m) => m.data === "ready" && res(), { once: true }));
  return { w, ready };
};
let spareJs = spawn(JS_SRC);
let py = null;
let babel = null;
let spareReact = null;
// Long-lived workers (the interpreter/compiler is expensive to load).
const KEEP = { python: () => (py = py || spawn(PY_SRC)), babel: () => (babel = babel || spawn(BABEL_SRC)) };
// Requests to a long-lived worker wait their turn, so two runs at once
// can't swap replies.
const queues = {};
addEventListener("message", (e) => {
  if (e.source !== parent) return;
  const { id, lang, payload, timeout } = e.data;
  const reply = (out) => parent.postMessage({ id, out }, "*");
  const kept = lang === "python" || lang === "babel";
  if (kept) queues[lang] = (queues[lang] || Promise.resolve()).then(() => run(KEEP[lang](), lang, true, payload, timeout, reply));
  else if (lang === "react") {
    const worker = spareReact || spawn(REACT_SRC);
    spareReact = spawn(REACT_SRC);
    run(worker, lang, false, payload, timeout, reply);
  } else {
    const worker = spareJs;
    spareJs = spawn(JS_SRC);
    run(worker, lang, false, payload, timeout, reply);
  }
});
async function run(worker, lang, kept, payload, timeout, reply) {
  await worker.ready;
  const w = worker.w;
  return new Promise((done) => {
    const finish = (out) => {
      clearTimeout(timer);
      if (!kept) w.terminate();
      reply(out);
      done();
    };
    // The time limit starts only once the worker is alive.
    const timer = setTimeout(() => {
      w.terminate();
      if (lang === "python") py = null;
      if (lang === "babel") babel = null;
      reply({ results: [], logs: [], error: "Tiempo agotado — ¿hay un bucle infinito?" });
      done();
    }, timeout);
    w.onmessage = (m) => finish(m.data);
    w.onerror = (err) => finish({ results: [], logs: [], error: String(err.message || "Worker error") });
    w.postMessage(payload);
  });
}
parent.postMessage({ ready: true }, "*");
</script>`;

let frame: HTMLIFrameElement | null = null;
let ready: Promise<void> | null = null;
const warm = new Set<string>();
const pending = new Map<number, (out: RunOutput) => void>();
let nextId = 1;

function ensureFrame(): Promise<void> {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.style.display = "none";
    window.addEventListener("message", (e) => {
      if (!frame || e.source !== frame.contentWindow) return;
      if (e.data?.ready) return resolve();
      const settle = pending.get(e.data?.id);
      if (settle) {
        pending.delete(e.data.id);
        settle(e.data.out as RunOutput);
      }
    });
    frame.srcdoc = FRAME;
    document.body.appendChild(frame);
  });
  return ready;
}

// Call early (e.g. when the challenge page opens) so the first Run is instant.
export function warmSandbox() {
  ensureFrame();
}

export async function runInSandbox(
  language: Language,
  code: string,
  entry: string,
  tests: ChallengeTest[],
): Promise<RunOutput> {
  await ensureFrame();
  if (language === "python") return send("python", { code, entry, tests: JSON.stringify(tests), harness: PY_HARNESS }, 8000);
  let js = code;
  if (needsCompile(language)) {
    const compiled = (await send("babel", { code, react: language === "react" }, 4000)) as unknown as RunOutput & { code?: string };
    if (compiled.error || typeof compiled.code !== "string") {
      return { results: [], logs: [], error: compiled.error ?? "Couldn't compile that" };
    }
    js = compiled.code;
  }
  const kind = language === "react" ? "react" : "plain";
  return send(kind === "react" ? "react" : "javascript", jsHarness(js, entry, tests, kind), 4000);
}

// One request to a worker. The first use of a worker that downloads
// something (Python, Babel, React) gets a much longer limit.
async function send(lang: string, payload: unknown, timeout: number): Promise<RunOutput> {
  const id = nextId++;
  const slowStart = lang !== "javascript" && !warm.has(lang);
  const out = await new Promise<RunOutput>((resolve) => {
    pending.set(id, resolve);
    frame!.contentWindow!.postMessage({ id, lang, payload, timeout: slowStart ? 60000 : timeout }, "*");
  });
  if (!out.error?.startsWith("Timed out")) warm.add(lang);
  return out;
}
