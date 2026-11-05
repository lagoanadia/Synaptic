"use client";

import { jsHarness, PY_HARNESS, type ChallengeTest, type Language, type RunOutput } from "@/lib/challenge";

// Where solutions run: a sandboxed iframe (allow-scripts only → an opaque
// origin with no cookies, so code can't act as your account or touch the
// page), and inside it a Web Worker, so an infinite loop can be killed by
// a timeout without freezing anything. Python is real CPython compiled to
// WebAssembly (Pyodide), loaded once and kept warm.

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js";

// Inside the frame: a JS worker is always kept warm (spawning one can
// take seconds on a cold page), and the time limit only starts once the
// worker has said it's alive — so a slow start is never mistaken for an
// infinite loop.
const FRAME = `<!doctype html><script>
const JS_SRC = 'postMessage("ready");onmessage=(e)=>{try{postMessage(new Function(e.data)())}catch(err){postMessage({results:[],logs:[],error:String(err&&err.message||err)})}}';
const PY_SRC = 'importScripts(${JSON.stringify(PYODIDE)});let py=null;postMessage("ready");onmessage=async(e)=>{try{py=py||await loadPyodide();py.globals.set("USER_CODE",e.data.code);py.globals.set("ENTRY",e.data.entry);py.globals.set("TESTS_JSON",e.data.tests);postMessage(JSON.parse(py.runPython(e.data.harness)))}catch(err){postMessage({results:[],logs:[],error:String(err&&err.message||err)})}}';
const spawn = (src) => {
  const w = new Worker("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
  const ready = new Promise((res) => w.addEventListener("message", (m) => m.data === "ready" && res(), { once: true }));
  return { w, ready };
};
let spareJs = spawn(JS_SRC);
let py = null;
addEventListener("message", async (e) => {
  if (e.source !== parent) return;
  const { id, lang, payload, timeout } = e.data;
  let worker;
  if (lang === "python") {
    py = py || spawn(PY_SRC);
    worker = py;
  } else {
    worker = spareJs;
    spareJs = spawn(JS_SRC);
  }
  await worker.ready;
  const w = worker.w;
  const reply = (out) => parent.postMessage({ id, out }, "*");
  const timer = setTimeout(() => {
    w.terminate();
    if (lang === "python") py = null;
    reply({ results: [], logs: [], error: "Timed out — is there an infinite loop?" });
  }, timeout);
  w.onmessage = (m) => {
    clearTimeout(timer);
    if (lang !== "python") w.terminate();
    reply(m.data);
  };
  w.onerror = (err) => {
    clearTimeout(timer);
    reply({ results: [], logs: [], error: String(err.message || "Worker error") });
  };
  w.postMessage(payload);
});
parent.postMessage({ ready: true }, "*");
</script>`;

let frame: HTMLIFrameElement | null = null;
let ready: Promise<void> | null = null;
let pythonWarm = false;
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
  const id = nextId++;
  // Python's first run downloads the interpreter (~10 MB), so it gets longer.
  const timeout = language === "python" ? (pythonWarm ? 8000 : 60000) : 4000;
  const payload =
    language === "python"
      ? { code, entry, tests: JSON.stringify(tests), harness: PY_HARNESS }
      : jsHarness(code, entry, tests);
  const out = await new Promise<RunOutput>((resolve) => {
    pending.set(id, resolve);
    frame!.contentWindow!.postMessage({ id, lang: language, payload, timeout }, "*");
  });
  if (language === "python" && !out.error?.startsWith("Timed out")) pythonWarm = true;
  return out;
}
