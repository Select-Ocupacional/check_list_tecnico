/* =========================================================
   db.js — Persistência local em IndexedDB (offline-first).
   Wrapper mínimo, sem dependências, sobre um object store de visitas.
   Substitui o localStorage e permite guardar MÚLTIPLAS visitas.
   ========================================================= */

const DB_NOME = "select_checklist";
const DB_VERSAO = 1;
const STORE = "visitas";

let _dbPromise = null;

/** Abre (uma vez) a conexão com o IndexedDB, criando o store se preciso. */
function abrir() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

/** Executa uma operação numa transação e resolve com o resultado do request. */
async function executar(modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, modo);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Grava (cria ou atualiza) uma visita. */
export function salvarVisita(visita) {
  return executar("readwrite", (store) => store.put(visita));
}

/** Retorna uma visita pelo id (ou undefined). */
export function obterVisita(id) {
  return executar("readonly", (store) => store.get(id));
}

/** Retorna todas as visitas gravadas. */
export function listarVisitas() {
  return executar("readonly", (store) => store.getAll());
}

/** Remove uma visita pelo id. */
export function excluirVisita(id) {
  return executar("readwrite", (store) => store.delete(id));
}

/** IndexedDB está disponível neste navegador? */
export function suportado() {
  return typeof indexedDB !== "undefined";
}
