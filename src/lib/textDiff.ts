// Lightweight word-level diff using LCS. Returns segments tagged as
// "equal" | "added" | "removed" so the UI can render colored inline diffs.
export type DiffSegment = { type: "equal" | "added" | "removed"; value: string };

const tokenize = (s: string) => (s ?? "").split(/(\s+)/).filter(Boolean);

export function wordDiff(a: string, b: string): DiffSegment[] {
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length;
  const m = B.length;
  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffSegment[] = [];
  let i = 0, j = 0;
  const push = (type: DiffSegment["type"], value: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.value += value;
    else out.push({ type, value });
  };
  while (i < n && j < m) {
    if (A[i] === B[j]) { push("equal", A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push("removed", A[i]); i++; }
    else { push("added", B[j]); j++; }
  }
  while (i < n) { push("removed", A[i++]); }
  while (j < m) { push("added", B[j++]); }
  return out;
}

export function diffStats(segs: DiffSegment[]) {
  let added = 0, removed = 0;
  for (const s of segs) {
    if (s.type === "added") added += s.value.trim() ? s.value.trim().split(/\s+/).length : 0;
    else if (s.type === "removed") removed += s.value.trim() ? s.value.trim().split(/\s+/).length : 0;
  }
  return { added, removed };
}
