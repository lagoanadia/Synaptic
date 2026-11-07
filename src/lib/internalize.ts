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

// An excerpt from notes can be a table, a list or plain prose — only show
// it as code when most of its lines look like code.
const CODE_LINE = /[;{}]\s*$|=>|^\s*(def|class|function|import|from|return|const|let|var|public|private|protected|static|if|for|while|switch|try|catch|SELECT|INSERT|UPDATE|CREATE|#include|package|fun|val)\b|^\s*(<\/?[a-z][\w-]*[\s>/]|\/\/|#\s|\/\*)/;
export function looksLikeCode(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0 || lines.some((l) => l.startsWith("|"))) return false;
  return lines.filter((l) => CODE_LINE.test(l)).length / lines.length >= 0.4;
}
