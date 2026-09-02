/* =========================================================
   tela-riscos.js — Tela 3: Riscos ocupacionais e EPIs/EPCs (por função).
   O técnico escolhe o Setor e, em seguida, a Função avaliada (funções vindas
   da Tela 2). Só após a função ser selecionada os riscos e EPIs/EPCs são
   registrados — e são salvos POR FUNÇÃO (schema 1.8.0).
   Mantém a filosofia offline-first (toda alteração persiste via estado.js).
   ========================================================= */

import {
  estado,
  obterSetor,
  obterFuncao,
  definirRiscoPresente,
  atualizarRisco,
  adicionarEpiEpc,
  removerEpiEpc,
  adicionarEvidencia,
  atualizarEvidencia,
  removerEvidencia,
} from "./estado.js";
import { GRUPOS, CATALOGO_RISCOS } from "./catalogo-riscos.js";
import { EPIS_NR06, EPCS_COMUNS } from "./catalogo-epi.js";
import { comprimirImagem } from "./imagem.js";
import { resolverRef } from "./storage.js";

const $ = (sel, ctx = document) => ctx.querySelector(sel);

// Setor e função atualmente em avaliação nesta tela.
let setorAtivoId = null;
let funcaoAtivaId = null;
// Quando true, funções já avaliadas voltam a ser selecionáveis (para correção).
let editarAvaliadas = false;

// Unidade sugerida do índice para os agentes comparados por valor no GHE.
const UNIDADE_PADRAO = {
  "Ruído contínuo ou intermitente": "dB(A)",
  "Vibração de mãos e braços": "m/s²",
  "Vibração de corpo inteiro": "m/s²",
};

const NIVEIS = [
  { v: "nao_avaliado", t: "Não avaliado" },
  { v: "baixo", t: "Baixo" },
  { v: "medio", t: "Médio" },
  { v: "alto", t: "Alto" },
  { v: "avaliar", t: "Avaliar" }, // requer quantificação instrumental (SST-10)
];

/* ---------- Seletores de setor e função ---------- */

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

/** Popula o seletor de funções do setor ativo e mantém a função ativa válida. */
function construirSeletorFuncoes() {
  const sel = $("#funcao_ativa");
  if (!sel) return;
  const setor = obterSetor(setorAtivoId);
  const funcoes = setor?.funcoes ?? [];
  sel.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = funcoes.length ? "— Selecione a função —" : "— Sem funções —";
  sel.appendChild(placeholder);

  funcoes.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.id;
    const base = f.quantidade != null ? `${f.nome} (${f.quantidade})` : f.nome;
    // Função já avaliada (com riscos ou EPIs) fica desabilitada para não ser
    // reavaliada — exceto a que está ativa no momento (que continua editável)
    // ou quando o modo "editar avaliadas" está ligado. Sempre marcada com "✓".
    const avaliada = funcaoAvaliada(f);
    if (avaliada && f.id !== funcaoAtivaId) {
      opt.textContent = `✓ ${base} — já avaliada`;
      opt.disabled = !editarAvaliadas;
    } else {
      opt.textContent = avaliada ? `✓ ${base}` : base;
    }
    sel.appendChild(opt);
  });

  // Mantém a função ativa apenas se ainda pertencer a este setor.
  if (!funcoes.some((f) => f.id === funcaoAtivaId)) {
    funcaoAtivaId = null;
  }
  sel.value = funcaoAtivaId || "";
  sel.disabled = funcoes.length === 0;
}

/** Uma função é "avaliada" quando já tem ao menos um risco ou EPI/EPC registrado. */
function funcaoAvaliada(f) {
  return (f.avaliacoes_risco?.length || 0) > 0 || (f.verificacoes_epi_epc?.length || 0) > 0;
}

/* ---------- Riscos ---------- */

