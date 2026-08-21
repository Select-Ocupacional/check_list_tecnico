/* =========================================================
   auth.js — Autenticação via API Auth do Supabase (GoTrue), por fetch.
   Sessão em cache no dispositivo (localStorage) para abrir o app offline
   após o primeiro login online. Sem dependências.
   ========================================================= */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const AUTH = `${SUPABASE_URL}/auth/v1`;
const CHAVE_SESSAO = "select_sessao";

function cabecalhos(extra = {}) {
  return { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, ...extra };
}

/** Sessão atual (ou null). */
export function sessao() {
  try {
    const s = localStorage.getItem(CHAVE_SESSAO);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function guardarSessao(dados) {
  const agora = Math.floor(Date.now() / 1000);
  const s = {
    access_token: dados.access_token,
    refresh_token: dados.refresh_token,
    expires_at: dados.expires_at || agora + (dados.expires_in || 3600),
    user: dados.user || null,
  };
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
  return s;
}

export function usuarioAtual() {
  return sessao()?.user || null;
}

export function estaAutenticado() {
  return !!sessao()?.access_token;
}

function mensagemErro(dados, padrao) {
  return dados?.error_description || dados?.msg || dados?.error || dados?.message || padrao;
}

/** Login com e-mail e senha. Requer conexão. */
export async function entrar(email, senha) {
  const resp = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: cabecalhos(),
    body: JSON.stringify({ email, password: senha }),
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(mensagemErro(dados, "E-mail ou senha inválidos."));
  return guardarSessao(dados);
}

/** Cadastro. Se "Confirm email" estiver desativado, já retorna sessão. */
export async function cadastrar(email, senha, nome) {
  const resp = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: cabecalhos(),
    body: JSON.stringify({ email, password: senha, data: { nome } }),
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(mensagemErro(dados, "Não foi possível criar a conta."));
  if (dados.access_token) return guardarSessao(dados); // auto-login
  return null; // aguarda confirmação de e-mail
}

/** Encerra a sessão local (e no servidor, se online). */
export function sair() {
  const s = sessao();
  if (s?.access_token && navigator.onLine) {
    fetch(`${AUTH}/logout`, {
      method: "POST",
      headers: cabecalhos({ Authorization: `Bearer ${s.access_token}` }),
    }).catch(() => {});
  }
  localStorage.removeItem(CHAVE_SESSAO);
}

/** Renova o access_token quando perto de expirar (se online). */
export async function atualizarSessao() {
  const s = sessao();
  if (!s?.refresh_token) return s;
  const agora = Math.floor(Date.now() / 1000);
  if (s.expires_at && s.expires_at - agora > 60) return s; // ainda válido
  if (!navigator.onLine) return s; // offline: mantém a sessão em cache
  try {
    const resp = await fetch(`${AUTH}/token?grant_type=refresh_token`, {
      method: "POST",
      headers: cabecalhos(),
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    const dados = await resp.json().catch(() => ({}));
    if (resp.ok) return guardarSessao(dados);
  } catch { /* rede indisponível — segue com o cache */ }
  return s;
}

/** Retorna um access_token válido para chamadas REST (renova se necessário). */
export async function tokenAcesso() {
  const s = await atualizarSessao();
  return s?.access_token || null;
}
