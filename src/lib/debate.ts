import "server-only";
import { arr, askJson, obj, str } from "@/lib/ai";

import { MAX_TURNS, type DebateMessage, type Verdict } from "@/lib/debateTypes";

export { MAX_TURNS, type DebateMessage, type Verdict };

// Turns a headline into something worth arguing about.
export async function frameDebate(h: { title: string; summary: string; source: string }, language: string) {
  const data = obj(
    await askJson(
      `Headline (${h.source}): "${h.title}"
${h.summary ? `Summary: ${h.summary}` : ""}

Turn this into a debate for a curious 20-year-old who follows tech and AI. Write in ${language}.
- "motion": one clear, genuinely contestable claim ("X should…", "Y is good/bad for…") — where smart people disagree. Not a fact question.
- "brief": 3-4 neutral sentences: what happened (only what the headline/summary supports; flag uncertainty), and what's actually contested.
- "for_case" and "against_case": the single best one-line argument for each side.
Respond with ONLY JSON: {"motion": "...", "brief": "...", "for_case": "...", "against_case": "..."}`,
      { maxTokens: 1500 },
    ),
  );
  const motion = str(data.motion, 300);
  if (!motion) return null;
  return {
    motion,
    brief: str(data.brief, 1500),
    forCase: str(data.for_case, 300),
    againstCase: str(data.against_case, 300),
  };
}

const opponentRules = (aiSide: string, language: string) => `You are the user's debate opponent. You argue ${aiSide} the motion. Your job is to make them think harder — not to flatter them, and not to win dishonestly.
Rules:
- Argue like an informed advocate: mechanisms, trade-offs, precedents, numbers you're confident about. Never invent facts, studies or quotes; if unsure say so or argue from principle.
- Go for the weakest link in their LAST message. If they made a genuinely good point, concede it in one short clause, then pivot.
- If they dodged your previous question, call it out first.
- Name a logical fallacy only if it's really there, and quote their exact words.
- No generic praise ("great point", "interesting"). No hedging walls. Direct, a bit provocative, never rude.
- Under 160 words. End with exactly ONE pointed question they must answer.
- Write in ${language}.`;

function transcript(messages: DebateMessage[]) {
  return messages.map((m) => `${m.role === "user" ? "USER" : "YOU"}: ${m.text}`).join("\n\n");
}

export async function opponentTurn(
  d: { motion: string; brief: string; side: string; language: string },
  messages: DebateMessage[],
): Promise<DebateMessage | null> {
  const aiSide = d.side === "for" ? "AGAINST" : "FOR";
  const userTurns = messages.filter((m) => m.role === "user").length;
  // The first user message is their steelman of YOUR side.
  const phase =
    userTurns === 1
      ? `The user's first message is their STEELMAN of your side (${aiSide}): the strongest case they can make for it. First grade it honestly in 1-2 sentences (what they nailed, what the strongest version would add). Then give your opening argument and your question.`
      : userTurns >= MAX_TURNS
        ? "This is the last exchange: give your closing rebuttal and summarize, in one sentence, the crux where you two actually disagree. Instead of a question, invite them to end the debate for the verdict."
        : "Reply to their latest argument.";
  const data = obj(
    await askJson(
      `${opponentRules(aiSide, d.language)}

Motion: "${d.motion}"
Context: ${d.brief}
The user argues ${d.side.toUpperCase()}.

${phase}

Debate so far:
${transcript(messages)}

Respond with ONLY JSON: {"reply": "...", "fallacies": [{"name": "fallacy name", "quote": "their exact words"}]} (fallacies = only real ones in their latest message, else []).`,
      { maxTokens: 2500 },
    ),
  );
  const reply = str(data.reply, 2500);
  if (!reply) return null;
  return {
    role: "ai",
    text: reply,
    fallacies: arr(data.fallacies)
      .map((f) => ({ name: str(obj(f).name, 60), quote: str(obj(f).quote, 200) }))
      .filter((f) => f.name && f.quote)
      .slice(0, 3),
  };
}

const clamp = (n: unknown) => Math.max(1, Math.min(5, Math.round(Number(n) || 1)));

export async function judge(
  d: { motion: string; side: string; language: string },
  messages: DebateMessage[],
): Promise<Verdict | null> {
  const data = obj(
    await askJson(
      `You are an impartial debate judge. Judge the USER's performance (they argued ${d.side.toUpperCase()} "${d.motion}") against the AI opponent. Judge reasoning quality, not which side you prefer. Be honest — inflated scores help nobody. Write in ${d.language}.

Debate:
${transcript(messages)}

Respond with ONLY JSON:
{"winner": "you" | "ai" | "draw",
 "scores": {"clarity": 1-5, "evidence": 1-5, "logic": 1-5, "responsiveness": 1-5},
 "strongest": "their single best moment, quoted or paraphrased, and why it worked",
 "weakest": "their weakest moment and how to fix it next time",
 "fallacies": [{"name": "...", "quote": "their words"}],
 "steelman": "how good their steelman of the other side was, one sentence",
 "rethink": "one consideration they never addressed that could change their mind",
 "read_more": ["2-3 specific search queries to go deeper"]}`,
      { maxTokens: 2500 },
    ),
  );
  const winner = str(data.winner) as Verdict["winner"];
  if (!["you", "ai", "draw"].includes(winner)) return null;
  const s = obj(data.scores);
  return {
    winner,
    scores: { clarity: clamp(s.clarity), evidence: clamp(s.evidence), logic: clamp(s.logic), responsiveness: clamp(s.responsiveness) },
    strongest: str(data.strongest, 600),
    weakest: str(data.weakest, 600),
    fallacies: arr(data.fallacies)
      .map((f) => ({ name: str(obj(f).name, 60), quote: str(obj(f).quote, 200) }))
      .filter((f) => f.name)
      .slice(0, 6),
    steelman: str(data.steelman, 400),
    rethink: str(data.rethink, 600),
    readMore: arr(data.read_more).map((q) => str(q, 120)).filter(Boolean).slice(0, 3),
  };
}

// Your habits across debates: which fallacies keep showing up, average score.
export function debateStats(verdicts: Verdict[]) {
  const counts = new Map<string, number>();
  for (const v of verdicts) for (const f of v.fallacies) counts.set(f.name.toLowerCase(), (counts.get(f.name.toLowerCase()) ?? 0) + 1);
  const avg = (k: keyof Verdict["scores"]) =>
    verdicts.length ? Math.round((verdicts.reduce((n, v) => n + v.scores[k], 0) / verdicts.length) * 10) / 10 : 0;
  return {
    debates: verdicts.length,
    wins: verdicts.filter((v) => v.winner === "you").length,
    averages: { clarity: avg("clarity"), evidence: avg("evidence"), logic: avg("logic"), responsiveness: avg("responsiveness") },
    topFallacies: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => ({ name, n })),
  };
}
