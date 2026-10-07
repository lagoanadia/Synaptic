// Tracks who last touched each line of a Brain Dump's content, so a
// shared Pursuit's editor can show per-line attribution instead of just
// one author for the whole page — same idea as a blame view, but kept to
// "whoever touched it last wins" (not full history) per how this is used.

// Classic LCS-based line diff: lines that are part of the longest common
// subsequence between old and new content keep whoever authored them
// before: every other new line (an addition or an edited line — editing a
// line is indistinguishable from deleting the old one and adding a new
// one once it's just text) is attributed to whoever is saving right now.
export function diffLineAuthors(
  oldLines: string[],
  oldAuthorIds: string[],
  newLines: string[],
  editorId: string,
): string[] {
  const n = oldLines.length;
  const m = newLines.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: string[] = new Array(m);
  let i = 0;
  let j = 0;
  while (j < m) {
    if (i < n && oldLines[i] === newLines[j] && dp[i][j] === dp[i + 1][j + 1] + 1) {
      result[j] = oldAuthorIds[i];
      i++;
      j++;
    } else if (i < n && dp[i + 1][j] >= dp[i][j + 1]) {
      i++; // old line i has no match in the new content — just skip it
    } else {
      result[j] = editorId; // new or changed line
      j++;
    }
  }
  return result;
}

// A dump saved before lineAuthorIds existed (or one whose array somehow
// drifted out of sync with its content) has no real per-line history to
// diff against — treat every existing line as authored by the dump's
// original author rather than crashing or guessing wrong.
export function normalizeLineAuthors(
  lines: string[],
  lineAuthorIds: string[],
  fallbackAuthorId: string,
): string[] {
  if (lineAuthorIds.length === lines.length) return lineAuthorIds;
  return lines.map(() => fallbackAuthorId);
}
