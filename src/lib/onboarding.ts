import { prisma } from "@/lib/prisma";
import { upsertSection } from "@/lib/sections";
import { arr, askJson, obj, str } from "@/lib/ai";

// First visit: a few questions, and the answers become the starter content
// (sections, subjects, a note, flashcards, practice tasks).

export type OnboardingAnswers = {
  areas: { name: string; items: string[] }[];
  learning: { topic: string; subject: string | null };
};

export type StarterPlan = {
  areas: { name: string; items: string[] }[];
  learning: { topic: string; areaName: string; subject: string } | null;
};

const clean = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";

// Pure: sanitizes whatever the browser sent into a plan the database
// writes can trust (limits, trimming, de-duplication, the learning topic
// attached to a real subject). No I/O, so it's unit-tested on its own.
export function planStarterSpace(input: OnboardingAnswers): StarterPlan {
  const areas: StarterPlan["areas"] = [];
  const seenAreas = new Set<string>();
  for (const a of Array.isArray(input?.areas) ? input.areas : []) {
    const name = clean(a?.name, 40);
    if (!name || seenAreas.has(name.toLowerCase())) continue;
    seenAreas.add(name.toLowerCase());
    const seenItems = new Set<string>();
    const items: string[] = [];
    for (const raw of Array.isArray(a?.items) ? a.items : []) {
      const item = clean(raw, 60);
      if (!item || seenItems.has(item.toLowerCase())) continue;
      seenItems.add(item.toLowerCase());
      items.push(item);
      if (items.length >= 8) break;
    }
    areas.push({ name, items });
    if (areas.length >= 6) break;
  }

  const topic = clean(input?.learning?.topic, 200);
  if (!topic) return { areas, learning: null };

  // Attach the topic to the subject they picked; if that's not a real
  // one, to the first subject they typed; failing that, give it a home.
  const wanted = clean(input?.learning?.subject, 60).toLowerCase();
  for (const a of areas) {
    const hit = a.items.find((i) => i.toLowerCase() === wanted);
    if (hit) return { areas, learning: { topic, areaName: a.name, subject: hit } };
  }
  const firstWithItems = areas.find((a) => a.items.length > 0);
  if (firstWithItems) {
    return {
      areas,
      learning: { topic, areaName: firstWithItems.name, subject: firstWithItems.items[0] },
    };
  }
  const subject = clean(topic, 60);
  if (areas.length > 0) {
    areas[0].items.push(subject);
    return { areas, learning: { topic, areaName: areas[0].name, subject } };
  }
  areas.push({ name: "Learning", items: [subject] });
  return { areas, learning: { topic, areaName: "Learning", subject } };
}

type StarterContent = {
  dump: string;
  note: string | null;
  flashcards: { question: string; answer: string }[];
  tasks: string[];
};

async function generateStarterContent(topic: string, subject: string): Promise<StarterContent> {
  const data = obj(
    await askJson(
      `Someone just started using a study app and said they're learning "${topic}" (subject: "${subject}"). Create their first real study material about exactly that topic. Write EVERYTHING in the same language as "${topic}".

Respond with ONLY a JSON object:
{
  "dump": "6-10 short lines of quick, messy first-person class notes about the topic, the way a student jots things down (fragments, arrows, a question to self). Plain text, one idea per line.",
  "note": "The same content, organized: first line '# <title>', then a numbered list ('1.', '2.'...) of the key ideas, sub-points as '   a.' lines. Accurate and beginner-friendly.",
  "flashcards": [{"question": "short specific question", "answer": "short answer"}],
  "tasks": ["3 short, concrete practice tasks to actually do, imperative"]
}
Make 6 flashcards. Only state things that are true.`,
      { maxTokens: 4000 },
    ),
  );

  const dump = str(data.dump, 3000);
  if (!dump) {
    // AI unreachable: still personal, just not written for you.
    return {
      dump: `${topic}\n- What I already know:\n- What confuses me:\n- Questions for class:`,
      note: null,
      flashcards: [],
      tasks: [`Write down 3 things you already know about ${topic}`],
    };
  }
  return {
    dump,
    note: str(data.note, 6000) || null,
    flashcards: arr(data.flashcards)
      .map((c) => ({ question: str(obj(c).question, 300), answer: str(obj(c).answer, 300) }))
      .filter((c) => c.question && c.answer)
      .slice(0, 10),
    tasks: arr(data.tasks)
      .map((t) => str(t, 200))
      .filter(Boolean)
      .slice(0, 5),
  };
}

// Writes the plan: sections → subjects → starter content for the learning
// topic. Returns the subject id the user should land on (if any).
export async function buildStarterSpace(userId: string, plan: StarterPlan): Promise<string | null> {
  let landingId: string | null = null;

  for (const area of plan.areas) {
    const section = await upsertSection(userId, area.name);
    for (const item of area.items) {
      const isLearning =
        plan.learning?.areaName === area.name && plan.learning.subject === item;
      const pursuit = await prisma.pursuit.create({
        data: {
          title: item,
          ownerId: userId,
          sectionId: section.id,
          statusNote: isLearning ? `Learning this week: ${plan.learning!.topic}` : null,
        },
      });
      if (isLearning) landingId = pursuit.id;
    }
  }

  if (plan.learning && landingId) {
    const content = await generateStarterContent(plan.learning.topic, plan.learning.subject);
    const dump = await prisma.brainDump.create({
      data: {
        pursuitId: landingId,
        authorId: userId,
        content: content.dump,
        processed: content.note !== null,
      },
    });
    if (content.note) {
      const note = await prisma.note.create({
        data: {
          pursuitId: landingId,
          content: content.note,
          sourceDumps: { connect: { id: dump.id } },
        },
      });
      if (content.flashcards.length > 0) {
        await prisma.flashcard.createMany({
          data: content.flashcards.map((c) => ({ ...c, pursuitId: landingId!, noteId: note.id })),
        });
      }
    }
    if (content.tasks.length > 0) {
      await prisma.project.create({
        data: {
          pursuitId: landingId,
          title: `Practice: ${plan.learning.topic}`.slice(0, 120),
          dueDate: new Date(Date.now() + 7 * 86400000),
          cards: { create: content.tasks.map((title, order) => ({ title, order })) },
        },
      });
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } });
  return landingId;
}
