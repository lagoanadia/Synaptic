import { saveChallenge, type DraftForBrowser } from "./actions";
import { runInSandbox } from "./sandbox";
import type { Language } from "@/lib/challenge";

// Checks each draft's answer key in the browser sandbox and saves it with
// only the tests its reference solution passes (2+ needed), until `want`
// are saved. Returns the new challenges' ids.
export async function checkAndSave(language: Language, drafts: DraftForBrowser[], want: number): Promise<string[]> {
  const ids: string[] = [];
  for (const draft of drafts) {
    if (ids.length >= want) break;
    const check = await runInSandbox(language, draft.solution, draft.entry, draft.tests);
    const passing = check.error ? [] : draft.tests.filter((_, i) => check.results[i]?.ok);
    if (passing.length < 2) continue;
    const saved = await saveChallenge(draft, passing);
    if (saved.id) ids.push(saved.id);
  }
  return ids;
}
