/* =============================================================
   Eurotrip 26 — service worker
   Faz o app funcionar 100% offline e avisar quando há versão nova.

   ⚠️  REGRA ÚNICA DE MANUTENÇÃO:
   sempre que o index.html mudar, altere a linha VERSION abaixo.
   É a mudança nesses bytes que faz o navegador perceber a atualização
   e mostrar a barra "Nova versão" nos dois celulares.
   ============================================================= */

const VERSION = 'v6.3';
const CACHE   = 'eurotrip26-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest'
];

/* ---- instalação: baixa e guarda tudo ---- */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(ASSETS);
    })
    // sem skipWaiting(): o SW novo espera o usuário tocar em "Atualizar"
  );
});

/* ---- ativação: joga fora os caches de versões antigas ---- */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(
        ks.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

/* ---- a página pede para trocar de versão agora ---- */
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ---- busca: cache primeiro (instantâneo e offline), rede como reserva ---- */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // mapas, tel:, geo:, sites de ingresso passam direto

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // offline e sem cache: se for navegação, devolve o app
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
