import "server-only";
import { prisma } from "@/lib/prisma";
import { askJson, obj, str } from "@/lib/ai";
import { looksEnglish, spanishComments } from "@/lib/challenge";

type Row = { id: string; title: string; prompt: string; starterCode: string; code: string | null };

// Older challenges were sometimes written in English. The first time one
// is opened it's translated (title and task, structured like new ones)
// and saved, so it only happens once. If the AI isn't reachable, the
// English stays and it's tried again next time.
export async function ensureSpanish(c: Row): Promise<Row> {
  const starterCode = spanishComments(c.starterCode);
  const code = c.code === null ? null : c.code === c.starterCode ? starterCode : spanishComments(c.code);
  let { title, prompt } = c;

  if (looksEnglish(c.prompt) || looksEnglish(c.title)) {
    const data = obj(
      await askJson(
        `Translate this coding exercise into natural Spanish (Spain) for a student. Keep code identifiers, function names and values exactly as they are.
Format "prompt" as markdown: one or two plain sentences on what to do; a line **Recibe:** with one '- \`param\`: what it is' line per parameter; **Devuelve:** and what it returns; then the example as a fenced code block (\`\`\`). Never glue the example into the prose. Keep a leading line like 'De tu nota “…”' unchanged if present.

TITLE: ${c.title}
TASK:
${c.prompt}

Respond with ONLY JSON: {"title": "…", "prompt": "…"}`,
        { maxTokens: 1500 },
      ),
    );
    const t = str(data.title, 120);
    const p = str(data.prompt, 4000);
    if (t && p && !looksEnglish(p)) {
      title = t;
      prompt = p;
    }
  }

  if (title !== c.title || prompt !== c.prompt || starterCode !== c.starterCode || code !== c.code) {
    await prisma.challenge.update({ where: { id: c.id }, data: { title, prompt, starterCode, code } });
  }
  return { ...c, title, prompt, starterCode, code };
}
