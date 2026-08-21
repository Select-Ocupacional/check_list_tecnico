/* =========================================================
   tela-identificacao.js — Tela 1: liga o formulário ao estado.
   Faz two-way binding simples, autosave e validação inline.
   ========================================================= */

import {
  estado,
  salvar,
  agendarSalvamento,
  adicionarContato,
  removerContato,
} from "./estado.js";
import { validarIdentificacao, formatarCnpj, formatarCep, formatarCnae, apenasDigitos } from "./validacao.js";
import { grauPorCnae } from "./tabela-cnae-nr04.js";

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
  renderizarContatos();
  set("unidade_nome", v.unidade.nome);
  set("logradouro", v.unidade.endereco.logradouro);
  set("numero", v.unidade.endereco.numero);
  set("bairro", v.unidade.endereco.bairro);
  set("cep", v.unidade.endereco.cep ? formatarCep(v.unidade.endereco.cep) : "");
  set("municipio", v.unidade.endereco.municipio);
  set("uf", v.unidade.endereco.uf);
  set("cnae_principal", v.unidade.cnae_principal ? formatarCnae(v.unidade.cnae_principal) : "");
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
  // contatos são gerenciados à parte (lista dinâmica).

  v.unidade.nome = val("unidade_nome");
  v.unidade.endereco.logradouro = val("logradouro");
  v.unidade.endereco.numero = val("numero");
  v.unidade.endereco.bairro = val("bairro");
  v.unidade.endereco.cep = apenasDigitos(val("cep")); // schema exige 8 dígitos; vazio é sanitizado
  v.unidade.endereco.municipio = val("municipio");
  v.unidade.endereco.uf = val("uf").toUpperCase();
  v.unidade.cnae_principal = val("cnae_principal");

  const grau = val("grau_risco");
  v.unidade.grau_risco = grau ? Number(grau) : null;
  const nTrab = val("numero_trabalhadores");
  v.unidade.numero_trabalhadores = nTrab ? Number(nTrab) : null;

  if (!v.tecnico.id) v.tecnico.id = "tecnico-local";
  v.tecnico.nome = val("tecnico_nome");
  v.tecnico.funcao = val("tecnico_funcao");
  v.tecnico.registro_profissional = val("tecnico_registro");
}

/** Renderiza a lista de contatos do cliente a partir do estado. */
function renderizarContatos() {
  const lista = $("#lista-contatos");
  const vazio = $("#contatos-vazio");
  if (!lista) return;
  const contatos = estado.visita.cliente.contatos || [];
  lista.innerHTML = "";
  if (vazio) vazio.hidden = contatos.length > 0;

  contatos.forEach((contato) => {
    const li = document.createElement("li");
    li.className = "contato-card";

    const info = document.createElement("div");
    info.className = "contato-card__info";
    const nome = document.createElement("p");
    nome.className = "contato-card__nome";
    nome.textContent = contato.nome;
    info.appendChild(nome);

    const detalhes = [contato.departamento, contato.email, contato.telefone].filter(Boolean);
    if (detalhes.length) {
      const meta = document.createElement("p");
      meta.className = "contato-card__meta";
      meta.textContent = detalhes.join(" · ");
      info.appendChild(meta);
    }

    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "setor-card__remover";
    remover.setAttribute("aria-label", `Remover contato ${contato.nome}`);
    remover.textContent = "✕";
    remover.addEventListener("click", () => {
      removerContato(contato.id);
      renderizarContatos();
    });

    li.append(info, remover);
    lista.appendChild(li);
  });
}

/** Lê os campos de novo contato, valida e adiciona. */
function tratarAdicionarContato() {
  const nome = $("#novo_contato_nome").value.trim();
  const email = $("#novo_contato_email").value.trim();
  const erro = $('[data-erro="novo_contato"]');
  if (erro) erro.textContent = "";

  if (!nome) {
    if (erro) erro.textContent = "Informe ao menos o nome do contato.";
    $("#novo_contato_nome").focus();
    return;
  }
  // Validação simples de e-mail (quando preenchido).
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (erro) erro.textContent = "E-mail inválido.";
    $("#novo_contato_email").focus();
    return;
  }

  adicionarContato({
    nome,
    email,
    departamento: $("#novo_contato_departamento").value,
    telefone: $("#novo_contato_telefone").value,
  });

  ["novo_contato_nome", "novo_contato_email", "novo_contato_departamento", "novo_contato_telefone"]
    .forEach((id) => ($("#" + id).value = ""));
  renderizarContatos();
  $("#novo_contato_nome").focus();
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

  // Evita que Enter em um campo submeta/recarregue a página (a navegação é pelo rodapé).
  form?.addEventListener("submit", (ev) => ev.preventDefault());

  // Máscara viva de CNPJ.
  const cnpj = $("#cnpj");
  cnpj?.addEventListener("input", () => { cnpj.value = formatarCnpj(cnpj.value); });

  // UF sempre em maiúsculas.
  const uf = $("#uf");
  uf?.addEventListener("input", () => { uf.value = uf.value.toUpperCase(); });

  // Máscara viva de CEP.
  const cep = $("#cep");
  cep?.addEventListener("input", () => { cep.value = formatarCep(cep.value); });

  // CNAE: máscara + preenchimento automático do grau de risco (Quadro I da NR-04).
  const cnae = $("#cnae_principal");
  const dica = $("#cnae-dica");
  cnae?.addEventListener("input", () => {
    cnae.value = formatarCnae(cnae.value);
    const grau = grauPorCnae(cnae.value);
    if (grau) {
      const sel = $("#grau_risco");
      if (sel) sel.value = String(grau);
      if (dica) dica.textContent = `Grau ${grau} preenchido pela tabela NR-04 (verificar vigência). Ajuste se necessário.`;
    } else if (apenasDigitos(cnae.value).length === 7) {
      if (dica) dica.textContent = "CNAE não encontrado na tabela — informe o grau manualmente.";
    } else if (dica) {
      dica.textContent = "";
    }
  });

  // Adicionar contato (botão dedicado — não é submit, para não enviar o form).
  $("#btn-add-contato")?.addEventListener("click", tratarAdicionarContato);

  // Autosave em rascunho a cada alteração (offline-first, com debounce).
  form?.addEventListener("input", () => { coletarFormulario(); agendarSalvamento(); });
}

/** Recarrega o formulário a partir da visita atual e limpa erros. */
export function preencherIdentificacao() {
  preencherFormulario();
  limparErros();
}