/** Cria o painel de detalhe (nível/observação/quantificação/fotos) de um risco presente. */
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
    atualizarRisco(setorAtivoId, funcaoAtivaId, risco.id, { nivel_exposicao: selNivel.value })
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
    atualizarRisco(setorAtivoId, funcaoAtivaId, risco.id, { observacao: obs.value })
  );
  campoObs.append(rotObs, obs);

  // Índice medido/sabido (opcional): valor + unidade. Usado no agrupamento de
  // GHE por valor exato (ruído contínuo/intermitente, vibrações e químicos).
  const campoIndice = document.createElement("div");
  campoIndice.className = "campo";
  const rotInd = document.createElement("span");
  rotInd.className = "rotulo-grupo";
  rotInd.textContent = "Índice medido (opcional)";
  const dicaInd = document.createElement("small");
  dicaInd.className = "quant-dica";
  dicaInd.textContent = "Valor medido ou conhecido. Agrupa o GHE por valor exato em ruído, vibrações e químicos.";

  const linhaInd = document.createElement("div");
  linhaInd.className = "quant-linha";
  const inValor = document.createElement("input");
  inValor.type = "number";
  inValor.step = "any";
  inValor.min = "0";
  inValor.placeholder = "Valor (ex.: 85)";
  inValor.value = Number.isFinite(risco.indice) ? String(risco.indice) : "";
  inValor.setAttribute("aria-label", "Índice medido");

  const inUnidade = document.createElement("input");
  inUnidade.type = "text";
  inUnidade.placeholder = UNIDADE_PADRAO[risco.agente] || "unidade (mg/m³, ppm…)";
  inUnidade.value = risco.unidade || "";
  inUnidade.setAttribute("aria-label", "Unidade do índice");

  const salvarIndice = () => {
    const temValor = inValor.value.trim() !== "";
    let unidade = inUnidade.value.trim();
    // Preenche a unidade padrão do agente ao informar um valor sem unidade.
    if (temValor && !unidade && UNIDADE_PADRAO[risco.agente]) {
      unidade = UNIDADE_PADRAO[risco.agente];
      inUnidade.value = unidade;
    }
    atualizarRisco(setorAtivoId, funcaoAtivaId, risco.id, {
      indice: temValor ? Number(inValor.value) : null,
      unidade: unidade || null,
    });
  };
  inValor.addEventListener("input", salvarIndice);
  inUnidade.addEventListener("input", salvarIndice);

  linhaInd.append(inValor, inUnidade);
  campoIndice.append(rotInd, dicaInd, linhaInd);

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
    atualizarRisco(setorAtivoId, funcaoAtivaId, risco.id, {
      quantificacao: Object.keys(nova).length ? nova : null,
    });
  };
  inData.addEventListener("change", atualizarQuant);
  inHora.addEventListener("change", atualizarQuant);
  inEquip.addEventListener("input", atualizarQuant);

  linha.append(inData, inHora, inEquip);
  campoQuant.append(rotQuant, dicaQuant, linha);

  wrap.append(campoNivel, campoObs, campoIndice, campoQuant, construirEvidencias(risco));
  return wrap;
}

/** Bloco de fotos (evidências) do risco: captura, galeria e legendas. */
function construirEvidencias(risco) {
  const campo = document.createElement("div");
  campo.className = "campo";

  const rot = document.createElement("span");
  rot.className = "rotulo-grupo";
  rot.textContent = "Fotos (evidências)";

  const galeria = document.createElement("div");
  galeria.className = "risco-fotos";

  const renderGaleria = () => {
    galeria.innerHTML = "";
    (risco.evidencias || []).forEach((ev) => {
      const fig = document.createElement("figure");
      fig.className = "risco-foto";

      const img = document.createElement("img");
      img.alt = ev.legenda || "Evidência";
      img.loading = "lazy";
      resolverRef(ev.arquivo_ref).then((url) => { if (url) img.src = url; });

      const legenda = document.createElement("input");
      legenda.type = "text";
      legenda.placeholder = "Legenda (opcional)";
      legenda.className = "risco-foto__legenda";
      legenda.value = ev.legenda || "";
      legenda.addEventListener("input", () =>
        atualizarEvidencia(setorAtivoId, funcaoAtivaId, risco.id, ev.id, { legenda: legenda.value })
      );

      const remover = document.createElement("button");
      remover.type = "button";
      remover.className = "risco-foto__remover";
      remover.setAttribute("aria-label", "Remover foto");
      remover.textContent = "✕";
      remover.addEventListener("click", () => {
        removerEvidencia(setorAtivoId, funcaoAtivaId, risco.id, ev.id);
        renderGaleria();
      });

      fig.append(img, legenda, remover);
      galeria.appendChild(fig);
    });
  };
  renderGaleria();

  // Processa um ou mais arquivos de imagem (câmera ou galeria).
  const processar = async (files) => {
    for (const arquivo of Array.from(files || [])) {
      if (!arquivo.type.startsWith("image/")) continue;
      try {
        const dataUrl = await comprimirImagem(arquivo);
        adicionarEvidencia(setorAtivoId, funcaoAtivaId, risco.id, { arquivo_ref: dataUrl });
      } catch (e) {
        console.warn("Falha ao processar a foto:", e);
      }
    }
    renderGaleria();
  };

  // Input de câmera (capture) e input de arquivo (galeria) — ocultos, acionados por botões.
  const inputCamera = document.createElement("input");
  inputCamera.type = "file";
  inputCamera.accept = "image/*";
  inputCamera.setAttribute("capture", "environment");
  inputCamera.hidden = true;
  inputCamera.addEventListener("change", () => { processar(inputCamera.files); inputCamera.value = ""; });

  const inputArquivo = document.createElement("input");
  inputArquivo.type = "file";
  inputArquivo.accept = "image/*";
  inputArquivo.multiple = true;
  inputArquivo.hidden = true;
  inputArquivo.addEventListener("change", () => { processar(inputArquivo.files); inputArquivo.value = ""; });

  const acoes = document.createElement("div");
  acoes.className = "risco-fotos-acoes";
  const btnCam = document.createElement("button");
  btnCam.type = "button";
  btnCam.className = "btn btn--secundario";
  btnCam.textContent = "📷 Tirar foto";
  btnCam.addEventListener("click", () => inputCamera.click());
  const btnArq = document.createElement("button");
  btnArq.type = "button";
  btnArq.className = "btn btn--fantasma";
  btnArq.textContent = "🖼️ Enviar arquivo";
  btnArq.addEventListener("click", () => inputArquivo.click());
  acoes.append(btnCam, btnArq);

  campo.append(rot, galeria, acoes, inputCamera, inputArquivo);
  return campo;
}

