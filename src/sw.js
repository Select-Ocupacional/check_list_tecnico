/* =========================================================
   sw.js — Service Worker do Check-list (offline-first, sem build).
   Estratégia: precache do "app shell" na instalação e cache-first
   para os assets estáticos. Os dados da visita ficam no IndexedDB/
   localStorage (não passam pelo SW).

   IMPORTANTE: ao alterar qualquer asset, incremente CACHE_VERSAO
   para forçar a atualização do cache nos dispositivos.
   ========================================================= */

const CACHE_VERSAO = "clt-v14";

// App shell — tudo que o app precisa para abrir offline.
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/estilos.css",
  "./js/app.js",
  "./js/config.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/estado.js",
  "./js/tela-ghe.js",
  "./js/tela-treinamentos.js",
  "./js/relatorio.js",
  "./js/imagem.js",
  "./js/validacao.js",
  "./js/catalogo-riscos.js",
  "./js/tabela-cnae-nr04.js",
  "./js/assinatura.js",
  "./js/tela-identificacao.js",
  "./js/tela-setores.js",
  "./js/tela-riscos.js",
  "./js/tela-encerramento.js",
  "./icons/icone-192.png",
  "./icons/icone-512.png",
  "./icons/apple-touch-icon.png",
];

// Instala: pré-cacheia o app shell.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSAO).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Ativa: remove caches de versões antigas.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE_VERSAO).map((c) => caches.delete(c)))
    ).then(() => self.clients.claim())
  );
});

// Busca: cache-first para GET mesma origem; navegações caem no index.html offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const mesmaOrigem = url.origin === self.location.origin;

  // Navegação (abrir o app): tenta rede, cai no cache do index.html offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (!mesmaOrigem) return; // fontes/CDN etc.: deixa o navegador tratar

  // Cache-first: responde do cache; se não houver, busca na rede e guarda.
  event.respondWith(
    caches.match(req).then((cacheado) => {
      if (cacheado) return cacheado;
      return fetch(req).then((resp) => {
        if (resp && resp.ok && resp.type === "basic") {
          const copia = resp.clone();
          caches.open(CACHE_VERSAO).then((cache) => cache.put(req, copia));
        }
        return resp;
      });
    })
  );
});
