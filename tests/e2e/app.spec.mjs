import { test, expect } from "@playwright/test";
import fs from "node:fs";
const m = JSON.parse(fs.readFileSync("data/catalog-manifest.json", "utf8")),
  words = m.packs.flatMap((p) => JSON.parse(fs.readFileSync(p.path, "utf8")));
async function ready(page) {
  await expect(
    page.getByText("기본 제공 6,500개", { exact: false }),
  ).toBeVisible();
}
async function dbread(page, store) {
  return page.evaluate(async (store) => {
    const db = await new Promise((ok, no) => {
      const r = indexedDB.open("wordloom-toefl-v1");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
    return new Promise((ok) => {
      const r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => {
        db.close();
        ok(r.result);
      };
    });
  }, store);
}
async function go(page, route) {
  await page.evaluate((route) => (location.hash = route), route);
  await expect(page.locator("h1")).toHaveText(
    {
      home: "홈",
      words: "단어장",
      cards: "단어 카드",
      quiz: "10문제 시험",
      review: "복습",
      stats: "통계",
      settings: "설정",
    }[route],
  );
}
test("first load, cards, quiz, persistence, backup, all packs offline, mobile", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await ready(page);
  expect((await dbread(page, "words")).length).toBe(6500);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.locator("#connection")).toHaveText("오프라인 준비 완료");
  await page.getByRole("button", { name: "오늘 카드 시작" }).click();
  await expect(page.locator(".flash")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "알겠음", exact: true }),
  ).toBeDisabled();
  await page.locator(".flash").focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "알겠음", exact: true }).click();
  expect(
    (await dbread(page, "progress")).filter((p) => p.firstReviewedAt).length,
  ).toBe(1);
  await page.getByRole("button", { name: "☆ 북마크" }).click();
  await go(page, "quiz");
  await page.getByRole("button", { name: "10문제 시작" }).click();
  for (let n = 0; n < 10; n++) {
    const word = await page.locator(".panel h2").innerText(),
      correct = words
        .find((w) => w.word === word)
        .meaning.split(";")[0]
        .trim();
    const options = page.locator(".options button");
    let index = 0;
    for (let i = 0; i < 4; i++) {
      const text = await options.nth(i).innerText();
      if (
        (n < 8 && text.slice(3) === correct) ||
        (n >= 8 && text.slice(3) !== correct)
      ) {
        index = i;
        break;
      }
    }
    await options.nth(index).click();
    await page
      .getByRole("button", {
        name: n === 9 ? "결과 보기" : "다음 문제",
        exact: true,
      })
      .click();
  }
  await expect(page.getByText("8/10", { exact: true })).toBeVisible();
  expect(
    (await dbread(page, "progress")).filter((p) => p.needsReview).length,
  ).toBe(2);
  expect((await dbread(page, "quizAttempts")).length).toBe(1);
  await page.reload();
  await go(page, "home");
  await ready(page);
  expect((await dbread(page, "words")).length).toBe(6500);
  expect(
    (await dbread(page, "progress")).filter((p) => p.bookmarked).length,
  ).toBe(1);
  expect((await dbread(page, "quizAttempts")).length).toBe(1);
  await go(page, "settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "전체 데이터 JSON 백업" }).click();
  const artifact = await download;
  await artifact.saveAs("verification/backup.json");
  const backup = JSON.parse(
    fs.readFileSync("verification/backup.json", "utf8"),
  );
  expect(backup.words.length).toBe(6500);
  expect(backup.quizAttempts[0].correct).toBe(8);
  await context.setOffline(true);
  await page.reload();
  await go(page, "home");
  await ready(page);
  expect((await dbread(page, "words")).length).toBe(6500);
  for (const w of [words[0], words[3250], words.at(-1)]) {
    await go(page, "words");
    await page.getByRole("searchbox").fill(w.word);
    await page.waitForTimeout(250);
    await page
      .getByRole("button", { name: w.word + " " + w.meaning, exact: true })
      .click();
    await page.locator(".flash").click();
    await expect(page.locator(".flash strong")).toHaveText(w.meaning);
  }
  await go(page, "quiz");
  await page.getByRole("button", { name: "10문제 시작" }).click();
  for (let i = 0; i < 10; i++) {
    await page.locator(".options button").first().click();
    await page
      .getByRole("button", {
        name: i === 9 ? "결과 보기" : "다음 문제",
        exact: true,
      })
      .click();
  }
  expect((await dbread(page, "quizAttempts")).length).toBe(2);
  await page.setViewportSize({ width: 320, height: 780 });
  await go(page, "home");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "verification/mobile-home.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "verification/desktop-home.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("v1 upgrade preserves progress, atomic restore and update preserves bookmarks", async ({
  page,
}) => {
  await page.goto("/data/sources/README.md");
  await page.evaluate(async () => {
    await new Promise((ok, no) => {
      const r = indexedDB.open("wordloom-toefl-v1", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("words", { keyPath: "id" });
        r.result.createObjectStore("progress", { keyPath: "id" });
        r.result.createObjectStore("meta", { keyPath: "key" });
      };
      r.onsuccess = () => {
        const db = r.result,
          t = db.transaction(["words", "progress"], "readwrite");
        t.objectStore("words").put({
          id: "w:you",
          word: "you",
          meaning: "너",
          source: "koreader-en-ko-v1.2.0",
          level: 1,
          category: "일반 독해",
        });
        t.objectStore("progress").put({
          id: "w:you",
          bookmarked: true,
          reviewCount: 3,
        });
        t.objectStore("words").put({
          id: "w:analyze",
          word: "analyze",
          meaning: "분석하다",
        });
        t.objectStore("progress").put({
          id: "w:analyze",
          bookmarked: true,
          repetitions: 2,
          intervalDays: 9,
          needsReview: true,
        });
        t.oncomplete = () => {
          db.close();
          ok();
        };
      };
      r.onerror = () => no(r.error);
    });
  });
  await page.goto("/");
  await ready(page);
  expect((await dbread(page, "words")).length).toBe(6500);
  expect((await dbread(page, "words")).some((w) => w.word === "you")).toBe(
    false,
  );
  expect(
    (await dbread(page, "progress")).find((p) => p.id === "w:you").reviewCount,
  ).toBe(3);
  const original = (await dbread(page, "progress"))[0];
  expect(original.bookmarked).toBe(true);
  expect(original.repetitions).toBe(2);
  expect(original.needsReview).toBe(true);
  await page.evaluate(async () => {
    const db = await new Promise((ok) => {
      const r = indexedDB.open("wordloom-toefl-v1");
      r.onsuccess = () => ok(r.result);
    });
    await new Promise((ok) => {
      const t = db.transaction("meta", "readwrite");
      t.objectStore("meta").put({ key: "catalogVersion", value: "older" });
      t.oncomplete = ok;
    });
    db.close();
  });
  await page.reload();
  await go(page, "home");
  await ready(page);
  expect((await dbread(page, "progress"))[0]).toEqual(original);
  await go(page, "settings");
  const migratedDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "전체 데이터 JSON 백업" }).click();
  const migratedFile = await migratedDownload;
  const migratedBytes = fs.readFileSync(await migratedFile.path());
  expect(
    JSON.parse(migratedBytes).meta.find((x) => x.key === "retiredWordIds")
      .value,
  ).toContain("w:you");
  await page
    .getByLabel("백업 파일 선택")
    .setInputFiles({
      name: "archived.json",
      mimeType: "application/json",
      buffer: migratedBytes,
    });
  await expect(
    page.getByText("복원 미리보기:", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("백업 파일 선택").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"bad"}'),
  });
  await expect(page.locator("#notice")).toContainText(
    "지원하지 않는 백업 형식",
  );
  expect((await dbread(page, "progress"))[0]).toEqual(original);
  const b = {
    format: "wordloom-backup",
    version: 1,
    words: [
      ...words,
      {
        id: "w:you",
        word: "you",
        meaning: "너",
        source: "koreader-en-ko-v1.2.0",
        level: 1,
        category: "일반 독해",
      },
    ],
    progress: [{ ...original, firstReviewedAt: new Date().toISOString() }],
    meta: [],
    studyEvents: [],
    quizAttempts: [
      {
        id: "restored-quiz",
        total: 10,
        correct: 8,
        completedAt: new Date().toISOString(),
        answers: words.slice(0, 10).map((w, i) => ({
          wordId: w.id,
          correct: i < 8,
          correctMeaning: w.meaning,
          selectedMeaning: i < 8 ? w.meaning : "다른 뜻",
        })),
      },
    ],
  };
  await page.getByLabel("백업 파일 선택").setInputFiles({
    name: "good.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(b)),
  });
  await expect(
    page.getByText("복원 미리보기:", { exact: false }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "전체 교체 복원", exact: true })
    .click();
  await expect(page.locator("#notice")).toHaveText("복원했습니다.");
  expect((await dbread(page, "words")).length).toBe(6500);
  expect((await dbread(page, "quizAttempts")).length).toBe(1);
  expect(
    (await dbread(page, "progress")).filter((p) => p.firstReviewedAt).length,
  ).toBe(1);
});
test("missing pack never reports a successful partial installation", async ({
  page,
}) => {
  await page.route("**/data/packs/core-07.json", (r) =>
    r.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "준비를 완료하지 못했어요" }),
  ).toBeVisible();
  expect((await dbread(page, "words")).length).toBe(0);
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
});

