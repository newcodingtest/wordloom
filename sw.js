const CACHE = "wordloom-2026-10-27-1";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./db.js",
  "./learning.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./data/catalog-manifest.json",
  "./data/sources/README.md",
  "./data/sources/WORDNET-LICENSE.txt",
  "./data/sources/QA.md",
  "./data/sources/original/en-ko/ATTRIBUTION",
  "./data/sources/original/en-ko/LICENSE",
  "./data/sources/frequency-README.md",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const r = await fetch("./data/catalog-manifest.json", {
        cache: "no-store",
      });
      if (!r.ok) throw Error("Manifest unavailable");
      const m = await r.json();
      const c = await caches.open(CACHE);
      await c.addAll([...SHELL, ...m.packs.map((p) => "./" + p.path)]);
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("wordloom-") && name !== CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const r = event.request,
    url = new URL(r.url);
  if (r.method !== "GET" || url.origin !== location.origin) return;
  event.respondWith(
    (async () => {
      const c = await caches.open(CACHE),
        cached = await c.match(r, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(r);
      } catch (e) {
        if (r.mode === "navigate")
          return (
            (await c.match(
              new URL("./index.html", self.registration.scope).href,
            )) || Response.error()
          );
        throw e;
      }
    })(),
  );
});
