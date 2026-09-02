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

const NIVEL_ROTULO = {
  nao_avaliado: "não avaliado",
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  avaliar: "Avaliar",
};

/* ---------- Sugestões automáticas de agrupamento (SST-12) ---------- */

// Agentes físicos comparados por VALOR medido (índice), não pelo nível.
// Químicos (grupo inteiro) também comparam por valor. Ver comparaPorValor().
const AGENTES_POR_VALOR = new Set([
  "Ruído contínuo ou intermitente",
  "Vibração de mãos e braços",
  "Vibração de corpo inteiro",
]);

/** Este risco é comparado por valor medido no agrupamento? */
function comparaPorValor(r) {
  return r.grupo === "quimico" || AGENTES_POR_VALOR.has(r.agente);
}

/** Um risco tem índice medido/sabido informado? */
function temIndice(r) {
  return Number.isFinite(r.indice);
}

/**
 * Chave de comparação de um risco:
 * - agentes medidos (ruído contínuo/intermitente, vibrações, químicos) com
 *   índice informado → o VALOR exato (+ unidade): "v:85:db(a)";
 * - demais casos (ou sem índice) → o nível de exposição: "n:alto".
 */
function chaveComparacao(r) {
  if (comparaPorValor(r) && temIndice(r)) {
    return `v:${r.indice}:${(r.unidade || "").trim().toLowerCase()}`;
  }
  return `n:${r.nivel_exposicao || "nao_avaliado"}`;
}

/**
 * Assinatura do perfil de risco de uma função: conjunto ordenado de
 * (grupo|agente|chave) dos riscos presentes. Funções com a mesma assinatura
 * têm os MESMOS riscos e — conforme o agente — o mesmo nível OU o mesmo valor
 * medido (exposição homogênea, critério do GHE).
 */
function assinaturaRiscos(funcao) {
  return (funcao.avaliacoes_risco || [])
    .filter((r) => r.presente !== false)
    .map((r) => `${r.grupo}|${r.agente}|${chaveComparacao(r)}`)
    .sort()
    .join("§");
}

/** Agrupa todas as funções por perfil de risco idêntico. */
function analisarGrupos() {
  const funcoes = [];
  (estado.visita.setores || []).forEach((s) => {
    (s.funcoes || []).forEach((f) => {
      funcoes.push({ setorNome: s.nome, funcaoId: f.id, funcaoNome: f.nome, quantidade: f.quantidade, funcao: f });
    });
  });

  const mapa = new Map();
  funcoes.forEach((item) => {
    const chave = assinaturaRiscos(item.funcao);
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(item);
  });

  const grupos = [];
  mapa.forEach((membros, chave) => {
    grupos.push({ chave, membros, semRiscos: chave === "" });
  });
  // Grupos com riscos e mais membros primeiro; “sem riscos” por último.
  grupos.sort((a, b) => (a.semRiscos !== b.semRiscos ? (a.semRiscos ? 1 : -1) : b.membros.length - a.membros.length));
  return grupos;
}

/** Uma função já está em algum GHE? */
function funcaoEmAlgumGhe(funcaoId) {
  return (estado.visita.ghes || []).some((g) => (g.funcoes_ref || []).includes(funcaoId));
}

/** Riscos representativos do grupo (todos os membros têm o mesmo perfil). */
function riscosDoGrupo(grupo) {
  return (grupo.membros[0].funcao.avaliacoes_risco || []).filter((r) => r.presente !== false);
}

/** Rótulo do valor medido do risco (ex.: "85 dB(A)") ou "". */
function rotuloIndice(r) {
  if (!temIndice(r)) return "";
  return `${r.indice}${r.unidade ? " " + r.unidade : ""}`;
}

/** Texto curto do perfil: "Ruído (85 dB(A)) · Poeira (Médio)". */
function descreverPerfil(grupo) {
  return riscosDoGrupo(grupo)
    .map((r) => {
      const val = comparaPorValor(r) && temIndice(r) ? rotuloIndice(r) : NIVEL_ROTULO[r.nivel_exposicao] || "—";
      return `${r.agente} (${val})`;
    })
    .join(" · ");
}