test("entire offline catalog remains recoverable from all cached packs under a subpath", async ({
  page,
  context,
}) => {
  const started = Date.now();
  await page.goto("/dist/");
  await ready(page);
  const loadMs = Date.now() - started;
  expect(loadMs).toBeLessThan(15000);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.locator("#connection")).toHaveText("오프라인 준비 완료");
  await context.setOffline(true);
  const result = await page.evaluate(async () => {
    const m = await (await fetch("./data/catalog-manifest.json")).json();
    const all = [];
    for (const p of m.packs) {
      const r = await fetch("./" + p.path);
      if (!r.ok) throw Error(p.path);
      all.push(...(await r.json()));
    }
    return {
      count: all.length,
      unique: new Set(all.map((w) => w.word)).size,
      korean: all.filter((w) => /[가-힣]/.test(w.meaning)).length,
      packs: m.packs.length,
    };
  });
  expect(result).toEqual({
    count: 6500,
    unique: 6500,
    korean: 6500,
    packs: 13,
  });
  await page.goto("/dist/data/sources/README.md");
  await page.evaluate(
    () =>
      new Promise((ok, no) => {
        const r = indexedDB.deleteDatabase("wordloom-toefl-v1");
        r.onsuccess = ok;
        r.onerror = () => no(r.error);
        r.onblocked = () => no(Error("DB blocked"));
      }),
  );
  await page.goto("/dist/");
  await ready(page);
  expect((await dbread(page, "words")).length).toBe(6500);
  const samples = [];
  for (const level of [1, 2, 3, 4])
    for (const category of ["일반 독해", "행동과 과정", "성질과 관계"]) {
      samples.push(
        ...words
          .filter((w) => w.level === level && w.category === category)
          .slice(0, 3),
      );
    }
  for (const w of samples.slice(0, 30)) {
    await go(page, "words");
    await page.getByRole("searchbox").fill(w.word);
    await page.waitForTimeout(180);
    await page
      .getByRole("button", { name: w.word + " " + w.meaning, exact: true })
      .click();
    await page.locator(".flash").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".flash strong")).toHaveText(w.meaning);
    await expect(page.locator(".flash")).toBeFocused();
  }
  await go(page, "stats");
  await expect(page.getByText("확인한 단어", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "verification/offline-stats.png",
    fullPage: true,
  });
  fs.writeFileSync(
    "verification/catalog-browser-check.json",
    JSON.stringify(
      {
        ...result,
        firstLoadMs: loadMs,
        offlineReseedCount: 6500,
        sampleCards: 30,
        subpath: "/dist/",
      },
      null,
      2,
    ),
  );
});
