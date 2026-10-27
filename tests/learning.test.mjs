import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { day, rate, due, mastered, quiz, validateWords } from "../learning.js";
const m = JSON.parse(readFileSync("data/catalog-manifest.json", "utf8"));
const words = m.packs.flatMap((p) => JSON.parse(readFileSync(p.path, "utf8")));
const now = Date.parse("2026-10-26T12:00:00Z");
test("real catalog count and runtime validation", () =>
  assert.equal(validateWords(words, m.sources).length, 6500));
test("SRS success, mastery, failure and future due", () => {
  let p = rate({ id: "w:analyze" }, "good", now);
  assert.equal(p.intervalDays, 3);
  assert.equal(p.repetitions, 1);
  assert.equal(due(p, now), false);
  assert.equal(mastered(p, now), false);
  p = rate(p, "good", now);
  assert.equal(p.intervalDays, 6);
  assert.equal(mastered(p, now), false);
  p = rate(p, "good", now);
  assert.equal(p.intervalDays, 12);
  assert.equal(mastered(p, now), true);
  p = rate({ ...p, needsReview: true }, "again", now);
  assert.equal(p.repetitions, 0);
  assert.equal(p.lapses, 1);
  assert.equal(Date.parse(p.dueAt) - now, 600000);
  assert.equal(p.needsReview, false);
  assert.equal(mastered(p, now), false);
});
test("hard/easy and local date", () => {
  assert.equal(rate({}, "hard", now).intervalDays, 1);
  assert.equal(rate({}, "easy", now).intervalDays, 7);
  assert.equal(mastered(rate({}, "easy", now), now), false);
  assert.match(day(now), /^2026-10-26$/);
});
test("100 real catalog quiz rounds have exactly ten distinct questions and four choices", () => {
  for (let i = 0; i < 100; i++) {
    const q = quiz(words, words);
    assert.equal(q.length, 10);
    assert.equal(new Set(q.map((x) => x.wordId)).size, 10);
    for (const x of q) {
      assert.equal(x.options.length, 4);
      assert.equal(new Set(x.options).size, 4);
      assert.equal(x.options.filter((o) => o === x.correctMeaning).length, 1);
    }
  }
  assert.throws(() => quiz(words.slice(0, 9), words));
});
test("runtime rejects duplicate, English-only, invalid source and 5999", () => {
  assert.throws(() => validateWords(words.slice(0, 5999), m.sources));
  for (const mutation of [
    (w) => (w.meaning = "English"),
    (w) => (w.source = "unknown"),
    (w) => (w.level = 5),
  ]) {
    const copy = structuredClone(words);
    mutation(copy[0]);
    assert.throws(() => validateWords(copy, m.sources));
  }
  assert.throws(() => validateWords([...words, words[0]], m.sources));
});
import { streak } from "../learning.js";
test("local calendar streak includes yesterday without a fixed 24h assumption", () => {
  const now = new Date(2026, 9, 26, 0, 5);
  const yesterday = new Date(2026, 9, 25, 23, 55).toISOString();
  const before = new Date(2026, 9, 24, 10).toISOString();
  assert.equal(streak([{ at: yesterday }, { at: before }], [], now), 2);
  assert.equal(
    streak(
      [{ at: yesterday }, { at: before }],
      [{ completedAt: now.toISOString() }],
      now,
    ),
    3,
  );
  assert.equal(streak([{ at: before }], [], now), 0);
});

test("basic vocabulary exclusion policy applies to the entire deployed catalog", () => {
  const policy = JSON.parse(
    readFileSync("data/sources/basic-exclusions.json", "utf8").replace(
      /^\uFEFF/,
      "",
    ),
  );
  const excluded = new Set(
    Object.values(policy.groups).flatMap((s) => s.split(/\s+/)),
  );
  for (const w of words) assert.equal(excluded.has(w.word), false, w.word);
  for (const w of [
    "you",
    "they",
    "it",
    "he",
    "she",
    "the",
    "hello",
    "apple",
    "dog",
    "one",
  ])
    assert.equal(
      words.some((x) => x.word === w),
      false,
      w,
    );
  assert.equal(words.length, 6500);
});
