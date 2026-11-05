// Pure rules behind Internalize — no database, no network.

export type Status = "NEW" | "SEEN" | "REREAD" | "UNDERSTOOD" | "MASTERED";
export type Verdict = "got_it" | "partly" | "not_yet";

const RANK: Record<Status, number> = { NEW: 0, REREAD: 1, SEEN: 2, UNDERSTOOD: 3, MASTERED: 4 };
export const isSolid = (s: Status) => RANK[s] >= RANK.UNDERSTOOD;

// Explaining it back: a pass promotes (understood → mastered on a second
// pass), "partly" keeps you where you are, a miss sends it to reread.
export function statusAfterCheck(current: Status, verdict: Verdict): Status {
  if (verdict === "got_it") return current === "UNDERSTOOD" || current === "MASTERED" ? "MASTERED" : "UNDERSTOOD";
  if (verdict === "not_yet") return "REREAD";
  return current === "NEW" ? "SEEN" : current;
}

// Quiz/Recall: recognizing something isn't proof you understand it, so a
// right answer only promotes what's already understood; a miss always
// sends it back to reread.
export function statusAfterReview(current: Status, correct: boolean): Status {
  if (!correct) return "REREAD";
  return current === "UNDERSTOOD" ? "MASTERED" : current;
}

// Opening a concept counts as having seen it — never demotes.
export const statusAfterOpen = (current: Status): Status => (current === "NEW" ? "SEEN" : current);

export type PathConcept = { id: string; status: Status; order: number; depth: number; parentId: string | null };
export type PathLink = { fromId: string; toId: string };

// What to study next: rereads first (you flagged them), then the first
// not-yet-understood concept in path order whose prerequisites are all
// understood. If every candidate is blocked, the first unfinished one.
export function nextUp(concepts: PathConcept[], links: PathLink[], currentId?: string): string | null {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const ordered = [...concepts].sort((a, b) => a.depth - b.depth || a.order - b.order);
  const open = ordered.filter((c) => !isSolid(c.status) && c.id !== currentId);
  const reread = open.find((c) => c.status === "REREAD");
  if (reread) return reread.id;
  const ready = open.find((c) =>
    links.filter((l) => l.toId === c.id).every((l) => {
      const pre = byId.get(l.fromId);
      return !pre || isSolid(pre.status);
    }),
  );
  return (ready ?? open[0])?.id ?? null;
}

export function progress(statuses: Status[]) {
  const count = (s: Status) => statuses.filter((x) => x === s).length;
  return {
    total: statuses.length,
    mastered: count("MASTERED"),
    understood: count("UNDERSTOOD"),
    reread: count("REREAD"),
    seen: count("SEEN"),
    fresh: count("NEW"),
  };
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

// The AI is asked for verbatim excerpts, but sometimes paraphrases. Only
// keep an excerpt that really appears in the source (whitespace-blind),
// so "the real code" is always actually the real code.
export function excerptInSource(excerpt: string, source: string): boolean {
  const e = squash(excerpt);
  return e.length >= 8 && squash(source).includes(e);
}

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|py|java|kt|cs|go|rs|rb|php|swift|c|cc|cpp|h|sql|prisma|vue|svelte)$/i;
const SKIP = /(^|\/)(node_modules|dist|build|out|\.next|vendor|coverage|generated|__pycache__|\.git)\//;
const SKIP_FILE = /(lock\.json|\.lock|\.min\.js|\.d\.ts|\.map)$/i;

// From a repo's file tree, which files to read (up to `budget` bytes):
// README and manifests first, then source files, shallow before deep,
// small before huge (a 3,000-line file is rarely where you learn the shape).
export function pickRepoFiles(
  files: { path: string; size: number }[],
  budget = 60000,
  perFile = 8000,
): string[] {
  const score = (p: string) => {
    const name = p.split("/").pop()!.toLowerCase();
    if (/^readme(\.md)?$/.test(name) && !p.includes("/")) return 0;
    if (["package.json", "pyproject.toml", "pom.xml", "build.gradle", "schema.prisma"].includes(name)) return 1;
    return 2 + p.split("/").length;
  };
  const candidates = files
    .filter((f) => !SKIP.test(f.path) && !SKIP_FILE.test(f.path))
    .filter((f) => score(f.path) < 2 || CODE_EXT.test(f.path))
    .filter((f) => f.size > 0 && f.size < 200000)
    .sort((a, b) => score(a.path) - score(b.path) || a.size - b.size);
  const picked: string[] = [];
  let used = 0;
  for (const f of candidates) {
    const cost = Math.min(f.size, perFile);
    if (used + cost > budget) continue;
    picked.push(f.path);
    used += cost;
  }
  return picked;
}

// "owner/repo", "github.com/owner/repo", "https://github.com/owner/repo/tree/main/src"
export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const m = input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/.*)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}
