// Service worker „Wrocław w pikselach”.
// index.html (nawigacja): network-first z kopią offline.
// Dane mapy (data/**: JSON, kafle, plany): network-first z kopią offline, bo zmieniają się przy każdym wydaniu
// (stara woda z cache przy nowym kodzie rysowała urwane rzeki).
// Assety builda (nazwy z hashem), ikony i fonty: stale-while-revalidate (z cache od razu, w tle odświeżenie).
// Zmiana VERSION czyści stare cache przy aktywacji.
const VERSION = 'v3'
const PAGES = `wpm-pages-${VERSION}`
const STATIC = `wpm-static-${VERSION}`
const KEEP = [PAGES, STATIC]

self.addEventListener('install', (e) => {
  // ścieżki względne do zakresu SW (aplikacja działa w podkatalogu)
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(['./'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wpm-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (req.mode === 'navigate') return e.respondWith(networkFirst(req))
  const local = url.origin === location.origin && url.pathname.startsWith(new URL(self.registration.scope).pathname)
  if (local && url.pathname.includes('/data/')) return e.respondWith(networkFirstData(req))
  if ((local && /\.(json|bin|js|css|png|svg|webp|jpg|woff2?|webmanifest)$/.test(url.pathname)) || FONTS.test(req.url)) {
    if (local && url.pathname.endsWith('/sw.js')) return
    e.respondWith(staleWhileRevalidate(req, e))
  }
})

async function networkFirst(req) {
  const cache = await caches.open(PAGES)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put('./', res.clone())
    return res
  } catch {
    // offline: ostatnio pobrana strona (?lang=… i #widok nie zmieniają HTML-a)
    return (await cache.match('./')) ?? Response.error()
  }
}

async function networkFirstData(req) {
  const cache = await caches.open(STATIC)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch {
    return (await cache.match(req)) ?? Response.error()
  }
}

async function staleWhileRevalidate(req, e) {
  const cache = await caches.open(STATIC)
  const hit = await cache.match(req)
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone())
      return res
    })
    .catch(() => hit ?? Response.error())
  // odświeżenie w tle musi się dokończyć, nawet gdy odpowiedź poszła z cache
  e.waitUntil(fresh.catch(() => {}))
  return hit ?? fresh
}
