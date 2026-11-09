// Uno Resenhas — guarda cartas, sons e ícones no celular.
// Sempre confere com o servidor primeiro (arte nova aparece na hora; o que não mudou volta
// como "304", sem baixar de novo). Sem internet ou com o servidor lento, usa o que está guardado.
const CACHE = 'uno-resenhas-v30'; // mude a versão quando trocar as artes das cartas
const GUARDAR = /\/(cartas|cartas-min|sons)\/|\/icone-|manifest\.webmanifest$/;
const ESPERA = 3000; // ms esperando o servidor antes de usar o guardado

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !GUARDAR.test(url.pathname)) return; // página, /ws, /salas: sempre da rede
  ev.respondWith(caches.open(CACHE).then(async (cache) => {
    const daRede = fetch(req, { cache: 'no-cache' }).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; });
    const guardado = await cache.match(req);
    if (!guardado) return daRede;
    const tempo = new Promise((ok) => setTimeout(() => ok(guardado), ESPERA));
    return Promise.race([daRede.catch(() => guardado), tempo]);
  }));
});
