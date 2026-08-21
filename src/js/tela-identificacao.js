/* =========================================================
   tela-identificacao.js — Tela 1: liga o formulário ao estado.
   Faz two-way binding simples, autosave e validação inline.
   ========================================================= */

import { estado, salvar, agendarSalvamento } from "./estado.js";
import { validarIdentificacao, formatarCnpj, formatarCep, apenasDigitos } from "./validacao.js";

const $ = (sel, ctx = document) => ctx.querySelector(sel);

/** Preenche os inputs a partir do estado (ao carregar rascunho). */
function preencherFormulario() {
  const v = estado.visita;
  const set = (id, valor) => { const el = $("#" + id); if (el) el.value = valor ?? ""; };

  set("data_visita", v.data_visita);
  set("hora_inicio", v.hora_inicio);
  set("razao_social", v.cliente.razao_social);
  set("nome_fantasia", v.cliente.nome_fantasia);
  set("cnpj", v.cliente.cnpj ? formatarCnpj(v.cliente.cnpj) : "");
  set("contato_nome", v.cliente.contato_nome);
  set("contato_telefone", v.cliente.contato_telefone);
  set("unidade_nome", v.unidade.nome);
  set("logradouro", v.unidade.endereco.logradouro);
  set("numero", v.unidade.endereco.numero);
  set("bairro", v.unidade.endereco.bairro);
  set("cep", v.unidade.endereco.cep ? formatarCep(v.unidade.endereco.cep) : "");
  set("municipio", v.unidade.endereco.municipio);
  set("uf", v.unidade.endereco.uf);
  set("grau_risco", v.unidade.grau_risco ?? "");
  set("numero_trabalhadores", v.unidade.numero_trabalhadores ?? "");
  set("tecnico_nome", v.tecnico.nome);
  set("tecnico_funcao", v.tecnico.funcao);
  set("tecnico_registro", v.tecnico.registro_profissional);
}

/** Copia os valores dos inputs para o estado (normalizando). */
function coletarFormulario() {
  const v = estado.visita;
  const val = (id) => ($("#" + id)?.value ?? "").trim();

  v.data_visita = val("data_visita");
  v.hora_inicio = val("hora_inicio");

  v.cliente.razao_social = val("razao_social");
  v.cliente.nome_fantasia = val("nome_fantasia");
  v.cliente.cnpj = apenasDigitos(val("cnpj")); // schema exige 14 dígitos crus
  v.cliente.contato_nome = val("contato_nome");
  v.cliente.contato_telefone = val("contato_telefone");

  v.unidade.nome = val("unidade_nome");
  v.unidade.endereco.logradouro = val("logradouro");
  v.unidade.endereco.numero = val("numero");
  v.unidade.endereco.bairro = val("bairro");
  v.unidade.endereco.cep = apenasDigitos(val("cep")); // schema exige 8 dígitos; vazio é sanitizado
  v.unidade.endereco.municipio = val("municipio");
  v.unidade.endereco.uf = val("uf").toUpperCase();

  const grau = val("grau_risco");
  v.unidade.grau_risco = grau ? Number(grau) : null;
  const nTrab = val("numero_trabalhadores");
  v.unidade.numero_trabalhadores = nTrab ? Number(nTrab) : null;

  if (!v.tecnico.id) v.tecnico.id = "tecnico-local";
  v.tecnico.nome = val("tecnico_nome");
  v.tecnico.funcao = val("tecnico_funcao");
  v.tecnico.registro_profissional = val("tecnico_registro");
}

/** Limpa marcações de erro da tela. */
function limparErros() {
  document.querySelectorAll("#form-identificacao .campo__erro").forEach((el) => (el.textContent = ""));
  document.querySelectorAll("#form-identificacao .invalido").forEach((el) => el.classList.remove("invalido"));
}

/** Exibe erros inline. Foca o primeiro campo com problema. */
function mostrarErros(erros) {
  limparErros();
  const campos = Object.keys(erros);
  campos.forEach((campo) => {
    const alvo = $(`[data-erro="${campo}"]`);
    if (alvo) alvo.textContent = erros[campo];
    const input = $("#" + campo);
    if (input) input.classList.add("invalido");
  });
  if (campos.length) $("#" + campos[0])?.focus();
}

/**
 * Valida e persiste a Tela 1.
 * @returns {boolean} true se válida (pode avançar).
 */
export function validarEComitar() {
  coletarFormulario();
  const erros = validarIdentificacao(estado.visita);
  if (Object.keys(erros).length) {
    mostrarErros(erros);
    return false;
  }
  limparErros();
  salvar();
  return true;
}

/** Inicializa listeners da Tela 1. */
export function inicializarTelaIdentificacao() {
  preencherFormulario();

  const form = $("#form-identificacao");

  // Máscara viva de CNPJ.
  const cnpj = $("#cnpj");
  cnpj?.addEventListener("input", () => { cnpj.value = formatarCnpj(cnpj.value); });

  // UF sempre em maiúsculas.
  const uf = $("#uf");
  uf?.addEventListener("input", () => { uf.value = uf.value.toUpperCase(); });

  // Máscara viva de CEP.
  const cep = $("#cep");
  cep?.addEventListener("input", () => { cep.value = formatarCep(cep.value); });

  // Autosave em rascunho a cada alteração (offline-first, com debounce).
  form?.addEventListener("input", () => { coletarFormulario(); agendarSalvamento(); });
}

/** Recarrega o formulário a partir da visita atual e limpa erros. */
export function preencherIdentificacao() {
  preencherFormulario();
  limparErros();
}
