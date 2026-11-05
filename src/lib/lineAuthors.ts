// Who last touched each line of a page ("blame", last writer wins).

// LCS line diff: unchanged lines keep their author; new or edited lines go
// to whoever is saving.
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

// Pages saved before line authors existed: every line → the page's author.
export function normalizeLineAuthors(
  lines: string[],
  lineAuthorIds: string[],
  fallbackAuthorId: string,
): string[] {
  if (lineAuthorIds.length === lines.length) return lineAuthorIds;
  return lines.map(() => fallbackAuthorId);
}
