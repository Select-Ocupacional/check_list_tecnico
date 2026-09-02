/* =========================================================
   cnpj.js — Consulta pública de CNPJ (BrasilAPI) para preencher os
   dados da empresa na Tela 1. Sem chave/autenticação e com CORS aberto.
   Requer internet: offline/erro degrada silenciosamente (preenche manual).
   ========================================================= */

const ENDPOINT = "https://brasilapi.com.br/api/cnpj/v1/";

/** Mantém só os dígitos de uma string. */
function digitos(v) {
  return String(v || "").replace(/\D/g, "");
}

/**
 * Consulta os dados cadastrais de um CNPJ (14 dígitos).
 * @returns {Promise<object|null>} dados normalizados, ou null se não encontrado/erro.
 * @throws {Error} com code "offline" quando não há conexão.
 */
export async function consultarCnpj(cnpj) {
  const num = digitos(cnpj);
  if (num.length !== 14) return null;
  if (!navigator.onLine) {
    const e = new Error("sem conexão");
    e.code = "offline";
    throw e;
  }

  const resp = await fetch(ENDPOINT + num, { headers: { Accept: "application/json" } });
  if (resp.status === 404) return null; // CNPJ não encontrado
  if (!resp.ok) throw new Error(`cnpj ${resp.status}`);
  const d = await resp.json().catch(() => null);
  if (!d) return null;

  // CNAE fiscal vem como número de 7 dígitos (ex.: 6209100).
  const cnae = d.cnae_fiscal != null ? String(d.cnae_fiscal).padStart(7, "0") : "";

  return {
    razao_social: d.razao_social || "",
    nome_fantasia: d.nome_fantasia || "",
    logradouro: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ").trim(),
    numero: d.numero || "",
    bairro: d.bairro || "",
    cep: digitos(d.cep),
    municipio: d.municipio || "",
    uf: d.uf || "",
    cnae, // 7 dígitos crus
    situacao: d.descricao_situacao_cadastral || "",
  };
}
