import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { upsertSection } from "@/lib/sections";
import { folderCover } from "@/lib/covers";
import { arr, askJson, obj, str } from "@/lib/ai";

// First visit: the welcome flow's answers (lib/onboardingPlan.ts) become
// notebooks, folders and an example page with cards about this week's topic.

import type { StarterPlan } from "@/lib/onboardingPlan";
export { planStarterSpace, type OnboardingAnswers } from "@/lib/onboardingPlan";

type StarterContent = {
  dump: string;
  note: string | null;
  flashcards: { question: string; answer: string }[];
};

async function generateStarterContent(topic: string, subject: string): Promise<StarterContent> {
  const data = obj(
    await askJson(
      `Someone just started using a study app and said they're learning "${topic}" (subject: "${subject}"). Create their first real study material about exactly that topic. Write EVERYTHING in the same language as "${topic}".

Respond with ONLY a JSON object:
{
  "dump": "6-10 short lines of quick, messy first-person class notes about the topic, the way a student jots things down (fragments, arrows, a question to self). Plain text, one idea per line.",
  "note": "The same content, organized: first line '# <title>', then a numbered list ('1.', '2.'...) of the key ideas, sub-points as '   a.' lines. Accurate and beginner-friendly.",
  "flashcards": [{"question": "short specific question", "answer": "short answer"}]
}
Make 6 flashcards. Only state things that are true.`,
      { maxTokens: 4000 },
    ),
  );

  const dump = str(data.dump, 3000);
  if (!dump) {
    // AI unreachable: still personal, just not written for you.
    return {
      dump: `${topic}\n- Lo que ya sé:\n- Lo que no entiendo:\n- Preguntas para clase:`,
      note: null,
      flashcards: [],
    };
  }
  return {
    dump,
    note: str(data.note, 6000) || null,
    flashcards: arr(data.flashcards)
      .map((c) => ({ question: str(obj(c).question, 300), answer: str(obj(c).answer, 300) }))
      .filter((c) => c.question && c.answer)
      .slice(0, 10),
  };
}

// Writes the plan: notebooks → folders → an example page (+ organized note
// and cards) in this week's folder. Remembers what's an example so it can be
// removed in one go. Returns the folder to land on, if any.
export async function buildStarterSpace(userId: string, plan: StarterPlan): Promise<string | null> {
  let landingId: string | null = null;

  for (const nb of plan.notebooks) {
    const section = await upsertSection(userId, nb.name);
    await prisma.section.update({ where: { id: section.id }, data: { study: nb.study, ...(nb.cover ? { cover: nb.cover } : {}) } });
    for (const f of nb.folders) {
      const pursuit = await prisma.pursuit.create({
        data: {
          title: f.title,
          ownerId: userId,
          sectionId: section.id,
          groupLabel: nb.groupLabel,
          // Same look the welcome flow previewed for it.
          cover: folderCover(f.title),
          ...(f.classroomCourseId ? { classroomCourseId: f.classroomCourseId, classroomCourseName: f.title, classroomEnabled: true } : {}),
          ...(f.challenges
            ? { blocks: ["pages", "map", "review", "challenges"].map((type) => ({ id: type, type })) }
            : {}),
        },
      });
      if (plan.learning?.notebook === nb.name && plan.learning.subject === f.title) landingId = pursuit.id;
    }
  }

  let sample: { topic: string; dumps: string[]; notes: string[]; flashcards: string[] } | null = null;
  if (plan.learning && landingId) {
    const content = await generateStarterContent(plan.learning.topic, plan.learning.subject);
    const dump = await prisma.brainDump.create({
      data: { pursuitId: landingId, authorId: userId, content: content.dump, processed: content.note !== null },
    });
    sample = { topic: plan.learning.topic, dumps: [dump.id], notes: [], flashcards: [] };
    if (content.note) {
      const note = await prisma.note.create({ data: { pursuitId: landingId, content: content.note, sourceDumps: { connect: { id: dump.id } } } });
      sample.notes.push(note.id);
      for (const c of content.flashcards) {
        const card = await prisma.flashcard.create({ data: { ...c, pursuitId: landingId, noteId: note.id } });
        sample.flashcards.push(card.id);
      }
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { onboardedAt: new Date(), ...(sample ? { sampleContent: sample } : {}) } });
  return landingId;
}

// "Quitar lo de ejemplo": deletes exactly what the welcome flow wrote.
export async function removeSampleContent(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sampleContent: true } });
  const s = (user?.sampleContent ?? null) as { dumps?: string[]; notes?: string[]; flashcards?: string[] } | null;
  if (s) {
    const own = { pursuit: { ownerId: userId } };
    await prisma.flashcard.deleteMany({ where: { id: { in: s.flashcards ?? [] }, ...own } });
    await prisma.note.deleteMany({ where: { id: { in: s.notes ?? [] }, ...own } });
    await prisma.brainDump.deleteMany({ where: { id: { in: s.dumps ?? [] }, ...own } });
  }
  await prisma.user.update({ where: { id: userId }, data: { sampleContent: Prisma.DbNull } });
}
