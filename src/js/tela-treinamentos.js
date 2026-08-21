/* =========================================================
   tela-treinamentos.js — Módulo de Treinamentos por função (SST-13).
   Cada treinamento tem uma situação (possui / necessita reciclagem /
   não possui) e referencia as funções (SST-08) às quais se aplica.
   ========================================================= */

import {
  estado,
  adicionarTreinamento,
  removerTreinamento,
  atualizarTreinamento,
  alternarFuncaoNoTreinamento,
  listarFuncoesDisponiveis,
} from "./estado.js";

const $ = (sel, ctx = document) => ctx.querySelector(sel);

const SITUACOES = [
  { v: "possui", t: "Possui" },
  { v: "necessita_reciclagem", t: "Necessita reciclagem" },
  { v: "nao_possui", t: "Não possui" },
];

/** Controle segmentado da situação do treinamento. */
function construirSituacao(treino) {
  const campo = document.createElement("div");
  campo.className = "campo";
  const rotulo = document.createElement("span");
  rotulo.className = "rotulo-grupo";
  rotulo.textContent = "Situação";

  const grupo = document.createElement("div");
  grupo.className = "segmentado";
  grupo.setAttribute("role", "group");
  SITUACOES.forEach((op) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.val = op.v;
    btn.textContent = op.t;
    btn.setAttribute("aria-pressed", String(op.v === treino.situacao));
    btn.addEventListener("click", () => {
      grupo.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      atualizarTreinamento(treino.id, { situacao: op.v });
    });
    grupo.appendChild(btn);
  });

  campo.append(rotulo, grupo);
  return campo;
}

/** Seletor de funções (agrupado por setor) às quais o treinamento se aplica. */
function construirSeletorFuncoes(treino, disponiveis, aoAlterar) {
  const wrap = document.createElement("div");
  wrap.className = "ghe-funcoes";

  const rotulo = document.createElement("span");
  rotulo.className = "rotulo-grupo";
  rotulo.textContent = "Funções que fazem este treinamento";
  wrap.appendChild(rotulo);

  const porSetor = new Map();
  disponiveis.forEach((f) => {
    if (!porSetor.has(f.setorNome)) porSetor.set(f.setorNome, []);
    porSetor.get(f.setorNome).push(f);
  });

  const refs = treino.funcoes_ref || [];
  porSetor.forEach((funcoes, setorNome) => {
    const grupo = document.createElement("div");
    grupo.className = "ghe-setor-grupo";
    const titulo = document.createElement("p");
    titulo.className = "ghe-setor-titulo";
    titulo.textContent = setorNome;
    grupo.appendChild(titulo);

    funcoes.forEach((f) => {
      const label = document.createElement("label");
      label.className = "ghe-func-check";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = refs.includes(f.funcaoId);
      chk.addEventListener("change", () => {
        alternarFuncaoNoTreinamento(treino.id, f.funcaoId);
        if (aoAlterar) aoAlterar();
      });
      const txt = document.createElement("span");
      txt.textContent = f.funcaoNome + (f.quantidade != null ? ` (${f.quantidade})` : "");
      label.append(chk, txt);
      grupo.appendChild(label);
    });

    wrap.appendChild(grupo);
  });

  return wrap;
}

/** (Re)renderiza a lista de treinamentos. */
export function renderizarTelaTreinamentos() {
  const lista = $("#lista-treinamentos");
  const vazio = $("#treinamentos-vazio");
  const semFuncoes = $("#treinamentos-sem-funcoes");
  if (!lista) return;

  const disponiveis = listarFuncoesDisponiveis();
  if (semFuncoes) semFuncoes.hidden = disponiveis.length > 0;

  const treinos = estado.visita.treinamentos || [];
  lista.innerHTML = "";
  if (vazio) vazio.hidden = treinos.length > 0;

  treinos.forEach((treino) => {
    const li = document.createElement("li");
    li.className = "ghe-card";

    const topo = document.createElement("div");
    topo.className = "ghe-card__topo";
    const info = document.createElement("div");
    info.className = "setor-card__info";
    const nome = document.createElement("p");
    nome.className = "setor-card__nome";
    nome.textContent = treino.nome;
    info.appendChild(nome);
    const meta = document.createElement("p");
    meta.className = "setor-card__desc";
    const atualizarMeta = () => {
      const n = (treino.funcoes_ref || []).length;
      meta.textContent = `${n} função(ões) vinculada(s)`;
    };
    atualizarMeta();
    info.appendChild(meta);

    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "setor-card__remover";
    remover.setAttribute("aria-label", `Remover treinamento ${treino.nome}`);
    remover.textContent = "✕";
    remover.addEventListener("click", () => {
      removerTreinamento(treino.id);
      renderizarTelaTreinamentos();
    });

    topo.append(info, remover);
    li.append(topo, construirSituacao(treino));

    if (disponiveis.length > 0) {
      li.appendChild(construirSeletorFuncoes(treino, disponiveis, atualizarMeta));
    }
    lista.appendChild(li);
  });
}

/** Inicializa listeners da tela de treinamentos. */
export function inicializarTelaTreinamentos() {
  const form = $("#form-novo-treinamento");
  const inputNome = $("#treinamento_nome");
  const erro = $('[data-erro="treinamento_nome"]');

  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const nome = (inputNome?.value ?? "").trim();
    if (!nome) {
      if (erro) erro.textContent = "Informe o nome do treinamento.";
      inputNome?.focus();
      return;
    }
    if (erro) erro.textContent = "";
    adicionarTreinamento({ nome });
    form.reset();
    inputNome?.focus();
    renderizarTelaTreinamentos();
  });

  renderizarTelaTreinamentos();
}
