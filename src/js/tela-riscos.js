/* =========================================================
   tela-riscos.js — Tela 3: Riscos ocupacionais e EPIs/EPCs (por setor).
   Constrói dinamicamente os grupos de risco a partir do catálogo e
   reflete/edita o estado do setor ativo. Mantém a filosofia offline-first
   (toda alteração persiste via estado.js).
   ========================================================= */

import {
  estado,
  obterSetor,
  definirRiscoPresente,
  atualizarRisco,
  adicionarEpiEpc,
  removerEpiEpc,
} from "./estado.js";
import { GRUPOS, CATALOGO_RISCOS } from "./catalogo-riscos.js";

const $ = (sel, ctx = document) => ctx.querySelector(sel);

// Setor atualmente em avaliação nesta tela.
let setorAtivoId = null;

const NIVEIS = [
  { v: "nao_avaliado", t: "Não avaliado" },
  { v: "baixo", t: "Baixo" },
  { v: "medio", t: "Médio" },
  { v: "alto", t: "Alto" },
  { v: "avaliar", t: "Avaliar" }, // requer quantificação instrumental (SST-10)
];

/* ---------- Seletor de setor ---------- */

function construirSeletorSetores() {
  const sel = $("#setor_ativo");
  if (!sel) return;
  const setores = estado.visita.setores;
  sel.innerHTML = "";
  setores.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.nome;
    sel.appendChild(opt);
  });

  // Mantém o setor ativo válido; se não, cai no primeiro.
  if (!setores.some((s) => s.id === setorAtivoId)) {
    setorAtivoId = setores[0]?.id ?? null;
  }
  if (setorAtivoId) sel.value = setorAtivoId;
}

/* ---------- Riscos ---------- */

/** Cria o painel de detalhe (conformidade/nível/observação) de um risco presente. */
function construirDetalheRisco(risco) {
  const wrap = document.createElement("div");
  wrap.className = "risco-detalhe";

  // Nível de exposição (select).
  const campoNivel = document.createElement("div");
  campoNivel.className = "campo";
  const rotNivel = document.createElement("label");
  rotNivel.className = "rotulo-grupo";
  rotNivel.textContent = "Nível de exposição";
  const selNivel = document.createElement("select");
  NIVEIS.forEach((n) => {
    const o = document.createElement("option");
    o.value = n.v;
    o.textContent = n.t;
    selNivel.appendChild(o);
  });
  selNivel.value = risco.nivel_exposicao || "nao_avaliado";
  selNivel.addEventListener("change", () =>
    atualizarRisco(setorAtivoId, risco.id, { nivel_exposicao: selNivel.value })
  );
  campoNivel.append(rotNivel, selNivel);

  // Observação (opcional).
  const campoObs = document.createElement("div");
  campoObs.className = "campo";
  const rotObs = document.createElement("label");
  rotObs.className = "rotulo-grupo";
  rotObs.textContent = "Observação (opcional)";
  const obs = document.createElement("input");
  obs.type = "text";
  obs.value = risco.observacao || "";
  obs.placeholder = "Ex.: fonte geradora, medida existente…";
  obs.addEventListener("input", () =>
    atualizarRisco(setorAtivoId, risco.id, { observacao: obs.value })
  );
  campoObs.append(rotObs, obs);

  // Quantificação (opcional): data, hora e equipamento da medição instrumental.
  const campoQuant = document.createElement("div");
  campoQuant.className = "campo";
  const rotQuant = document.createElement("span");
  rotQuant.className = "rotulo-grupo";
  rotQuant.textContent = "Quantificação (opcional)";
  const dicaQuant = document.createElement("small");
  dicaQuant.className = "quant-dica";
  dicaQuant.textContent = "Preencha quando o nível for “Avaliar” (ex.: dosimetria).";

  const linha = document.createElement("div");
  linha.className = "quant-linha";
  const q = risco.quantificacao || {};

  const inData = document.createElement("input");
  inData.type = "date";
  inData.value = q.data || "";
  inData.setAttribute("aria-label", "Data da medição");

  const inHora = document.createElement("input");
  inHora.type = "time";
  inHora.value = q.hora || "";
  inHora.setAttribute("aria-label", "Hora da medição");

  const inEquip = document.createElement("input");
  inEquip.type = "text";
  inEquip.placeholder = "Equipamento";
  inEquip.value = q.equipamento || "";
  inEquip.setAttribute("aria-label", "Equipamento da medição");

  const atualizarQuant = () => {
    const nova = {};
    if (inData.value) nova.data = inData.value;
    if (inHora.value) nova.hora = inHora.value;
    if (inEquip.value.trim()) nova.equipamento = inEquip.value.trim();
    atualizarRisco(setorAtivoId, risco.id, {
      quantificacao: Object.keys(nova).length ? nova : null,
    });
  };
  inData.addEventListener("change", atualizarQuant);
  inHora.addEventListener("change", atualizarQuant);
  inEquip.addEventListener("input", atualizarQuant);

  linha.append(inData, inHora, inEquip);
  campoQuant.append(rotQuant, dicaQuant, linha);

  wrap.append(campoNivel, campoObs, campoQuant);
  return wrap;
}

