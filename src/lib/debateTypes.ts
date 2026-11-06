// Debate shapes shared with the browser. Kept apart from lib/debate.ts,
// which calls the AI and must never end up in a client bundle.

export type DebateMessage = {
  role: "user" | "ai";
  text: string;
  // Set when the user tapped a one-tap move instead of typing.
  intent?: string;
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

export const MAX_TURNS = 20;

// One-tap moves you can make instead of typing an argument.
export const INTENTS = {
  context: { label: "Explain the context", prompt: "Before going on, explain the background of this topic simply and neutrally: what happened, who's involved, what's actually known. Then hand it back to me." },
  evidence: { label: "Show me evidence", prompt: "Back up your last claim with concrete evidence or examples, and say how confident you are and where it could be wrong." },
  angle: { label: "Another angle", prompt: "Attack this from a completely different angle than so far (ethical, economic, technical, historical, personal…)." },
  steelman: { label: "Test my steelman", prompt: "Ask me to state the strongest version of YOUR side, then judge my attempt honestly." },
  simpler: { label: "Say it simpler", prompt: "Rephrase your last message in plain words, shorter, with an everyday example." },
  switch: { label: "Switch sides", prompt: "I'm switching sides: from now on I argue the opposite of what I argued so far, and you take the side I just left. Acknowledge in one line and open on your new side." },
} as const;
export type Intent = keyof typeof INTENTS;
