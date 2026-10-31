// Uno Resenhas — guarda cartas, sons e ícones no celular.
// Da segunda vez em diante o jogo abre sem baixar nada disso de novo.
// Estratégia: mostra o que está guardado na hora e, por trás, confere se a arte mudou.
const CACHE = 'uno-resenhas-v3'; // mude a versão quando trocar as artes das cartas
const GUARDAR = /\/(cartas|sons)\/|\/icone-|manifest\.webmanifest$/;

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
    const guardado = await cache.match(req);
    const daRede = fetch(req, { cache: 'no-cache' }).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => guardado);
    if (guardado) { ev.waitUntil(daRede); return guardado; }
    return daRede;
  }));
});
