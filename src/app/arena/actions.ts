"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { aiBudget } from "@/lib/access";
import { MAX_TURNS, frameDebate, judge, opponentTurn, type DebateMessage } from "@/lib/debate";
import { INTENTS, type Intent } from "@/lib/debateTypes";

async function signedIn() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No has iniciado sesión");
  return { userId: session.user.id, email: session.user.email };
}

const LANGUAGES = ["Español", "English"];

export async function frameHeadline(h: { title: string; summary: string; source: string }, language: string) {
  const { userId, email } = await signedIn();
  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const framed = await frameDebate(
    { title: h.title.slice(0, 300), summary: h.summary.slice(0, 600), source: h.source.slice(0, 60) },
    LANGUAGES.includes(language) ? language : "Español",
  );
  if (!framed) return { error: "No he podido plantear un debate con eso — prueba otro titular" };
  await budget.charge();
  return { error: null, ...framed };
}

// You picked a side and a style; the AI opens.
export async function startDebate(input: {
  headline: string;
  url: string | null;
  source: string | null;
  motion: string;
  brief: string;
  side: "for" | "against";
  style: "opponent" | "socratic";
  language: string;
}): Promise<{ error: string | null; id?: string }> {
  const { userId, email } = await signedIn();
  const side = input.side === "against" ? "against" : "for";
  const style = input.style === "socratic" ? "socratic" : "opponent";
  const language = LANGUAGES.includes(input.language) ? input.language : "Español";
  const motion = input.motion.slice(0, 300);
  const brief = input.brief.slice(0, 1500);

  const budget = await aiBudget(userId, email);
  const aiOpening = (await budget.check()) ? null : await opponentTurn({ motion, brief, side, style, language }, []);
  if (aiOpening) await budget.charge();
  const opener: DebateMessage = aiOpening ?? {
    role: "ai",
    text: language === "Español" ? "Tu turno: defiende tu postura." : "Your move: make your case.",
  };

  const url = input.url && /^https?:\/\//.test(input.url) ? input.url.slice(0, 500) : null;
  const debate = await prisma.debate.create({
    data: {
      userId,
      headline: input.headline.slice(0, 300),
      url,
      source: input.source?.slice(0, 60) ?? null,
      motion,
      brief,
      side,
      style,
      language,
      messages: [opener],
    },
  });
  revalidatePath("/arena");
  return { error: null, id: debate.id };
}

// A typed message, or a one-tap move (intent) like "show me evidence".
export async function sendArgument(
  id: string,
  text: string,
  intent?: Intent,
): Promise<{ error: string | null; messages?: DebateMessage[]; side?: string }> {
  const { userId, email } = await signedIn();
  const move = intent && intent in INTENTS ? INTENTS[intent] : null;
  const message = move ? move.label : text.trim().slice(0, 3000);
  if (!message) return { error: "Escribe algo primero" };
  const debate = await prisma.debate.findFirst({ where: { id, userId } });
  if (!debate) return { error: "Debate no encontrado" };
  if (debate.verdict) return { error: "Este debate ha terminado" };
  const messages = debate.messages as DebateMessage[];
  if (messages.filter((m) => m.role === "user").length >= MAX_TURNS) return { error: "Es la última ronda — termina para ver el veredicto" };

  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const side = intent === "switch" ? (debate.side === "for" ? "against" : "for") : debate.side;
  const withMine: DebateMessage[] = [...messages, { role: "user", text: message, ...(move ? { intent } : {}) }];
  const reply = await opponentTurn(
    { motion: debate.motion, brief: debate.brief, side, style: debate.style, language: debate.language },
    withMine,
    move?.prompt,
  );
  if (!reply) return { error: "Tu rival se ha quedado callado (IA sin respuesta) — vuelve a enviarlo" };
  await budget.charge();
  const all = [...withMine, reply];
  await prisma.debate.update({ where: { id }, data: { messages: all, side } });
  return { error: null, messages: all, side };
}

export async function endDebate(id: string): Promise<{ error: string | null }> {
  const { userId, email } = await signedIn();
  const debate = await prisma.debate.findFirst({ where: { id, userId } });
  if (!debate) return { error: "Debate no encontrado" };
  if (debate.verdict) return { error: null };
  const messages = debate.messages as DebateMessage[];
  if (messages.filter((m) => m.role === "user" && !m.intent).length < 2) return { error: "Haz al menos dos argumentos primero" };
  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const verdict = await judge({ motion: debate.motion, side: debate.side, language: debate.language }, messages);
  if (!verdict) return { error: "El juez no responde — inténtalo de nuevo" };
  await budget.charge();
  await prisma.debate.update({ where: { id }, data: { verdict } });
  revalidatePath(`/arena/${id}`);
  revalidatePath("/arena");
  return { error: null };
}

export async function deleteDebate(id: string) {
  const { userId } = await signedIn();
  await prisma.debate.deleteMany({ where: { id, userId } });
  revalidatePath("/arena");
}
