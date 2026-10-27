import { openDB, all, write, stores, recordSeen } from "./db.js";
import {
  day,
  rate,
  due,
  mastered,
  quiz,
  validateWords,
  streak,
} from "./learning.js";
const main = document.querySelector("#main"),
  nav = document.querySelector("#nav");
const routes = {
  home: "홈",
  cards: "단어 카드",
  quiz: "10문제 시험",
  words: "단어장",
  review: "복습",
  stats: "통계",
  settings: "설정",
};
const sessionSeen = new Set();
let db,
  words = [],
  progress = {},
  attempts = [],
  events = [],
  meta = {},
  settings = { newGoal: 20, reviewGoal: 20, voiceRate: 0.9 },
  deck = [],
  cardIndex = 0,
  flipped = false,
  cardMode = "today",
  quizRun = null,
  quizIndex = 0,
  answers = [],
  quizMode = "all",
  query = "",
  level = "",
  category = "",
  status = "",
  sort = "alpha",
  page = 0,
  restoreCandidate = null;
let route = "home",
  ready = false,
  busy = false;
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function add(parent, ...children) {
  parent.append(...children.filter(Boolean));
  return parent;
}
function btn(text, fn, cls) {
  const e = el("button", text, cls);
  e.type = "button";
  e.onclick = () => safe(fn);
  return e;
}
function link(text, hash, cls) {
  const e = el("a", text, cls);
  e.href = "#" + hash;
  return e;
}
function say(text) {
  document.querySelector("#notice").textContent = text;
  setTimeout(() => {
    document.querySelector("#notice").textContent = "";
  }, 6500);
}
async function safe(fn) {
  try {
    await fn();
  } catch (e) {
    say(e.message);
    console.error(e);
  }
}
function select(options, value, fn, label) {
  const e = el("select");
  e.setAttribute("aria-label", label);
  for (const [v, t] of options) {
    const o = el("option", t);
    o.value = v;
    e.append(o);
  }
  e.value = value;
  e.onchange = () => safe(() => fn(e.value));
  return e;
}
function panel(title) {
  const p = el("section", undefined, "panel");
  if (title) p.append(el("h2", title));
  return p;
}
function getp(w) {
  return progress[w.id] || { id: w.id };
}
function list(mode) {
  const now = Date.now();
  if (mode === "all") return words;
  if (mode === "wrong") return words.filter((w) => getp(w).needsReview);
  if (mode === "bookmarks") return words.filter((w) => getp(w).bookmarked);
  if (mode === "review")
    return words
      .filter((w) => due(getp(w), now))
      .sort(
        (a, b) =>
          !getp(a).needsReview - !getp(b).needsReview ||
          (Date.parse(getp(a).dueAt) || 0) - (Date.parse(getp(b).dueAt) || 0),
      );
  if (mode === "recent")
    return words.filter(
      (w) => getp(w).lastReviewedAt && day(getp(w).lastReviewedAt) === day(now),
    );
  const newToday = words.filter(
    (w) => getp(w).firstReviewedAt && day(getp(w).firstReviewedAt) === day(now),
  ).length;
  return [
    ...list("review").slice(0, settings.reviewGoal),
    ...words
      .filter((w) => !getp(w).firstReviewedAt)
      .sort(
        (a, b) =>
          a.frequencyRank - b.frequencyRank || a.word.localeCompare(b.word),
      )
      .slice(0, Math.max(0, settings.newGoal - newToday)),
  ];
}
function startDeck(mode, one) {
  cardMode = mode;
  deck = one ? [one] : list(mode);
  cardIndex = 0;
  flipped = false;
  if (location.hash === "#cards") render();
  else location.hash = "cards";
}
function speak(w) {
  if (!("speechSynthesis" in window)) {
    say("이 브라우저는 발음 재생을 지원하지 않습니다.");
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(w.word);
  u.lang = "en-US";
  u.rate = settings.voiceRate;
  u.onerror = () =>
    say("음성을 재생할 수 없습니다. 기기 영어 음성을 확인하세요.");
  speechSynthesis.speak(u);
}
async function bookmark(w) {
  const p = { ...getp(w), bookmarked: !getp(w).bookmarked };
  await write(db, { progress: [p] });
  progress[w.id] = p;
  render();
}
async function loadState() {
  words = await all(db, "words");
  progress = Object.fromEntries(
    (await all(db, "progress")).map((p) => [p.id, p]),
  );
  attempts = await all(db, "quizAttempts");
  events = await all(db, "studyEvents");
  meta = Object.fromEntries(
    (await all(db, "meta")).map((x) => [x.key, x.value]),
  );
  settings = { ...settings, ...meta.settings };
}
async function fetchJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw Error(`${path}: HTTP ${r.status}`);
  return r.json();
}
async function bootstrap() {
  ready = false;
  main.replaceChildren(
    el("h1", "단어를 준비하고 있어요"),
    el("p", "기본 영단어 다운로드 및 검증 중…"),
  );
  try {
    db = await openDB();
    await loadState();
    let manifest;
    try {
      manifest = await fetchJSON("./data/catalog-manifest.json");
    } catch (e) {
      if (!meta.catalogReady) throw e;
    }
    if (manifest) {
      let installed = words.filter((w) => manifest.sources[w.source]);
      let valid = false;
      try {
        validateWords(installed, manifest.sources);
        valid = installed.length === manifest.expectedCount;
      } catch {}
      if (meta.catalogVersion !== manifest.catalogVersion || !valid) {
        const incoming = [];
        for (const pack of manifest.packs) {
          const r = await fetch("./" + pack.path);
          if (!r.ok) throw Error("단어 팩 다운로드 실패: " + pack.path);
          const bytes = await r.arrayBuffer();
          if (crypto.subtle) {
            const hash = [
              ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            ]
              .map((x) => x.toString(16).padStart(2, "0"))
              .join("");
            if (hash !== pack.sha256) throw Error("데이터 무결성 검증 실패");
          }
          const part = JSON.parse(new TextDecoder().decode(bytes));
          if (part.length !== pack.expectedCount) throw Error("팩 수량 불일치");
          incoming.push(...part);
          main.lastChild.textContent = `기본 영단어 준비 중: ${incoming.length.toLocaleString()} / ${manifest.expectedCount.toLocaleString()}개`;
        }
        validateWords(incoming, manifest.sources);
        if (incoming.some((w) => manifest.excludedLemmas?.includes(w.word)))
          throw Error("제외 대상 기초 어휘가 포함되어 있습니다.");
        if (incoming.length !== manifest.expectedCount)
          throw Error("전체 수량 불일치");
        const incomingIds = new Set(incoming.map((w) => w.id));
        const retiredIds = words
          .filter((w) => manifest.sources[w.source] && !incomingIds.has(w.id))
          .map((w) => w.id);
        await write(
          db,
          {
            words: incoming,
            meta: [
              { key: "catalogVersion", value: manifest.catalogVersion },
              { key: "catalogReady", value: true },
              { key: "catalogSources", value: manifest.sources },
              { key: "catalogCount", value: incoming.length },
              {
                key: "retiredWordIds",
                value: [
                  ...new Set([...(meta.retiredWordIds || []), ...retiredIds]),
                ],
              },
            ],
          },
          [],
          { words: retiredIds },
        );
        await loadState();
      }
    }
    validateWords(
      words.filter((w) => meta.catalogSources?.[w.source]),
      meta.catalogSources || {},
    );
    if (
      words.filter((w) => meta.catalogSources?.[w.source]).length !==
      meta.catalogCount
    )
      throw Error(
        "저장된 내장 데이터 수량이 다릅니다. 온라인에서 재시도하세요.",
      );
    ready = true;
    window.addEventListener("hashchange", navigate);
    navigate();
    registerSW();
  } catch (e) {
    console.error(e);
    main.replaceChildren(
      el("h1", "준비를 완료하지 못했어요"),
      el("p", e.message, "error"),
      el(
        "p",
        "온라인 연결과 저장 공간을 확인해 주세요. 일부 데이터로 완료 처리하지 않습니다.",
      ),
      btn("다시 시도", bootstrap, "primary"),
    );
  }
}
function navigate() {
  const hash = location.hash.slice(1) || "home";
  if (!routes[hash]) {
    location.replace("#home");
    return;
  }
  route = hash;
  render();
  main.focus();
}
function render() {
  if (!ready) return;
  nav.replaceChildren();
  for (const [key, name] of Object.entries(routes)) {
    const a = link(name, key);
    if (route === key) a.setAttribute("aria-current", "page");
    nav.append(a);
  }
  main.replaceChildren(
    el("p", "A LITTLE EVERY DAY", "eyebrow"),
    el("h1", routes[route]),
  );
  ({
    home: homeView,
    cards: cardsView,
    quiz: quizView,
    words: wordsView,
    review: reviewView,
    stats: statsView,
    settings: settingsView,
  })[route]();
}
function metrics(items) {
  const grid = el("div", undefined, "grid");
  for (const [label, value] of items) {
    const p = panel();
    p.classList.add("metric");
    add(p, el("small", label), el("strong", String(value)));
    grid.append(p);
  }
  return grid;
}
function homeView() {
  main.append(el("p", "하루의 작은 배움, 오래 남는 어휘.", "muted"));
  const hero = el("section", undefined, "hero");
  add(
    hero,
    el("p", "오늘도 나만의 속도로"),
    el("h2", "매일 조금씩,\n더 넓은 영어의 세계로."),
    el(
      "p",
      `오늘 신규 ${settings.newGoal}개 · 복습 목표 ${settings.reviewGoal}개`,
    ),
    btn("오늘 카드 시작 →", () => startDeck("today"), "primary"),
  );
  main.append(hero);
  const learned = words.filter((w) => getp(w).firstReviewedAt).length;
  main.append(
    metrics([
      [
        "오늘 신규",
        words.filter(
          (w) =>
            getp(w).firstReviewedAt &&
            day(getp(w).firstReviewedAt) === day(Date.now()),
        ).length,
      ],
      ["복습 대기", list("review").length],
      ["암기 완료", words.filter((w) => mastered(getp(w), Date.now())).length],
      [
        "최근 시험",
        attempts.length
          ? attempts.toSorted((a, b) =>
              b.completedAt.localeCompare(a.completedAt),
            )[0].correct + "/10"
          : "—",
      ],
    ]),
  );
  const p = panel("조금씩 채워가는 나의 단어장");
  add(
    p,
    el(
      "p",
      `기본 제공 ${meta.catalogCount.toLocaleString()}개 · 학습한 단어 ${learned.toLocaleString()}개 · 사용자 추가 ${words.length - meta.catalogCount}개`,
    ),
  );
  const bar = el("progress");
  bar.max = words.length;
  bar.value = learned;
  bar.setAttribute("aria-label", "학습한 단어 비율");
  p.append(bar);
  add(
    p,
    el(
      "p",
      "토플 학습용 큐레이션 어휘 6,000개 · 실제 내장 " +
        meta.catalogCount.toLocaleString() +
        "개",
      "muted",
    ),
  );
  main.append(
    p,
    add(
      el("div", undefined, "actions"),
      link("10문제 풀기 ↗", "quiz"),
      link("오답 복습 ↗", "review"),
      link("학습 통계 ↗", "stats"),
    ),
  );
}
function cardsView() {
  const modes = [
    ["today", "오늘 학습"],
    ["review", "기한 복습"],
    ["wrong", "퀴즈 오답"],
    ["bookmarks", "북마크"],
    ["all", "전체"],
  ];
  main.append(select(modes, cardMode, (v) => startDeck(v), "카드 범위"));
  if (!deck.length) {
    main.append(
      el("p", "이 범위에 학습할 단어가 없어요."),
      btn("전체 단어 학습", () => startDeck("all")),
    );
    return;
  }
  if (cardMode === "all") {
    const jump = el("form", undefined, "card-jump row");
    const label = el("label", "카드 번호");
    const input = el("input");
    input.id = "card-jump-number";
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "1";
    input.max = String(deck.length);
    input.step = "1";
    input.required = true;
    input.value = String(Math.min(cardIndex + 1, deck.length));
    input.setAttribute("aria-describedby", "card-jump-range");
    label.htmlFor = input.id;
    const range = el("small", `1–${deck.length.toLocaleString()}번`);
    range.id = "card-jump-range";
    const submit = el("button", "이동");
    submit.type = "submit";
    jump.onsubmit = (event) => {
      event.preventDefault();
      if (busy || !jump.reportValidity()) return;
      const position = input.valueAsNumber;
      if (!Number.isInteger(position) || position < 1 || position > deck.length)
        return;
      cardIndex = position - 1;
      flipped = false;
      render();
      document.querySelector(".flash")?.focus();
    };
    add(jump, label, input, submit, range);
    main.append(jump);
  }
  if (cardIndex >= deck.length) {
    main.append(
      el("p", "이번 카드 학습을 마쳤어요."),
      btn("오늘 학습으로", () => startDeck("today")),
    );
    return;
  }
  const w = deck[cardIndex];
  if (!sessionSeen.has(w.id)) {
    sessionSeen.add(w.id);
    safe(async () => {
      await recordSeen(db, w.id);
      const saved = await all(db, "progress");
      for (const p of saved) progress[p.id] = p;
    });
  }
  add(
    main,
    add(
      el("div", undefined, "row between"),
      el("p", `${cardIndex + 1} / ${deck.length}`),
      btn("발음 듣기", () => speak(w)),
      btn(getp(w).bookmarked ? "★ 북마크 해제" : "☆ 북마크", () => bookmark(w)),
    ),
  );
  const card = btn(
    "",
    () => {
      flipped = !flipped;
      render();
      document.querySelector(".flash")?.focus();
    },
    "flash" + (flipped ? " back" : ""),
  );
  card.setAttribute(
    "aria-label",
    w.word + (flipped ? " 뜻 표시됨. 다시 뒤집기" : " 뜻 보기"),
  );
  add(
    card,
    el("small", `L${w.level} · ${w.category}`),
    el("strong", flipped ? w.meaning : w.word),
    el("small", flipped ? w.word : "탭하거나 Enter / Space로 뜻 보기"),
  );
  main.append(card);
  const actions = el("div", undefined, "actions");
  for (const [rating, label] of [
    ["again", "다시 · 10분"],
    ["hard", "어려움"],
    ["good", "알겠음"],
    ["easy", "쉬움"],
  ]) {
    const b = btn(
      label,
      async () => {
        if (busy) return;
        busy = true;
        try {
          const old = getp(w),
            now = Date.now(),
            p = rate(old, rating, now),
            ev = {
              id: crypto.randomUUID(),
              wordId: w.id,
              at: new Date(now).toISOString(),
              kind: old.firstReviewedAt ? "review" : "new",
            };
          await write(db, { progress: [p], studyEvents: [ev] });
          progress[w.id] = p;
          events.push(ev);
          cardIndex++;
          flipped = false;
          render();
        } finally {
          busy = false;
        }
      },
      rating === "good" ? "primary" : "",
    );
    b.disabled = !flipped;
    actions.append(b);
  }
  main.append(
    actions,
    add(
      el("div", undefined, "actions"),
      btn("이전", () => {
        cardIndex = Math.max(0, cardIndex - 1);
        flipped = false;
        render();
      }),
      btn("다음", () => {
        cardIndex++;
        flipped = false;
        render();
      }),
    ),
  );
}
function quizView() {
  if (!quizRun) {
    main.append(
      el(
        "p",
        "서로 다른 단어 10개, 한국어 뜻 4지선다. 완료한 시험만 통계에 반영합니다. 중간에 새로고침하면 새 시험을 시작합니다.",
      ),
      select(
        [
          ["all", "전체 단어"],
          ["recent", "오늘 학습한 단어"],
          ["wrong", "퀴즈 오답"],
        ],
        quizMode,
        (v) => {
          quizMode = v;
        },
        "시험 범위",
      ),
      btn(
        "10문제 시작",
        () => {
          quizRun = quiz(list(quizMode), words);
          quizIndex = 0;
          answers = [];
          render();
        },
        "primary",
      ),
    );
    return;
  }
  if (quizIndex === 10) {
    const correct = answers.filter((x) => x.correct).length;
    main.append(
      metrics([
        ["시험 결과", `${correct}/10`],
        ["정확도", `${correct * 10}%`],
      ]),
    );
    const p = panel("틀린 단어 확인");
    for (const a of answers.filter((a) => !a.correct))
      add(
        p,
        el(
          "p",
          `${words.find((w) => w.id === a.wordId).word} — 정답: ${a.correctMeaning} / 내 답: ${a.selectedMeaning}`,
        ),
      );
    if (correct === 10) p.append(el("p", "모두 맞혔어요!"));
    main.append(
      p,
      btn("다시 풀기", () => {
        quizRun = null;
        render();
      }),
      btn("오답 카드 복습", () => startDeck("wrong")),
    );
    return;
  }
  const q = quizRun[quizIndex],
    answer = answers[quizIndex];
  main.append(el("p", `${quizIndex + 1} / 10`));
  const p = panel();
  add(
    p,
    el("h2", q.word),
    btn("발음 듣기", () => speak({ word: q.word })),
  );
  const options = el("div", undefined, "options");
  for (const [i, o] of q.options.entries()) {
    const b = btn(`${"ABCD"[i]}. ${o}`, () => {
      if (answers[quizIndex]) return;
      answers.push({
        wordId: q.wordId,
        selectedMeaning: o,
        correctMeaning: q.correctMeaning,
        correct: o === q.correctMeaning,
      });
      render();
    });
    b.disabled = !!answer;
    if (answer)
      b.classList.add(
        o === q.correctMeaning
          ? "correct"
          : o === answer.selectedMeaning
            ? "wrong"
            : "answered",
      );
    options.append(b);
  }
  p.append(options);
  if (answer)
    add(
      p,
      el(
        "p",
        answer.correct
          ? "정답입니다."
          : "오답입니다. 정답: " + q.correctMeaning,
      ),
      btn(
        quizIndex === 9 ? "결과 보기" : "다음 문제",
        async () => {
          if (busy) return;
          busy = true;
          try {
            if (quizIndex === 9) {
              const now = new Date().toISOString(),
                attempt = {
                  id: crypto.randomUUID(),
                  mode: quizMode,
                  completedAt: now,
                  total: 10,
                  correct: answers.filter((a) => a.correct).length,
                  answers,
                };
              const changed = answers
                .filter((a) => !a.correct)
                .map((a) => ({
                  ...getp({ id: a.wordId }),
                  needsReview: true,
                  quizWrongCount: (progress[a.wordId]?.quizWrongCount || 0) + 1,
                  updatedAt: now,
                }));
              await write(db, { quizAttempts: [attempt], progress: changed });
              attempts.push(attempt);
              changed.forEach((p) => (progress[p.id] = p));
            }
            quizIndex++;
            render();
          } finally {
            busy = false;
          }
        },
        "primary",
      ),
    );
  main.append(p);
}
function wordRow(w) {
  const row = el("div", undefined, "word-row"),
    b = btn("", () => startDeck("all", w), "word-open");
  add(b, el("strong", w.word), el("span", w.meaning));
  add(
    row,
    b,
    el("span", `L${w.level}`, "tag"),
    btn("발음", () => speak(w)),
    btn(getp(w).bookmarked ? "★" : "☆", () => bookmark(w)),
  );
  row.lastChild.setAttribute("aria-label", w.word + " 북마크");
  return row;
}
function wordsView() {
  const filters = el("div", undefined, "filters"),
    input = el("input");
  input.type = "search";
  input.placeholder = "영어 또는 한국어 뜻 검색";
  input.setAttribute("aria-label", "단어 검색");
  input.value = query;
  let timer;
  input.oninput = () => {
    query = input.value;
    page = 0;
    clearTimeout(timer);
    timer = setTimeout(updateResults, 150);
  };
  add(
    filters,
    input,
    select(
      [["", "모든 레벨"], ...[1, 2, 3, 4].map((n) => [String(n), "L" + n])],
      level,
      (v) => {
        level = v;
        page = 0;
        updateResults();
      },
      "레벨",
    ),
    select(
      [
        ["", "모든 분류"],
        ...[...new Set(words.map((w) => w.category))].map((c) => [c, c]),
      ],
      category,
      (v) => {
        category = v;
        page = 0;
        updateResults();
      },
      "분류",
    ),
    select(
      [
        ["", "모든 상태"],
        ["new", "미학습"],
        ["learning", "학습 중"],
        ["due", "복습 필요"],
        ["mastered", "암기 완료"],
        ["bookmarks", "북마크"],
      ],
      status,
      (v) => {
        status = v;
        page = 0;
        updateResults();
      },
      "학습 상태",
    ),
    select(
      [
        ["alpha", "알파벳순"],
        ["level", "레벨순"],
        ["due", "복습 예정순"],
      ],
      sort,
      (v) => {
        sort = v;
        page = 0;
        updateResults();
      },
      "정렬",
    ),
  );
  main.append(filters);
  const results = el("section");
  results.id = "results";
  main.append(results);
  updateResults();
}
function updateResults() {
  const results = document.querySelector("#results");
  if (!results) return;
  const now = Date.now(),
    q = query.toLowerCase();
  let found = words.filter(
    (w) =>
      (!q || w.word.includes(q) || w.meaning.includes(q)) &&
      (!level || w.level === Number(level)) &&
      (!category || w.category === category) &&
      (!status ||
        (status === "new"
          ? !getp(w).firstReviewedAt
          : status === "due"
            ? due(getp(w), now)
            : status === "mastered"
              ? mastered(getp(w), now)
              : status === "bookmarks"
                ? getp(w).bookmarked
                : !!getp(w).firstReviewedAt && !mastered(getp(w), now))),
  );
  found.sort((a, b) =>
    sort === "level"
      ? a.level - b.level || a.word.localeCompare(b.word)
      : sort === "due"
        ? (Date.parse(getp(a).dueAt) || Infinity) -
          (Date.parse(getp(b).dueAt) || Infinity)
        : a.word.localeCompare(b.word),
  );
  page = Math.min(page, Math.max(0, Math.ceil(found.length / 50) - 1));
  results.replaceChildren(
    el(
      "p",
      `${found.length.toLocaleString()}개 · ${page + 1} / ${Math.max(1, Math.ceil(found.length / 50))}페이지`,
    ),
  );
  for (const w of found.slice(page * 50, page * 50 + 50))
    results.append(wordRow(w));
  const prev = btn("이전 페이지", () => {
      page--;
      updateResults();
    }),
    next = btn("다음 페이지", () => {
      page++;
      updateResults();
    });
  prev.disabled = page === 0;
  next.disabled = (page + 1) * 50 >= found.length;
  results.append(add(el("div", undefined, "actions"), prev, next));
}
function reviewView() {
  const items = list("review");
  main.append(
    el("p", `기한 도달 및 미해결 퀴즈 오답 ${items.length}개 · 중복 제외`),
    btn("복습 카드 시작", () => startDeck("review"), "primary"),
  );
  if (!items.length)
    main.append(
      el("p", "오늘 복습할 단어가 없어요."),
      btn("신규 카드 학습", () => startDeck("today")),
    );
  for (const w of items.slice(0, 50)) main.append(wordRow(w));
  if (items.length > 50)
    main.append(
      el("p", "목록은 첫 50개입니다. 복습 카드에는 전량 포함됩니다."),
    );
}
function statsView() {
  main.append(
    metrics([
      ["전체 어휘", words.length.toLocaleString()],
      ["연속 학습", streak(events, attempts, Date.now()) + "일"],
      ["확인한 단어", words.filter((w) => getp(w).seenCount > 0).length],
      [
        "학습 중",
        words.filter(
          (w) => getp(w).firstReviewedAt && !mastered(getp(w), Date.now()),
        ).length,
      ],
      [
        "오늘 복습",
        events.filter(
          (e) => e.kind === "review" && day(e.at) === day(Date.now()),
        ).length,
      ],
      ["학습한 단어", words.filter((w) => getp(w).firstReviewedAt).length],
      ["암기 완료", words.filter((w) => mastered(getp(w), Date.now())).length],
      ["복습 대기", list("review").length],
    ]),
  );
  const p = panel("최근 7일 카드 평가"),
    week = el("div", undefined, "week");
  for (let n = 6; n >= 0; n--) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    const key = day(d),
      count = events.filter((e) => day(e.at) === key).length,
      item = el("div");
    add(item, el("span", key.slice(5)), el("strong", count + "회"));
    const bar = el("div", undefined, "bar");
    bar.style.width = Math.min(100, count * 5) + "%";
    add(item, bar);
    week.append(item);
  }
  p.append(week);
  main.append(p);
  const total = attempts.reduce((n, a) => n + a.total, 0),
    correct = attempts.reduce((n, a) => n + a.correct, 0);
  main.append(
    metrics([
      ["완료 시험", attempts.length + "회"],
      ["누적 정답률", total ? Math.round((correct / total) * 100) + "%" : "—"],
    ]),
  );
  main.append(
    el(
      "p",
      "확인한 단어 = 화면에 노출된 고유 카드 수. 학습한 단어 = 카드 평가 1회 이상. 암기 완료 = 성공 평가 2회 이상, 간격 7일 이상, 미래 복습 예정, 미해결 오답 없음. 오늘 복습은 이전에 평가한 카드의 재평가 횟수입니다.",
      "muted",
    ),
  );
  for (const a of attempts
    .toSorted((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, 10))
    main.append(
      el("p", `${new Date(a.completedAt).toLocaleString()} · ${a.correct}/10`),
    );
}
async function backup() {
  const data = {
    format: "wordloom-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
  };
  for (const s of stores) data[s] = await all(db, s);
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(data)], { type: "application/json" }),
    ),
    a = el("a");
  a.href = url;
  a.download = "wordloom-backup-" + day(Date.now()) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function validateBackup(b) {
  if (b.format !== "wordloom-backup" || b.version !== 1)
    throw Error("지원하지 않는 백업 형식");
  for (const s of stores) {
    if (!Array.isArray(b[s])) throw Error("누락된 백업 항목: " + s);
    const seen = new Set();
    for (const row of b[s]) {
      const id = row[s === "meta" ? "key" : "id"];
      if (typeof id !== "string" || seen.has(id))
        throw Error("중복 또는 잘못된 백업 ID");
      seen.add(id);
    }
  }
  validateWords(
    b.words,
    Object.fromEntries(b.words.map((w) => [w.source, true])),
  );
  const archivedIds =
    b.meta.find((x) => x.key === "retiredWordIds")?.value || [];
  if (
    !Array.isArray(archivedIds) ||
    archivedIds.some(
      (id) => typeof id !== "string" || !/^w:[a-z]+(?:[ '-][a-z]+)*$/.test(id),
    )
  )
    throw Error("잘못된 보관 어휘 ID");
  const ids = new Set([...b.words.map((w) => w.id), ...archivedIds]);
  for (const p of b.progress) {
    if (
      !ids.has(p.id) ||
      [
        "intervalDays",
        "repetitions",
        "reviewCount",
        "lapses",
        "quizWrongCount",
      ].some((k) => p[k] !== undefined && (!Number.isFinite(p[k]) || p[k] < 0))
    )
      throw Error("잘못된 학습 진도");
    for (const k of ["dueAt", "firstReviewedAt", "lastReviewedAt"])
      if (p[k] && !Number.isFinite(Date.parse(p[k])))
        throw Error("잘못된 학습 날짜");
  }
  for (const a of b.quizAttempts) {
    if (
      a.total !== 10 ||
      !Array.isArray(a.answers) ||
      a.answers.length !== 10 ||
      a.correct !== a.answers.filter((x) => x.correct === true).length ||
      new Set(a.answers.map((x) => x.wordId)).size !== 10 ||
      a.answers.some((x) => !ids.has(x.wordId))
    )
      throw Error("잘못된 시험 기록");
  }
  for (const e of b.studyEvents)
    if (
      !ids.has(e.wordId) ||
      !Number.isFinite(Date.parse(e.at)) ||
      !["new", "review"].includes(e.kind)
    )
      throw Error("잘못된 학습 이벤트");
  return b;
}
function settingsView() {
  main.append(
    el(
      "p",
      "학습 기록은 이 기기의 브라우저에 저장됩니다. 계정과 자동 동기화가 없으니 정기적으로 백업하세요.",
    ),
  );
  const p = panel("나의 학습 속도");
  for (const [key, label, min, max, step] of [
    ["newGoal", "하루 신규 목표", 1, 200, 1],
    ["reviewGoal", "하루 복습 목표", 1, 500, 1],
    ["voiceRate", "발음 속도", 0.5, 1.5, 0.1],
  ]) {
    const l = el("label", label),
      input = el("input");
    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = settings[key];
    input.onchange = () =>
      safe(async () => {
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < min || value > max)
          throw Error("설정 범위를 확인하세요.");
        const next = { ...settings, [key]: value };
        await write(db, { meta: [{ key: "settings", value: next }] });
        settings = next;
        say("설정을 저장했어요.");
      });
    l.append(input);
    p.append(l);
  }
  main.append(p);
  const b = panel("백업과 복원");
  b.append(btn("전체 데이터 JSON 백업", backup, "primary"));
  const label = el("label", "백업 파일 선택 (최대 30MB)"),
    file = el("input");
  file.type = "file";
  file.accept = ".json,application/json";
  file.onchange = () =>
    safe(async () => {
      restoreCandidate = null;
      const f = file.files[0];
      if (!f) return;
      if (f.size > 30 * 1024 * 1024) throw Error("파일이 너무 큽니다.");
      restoreCandidate = validateBackup(JSON.parse(await f.text()));
      render();
    });
  label.append(file);
  b.append(label);
  if (restoreCandidate) {
    add(
      b,
      el(
        "p",
        `복원 미리보기: 단어 ${restoreCandidate.words.length}개, 진도 ${restoreCandidate.progress.length}개, 시험 ${restoreCandidate.quizAttempts.length}회. 병합은 같은 ID를 백업 값으로 갱신합니다. 교체는 현재 기록을 삭제합니다.`,
      ),
    );
    for (const replace of [false, true])
      b.append(
        btn(replace ? "전체 교체 복원" : "병합 복원", async () => {
          if (
            !confirm(
              replace
                ? "현재 기록 전체를 이 백업으로 교체할까요?"
                : "같은 ID의 기록을 백업 값으로 갱신하여 병합할까요?",
            )
          )
            return;
          const changes = Object.fromEntries(
            stores.map((s) => [s, restoreCandidate[s]]),
          );
          changes.meta = changes.meta.filter(
            (x) =>
              ![
                "catalogReady",
                "catalogVersion",
                "catalogSources",
                "catalogCount",
                "settings",
              ].includes(x.key),
          );
          changes.meta.push(
            ...[
              "catalogReady",
              "catalogVersion",
              "catalogSources",
              "catalogCount",
            ].map((key) => ({ key, value: meta[key] })),
          );
          const backupSettings = restoreCandidate.meta.find(
            (x) => x.key === "settings",
          )?.value;
          if (backupSettings) {
            if (
              !Number.isFinite(backupSettings.newGoal) ||
              backupSettings.newGoal < 1 ||
              backupSettings.newGoal > 200 ||
              !Number.isFinite(backupSettings.reviewGoal) ||
              backupSettings.reviewGoal < 1 ||
              backupSettings.reviewGoal > 500 ||
              !Number.isFinite(backupSettings.voiceRate) ||
              backupSettings.voiceRate < 0.5 ||
              backupSettings.voiceRate > 1.5
            )
              throw Error("백업 설정이 유효하지 않습니다.");
            changes.meta.push({ key: "settings", value: backupSettings });
          }
          const combined = new Map(
            restoreCandidate.words
              .filter((w) => !meta.catalogSources[w.source])
              .map((w) => [w.id, w]),
          );
          for (const w of words.filter((w) => meta.catalogSources[w.source]))
            combined.set(w.id, w);
          changes.words = [...combined.values()];
          const archivedFromBackup =
            restoreCandidate.meta.find((x) => x.key === "retiredWordIds")
              ?.value || [];
          const omittedBackupIds = restoreCandidate.words
            .filter((w) => meta.catalogSources[w.source] && !combined.has(w.id))
            .map((w) => w.id);
          changes.meta.push({
            key: "retiredWordIds",
            value: [
              ...new Set([
                ...(meta.retiredWordIds || []),
                ...archivedFromBackup,
                ...omittedBackupIds,
              ]),
            ],
          });
          await write(db, changes, replace ? stores : []);
          restoreCandidate = null;
          await loadState();
          render();
          say("복원했습니다.");
        }),
      );
  }
  main.append(b);
  const install = panel("설치와 오프라인");
  add(
    install,
    el(
      "p",
      "Android Chrome: 브라우저 메뉴 → 앱 설치. iPhone / iPad Safari: 공유 → 홈 화면에 추가. 최초 데이터 준비 및 오프라인 캐시 완료 후 전체 어휘를 사용할 수 있습니다. 발음에는 기기 영어 음성이 필요할 수 있습니다.",
    ),
    el(
      "p",
      `내장 데이터 ${meta.catalogCount.toLocaleString()}개 저장됨. ${swReady ? "앱과 전체 데이터 오프라인 캐시 완료." : "오프라인 앱 캐시 준비 중 또는 미지원."}`,
    ),
  );
  main.append(install);
  const sources = panel("데이터 출처");
  add(
    sources,
    el(
      "p",
      "KOReader Dicts v1.2.0 — Daniel Gregorini 및 기여자. English Wiktionary 기여자 / kaikki.org (wiktextract), Princeton University WordNet 3.0. 선정 빈도: Hermit Dave, FrequencyWords / OpenSubtitles 2018. 파생 데이터 팩 CC BY-SA 4.0. 변경: 표제어 선정, HTML 제거, 한국어 뜻 일부 교정, 분류 및 교육용 레벨 추가.",
    ),
    external("전체 출처와 변경 기록", "./data/sources/README.md"),
    el("br"),
    external(
      "CC BY-SA 4.0 라이선스",
      "https://creativecommons.org/licenses/by-sa/4.0/",
    ),
    el("br"),
    external("WordNet 라이선스", "./data/sources/WORDNET-LICENSE.txt"),
  );
  main.append(
    sources,
    btn("학습 기록 초기화", async () => {
      if (!confirm("모든 학습 진도·북마크·시험 기록을 삭제합니다. 백업했나요?"))
        return;
      if (prompt("확인을 위해 초기화를 입력하세요.") !== "초기화") return;
      await write(db, {}, ["progress", "quizAttempts", "studyEvents"]);
      await loadState();
      render();
      say("학습 기록을 초기화했습니다.");
    }),
  );
}
function external(text, url) {
  const a = el("a", text);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}
let swReady = false;
async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    say("서비스 워커 미지원: 온라인 학습이 가능합니다.");
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register("./sw.js");
    const update = () => {
      swReady = !!reg.active;
      connection();
      if (route === "settings") render();
    };
    await navigator.serviceWorker.ready;
    update();
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && reg.active)
          say("업데이트가 준비됐어요. 앱을 모두 닫고 다시 열면 적용됩니다.");
        update();
      });
    });
  } catch (e) {
    say("오프라인 앱 준비 실패: " + e.message);
  }
}
function connection() {
  document.querySelector("#connection").textContent = navigator.onLine
    ? swReady
      ? "오프라인 준비 완료"
      : "온라인"
    : "오프라인";
}
window.addEventListener("online", connection);
window.addEventListener("offline", connection);
connection();
bootstrap();