/** Adiciona à lista um item (toggle + detalhe) de um agente. Retorna se está presente. */
function adicionarItemRisco(lista, funcao, grupoChave, agente) {
  const existente = funcao.avaliacoes_risco.find(
    (r) => r.grupo === grupoChave && r.agente === agente
  );
  const presente = Boolean(existente);

  const li = document.createElement("li");
  li.className = "risco-item";
  const nome = document.createElement("span");
  nome.className = "risco-item__nome";
  nome.textContent = agente;
  const sw = criarSwitch(presente, `Risco: ${agente}`, (marcado) => {
    definirRiscoPresente(setorAtivoId, funcaoAtivaId, grupoChave, agente, marcado);
    renderizarRiscos();
  });
  li.append(nome, sw);
  lista.appendChild(li);

  if (existente) {
    const detalheLi = document.createElement("li");
    detalheLi.className = "risco-item risco-item--detalhe";
    detalheLi.appendChild(construirDetalheRisco(existente));
    lista.appendChild(detalheLi);
  }
  return presente;
}

/** Form "+ outro agente" para adicionar um risco fora do catálogo (SST-14). */
function criarFormOutroAgente(grupoChave) {
  const li = document.createElement("li");
  li.className = "risco-item risco-outro";
  const form = document.createElement("form");
  form.className = "risco-outro-form";
  form.noValidate = true;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "risco-outro__nome";
  input.placeholder = "Outro agente (especificar)";
  input.setAttribute("aria-label", `Adicionar outro agente de risco (${grupoChave})`);

  const add = document.createElement("button");
  add.type = "submit";
  add.className = "btn btn--secundario risco-outro__add";
  add.textContent = "+";
  add.setAttribute("aria-label", "Adicionar agente");

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const nome = input.value.trim();
    if (!nome) { input.focus(); return; }
    definirRiscoPresente(setorAtivoId, funcaoAtivaId, grupoChave, nome, true);
    renderizarRiscos();
  });

  form.append(input, add);
  li.appendChild(form);
  return li;
}

