// Debate shapes shared with the browser. Kept apart from lib/debate.ts,
// which calls the AI and must never end up in a client bundle.

export type DebateMessage = {
  role: "user" | "ai";
  text: string;
  // Fallacies the AI spotted in the user message it was replying to.
  fallacies?: { name: string; quote: string }[];
};

export type Verdict = {
  winner: "you" | "ai" | "draw";
  scores: { clarity: number; evidence: number; logic: number; responsiveness: number };
  strongest: string;
  weakest: string;
  fallacies: { name: string; quote: string }[];
  steelman: string;
  rethink: string;
  readMore: string[];
};

export const MAX_TURNS = 8;
