/* =========================================================
   admin.js — Painel Administrativo (SST — Painel Admin).
   Acesso restrito a usuários com papel "admin" (tabela perfis).
   Usa fetch direto ao REST do Supabase; a RLS garante que só admin
   enxergue/gerencie todas as visitas e perfis.
   ========================================================= */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { tokenAcesso, usuarioAtual } from "./auth.js";
import { salvarVisita as dbSalvar } from "./db.js";

const REST = `${SUPABASE_URL}/rest/v1`;

// Papel do usuário atual, resolvido uma vez por sessão (evita refetch).
let papelAtual = null;

async function cabecalhos(extra = {}) {
  const token = await tokenAcesso();
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

/**
 * Descobre o papel do usuário atual ("admin" | "tecnico") consultando perfis.
 * Retorna "tecnico" quando offline/sem sessão (degrada com segurança).
 * @param {boolean} [forcar] Ignora o cache e refaz a consulta.
 */
export async function obterPapel(forcar = false) {
  if (papelAtual && !forcar) return papelAtual;
  const uid = usuarioAtual()?.id;
  if (!uid || !navigator.onLine) return "tecnico";
  try {
    const resp = await fetch(`${REST}/perfis?select=papel&user_id=eq.${uid}`, {
      headers: await cabecalhos(),
    });
    if (!resp.ok) return "tecnico";
    const linhas = await resp.json();
    papelAtual = linhas?.[0]?.papel === "admin" ? "admin" : "tecnico";
    return papelAtual;
  } catch {
    return "tecnico";
  }
}

/** Conveniência síncrona: usa o papel já resolvido por obterPapel(). */
export function ehAdmin() {
  return papelAtual === "admin";
}

/** Limpa o cache de papel (ex.: ao sair). */
export function limparPapel() {
  papelAtual = null;
}

/** Lista TODAS as visitas do servidor (RLS: admin vê todas). */
export async function listarTodasVisitas() {
  const campos = "id,tecnico_id,status,data_visita,cliente_razao,atualizado_em,dados";
  const resp = await fetch(`${REST}/visitas?select=${campos}&order=atualizado_em.desc`, {
    headers: await cabecalhos(),
  });
  if (!resp.ok) throw new Error(`admin visitas ${resp.status}: ${await resp.text().catch(() => "")}`);
  return resp.json();
}

/** Lista todos os perfis (RLS: admin vê todos). */
export async function listarPerfis() {
  const resp = await fetch(`${REST}/perfis?select=user_id,nome,papel,criado_em&order=nome.asc`, {
    headers: await cabecalhos(),
  });
  if (!resp.ok) throw new Error(`admin perfis ${resp.status}: ${await resp.text().catch(() => "")}`);
  return resp.json();
}

/**
 * Define o papel de um usuário ("admin" | "tecnico"). Requer a policy de
 * UPDATE de perfis por admin (ver supabase/schema.sql).
 */
export async function definirPapel(userId, papel) {
  const resp = await fetch(`${REST}/perfis?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: await cabecalhos({ Prefer: "return=minimal" }),
    body: JSON.stringify({ papel }),
  });
  if (!resp.ok) throw new Error(`definir papel ${resp.status}: ${await resp.text().catch(() => "")}`);
  return true;
}

/**
 * Salva no IndexedDB uma visita vinda do servidor, para o admin abri-la e
 * editá-la no assistente. O push posterior (sync) preserva o tecnico_id
 * original (não é reenviado; a RLS de admin permite o UPDATE).
 * @returns {string|null} o id da visita salva.
 */
export async function abrirVisitaRemotaParaEdicao(dados) {
  if (!dados?.id) return null;
  await dbSalvar(dados);
  return dados.id;
}