/** Gera um nome único para o GHE criado a partir de um grupo. */
function nomeUnicoGhe(grupo) {
  const setores = [...new Set(grupo.membros.map((m) => m.setorNome))];
  const base = setores.length === 1 ? `GHE — ${setores[0]}` : `GHE ${(estado.visita.ghes || []).length + 1}`;
  const usados = new Set((estado.visita.ghes || []).map((g) => g.nome));
  if (!usados.has(base)) return base;
  let i = 2;
  while (usados.has(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}

/** Cria um GHE com as funções elegíveis (ainda não agrupadas) do grupo. */
function criarGheDeGrupo(grupo) {
  const elegiveis = grupo.membros.filter((m) => !funcaoEmAlgumGhe(m.funcaoId));
  if (!elegiveis.length) return;
  const ghe = adicionarGhe({ nome: nomeUnicoGhe(grupo), descricao: descreverPerfil(grupo) });
  elegiveis.forEach((m) => alternarFuncaoNoGhe(ghe.id, m.funcaoId));
  renderizarTelaGhe();
}

/** Painel recolhível "Consultar riscos e medições" de um grupo. */
function construirConsulta(grupo) {
  const painel = document.createElement("div");
  painel.className = "ghe-sug-consulta";
  painel.hidden = true;

  // Riscos do grupo (compartilhados).
  const tRiscos = document.createElement("p");
  tRiscos.className = "ghe-sug-consulta__tit";
  tRiscos.textContent = "Riscos do grupo";
  painel.appendChild(tRiscos);

  const ulR = document.createElement("ul");
  ulR.className = "ghe-sug-consulta__lista";
  riscosDoGrupo(grupo).forEach((r) => {
    const li = document.createElement("li");
    const val = rotuloIndice(r);
    li.textContent = `${r.agente} — ${NIVEL_ROTULO[r.nivel_exposicao] || "—"}` + (val ? ` · ${val}` : "");
    ulR.appendChild(li);
  });
  if (!ulR.childElementCount) {
    const li = document.createElement("li");
    li.textContent = "Sem riscos registrados.";
    ulR.appendChild(li);
  }
  painel.appendChild(ulR);

  // Medições registradas (por função, quando houver quantificação).
  const tMed = document.createElement("p");
  tMed.className = "ghe-sug-consulta__tit";
  tMed.textContent = "Medições registradas";
  painel.appendChild(tMed);

  const ulM = document.createElement("ul");
  ulM.className = "ghe-sug-consulta__lista";
  grupo.membros.forEach((m) => {
    (m.funcao.avaliacoes_risco || []).forEach((r) => {
      const q = r.quantificacao;
      if (q && (q.data || q.hora || q.equipamento)) {
        const li = document.createElement("li");
        const partes = [q.data ? fmtDataBr(q.data) : "", q.hora || "", q.equipamento || ""].filter(Boolean).join(" · ");
        li.textContent = `${m.funcaoNome} — ${r.agente}: ${partes}`;
        ulM.appendChild(li);
      }
    });
  });
  if (!ulM.childElementCount) {
    const li = document.createElement("li");
    li.className = "ghe-sug-consulta__vazio";
    li.textContent = "Nenhuma medição instrumental registrada.";
    ulM.appendChild(li);
  }
  painel.appendChild(ulM);

  return painel;
}

/** Formata AAAA-MM-DD → DD/MM/AAAA (sem alterar quando fora do padrão). */
function fmtDataBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
}

/** Desenha as sugestões de agrupamento (grupos com 2+ funções e riscos). */
function renderizarSugestoes() {
  const secao = $("#ghe-sugestoes");
  const cont = $("#ghe-sugestoes-lista");
  if (!secao || !cont) return;

  const grupos = analisarGrupos().filter((g) => !g.semRiscos && g.membros.length >= 2);
  cont.innerHTML = "";
  secao.hidden = grupos.length === 0;
  if (!grupos.length) return;

  grupos.forEach((grupo, idx) => {
    const card = document.createElement("div");
    card.className = "ghe-sug-card";

    const cab = document.createElement("div");
    cab.className = "ghe-sug-card__cab";
    const titulo = document.createElement("p");
    titulo.className = "ghe-sug-card__tit";
    titulo.textContent = `Sugestão ${idx + 1} · ${grupo.membros.length} funções`;
    const perfil = document.createElement("p");
    perfil.className = "ghe-sug-card__perfil";
    perfil.textContent = descreverPerfil(grupo);
    cab.append(titulo, perfil);
    card.appendChild(cab);

    // Funções do grupo (com aviso se já agrupada em outro GHE).
    const ul = document.createElement("ul");
    ul.className = "ghe-sug-card__funcoes";
    grupo.membros.forEach((m) => {
      const li = document.createElement("li");
      const emGhe = funcaoEmAlgumGhe(m.funcaoId);
      li.textContent = `${m.funcaoNome}${m.quantidade != null ? ` (${m.quantidade})` : ""} · ${m.setorNome}`;
      if (emGhe) {
        const tag = document.createElement("span");
        tag.className = "ghe-sug-tag";
        tag.textContent = "já agrupada";
        li.appendChild(tag);
      }
      ul.appendChild(li);
    });
    card.appendChild(ul);

    // Ações: consultar (recolhível) + criar GHE.
    const acoes = document.createElement("div");
    acoes.className = "ghe-sug-card__acoes";

    const consulta = construirConsulta(grupo);
    const btnConsulta = document.createElement("button");
    btnConsulta.type = "button";
    btnConsulta.className = "btn btn--fantasma";
    btnConsulta.textContent = "🔎 Consultar riscos e medições";
    btnConsulta.setAttribute("aria-expanded", "false");
    btnConsulta.addEventListener("click", () => {
      consulta.hidden = !consulta.hidden;
      btnConsulta.setAttribute("aria-expanded", consulta.hidden ? "false" : "true");
      btnConsulta.textContent = consulta.hidden ? "🔎 Consultar riscos e medições" : "▲ Ocultar riscos e medições";
    });

    const restantes = grupo.membros.filter((m) => !funcaoEmAlgumGhe(m.funcaoId)).length;
    const btnCriar = document.createElement("button");
    btnCriar.type = "button";
    btnCriar.className = "btn btn--secundario";
    if (restantes === 0) {
      btnCriar.textContent = "✓ Já agrupadas";
      btnCriar.disabled = true;
    } else {
      btnCriar.textContent = `+ Criar GHE (${restantes})`;
      btnCriar.addEventListener("click", () => criarGheDeGrupo(grupo));
    }

    acoes.append(btnConsulta, btnCriar);
    card.append(acoes, consulta);
    cont.appendChild(card);
  });
}

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

      const nesteGhe = refs.includes(f.funcaoId);
      const outroGhe = (estado.visita.ghes || []).find(
        (g) => g.id !== ghe.id && (g.funcoes_ref || []).includes(f.funcaoId)
      );

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = nesteGhe;
      // Uma função pertence a um único GHE: se já está em outro, fica desabilitada aqui.
      if (outroGhe && !nesteGhe) {
        chk.disabled = true;
        label.classList.add("ghe-func-check--indisponivel");
      }
      chk.addEventListener("change", () => {
        alternarFuncaoNoGhe(ghe.id, f.funcaoId);
        renderizarTelaGhe(); // re-render p/ manter a exclusividade consistente entre GHEs
      });

      const txt = document.createElement("span");
      txt.textContent = f.funcaoNome + (f.quantidade != null ? ` (${f.quantidade})` : "");
      if (outroGhe && !nesteGhe) txt.textContent += ` — já em ${outroGhe.nome}`;

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

  renderizarSugestoes();

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
