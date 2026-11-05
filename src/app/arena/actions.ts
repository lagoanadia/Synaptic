"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { aiBudget } from "@/lib/access";
import { MAX_TURNS, frameDebate, judge, opponentTurn, type DebateMessage } from "@/lib/debate";

async function signedIn() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");
  return { userId: session.user.id, email: session.user.email };
}

const LANGUAGES = ["English", "Español"];

export async function frameHeadline(h: { title: string; summary: string; source: string }, language: string) {
  const { userId, email } = await signedIn();
  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const framed = await frameDebate(
    { title: h.title.slice(0, 300), summary: h.summary.slice(0, 600), source: h.source.slice(0, 60) },
    LANGUAGES.includes(language) ? language : "English",
  );
  if (!framed) return { error: "Couldn't frame a debate from that — try another headline" };
  await budget.charge();
  return { error: null, ...framed };
}

// You picked a side. The opponent's first move: make you steelman it.
export async function startDebate(input: {
  headline: string;
  url: string | null;
  source: string | null;
  motion: string;
  brief: string;
  side: "for" | "against";
  language: string;
}): Promise<{ error: string | null; id?: string }> {
  const { userId } = await signedIn();
  const side = input.side === "against" ? "against" : "for";
  const language = LANGUAGES.includes(input.language) ? input.language : "English";
  const aiSide = side === "for" ? "against" : "for";
  const opener: DebateMessage = {
    role: "ai",
    text:
      language === "Español"
        ? `Vas a defender que estás a ${side === "for" ? "favor" : "en contra"}. Yo defiendo lo contrario. Antes de discutir: dame la versión MÁS FUERTE de mi postura (${aiSide === "for" ? "a favor" : "en contra"}). Si no puedes explicar bien lo que piensa el otro lado, todavía no sabes por qué no estás de acuerdo.`
        : `You're arguing ${side.toUpperCase()}. I'll take the other side. Before we fight: give me the STRONGEST version of my position (${aiSide.toUpperCase()}). If you can't state the other side well, you don't yet know why you disagree with it.`,
  };
  const url = input.url && /^https?:\/\//.test(input.url) ? input.url.slice(0, 500) : null;
  const debate = await prisma.debate.create({
    data: {
      userId,
      headline: input.headline.slice(0, 300),
      url,
      source: input.source?.slice(0, 60) ?? null,
      motion: input.motion.slice(0, 300),
      brief: input.brief.slice(0, 1500),
      language,
      side,
      messages: [opener],
    },
  });
  revalidatePath("/arena");
  return { error: null, id: debate.id };
}

export async function sendArgument(id: string, text: string): Promise<{ error: string | null; messages?: DebateMessage[] }> {
  const { userId, email } = await signedIn();
  const argument = text.trim().slice(0, 3000);
  if (argument.length < 15) return { error: "Make an actual argument — a sentence or two at least" };
  const debate = await prisma.debate.findFirst({ where: { id, userId } });
  if (!debate) return { error: "Debate not found" };
  if (debate.verdict) return { error: "This debate is over" };
  const messages = debate.messages as DebateMessage[];
  if (messages.filter((m) => m.role === "user").length >= MAX_TURNS) return { error: "That's the last round — end it for the verdict" };

  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const withMine: DebateMessage[] = [...messages, { role: "user", text: argument }];
  const reply = await opponentTurn(
    { motion: debate.motion, brief: debate.brief, side: debate.side, language: debate.language },
    withMine,
  );
  if (!reply) return { error: "Your opponent went quiet (AI unreachable) — send it again" };
  await budget.charge();
  const all = [...withMine, reply];
  await prisma.debate.update({ where: { id }, data: { messages: all } });
  return { error: null, messages: all };
}

export async function endDebate(id: string): Promise<{ error: string | null }> {
  const { userId, email } = await signedIn();
  const debate = await prisma.debate.findFirst({ where: { id, userId } });
  if (!debate) return { error: "Debate not found" };
  if (debate.verdict) return { error: null };
  const messages = debate.messages as DebateMessage[];
  if (messages.filter((m) => m.role === "user").length < 2) return { error: "Argue at least two rounds first" };
  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const verdict = await judge({ motion: debate.motion, side: debate.side, language: debate.language }, messages);
  if (!verdict) return { error: "The judge is unreachable — try again" };
  await budget.charge();
  await prisma.debate.update({ where: { id }, data: { verdict } });
  revalidatePath(`/arena/${id}`);
  revalidatePath("/arena");
  return { error: null };
}
