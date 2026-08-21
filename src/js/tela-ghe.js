/* =========================================================
   tela-ghe.js — Tela GHE (Grupo Homogêneo de Exposição, SST-12).
   Adição manual de GHEs e seleção das funções já cadastradas nos
   setores (SST-08) que compõem cada grupo.
   ========================================================= */

import {
  estado,
  adicionarGhe,
  removerGhe,
  alternarFuncaoNoGhe,
  listarFuncoesDisponiveis,
} from "./estado.js";

const $ = (sel, ctx = document) => ctx.querySelector(sel);

/** Constrói o seletor de funções (agrupado por setor) de um GHE. */
function construirSeletorFuncoes(ghe, disponiveis, aoAlterar) {
  const wrap = document.createElement("div");
  wrap.className = "ghe-funcoes";

  const rotulo = document.createElement("span");
  rotulo.className = "rotulo-grupo";
  rotulo.textContent = "Funções neste GHE";
  wrap.appendChild(rotulo);

  // Agrupa as funções disponíveis por setor.
  const porSetor = new Map();
  disponiveis.forEach((f) => {
    if (!porSetor.has(f.setorNome)) porSetor.set(f.setorNome, []);
    porSetor.get(f.setorNome).push(f);
  });

  const refs = ghe.funcoes_ref || [];
  porSetor.forEach((funcoes, setorNome) => {
    const grupo = document.createElement("div");
    grupo.className = "ghe-setor-grupo";

    const tituloSetor = document.createElement("p");
    tituloSetor.className = "ghe-setor-titulo";
    tituloSetor.textContent = setorNome;
    grupo.appendChild(tituloSetor);

    funcoes.forEach((f) => {
      const label = document.createElement("label");
      label.className = "ghe-func-check";

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = refs.includes(f.funcaoId);
      chk.addEventListener("change", () => {
        alternarFuncaoNoGhe(ghe.id, f.funcaoId);
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

/** (Re)renderiza a lista de GHEs. */
export function renderizarTelaGhe() {
  const lista = $("#lista-ghe");
  const vazio = $("#ghe-vazio");
  const semFuncoes = $("#ghe-sem-funcoes");
  if (!lista) return;

  const disponiveis = listarFuncoesDisponiveis();
  if (semFuncoes) semFuncoes.hidden = disponiveis.length > 0;

  const ghes = estado.visita.ghes || [];
  lista.innerHTML = "";
  if (vazio) vazio.hidden = ghes.length > 0;

  ghes.forEach((ghe) => {
    const li = document.createElement("li");
    li.className = "ghe-card";

    const topo = document.createElement("div");
    topo.className = "ghe-card__topo";

    const info = document.createElement("div");
    info.className = "setor-card__info";
    const nome = document.createElement("p");
    nome.className = "setor-card__nome";
    nome.textContent = ghe.nome;
    info.appendChild(nome);
    const meta = document.createElement("p");
    meta.className = "setor-card__desc";
    const atualizarMeta = () => {
      const n = (ghe.funcoes_ref || []).length;
      meta.textContent = `${n} função(ões) selecionada(s)` + (ghe.descricao ? ` — ${ghe.descricao}` : "");
    };
    atualizarMeta();
    info.appendChild(meta);

    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "setor-card__remover";
    remover.setAttribute("aria-label", `Remover GHE ${ghe.nome}`);
    remover.textContent = "✕";
    remover.addEventListener("click", () => {
      removerGhe(ghe.id);
      renderizarTelaGhe();
    });

    topo.append(info, remover);
    li.appendChild(topo);

    if (disponiveis.length > 0) {
      li.appendChild(construirSeletorFuncoes(ghe, disponiveis, atualizarMeta));
    }
    lista.appendChild(li);
  });
}

/** Inicializa listeners da Tela GHE. */
export function inicializarTelaGhe() {
  const form = $("#form-novo-ghe");
  const inputNome = $("#ghe_nome");
  const inputDesc = $("#ghe_descricao");
  const erro = $('[data-erro="ghe_nome"]');

  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const nome = (inputNome?.value ?? "").trim();
    if (!nome) {
      if (erro) erro.textContent = "Informe o nome do GHE.";
      inputNome?.focus();
      return;
    }
    if (erro) erro.textContent = "";
    adicionarGhe({ nome, descricao: inputDesc?.value ?? "" });
    form.reset();
    inputNome?.focus();
    renderizarTelaGhe();
  });

  renderizarTelaGhe();
}
