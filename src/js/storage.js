/* =========================================================
   storage.js — Binários (fotos/assinaturas) no Supabase Storage (SST-BE-4).
   Upload dos data URLs para o bucket privado "evidencias" e resolução das
   referências para exibição (data URL → cache local → URL assinada).
   ========================================================= */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { tokenAcesso } from "./auth.js";
import { obterMidia, salvarMidia } from "./db.js";

const STORAGE = `${SUPABASE_URL}/storage/v1`;
const BUCKET = "evidencias";

/** Converte um data URL em Blob. */
function dataUrlParaBlob(dataUrl) {
  const [cab, b64] = dataUrl.split(",");
  const mime = (cab.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Um ref é um data URL (ainda não migrado)? */
export function ehDataUrl(ref) {
  return typeof ref === "string" && ref.startsWith("data:");
}

/** Um ref é um caminho do Storage (não data URL nem URL http)? */
export function ehCaminhoStorage(ref) {
  return typeof ref === "string" && ref.length > 0 && !ref.startsWith("data:") && !/^https?:/i.test(ref);
}

/** Remove do bucket os objetos nos caminhos informados. Retorna quantos foram pedidos. */
export async function removerBinarios(paths) {
  const alvos = (paths || []).filter(ehCaminhoStorage);
  if (!alvos.length) return 0;
  const token = await tokenAcesso();
  const resp = await fetch(`${STORAGE}/object/${BUCKET}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: alvos }),
  });
  if (!resp.ok) throw new Error(`remover binarios ${resp.status}: ${await resp.text().catch(() => "")}`);
  return alvos.length;
}

/** Envia um binário (data URL) ao Storage no caminho informado. */
export async function uploadBinario(path, dataUrl) {
  const token = await tokenAcesso();
  const blob = dataUrlParaBlob(dataUrl);
  const resp = await fetch(`${STORAGE}/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": blob.type,
      "x-upsert": "true",
    },
    body: blob,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`upload ${resp.status}: ${t}`);
  }
  await salvarMidia(path, dataUrl); // cache local p/ exibir offline
  return path;
}

/** Gera uma URL assinada (temporária) para exibir um objeto do Storage. */
export async function urlAssinada(path, expira = 3600) {
  const token = await tokenAcesso();
  const resp = await fetch(`${STORAGE}/object/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: expira }),
  });
  if (!resp.ok) return null;
  const dados = await resp.json().catch(() => ({}));
  return dados?.signedURL ? `${STORAGE}${dados.signedURL}` : null;
}

/**
 * Resolve uma referência (data URL ou caminho do Storage) para uma URL exibível.
 * Ordem: data URL direto → cache local → URL assinada (se online).
 */
export async function resolverRef(ref) {
  if (!ref) return "";
  if (ehDataUrl(ref)) return ref;
  const cache = await obterMidia(ref);
  if (cache) return cache;
  if (navigator.onLine) {
    const url = await urlAssinada(ref);
    return url || "";
  }
  return "";
}
