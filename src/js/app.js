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
import {
  inicializarTelaRiscos,
  renderizarTelaRiscos,
} from "./tela-riscos.js";
import {
  inicializarTelaEncerramento,
  renderizarTelaEncerramento,
  finalizarVisita,
} from "./tela-encerramento.js";

const $ = (sel) => document.querySelector(sel);

// Ordem das telas navegáveis nesta versão.
const PASSOS = ["identificacao", "setores", "riscos", "encerramento"];
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
  $("#tela-riscos").hidden = passo !== "riscos";
  $("#tela-encerramento").hidden = passo !== "encerramento";

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
  btnAvancar.textContent = passo === "encerramento" ? "Finalizar visita" : "Avançar";

  if (passo === "setores") renderizarLista();
  if (passo === "riscos") renderizarTelaRiscos();
  if (passo === "encerramento") renderizarTelaEncerramento();
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
  inicializarTelaRiscos();
  inicializarTelaEncerramento();

  btnAvancar.addEventListener("click", () => {
    const passoAtual = PASSOS[indiceAtual];

    if (passoAtual === "encerramento") {
      // Última etapa: valida e finaliza a visita (assinaturas + parecer).
      if (finalizarVisita()) {
        btnAvancar.hidden = true;
        btnVoltar.hidden = true;
      }
      return;
    }

    if (!podeAvancarDe(passoAtual)) return;
    irPara(indiceAtual + 1);
  });

  btnVoltar.addEventListener("click", () => irPara(indiceAtual - 1));

  irPara(0);
}

document.addEventListener("DOMContentLoaded", inicializar);
