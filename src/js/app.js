/* =========================================================
   app.js — Bootstrap e navegação entre as telas (SST-02).
   Telas implementadas nesta issue: 1 (Identificação) e 2 (Setores).
   As telas 3 e 4 ficam para issues seguintes.
   ========================================================= */

import { carregar } from "./estado.js";
import {
  inicializarTelaIdentificacao,
  validarEComitar,
} from "./tela-identificacao.js";
import {
  inicializarTelaSetores,
  validarSetoresTela,
  renderizarLista,
} from "./tela-setores.js";

const $ = (sel) => document.querySelector(sel);

// Ordem das telas navegáveis nesta versão.
const PASSOS = ["identificacao", "setores"];
let indiceAtual = 0;

const btnAvancar = $("#btn-avancar");
const btnVoltar = $("#btn-voltar");

/** Mostra a tela do índice informado e ajusta cabeçalho/rodapé. */
function irPara(indice) {
  indiceAtual = Math.max(0, Math.min(indice, PASSOS.length - 1));
  const passo = PASSOS[indiceAtual];

  // Alterna visibilidade das seções.
  $("#tela-identificacao").hidden = passo !== "identificacao";
  $("#tela-setores").hidden = passo !== "setores";

  // Atualiza indicador de passos.
  document.querySelectorAll(".passos__item").forEach((item) => {
    const p = item.dataset.passo;
    item.removeAttribute("aria-current");
    item.classList.remove("passos__item--concluido");
    if (!p) return;
    const idx = PASSOS.indexOf(p);
    if (idx === indiceAtual) item.setAttribute("aria-current", "step");
    else if (idx > -1 && idx < indiceAtual) item.classList.add("passos__item--concluido");
  });

  // Botões de navegação.
  btnVoltar.hidden = indiceAtual === 0;
  btnAvancar.textContent = indiceAtual === PASSOS.length - 1 ? "Concluir etapa" : "Avançar";

  if (passo === "setores") renderizarLista();
  document.querySelector(".conteudo")?.scrollTo({ top: 0, behavior: "smooth" });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Valida a tela atual antes de avançar. */
function podeAvancarDe(passo) {
  if (passo === "identificacao") return validarEComitar();
  if (passo === "setores") return validarSetoresTela();
  return true;
}

function inicializar() {
  const recuperou = carregar();
  if (recuperou) $("#indicador-rascunho").hidden = false;

  inicializarTelaIdentificacao();
  inicializarTelaSetores();

  btnAvancar.addEventListener("click", () => {
    const passoAtual = PASSOS[indiceAtual];
    if (!podeAvancarDe(passoAtual)) return;

    if (indiceAtual < PASSOS.length - 1) {
      irPara(indiceAtual + 1);
    } else {
      // Fim das telas desta issue (SST-02). Próximas telas em issues futuras.
      alert("Etapas 1 e 2 concluídas e salvas em rascunho.\nPróximas telas (Riscos/EPIs e Encerramento) serão implementadas nas próximas issues.");
    }
  });

  btnVoltar.addEventListener("click", () => irPara(indiceAtual - 1));

  irPara(0);
}

document.addEventListener("DOMContentLoaded", inicializar);
