/* =============================================================
   Eurotrip 26 — service worker
   Faz o app funcionar 100% offline e avisar quando há versão nova.

   ⚠️  REGRA ÚNICA DE MANUTENÇÃO:
   sempre que o index.html mudar, altere DUAS linhas em conjunto:
   a VERSION abaixo E a APP_VERSION no topo do <script> do index.html.
   As duas devem ser sempre idênticas — é a comparação entre elas que
   sincroniza os aparelhos.
   ============================================================= */

const VERSION = 'v6.8';
const CACHE   = 'eurotrip26-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest'
];

/* ---- precache: baixa direto da rede, IGNORANDO o cache HTTP ----
   O GitHub Pages serve tudo com Cache-Control: max-age=600. Com o
   addAll() padrão, um service worker novo podia instalar guardando o
   index.html VELHO (recém-baixado pelo navegador) — motor de uma
   versão servindo página de outra, para sempre. Era a causa-raiz da
   barra de atualização que não parava de aparecer. */
function precache() {
  return caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) {
      return fetch(u, { cache: 'no-store' }).then(function (r) {
        if (!r || r.status !== 200) throw new Error('precache falhou: ' + u);
        return c.put(u, r);
      });
    }));
  });
}

/* ---- instalação: baixa tudo e ASSUME imediatamente ----
   O skipWaiting elimina o estado "em espera" (waiting), que no iOS
   persiste entre aberturas do app e era o gatilho da barra recorrente.
   A página detecta a troca de motor pelo handshake de versão e se
   sincroniza sozinha. */
self.addEventListener('install', function (e) {
  e.waitUntil(
    precache().then(function () { return self.skipWaiting(); })
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

/* ---- a página pede para trocar de versão ou para re-baixar o cache ---- */
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'GET_VERSION' && e.ports && e.ports[0]) {
    e.ports[0].postMessage({ version: VERSION });
  }
  if (e.data && e.data.type === 'RECACHE') {
    var done = precache().then(function () {
      if (e.ports && e.ports[0]) e.ports[0].postMessage({ ok: true });
    });
    if (e.waitUntil) e.waitUntil(done);
  }
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
