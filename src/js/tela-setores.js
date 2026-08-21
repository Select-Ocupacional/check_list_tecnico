/* =========================================================
   tela-setores.js — Tela 2: setores avaliados e suas funções.
   Cada setor tem uma lista de funções com a quantidade de
   funcionários por função (SST-08).
   ========================================================= */

import {
  estado,
  adicionarSetor,
  removerSetor,
  adicionarFuncao,
  atualizarFuncao,
  removerFuncao,
} from "./estado.js";
import { validarSetores } from "./validacao.js";

const $ = (sel, ctx = document) => ctx.querySelector(sel);

/** Preenche (ou atualiza) a lista de funções de um setor dentro do card. */
function renderizarFuncoes(setor, ul) {
  ul.innerHTML = "";
  const funcoes = setor.funcoes || [];
  if (funcoes.length === 0) {
    const vazio = document.createElement("li");
    vazio.className = "funcoes-vazio";
    vazio.textContent = "Nenhuma função cadastrada.";
    ul.appendChild(vazio);
    return;
  }

  funcoes.forEach((funcao) => {
    const li = document.createElement("li");
    li.className = "funcao-row";

    const nome = document.createElement("span");
    nome.className = "funcao-row__nome";
    nome.textContent = funcao.nome;

    const qtd = document.createElement("input");
    qtd.type = "number";
    qtd.min = "0";
    qtd.inputMode = "numeric";
    qtd.className = "funcao-row__qtd";
    qtd.value = funcao.quantidade ?? "";
    qtd.setAttribute("aria-label", `Quantidade de funcionários — ${funcao.nome}`);
    qtd.addEventListener("input", () => {
      const v = qtd.value.trim();
      atualizarFuncao(setor.id, funcao.id, { quantidade: v === "" ? undefined : Number(v) });
    });

    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "funcao-row__remover";
    remover.setAttribute("aria-label", `Remover função ${funcao.nome}`);
    remover.textContent = "✕";
    remover.addEventListener("click", () => {
      removerFuncao(setor.id, funcao.id);
      renderizarFuncoes(setor, ul);
    });

    li.append(nome, qtd, remover);
    ul.appendChild(li);
  });
}

/** Monta o bloco de funções (rótulo, lista e formulário de adição) de um setor. */
function construirBlocoFuncoes(setor) {
  const bloco = document.createElement("div");
  bloco.className = "setor-funcoes";

  const rotulo = document.createElement("span");
  rotulo.className = "rotulo-grupo";
  rotulo.textContent = "Funções e nº de funcionários";

  const ul = document.createElement("ul");
  ul.className = "funcoes-lista";
  renderizarFuncoes(setor, ul);

  const form = document.createElement("form");
  form.className = "funcao-form";
  form.noValidate = true;

  const inputNome = document.createElement("input");
  inputNome.type = "text";
  inputNome.placeholder = "Função (ex.: Operador de prensa)";
  inputNome.className = "funcao-form__nome";
  inputNome.autocomplete = "off";

  const inputQtd = document.createElement("input");
  inputQtd.type = "number";
  inputQtd.min = "0";
  inputQtd.inputMode = "numeric";
  inputQtd.placeholder = "Qtd";
  inputQtd.className = "funcao-form__qtd";
  inputQtd.setAttribute("aria-label", "Quantidade de funcionários");

  const add = document.createElement("button");
  add.type = "submit";
  add.className = "btn btn--secundario funcao-form__add";
  add.textContent = "+";
  add.setAttribute("aria-label", "Adicionar função");

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const nome = inputNome.value.trim();
    if (!nome) { inputNome.focus(); return; }
    adicionarFuncao(setor.id, { nome, quantidade: inputQtd.value });
    inputNome.value = "";
    inputQtd.value = "";
    renderizarFuncoes(setor, ul);
    inputNome.focus();
  });

  form.append(inputNome, inputQtd, add);
  bloco.append(rotulo, ul, form);
  return bloco;
}

/** Renderiza a lista de setores (com suas funções) a partir do estado. */
function renderizarLista() {
  const lista = $("#lista-setores");
  const vazio = $("#setores-vazio");
  if (!lista) return;

  lista.innerHTML = "";
  const setores = estado.visita.setores;
  vazio.hidden = setores.length > 0;

  setores.forEach((setor) => {
    const li = document.createElement("li");
    li.className = "setor-item";

    const topo = document.createElement("div");
    topo.className = "setor-item__topo";

    const info = document.createElement("div");
    info.className = "setor-card__info";
    const nome = document.createElement("p");
    nome.className = "setor-card__nome";
    nome.textContent = setor.nome;
    info.appendChild(nome);
    if (setor.descricao) {
      const desc = document.createElement("p");
      desc.className = "setor-card__desc";
      desc.textContent = setor.descricao;
      info.appendChild(desc);
    }

    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "setor-card__remover";
    remover.setAttribute("aria-label", `Remover setor ${setor.nome}`);
    remover.textContent = "✕";
    remover.addEventListener("click", () => {
      removerSetor(setor.id);
      renderizarLista();
    });

    topo.append(info, remover);
    li.append(topo, construirBlocoFuncoes(setor));
    lista.appendChild(li);
  });
}

/**
 * Valida a Tela 2 (ao menos um setor).
 * @returns {boolean}
 */
export function validarSetoresTela() {
  const erros = validarSetores(estado.visita);
  const alvo = $('[data-erro="setor_nome"]');
  if (erros.setores) {
    if (alvo) alvo.textContent = erros.setores;
    $("#setor_nome")?.focus();
    return false;
  }
  if (alvo) alvo.textContent = "";
  return true;
}

/** Inicializa listeners da Tela 2. */
export function inicializarTelaSetores() {
  const form = $("#form-novo-setor");
  const inputNome = $("#setor_nome");
  const inputDesc = $("#setor_descricao");
  const erroNome = $('[data-erro="setor_nome"]');

  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const nome = (inputNome?.value ?? "").trim();
    if (!nome) {
      if (erroNome) erroNome.textContent = "Informe o nome do setor.";
      inputNome?.classList.add("invalido");
      inputNome?.focus();
      return;
    }
    if (erroNome) erroNome.textContent = "";
    inputNome?.classList.remove("invalido");

    adicionarSetor({ nome, descricao: inputDesc?.value ?? "" });
    form.reset();
    inputNome?.focus();
    renderizarLista();
  });

  renderizarLista();
}

// Reexporta para o app chamar ao entrar na tela.
export { renderizarLista };