/** Renderiza todos os grupos e agentes de risco da função ativa. */
function renderizarRiscos() {
  const container = $("#riscos-container");
  if (!container) return;
  container.innerHTML = "";
  const funcao = obterFuncao(setorAtivoId, funcaoAtivaId);
  if (!funcao) return;

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
    // Agentes do catálogo.
    CATALOGO_RISCOS[grupo.chave].forEach((agente) => {
      if (adicionarItemRisco(lista, funcao, grupo.chave, agente)) ativos++;
    });
    // Agentes customizados (fora do catálogo) já cadastrados nesta função.
    funcao.avaliacoes_risco
      .filter((r) => r.grupo === grupo.chave && !CATALOGO_RISCOS[grupo.chave].includes(r.agente))
      .forEach((r) => { if (adicionarItemRisco(lista, funcao, grupo.chave, r.agente)) ativos++; });
    // Form para adicionar outro agente.
    lista.appendChild(criarFormOutroAgente(grupo.chave));

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
  const funcao = obterFuncao(setorAtivoId, funcaoAtivaId);
  lista.innerHTML = "";
  const itens = funcao?.verificacoes_epi_epc ?? [];
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
      removerEpiEpc(setorAtivoId, funcaoAtivaId, item.id);
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

  // Popula as listas de sugestões (o técnico pode escolher ou digitar outro).
  const preencherDatalist = (id, itens) => {
    const dl = $("#" + id);
    if (dl && !dl.childElementCount) {
      itens.forEach((nome) => {
        const opt = document.createElement("option");
        opt.value = nome;
        dl.appendChild(opt);
      });
    }
  };
  preencherDatalist("lista-epi-nr06", EPIS_NR06);
  preencherDatalist("lista-epc", EPCS_COMUNS);

  const descricao = $("#epi_descricao");
  // Ajusta CA (só EPI) e a lista de sugestões conforme o tipo.
  const atualizarPorTipo = () => {
    const ehEpi = selTipo.value === "epi";
    campoCa.hidden = !ehEpi;
    if (descricao) descricao.setAttribute("list", ehEpi ? "lista-epi-nr06" : "lista-epc");
  };
  selTipo?.addEventListener("change", atualizarPorTipo);
  atualizarPorTipo();

  // Segmentados do formulário.
  ligarSegmentado("#epi_fornecido");
  ligarSegmentado("#epi_em_uso");
  ligarSegmentado("#epi_conservacao");

  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    erro.textContent = "";

    if (!funcaoAtivaId) return falhar("Selecione uma função antes de adicionar EPIs/EPCs.");

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

    adicionarEpiEpc(setorAtivoId, funcaoAtivaId, dados);
    form.reset();
    limparSegmentado("#epi_fornecido");
    limparSegmentado("#epi_em_uso");
    limparSegmentado("#epi_conservacao");
    atualizarPorTipo();
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

/** Mostra/oculta o conteúdo por função e a mensagem de "setor sem funções". */
function atualizarVisibilidade() {
  const setor = obterSetor(setorAtivoId);
  const temFuncoes = (setor?.funcoes?.length ?? 0) > 0;
  const conteudo = $("#riscos-conteudo");
  const semFuncao = $("#riscos-sem-funcao");
  if (semFuncao) semFuncao.hidden = temFuncoes;
  if (conteudo) conteudo.hidden = !(temFuncoes && funcaoAtivaId);
}

/** (Re)renderiza toda a Tela 3 — chamado ao entrar na tela. */
export function renderizarTelaRiscos() {
  construirSeletorSetores();
  construirSeletorFuncoes();
  atualizarVisibilidade();
  renderizarRiscos();
  renderizarEpis();
}

/** Inicializa listeners persistentes da Tela 3. */
export function inicializarTelaRiscos() {
  $("#setor_ativo")?.addEventListener("change", (ev) => {
    setorAtivoId = ev.target.value;
    funcaoAtivaId = null; // ao trocar de setor, exige nova seleção de função
    construirSeletorFuncoes();
    atualizarVisibilidade();
    renderizarRiscos();
    renderizarEpis();
  });
  $("#funcao_ativa")?.addEventListener("change", (ev) => {
    funcaoAtivaId = ev.target.value || null;
    construirSeletorFuncoes(); // re-marca a função anterior como "já avaliada"
    atualizarVisibilidade();
    renderizarRiscos();
    renderizarEpis();
  });

  // Alterna a possibilidade de reabrir funções já avaliadas para correção.
  $("#editar_avaliadas")?.addEventListener("change", (ev) => {
    editarAvaliadas = ev.target.checked;
    construirSeletorFuncoes();
  });

  // "Incluir outra função / setor": volta ao topo (seletores) para avaliar a próxima.
  $("#btn-incluir-outra")?.addEventListener("click", () => {
    const topo = $("#setor_ativo")?.closest(".setor-seletor") || $("#setor_ativo");
    topo?.scrollIntoView({ behavior: "smooth", block: "start" });
    const fsel = $("#funcao_ativa");
    if (fsel) { try { fsel.focus({ preventScroll: true }); } catch { fsel.focus(); } }
  });

  inicializarFormEpi();
}
