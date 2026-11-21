import { NextResponse, after } from "next/server";
import { agentFor, needText, pendingUndo, plan, report, type Report } from "@/lib/driveAgent";
import { processTopicPages } from "@/lib/driveTopics";
import { readConfig, type Candidate } from "@/lib/driveAgentPlan";

// The student's Apps Script talks to Synaptic here (lib/driveAgentScript.ts).
// Authorization: Bearer <its token>. Two calls:
//   { op: "sync", found: [{ id, name, mimeType, createdAt, course?, submission? }] }
//     → { folders, extraIds, actions: [{ id, target }], undo: [{ id, fileId, oldId }] }
//   { op: "report", runId, results: [{ id, ok, outputId?, path?, oldId?, error? }], undone: [changeId] }
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const agent = await agentFor(token);
  if (!agent) return NextResponse.json({ error: "Token no válido. Vuelve a copiar el script desde Synaptic." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  if (body.op === "sync") {
    const found: Candidate[] = (Array.isArray(body.found) ? body.found : [])
      .slice(0, 1000)
      .filter((f: unknown): f is Record<string, unknown> => !!f && typeof f === "object")
      .filter((f: Record<string, unknown>) => typeof f.id === "string" && typeof f.name === "string" && !isNaN(Date.parse(String(f.createdAt))))
      .map((f: Record<string, unknown>) => ({
        id: String(f.id).slice(0, 100),
        name: String(f.name).slice(0, 300),
        mimeType: typeof f.mimeType === "string" ? f.mimeType.slice(0, 120) : null,
        createdAt: new Date(String(f.createdAt)),
        course: typeof f.course === "string" ? f.course.slice(0, 20) : null,
        submission: f.submission === true,
      }));
    const config = readConfig(agent.config);
    const [actions, undo, textFor] = await Promise.all([plan(agent.userId, found), pendingUndo(agent.userId), needText(agent.userId)]);
    // Topic pages waiting from earlier runs (after the answer: they take a while).
    after(() => processTopicPages(agent.userId).catch(() => {}));
    return NextResponse.json({ folders: config.folders, extraIds: config.extraIds, actions, undo, textFor });
  }

  if (body.op === "report") {
    const results: Report[] = (Array.isArray(body.results) ? body.results : []).filter((r: unknown): r is Report => !!r && typeof r === "object" && typeof (r as Report).id === "string");
    const undone = (Array.isArray(body.undone) ? body.undone : []).filter((x: unknown): x is string => typeof x === "string");
    await report(agent.userId, String(body.runId ?? "").slice(0, 40) || new Date().toISOString(), results, undone);
    after(() => processTopicPages(agent.userId).catch(() => {}));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