/** Renderiza todos os grupos e agentes de risco do setor ativo. */
function renderizarRiscos() {
  const container = $("#riscos-container");
  if (!container) return;
  container.innerHTML = "";
  const setor = obterSetor(setorAtivoId);
  if (!setor) return;

  GRUPOS.forEach((grupo) => {
    const card = document.createElement("section");
    card.className = "risco-grupo";
    card.dataset.grupo = grupo.chave;

    const cab = document.createElement("header");
    cab.className = "risco-grupo__cabecalho";
    const titulo = document.createElement("h4");
    titulo.className = "risco-grupo__titulo";
    titulo.textContent = `${grupo.icone} ${grupo.rotulo}`;
    const contagem = document.createElement("span");
    contagem.className = "risco-grupo__contagem";
    cab.append(titulo, contagem);

    const lista = document.createElement("ul");
    lista.className = "risco-lista";

    let ativos = 0;
    CATALOGO_RISCOS[grupo.chave].forEach((agente) => {
      const existente = setor.avaliacoes_risco.find(
        (r) => r.grupo === grupo.chave && r.agente === agente
      );
      const presente = Boolean(existente);
      if (presente) ativos++;

      const li = document.createElement("li");
      li.className = "risco-item";

      const nome = document.createElement("span");
      nome.className = "risco-item__nome";
      nome.textContent = agente;

      const sw = criarSwitch(presente, `Risco: ${agente}`, (marcado) => {
        definirRiscoPresente(setorAtivoId, grupo.chave, agente, marcado);
        renderizarRiscos(); // re-render para mostrar/ocultar o detalhe
      });

      li.append(nome, sw);
      lista.appendChild(li);

      if (existente) {
        const detalheLi = document.createElement("li");
        detalheLi.className = "risco-item risco-item--detalhe";
        detalheLi.appendChild(construirDetalheRisco(existente));
        lista.appendChild(detalheLi);
      }
    });

    contagem.textContent = ativos ? `${ativos} ativo(s)` : "nenhum";
    card.append(cab, lista);
    container.appendChild(card);
  });
}

/* ---------- EPI / EPC ---------- */

function renderizarEpis() {
  const lista = $("#lista-epi");
  const vazio = $("#epi-vazio");
  if (!lista) return;
  const setor = obterSetor(setorAtivoId);
  lista.innerHTML = "";
  const itens = setor?.verificacoes_epi_epc ?? [];
  vazio.hidden = itens.length > 0;

  const rotuloConserv = { bom: "Adequado", regular: "Regular", ruim: "Inadequado", nao_aplicavel: "N/A" };

  itens.forEach((item) => {
    const li = document.createElement("li");
    li.className = "setor-card";
    if (item.conforme === "nao_conforme") li.classList.add("setor-card--alerta");

    const info = document.createElement("div");
    info.className = "setor-card__info";

    const titulo = document.createElement("p");
    titulo.className = "setor-card__nome";
    const tag = item.tipo === "epi" ? "EPI" : "EPC";
    titulo.textContent = `[${tag}] ${item.descricao}`;
    info.appendChild(titulo);

    const detalhes = [];
    if (item.tipo === "epi" && item.numero_ca) detalhes.push(`CA ${item.numero_ca}`);
    detalhes.push(`Fornece: ${item.fornecido ? "Sim" : "Não"}`);
    detalhes.push(`Uso correto: ${item.em_uso ? "Sim" : "Não"}`);
    detalhes.push(`Conservação: ${rotuloConserv[item.estado_conservacao] ?? "—"}`);
    detalhes.push(item.conforme === "conforme" ? "✔ Conforme" : "✖ Não conforme");

    const desc = document.createElement("p");
    desc.className = "setor-card__desc";
    desc.textContent = detalhes.join(" · ");
    info.appendChild(desc);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "setor-card__remover";
    btn.setAttribute("aria-label", `Remover ${item.descricao}`);
    btn.textContent = "✕";
    btn.addEventListener("click", () => {
      removerEpiEpc(setorAtivoId, item.id);
      renderizarEpis();
    });

    li.append(info, btn);
    lista.appendChild(li);
  });
}

