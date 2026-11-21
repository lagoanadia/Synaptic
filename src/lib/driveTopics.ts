import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { aiBudget } from "./access";
import { chat, TEXT_MODEL } from "./ai";
import { parseFlashcardsResponse } from "./flashcards";
import { parseJsonLoosely } from "./json";
import { FREE_MONTHLY_FLASHCARD_LIMIT, getFlashcardsThisMonth } from "./flashcardLimit";
import { upsertContentSection } from "./sections";
import { refreshUnitMap } from "./autoMap";
import { normName, subjectOf } from "./materialName";
import { pageContent, readConfig, topicTitle, type Target } from "./driveAgentPlan";

// "Unificar con Drive", phase d: each topic the script placed becomes a page
// in its subject and unit — the PDF as a card on top (it opens beside the
// page), a summary and the key concepts — plus questions for Repasar, and
// the unit's concept map grows. A newer version of the topic updates the
// same page. A few per call; the rest wait for the next sync.

const MAX_TEXT = 24_000;
const PER_RUN = 3;

type TopicAi = { summary: string; concepts: { term: string; definition: string }[]; raw: string };

async function summarize(title: string, text: string): Promise<TopicAi | null> {
  const prompt = `This is the text of a class topic ("${title}"), extracted from the teacher's slides or document:

${text.slice(0, MAX_TEXT)}

---

Write, in the SAME language as the text (usually Spanish), a JSON object:
{
  "summary": a clear study summary of the topic, 150-400 words, using ONLY these shortcuts: "## " subheadings, "- " bullets, "! " for one key takeaway, "**bold**" for key terms. No other markdown, no code fences;
  "concepts": the 4-8 key concepts, [{"term": "...", "definition": "one sentence"}];
  "cards": 5-8 flashcards about the THEORY (what it is, what it is for, why, differences), never about one-off details; short question naming the topic, short answer, 3 plausible wrong answers about as long as the answer, a hint that doesn't give it away: [{"question": "...", "answer": "...", "wrong": ["...", "...", "..."], "hint": "..."}]
}
Respond with ONLY the JSON object.`;
  const completion = await chat({ model: TEXT_MODEL, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
  const raw = completion.choices[0]?.message?.content ?? "";
  const j = parseJsonLoosely(raw) as { summary?: unknown; concepts?: unknown } | null;
  if (!j || typeof j.summary !== "string" || !j.summary.trim()) return null;
  const concepts = (Array.isArray(j.concepts) ? j.concepts : [])
    .filter((c): c is { term: string; definition: string } => !!c && typeof c.term === "string" && typeof c.definition === "string")
    .slice(0, 10);
  return { summary: j.summary.trim(), concepts, raw };
}

// The user's folder for a subject code ("AD" → their "📌 AD" folder).
async function folderFor(userId: string, subject: string, folders: Record<string, string>) {
  const mine = await prisma.pursuit.findMany({ where: { ownerId: userId, loose: false }, select: { id: true, title: true } });
  return mine.find((p) => subjectOf(p.title, folders) === subject || normName(p.title) === normName(subject)) ?? null;
}

/** Makes (or updates) the pages of topics waiting for one. Returns how many. */
export async function processTopicPages(userId: string): Promise<number> {
  const [agent, user] = await Promise.all([
    prisma.driveAgent.findUnique({ where: { userId }, select: { config: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  if (!agent || !user) return 0;
  const config = readConfig(agent.config);
  if (config.pages === false) return 0;
  const todo = await prisma.driveSource.findMany({ where: { userId, pageStatus: "pending" }, orderBy: { createdAt: "asc" }, take: PER_RUN });
  const budget = await aiBudget(userId, user.email);
  let made = 0;
  for (const s of todo) {
    const target = s.placement as Target | null;
    if (!target || !s.text || !s.outputId) {
      await prisma.driveSource.update({ where: { id: s.id }, data: { pageStatus: "skipped" } });
      continue;
    }
    // Out of AI for today: they wait for tomorrow, as they are.
    if (await budget.check()) break;
    const folder = await folderFor(userId, target.subject, config.folders);
    if (!folder) {
      await prisma.driveSource.update({ where: { id: s.id }, data: { pageStatus: "error", pageError: `Crea una carpeta ${config.folders[target.subject] ?? target.subject} en Synaptic` } });
      continue;
    }
    try {
      const title = topicTitle(target.name);
      const ai = await summarize(title, s.text);
      if (!ai) throw new Error("La IA no ha devuelto un resumen");
      await budget.charge();
      const unitName = target.folder.find((f) => /^UD\d+$/.test(f));
      const unit = unitName ? await upsertContentSection(folder.id, unitName) : null;
      const content = pageContent(title, s.outputId, ai);
      // A newer version of the same topic updates its page (and keeps the cards).
      const previous = await prisma.driveSource.findFirst({ where: { userId, noteId: { not: null }, id: { not: s.id }, placement: { path: ["name"], equals: target.name } }, select: { noteId: true } });
      const existing = previous?.noteId ? await prisma.note.findFirst({ where: { id: previous.noteId, pursuitId: folder.id } }) : null;
      const note = existing
        ? await prisma.note.update({ where: { id: existing.id }, data: { content } })
        : await prisma.note.create({ data: { pursuitId: folder.id, sectionId: unit?.id ?? null, content } });
      // Questions for Repasar, within the free plan's monthly cards.
      if (!existing) {
        const room = budget.unlimited ? Infinity : Math.max(0, FREE_MONTHLY_FLASHCARD_LIMIT - (await getFlashcardsThisMonth(userId)));
        const cards = parseFlashcardsResponse(ai.raw).slice(0, room === Infinity ? 10 : room);
        if (cards.length)
          await prisma.flashcard.createMany({ data: cards.map((c) => ({ pursuitId: folder.id, noteId: note.id, question: c.question, answer: c.answer, distractors: c.distractors, hint: c.hint })) });
      }
      await prisma.driveSource.update({ where: { id: s.id }, data: { pageStatus: "done", noteId: note.id, pageError: null, text: null } });
      await refreshUnitMap(userId, folder.id, unit?.id ?? null).catch(() => {});
      revalidatePath(`/pursuits/${folder.id}`);
      made++;
    } catch (e) {
      await prisma.driveSource.update({ where: { id: s.id }, data: { pageStatus: "error", pageError: String(e instanceof Error ? e.message : e).slice(0, 300) } });
    }
  }
  return made;
}
