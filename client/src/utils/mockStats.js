// Numbers for the Mock & Practice page, derived from GET /cbt/mock-results. The API already did the
// per-test grading; everything here is the comparison between tests (first vs latest), done once so
// the summary cards, the score table and the rank column can never disagree.

export const PASS_MARK = 50; // below this on the latest test = "needs attention"

const isNum = (n) => typeof n === 'number';

// Whole-number average of the scores that exist; null when nobody has one.
const mean = (nums) => (nums.length === 0 ? null : Math.round(nums.reduce((a, b) => a + b, 0) / nums.length));

// Ranks by score, highest first, ties sharing a rank (90, 80, 80, 70 -> 1, 2, 2, 4). Rows without a
// score are unranked and sink to the bottom.
function rankByLatest(rows) {
  const sorted = [...rows].sort((a, b) => {
    if (isNum(a.latest) !== isNum(b.latest)) return isNum(a.latest) ? -1 : 1;
    return (b.latest ?? 0) - (a.latest ?? 0) || a.name.localeCompare(b.name);
  });
  return sorted.map((row) => {
    if (!isNum(row.latest)) return { ...row, rank: null };
    const firstWithSameScore = sorted.findIndex((r) => r.latest === row.latest);
    return { ...row, rank: firstWithSameScore + 1 };
  });
}

// data: the /cbt/mock-results response (tests oldest first). Percentages are whole numbers 0-100.
export function buildMockView(data, showRank) {
  const { tests, students } = data;
  const first = tests[0] || null;
  const latest = tests[tests.length - 1] || null;
  const several = tests.length > 1;

  const on = (student, test) => (test && isNum(student.scores[test._id]) ? student.scores[test._id] : null);

  const latestScores = students.map((s) => on(s, latest)).filter(isNum);
  const latestAvg = mean(latestScores);
  const firstAvg = several ? mean(students.map((s) => on(s, first)).filter(isNum)) : null;
  // averages are rounded before they are subtracted, so the card always equals what the cards above show
  const change = several && isNum(latestAvg) && isNum(firstAvg) ? latestAvg - firstAvg : null;

  const tookBoth = several ? students.filter((s) => isNum(on(s, first)) && isNum(on(s, latest))) : [];

  let rows = students.map((s) => {
    const all = Object.values(s.scores).filter(isNum);
    const lat = on(s, latest);
    const fst = on(s, first);
    return {
      ...s,
      latest: lat,
      best: all.length ? Math.max(...all) : null,
      progress: several && isNum(lat) && isNum(fst) ? lat - fst : null,
    };
  });
  rows = showRank ? rankByLatest(rows) : rows.map((r) => ({ ...r, rank: null }));

  return {
    first,
    latest,
    several,
    latestAvg,
    firstAvg,
    change,
    improving: tookBoth.filter((s) => on(s, latest) > on(s, first)).length,
    tookBoth: tookBoth.length,
    needsAttention: latestScores.filter((p) => p < PASS_MARK).length,
    tookLatest: latestScores.length,
    rows,
  };
}