/** Deriva a conformidade do EPI/EPC a partir das respostas. */
function derivarConformeEpi({ fornecido, em_uso, estado_conservacao }) {
  const inadequado = estado_conservacao === "ruim";
  if (fornecido === false || em_uso === false || inadequado) return "nao_conforme";
  return "conforme";
}

function inicializarFormEpi() {
  const form = $("#form-novo-epi");
  const selTipo = $("#epi_tipo");
  const campoCa = $("#campo-ca");
  const erro = $('[data-erro="epi_form"]');

  const atualizarVisibilidadeCa = () => {
    campoCa.hidden = selTipo.value !== "epi";
  };
  selTipo?.addEventListener("change", atualizarVisibilidadeCa);
  atualizarVisibilidadeCa();

  // Segmentados do formulário.
  ligarSegmentado("#epi_fornecido");
  ligarSegmentado("#epi_em_uso");
  ligarSegmentado("#epi_conservacao");

  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    erro.textContent = "";

    const tipo = selTipo.value;
    const descricao = $("#epi_descricao").value.trim();
    const numero_ca = $("#epi_ca").value.trim();
    const fornecido = lerSegmentado("#epi_fornecido");
    const em_uso = lerSegmentado("#epi_em_uso");
    const estado_conservacao = lerSegmentado("#epi_conservacao");

    if (!descricao) return falhar("Informe a descrição do EPI/EPC.");
    if (tipo === "epi" && !numero_ca) return falhar("Informe o número do CA (obrigatório para EPI).");
    if (fornecido === null) return falhar("Informe se a empresa fornece.");
    if (em_uso === null) return falhar("Informe se há uso correto.");
    if (estado_conservacao === null) return falhar("Informe as condições de conservação.");

    const dados = {
      tipo,
      descricao,
      numero_ca,
      fornecido: fornecido === "true",
      em_uso: em_uso === "true",
      estado_conservacao,
    };
    dados.conforme = derivarConformeEpi(dados);

    adicionarEpiEpc(setorAtivoId, dados);
    form.reset();
    limparSegmentado("#epi_fornecido");
    limparSegmentado("#epi_em_uso");
    limparSegmentado("#epi_conservacao");
    atualizarVisibilidadeCa();
    renderizarEpis();
    $("#epi_descricao").focus();

    function falhar(msg) { erro.textContent = msg; return; }
  });
}

/* ---------- Componentes reutilizáveis ---------- */

/** Cria um toggle switch acessível. onChange recebe (marcado:boolean). */
function criarSwitch(marcado, rotulo, onChange) {
  const label = document.createElement("label");
  label.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = marcado;
  input.setAttribute("aria-label", rotulo);
  const trilho = document.createElement("span");
  trilho.className = "switch__trilho";
  input.addEventListener("change", () => onChange(input.checked));
  label.append(input, trilho);
  return label;
}

/** Liga o comportamento de seleção de um segmentado já presente no HTML. */
function ligarSegmentado(sel) {
  const grupo = $(sel);
  if (!grupo) return;
  grupo.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      grupo.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
    });
  });
}

/** Lê o valor selecionado de um segmentado (ou null). */
function lerSegmentado(sel) {
  const btn = $(`${sel} button[aria-pressed="true"]`);
  return btn ? btn.dataset.val : null;
}

/** Limpa a seleção de um segmentado. */
function limparSegmentado(sel) {
  $(sel)?.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
}

/* ---------- API da tela ---------- */

/** (Re)renderiza toda a Tela 3 — chamado ao entrar na tela. */
export function renderizarTelaRiscos() {
  construirSeletorSetores();
  renderizarRiscos();
  renderizarEpis();
}

/** Inicializa listeners persistentes da Tela 3. */
export function inicializarTelaRiscos() {
  $("#setor_ativo")?.addEventListener("change", (ev) => {
    setorAtivoId = ev.target.value;
    renderizarRiscos();
    renderizarEpis();
  });
  inicializarFormEpi();
}
