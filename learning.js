export const day = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function rate(p = {}, rating, now) {
  if (!["again", "hard", "good", "easy"].includes(rating))
    throw Error("잘못된 평가");
  const interval =
    rating === "again"
      ? 10 / 1440
      : Math.max(
          { hard: 1, good: 3, easy: 7 }[rating],
          (p.intervalDays || 0) * { hard: 1.2, good: 2, easy: 2.5 }[rating],
        );
  return {
    ...p,
    intervalDays: interval,
    repetitions: rating === "again" ? 0 : (p.repetitions || 0) + 1,
    lapses: (p.lapses || 0) + (rating === "again" ? 1 : 0),
    reviewCount: (p.reviewCount || 0) + 1,
    firstReviewedAt: p.firstReviewedAt || new Date(now).toISOString(),
    lastReviewedAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    dueAt: new Date(now + interval * 86400000).toISOString(),
    lastRating: rating,
    needsReview: false,
  };
}
export const due = (p, now) =>
  !!p && (p.needsReview || (!!p.dueAt && Date.parse(p.dueAt) <= now));
export const mastered = (p, now) =>
  !!p &&
  p.repetitions >= 2 &&
  p.intervalDays >= 7 &&
  Date.parse(p.dueAt) > now &&
  !p.needsReview;
export const primary = (w) => w.meaning.split(";")[0].trim();
export function shuffle(a, rng = Math.random) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const tokens = (s) =>
  new Set(
    s
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
function overlaps(a, b) {
  const x = tokens(a),
    y = tokens(b);
  return [...x].some((t) => y.has(t));
}
export function quiz(candidates, all, rng = Math.random) {
  if (candidates.length < 10)
    throw Error(
      "이 범위에는 서로 다른 단어가 10개 이상 필요합니다. 전체 범위를 선택하세요.",
    );
  return shuffle(candidates, rng)
    .slice(0, 10)
    .map((w) => {
      const options = [primary(w)],
        used = [w.meaning];
      for (const v of shuffle(all, rng)) {
        if (
          used.some((x) => overlaps(x, v.meaning)) ||
          options.includes(primary(v))
        )
          continue;
        options.push(primary(v));
        used.push(v.meaning);
        if (options.length === 4) break;
      }
      if (options.length !== 4) throw Error("구별 가능한 보기가 부족합니다.");
      return {
        wordId: w.id,
        word: w.word,
        correctMeaning: primary(w),
        options: shuffle(options, rng),
      };
    });
}
export function validateWords(words, sources, min = 6000) {
  const ids = new Set(),
    lemmas = new Set();
  for (const w of words) {
    const lemma = w.word
      ?.normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (
      typeof w.meaning !== "string" ||
      w.meaning.length > 1000 ||
      typeof w.category !== "string" ||
      !lemma ||
      !/^[a-z]+(?:[ '-][a-z]+)*$/.test(lemma) ||
      w.id !== "w:" + lemma ||
      ids.has(w.id) ||
      lemmas.has(lemma) ||
      !/[가-힣]/.test(w.meaning) ||
      /TODO|미정|번역 필요|뜻 없음|�/i.test(w.meaning) ||
      !Number.isInteger(w.level) ||
      w.level < 1 ||
      w.level > 4 ||
      !w.category ||
      !sources[w.source]
    )
      throw Error("어휘 검증 실패: " + (w.id || "ID 없음"));
    ids.add(w.id);
    lemmas.add(lemma);
  }
  if (ids.size < min) throw Error(`내장 어휘 부족: ${ids.size} / ${min}`);
  return words;
}
export function streak(events, attempts, now) {
  const active = new Set([
    ...events.map((e) => day(e.at)),
    ...attempts.map((a) => day(a.completedAt)),
  ]);
  const d = new Date(now);
  if (!active.has(day(d))) d.setDate(d.getDate() - 1);
  let count = 0;
  while (active.has(day(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}
