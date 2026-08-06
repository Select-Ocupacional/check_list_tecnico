/* =========================================================
   tela-setores.js — Tela 2: cadastro e listagem de setores avaliados.
   ========================================================= */

import { estado, adicionarSetor, removerSetor } from "./estado.js";
import { validarSetores } from "./validacao.js";

const $ = (sel, ctx = document) => ctx.querySelector(sel);

/** Renderiza a lista de setores a partir do estado. */
function renderizarLista() {
  const lista = $("#lista-setores");
  const vazio = $("#setores-vazio");
  if (!lista) return;

  lista.innerHTML = "";
  const setores = estado.visita.setores;

  vazio.hidden = setores.length > 0;

  setores.forEach((setor) => {
    const li = document.createElement("li");
    li.className = "setor-card";

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

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "setor-card__remover";
    btn.setAttribute("aria-label", `Remover setor ${setor.nome}`);
    btn.textContent = "✕";
    btn.addEventListener("click", () => {
      removerSetor(setor.id);
      renderizarLista();
    });

    li.append(info, btn);
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
