/* =========================================================
   sw.js — Service Worker do Check-list (offline-first, sem build).
   Estratégia: precache do "app shell" na instalação e cache-first
   para os assets estáticos. Os dados da visita ficam no IndexedDB/
   localStorage (não passam pelo SW).

   IMPORTANTE: ao alterar qualquer asset, incremente CACHE_VERSAO
   para forçar a atualização do cache nos dispositivos.
   ========================================================= */

const CACHE_VERSAO = "clt-v31";

// App shell — tudo que o app precisa para abrir offline.
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/estilos.css",
  "./js/app.js",
  "./js/config.js",
  "./js/auth.js",
  "./js/sync.js",
  "./js/storage.js",
  "./js/db.js",
  "./js/estado.js",
  "./js/admin.js",
  "./js/tela-ghe.js",
  "./js/tela-treinamentos.js",
  "./js/relatorio.js",
  "./js/imagem.js",
  "./js/validacao.js",
  "./js/catalogo-riscos.js",
  "./js/catalogo-epi.js",
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

// Tempo máximo de espera pela rede no app shell antes de servir o cache.
// Protege o uso em campo: com sinal fraco, o app não trava esperando a rede.
const REDE_TIMEOUT_MS = 3000;

/**
 * "Rede primeiro" com timeout, para HTML/JS/CSS:
 * - online e rápido: usa a rede e atualiza o cache (deploy entra no 1º reload);
 * - online e lento (>3s): serve o cache na hora e atualiza em 2º plano;
 * - offline: cai no cache (navegação → index.html).
 * O 1º acesso (sem cache) sempre aguarda a rede, pois exige internet.
 */
async function redePrimeiroComTimeout(req) {
  const cache = await caches.open(CACHE_VERSAO);
  const cacheado = await cache.match(req);

  const rede = fetch(req).then((resp) => {
    if (resp && resp.ok && resp.type === "basic") cache.put(req, resp.clone());
    return resp;
  });

  if (!cacheado) {
    // Sem cópia local: primeiro acesso precisa da rede.
    try {
      return await rede;
    } catch {
      return req.mode === "navigate" ? cache.match("./index.html") : Response.error();
    }
  }

  // Com cópia local: usa a rede, mas no máximo REDE_TIMEOUT_MS; senão, o cache.
  try {
    return await Promise.race([
      rede,
      new Promise((resolve) => setTimeout(() => resolve(cacheado), REDE_TIMEOUT_MS)),
    ]);
  } catch {
    return cacheado; // rede falhou (offline): serve o cache
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const mesmaOrigem = url.origin === self.location.origin;
  if (!mesmaOrigem) return; // fontes/CDN etc.: deixa o navegador tratar

  const dinamico = req.mode === "navigate" || /\.(?:js|css|html)$/.test(url.pathname);

  if (dinamico) {
    event.respondWith(redePrimeiroComTimeout(req));
    return;
  }

  // Demais assets (imagens, ícones, manifest, fontes): "cache primeiro".
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
