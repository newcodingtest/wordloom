import { test, expect } from "@playwright/test";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("data/catalog-manifest.json", "utf8"));
const words = manifest.packs.flatMap((p) => JSON.parse(fs.readFileSync(p.path, "utf8")));

test("meaning update preserves learning records and reaches all words offline", async ({ page, context }) => {
  const progress = {
    id: "w:bottom", bookmarked: true, needsReview: true, repetitions: 3,
    intervalDays: 12, reviewCount: 7, dueAt: "2026-11-01T12:00:00.000Z",
  };
  const history = {
    id: "before-meaning-update", total: 10, correct: 10,
    completedAt: "2026-10-26T12:00:00.000Z",
    answers: [words.find((w) => w.word === "bottom"), ...words.slice(0, 9)]
      .map((w) => ({ wordId: w.id, correct: true,
        correctMeaning: w.word === "bottom" ? "말" : w.meaning,
        selectedMeaning: w.word === "bottom" ? "말" : w.meaning })),
  };
  const event = { id: "before-update-event", wordId: "w:bottom", rating: "good", at: history.completedAt };
  await page.goto("/data/sources/README.md");
  await page.evaluate(async ({ words, manifest, progress, history, event }) => {
    const { openDB, write } = await import("/db.js");
    const db = await openDB();
    await write(db, {
      words: words.map((w) => w.word === "bottom" ? { ...w, meaning: "말" } : w),
      progress: [progress], quizAttempts: [history], studyEvents: [event],
      meta: [
        { key: "catalogVersion", value: "2026.10.26.2" },
        { key: "catalogReady", value: true },
        { key: "catalogSources", value: manifest.sources },
        { key: "catalogCount", value: 6500 },
      ],
    });
    db.close();
  }, { words, manifest, progress, history, event });
  await page.goto("/");
  await expect(page.getByText("기본 제공 6,500개", { exact: false })).toBeVisible();
  const read = () => page.evaluate(async () => {
    const { openDB, all } = await import("/db.js");
    const db = await openDB();
    const result = {};
    for (const key of ["words", "progress", "quizAttempts", "studyEvents", "meta"])
      result[key] = await all(db, key);
    db.close();
    return result;
  });
  const updated = await read();
  expect(updated.words).toEqual(words);
  expect(updated.progress).toEqual([progress]);
  expect(updated.quizAttempts).toEqual([history]);
  expect(updated.studyEvents).toEqual([event]);
  expect(updated.meta.find((x) => x.key === "catalogVersion").value).toBe(manifest.catalogVersion);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("기본 제공 6,500개", { exact: false })).toBeVisible();
  expect((await read()).words).toEqual(words);
  await page.goto("/#words");
  await page.getByRole("searchbox").fill("bottom");
  const meaning = words.find((w) => w.word === "bottom").meaning;
  await page.getByRole("button", { name: "bottom " + meaning, exact: true }).click();
  await page.locator(".flash").click();
  await expect(page.locator(".flash strong")).toHaveText(meaning);
});
