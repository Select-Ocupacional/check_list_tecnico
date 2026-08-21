/* =========================================================
   db.js — Persistência local em IndexedDB (offline-first).
   Stores:
   - "visitas": documentos de visita.
   - "midias":  cache local de binários (path -> dataUrl) para exibir
     fotos/assinaturas offline mesmo depois de migradas ao Storage (SST-BE-4).
   ========================================================= */

const DB_NOME = "select_checklist";
const DB_VERSAO = 2;
const STORE = "visitas";
const STORE_MIDIA = "midias";

let _dbPromise = null;

function abrir() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_MIDIA)) {
        db.createObjectStore(STORE_MIDIA, { keyPath: "path" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function executar(store, modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, modo);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/* ---------- Visitas ---------- */

export function salvarVisita(visita) {
  return executar(STORE, "readwrite", (s) => s.put(visita));
}
export function obterVisita(id) {
  return executar(STORE, "readonly", (s) => s.get(id));
}
export function listarVisitas() {
  return executar(STORE, "readonly", (s) => s.getAll());
}
export function excluirVisita(id) {
  return executar(STORE, "readwrite", (s) => s.delete(id));
}

/* ---------- Mídias (cache local de binários) ---------- */

export function salvarMidia(path, dataUrl) {
  return executar(STORE_MIDIA, "readwrite", (s) => s.put({ path, dataUrl }));
}
export async function obterMidia(path) {
  const r = await executar(STORE_MIDIA, "readonly", (s) => s.get(path));
  return r?.dataUrl || null;
}

/** IndexedDB está disponível neste navegador? */
export function suportado() {
  return typeof indexedDB !== "undefined";
}
