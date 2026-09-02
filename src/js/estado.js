/* =========================================================
   estado.js — Modelo de dados em memória + persistência local.
   Alinhado ao contrato schema/checklist-visita-tecnica.schema.json (SST-01).
   Princípio offline-first: persiste em IndexedDB (várias visitas) e nasce
   no dispositivo. Migra automaticamente rascunhos antigos do localStorage.
   ========================================================= */

import {
  salvarVisita as dbSalvar,
  obterVisita as dbObter,
  listarVisitas as dbListar,
  excluirVisita as dbExcluir,
} from "./db.js";

// Chave do rascunho único da versão anterior (localStorage) — usada só na migração.
const CHAVE_STORAGE_ANTIGA = "select_visita_tecnica_rascunho";
const VERSAO_SCHEMA = "1.9.0";

/** Gera um UUID v4 (usa crypto nativo quando disponível). */
export function gerarUuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Fallback compatível com o padrão v4 exigido pelo schema.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function agoraIso() {
  return new Date().toISOString();
}

/** Cria uma VisitaTecnica vazia, no formato do schema. */
export function criarVisitaVazia() {
  const criado = agoraIso();
  return {
    id: gerarUuid(),
    status: "rascunho",
    data_visita: "",
    hora_inicio: "",
    cliente: { razao_social: "", nome_fantasia: "", cnpj: "", contatos: [] },
    unidade: {
      nome: "",
      endereco: { logradouro: "", numero: "", bairro: "", municipio: "", uf: "", cep: "" },
      grau_risco: null,
      numero_trabalhadores: null,
    },
    tecnico: { id: "", nome: "", funcao: "", registro_profissional: "" },
    setores: [],
    ghes: [],
    treinamentos: [],
    nao_conformidades: [],
    assinaturas: [],
    observacoes_gerais: "",
    auditoria: {
      criado_em: criado,
      atualizado_em: criado,
      sincronizado_em: null,
      versao_app: "0.1.0",
      versao_schema: VERSAO_SCHEMA,
    },
  };
}

// Estado da aplicação: a visita atualmente em edição (ou null na tela inicial).
export const estado = { visita: criarVisitaVazia() };

/** Persiste a visita atual no IndexedDB (offline-first). Assíncrono. */
export async function salvar() {
  if (!estado.visita) return false;
  estado.visita.auditoria.atualizado_em = agoraIso();
  try {
    await dbSalvar(estado.visita);
    return true;
  } catch (e) {
    console.warn("Não foi possível salvar a visita:", e);
    return false;
  }
}

// Salvamento com debounce, para autosave de digitação (evita gravar a cada tecla).
let _timerSalvar = null;
/** Agenda um salvamento (debounce ~400ms). Ideal para eventos de digitação. */
export function agendarSalvamento() {
  clearTimeout(_timerSalvar);
  _timerSalvar = setTimeout(() => salvar(), 400);
}

/* ---------- Grupos Homogêneos de Exposição — GHE (SST-12) ---------- */

/** Adiciona um GHE (grupo) e persiste. */
export function adicionarGhe({ nome, descricao }) {
  if (!Array.isArray(estado.visita.ghes)) estado.visita.ghes = [];
  const ghe = { id: gerarUuid(), nome: nome.trim(), funcoes_ref: [] };
  if (descricao && descricao.trim()) ghe.descricao = descricao.trim();
  estado.visita.ghes.push(ghe);
  salvar();
  return ghe;
}

/** Remove um GHE pelo id e persiste. */
export function removerGhe(id) {
  estado.visita.ghes = (estado.visita.ghes || []).filter((g) => g.id !== id);
  salvar();
}

/** Inclui/remove (toggle) a referência de uma função em um GHE. */
export function alternarFuncaoNoGhe(gheId, funcaoId) {
  const ghe = (estado.visita.ghes || []).find((g) => g.id === gheId);
  if (!ghe) return;
  if (!Array.isArray(ghe.funcoes_ref)) ghe.funcoes_ref = [];
  const i = ghe.funcoes_ref.indexOf(funcaoId);
  if (i >= 0) ghe.funcoes_ref.splice(i, 1);
  else ghe.funcoes_ref.push(funcaoId);
  salvar();
}

/* ---------- Treinamentos por função (SST-13) ---------- */

/** Adiciona um treinamento (situação padrão: possui) e persiste. */
export function adicionarTreinamento({ nome, situacao }) {
  if (!Array.isArray(estado.visita.treinamentos)) estado.visita.treinamentos = [];
  const treino = {
    id: gerarUuid(),
    nome: nome.trim(),
    situacao: situacao || "possui",
    funcoes_ref: [],
  };
  estado.visita.treinamentos.push(treino);
  salvar();
  return treino;
}

/** Remove um treinamento pelo id e persiste. */
export function removerTreinamento(id) {
  estado.visita.treinamentos = (estado.visita.treinamentos || []).filter((t) => t.id !== id);
  salvar();
}

/** Atualiza um treinamento (ex.: situação) e persiste. */
export function atualizarTreinamento(id, patch) {
  const treino = (estado.visita.treinamentos || []).find((t) => t.id === id);
  if (!treino) return null;
  Object.assign(treino, patch);
  salvar();
  return treino;
}

/** Inclui/remove (toggle) a referência de uma função em um treinamento. */
export function alternarFuncaoNoTreinamento(treinoId, funcaoId) {
  const treino = (estado.visita.treinamentos || []).find((t) => t.id === treinoId);
  if (!treino) return;
  if (!Array.isArray(treino.funcoes_ref)) treino.funcoes_ref = [];
  const i = treino.funcoes_ref.indexOf(funcaoId);
  if (i >= 0) treino.funcoes_ref.splice(i, 1);
  else treino.funcoes_ref.push(funcaoId);
  salvar();
}

/** Lista todas as funções cadastradas nos setores (para compor GHEs/treinamentos). */
export function listarFuncoesDisponiveis() {
  const out = [];
  (estado.visita.setores || []).forEach((setor) => {
    (setor.funcoes || []).forEach((f) => {
      out.push({
        setorId: setor.id,
        setorNome: setor.nome,
        funcaoId: f.id,
        funcaoNome: f.nome,
        quantidade: f.quantidade,
      });
    });
  });
  return out;
}

/* ---------- Contatos do cliente (SST-06) ---------- */

/** Adiciona um contato ao cliente e persiste. */
export function adicionarContato({ nome, email, departamento, telefone }) {
  const c = estado.visita.cliente;
  if (!Array.isArray(c.contatos)) c.contatos = [];
  const contato = { id: gerarUuid(), nome: nome.trim() };
  if (email && email.trim()) contato.email = email.trim();
  if (departamento && departamento.trim()) contato.departamento = departamento.trim();
  if (telefone && telefone.trim()) contato.telefone = telefone.trim();
  c.contatos.push(contato);
  salvar();
  return contato;
}

/** Remove um contato do cliente pelo id e persiste. */
export function removerContato(id) {
  const c = estado.visita.cliente;
  if (!c.contatos) return;
  c.contatos = c.contatos.filter((x) => x.id !== id);
  salvar();
}

/* ---------- Gestão de múltiplas visitas ---------- */

/** Cria uma nova visita, define como atual e persiste. */
export async function novaVisita() {
  estado.visita = criarVisitaVazia();
  await salvar();
  return estado.visita;
}

/**
 * Migra rascunhos anteriores (schema ≤1.7.0), em que os riscos e EPIs/EPCs
 * ficavam no SETOR, para o novo formato por FUNÇÃO (1.8.0). Os dados do setor
 * são movidos para uma função "Geral" (criada se o setor não tiver funções),
 * evitando perda de informação. Idempotente.
 */
function migrarRiscosParaFuncao(v) {
  for (const setor of v?.setores || []) {
    if (!Array.isArray(setor.funcoes)) setor.funcoes = [];
    const temLegado = (setor.avaliacoes_risco?.length || 0) || (setor.verificacoes_epi_epc?.length || 0);
    if (temLegado) {
      let alvo = setor.funcoes[0];
      if (!alvo) {
        alvo = { id: gerarUuid(), nome: "Geral", avaliacoes_risco: [], verificacoes_epi_epc: [] };
        setor.funcoes.push(alvo);
      }
      if (!Array.isArray(alvo.avaliacoes_risco)) alvo.avaliacoes_risco = [];
      if (!Array.isArray(alvo.verificacoes_epi_epc)) alvo.verificacoes_epi_epc = [];
      alvo.avaliacoes_risco.push(...(setor.avaliacoes_risco || []));
      alvo.verificacoes_epi_epc.push(...(setor.verificacoes_epi_epc || []));
    }
    delete setor.avaliacoes_risco;
    delete setor.verificacoes_epi_epc;
    // Garante os arrays em todas as funções (formato 1.8.0).
    for (const f of setor.funcoes) {
      if (!Array.isArray(f.avaliacoes_risco)) f.avaliacoes_risco = [];
      if (!Array.isArray(f.verificacoes_epi_epc)) f.verificacoes_epi_epc = [];
    }
  }
  return v;
}

/** Abre uma visita salva pelo id e a define como atual. */
export async function abrirVisita(id) {
  const v = await dbObter(id);
  if (v) estado.visita = migrarRiscosParaFuncao(v);
  return estado.visita || null;
}

/** Lista as visitas salvas, mais recentes primeiro. */
export async function listarVisitas() {
  const visitas = await dbListar();
  return (visitas || []).sort((a, b) =>
    (b.auditoria?.atualizado_em || "").localeCompare(a.auditoria?.atualizado_em || "")
  );
}

/** Exclui uma visita salva pelo id. */
export async function excluirVisita(id) {
  await dbExcluir(id);
  if (estado.visita && estado.visita.id === id) estado.visita = null;
}

/**
 * Migra o rascunho único da versão anterior (localStorage) para o IndexedDB.
 * Executa uma vez; remove a chave antiga após migrar. Retorna true se migrou.
 */
export async function migrarLocalStorage() {
  let bruto = null;
  try {
    bruto = localStorage.getItem(CHAVE_STORAGE_ANTIGA);
  } catch {
    return false;
  }
  if (!bruto) return false;
  try {
    const dados = JSON.parse(bruto);
    if (dados && typeof dados === "object" && dados.id) {
      if (!dados.auditoria) dados.auditoria = criarVisitaVazia().auditoria;
      dados.auditoria.versao_schema = dados.auditoria.versao_schema || VERSAO_SCHEMA;
      await dbSalvar(dados);
    }
    localStorage.removeItem(CHAVE_STORAGE_ANTIGA);
    return true;
  } catch (e) {
    console.warn("Falha ao migrar rascunho do localStorage:", e);
    return false;
  }
}

/* ---------- Operações de domínio ---------- */

/** Adiciona um setor (SetorAvaliado) e persiste. */
export function adicionarSetor({ nome, descricao }) {
  const setor = {
    id: gerarUuid(),
    nome: nome.trim(),
    descricao: (descricao || "").trim(),
    funcoes: [],
  };
  if (!setor.descricao) delete setor.descricao;
  estado.visita.setores.push(setor);
  salvar();
  return setor;
}

/** Remove um setor pelo id e persiste. */
export function removerSetor(id) {
  estado.visita.setores = estado.visita.setores.filter((s) => s.id !== id);
  salvar();
}

/* ---------- Funções do setor (SST-08) ---------- */

/** Adiciona uma função (com quantidade opcional) a um setor. */
export function adicionarFuncao(setorId, { nome, quantidade }) {
  const setor = obterSetor(setorId);
  if (!setor) return null;
  if (!Array.isArray(setor.funcoes)) setor.funcoes = [];
  const funcao = { id: gerarUuid(), nome: nome.trim(), avaliacoes_risco: [], verificacoes_epi_epc: [] };
  const qtd = Number(quantidade);
  if (Number.isFinite(qtd) && qtd >= 0 && String(quantidade).trim() !== "") {
    funcao.quantidade = qtd;
  }
  setor.funcoes.push(funcao);
  salvar();
  return funcao;
}

/** Atualiza uma função do setor (ex.: quantidade) e persiste. */
export function atualizarFuncao(setorId, funcaoId, patch) {
  const setor = obterSetor(setorId);
  const funcao = setor?.funcoes?.find((f) => f.id === funcaoId);
  if (!funcao) return null;
  Object.assign(funcao, patch);
  if (funcao.quantidade === null || funcao.quantidade === undefined || Number.isNaN(funcao.quantidade)) {
    delete funcao.quantidade;
  }
  salvar();
  return funcao;
}

/** Remove uma função de um setor e persiste. */
export function removerFuncao(setorId, funcaoId) {
  const setor = obterSetor(setorId);
  if (!setor?.funcoes) return;
  setor.funcoes = setor.funcoes.filter((f) => f.id !== funcaoId);
  salvar();
}

/** Retorna o setor pelo id (ou undefined). */
export function obterSetor(setorId) {
  return estado.visita.setores.find((s) => s.id === setorId);
}

/** Retorna a função (dentro de um setor) pelo id, garantindo os arrays. */
export function obterFuncao(setorId, funcaoId) {
  const funcao = obterSetor(setorId)?.funcoes?.find((f) => f.id === funcaoId);
  if (funcao) {
    if (!Array.isArray(funcao.avaliacoes_risco)) funcao.avaliacoes_risco = [];
    if (!Array.isArray(funcao.verificacoes_epi_epc)) funcao.verificacoes_epi_epc = [];
  }
  return funcao;
}

/* ---------- Riscos ocupacionais (por função, schema 1.8.0) ---------- */

/**
 * Marca/desmarca a presença de um risco na função. Identidade = grupo + agente.
 * @returns {object|null} a avaliação criada, ou null ao remover.
 */
export function definirRiscoPresente(setorId, funcaoId, grupo, agente, presente) {
  const funcao = obterFuncao(setorId, funcaoId);
  if (!funcao) return null;
  const idx = funcao.avaliacoes_risco.findIndex(
    (r) => r.grupo === grupo && r.agente === agente
  );

  if (presente) {
    if (idx >= 0) return funcao.avaliacoes_risco[idx];
    const risco = {
      id: gerarUuid(),
      grupo,
      agente,
      presente: true,
      nivel_exposicao: "nao_avaliado",
      observacao: "",
    };
    funcao.avaliacoes_risco.push(risco);
    salvar();
    return risco;
  }

  if (idx >= 0) {
    funcao.avaliacoes_risco.splice(idx, 1);
    salvar();
  }
  return null;
}

/** Aplica alterações a uma AvaliacaoRisco existente e persiste. */
export function atualizarRisco(setorId, funcaoId, riscoId, patch) {
  const funcao = obterFuncao(setorId, funcaoId);
  const risco = funcao?.avaliacoes_risco.find((r) => r.id === riscoId);
  if (!risco) return null;
  Object.assign(risco, patch);
  for (const chave of Object.keys(patch)) {
    if (risco[chave] === null || risco[chave] === undefined) delete risco[chave];
  }
  salvar();
  return risco;
}

/* ---------- Evidências fotográficas do risco (SST-15) ---------- */

/** Adiciona uma evidência (foto) a um risco. arquivo_ref = data URL (offline). */
export function adicionarEvidencia(setorId, funcaoId, riscoId, { arquivo_ref, legenda, capturada_em }) {
  const funcao = obterFuncao(setorId, funcaoId);
  const risco = funcao?.avaliacoes_risco.find((r) => r.id === riscoId);
  if (!risco) return null;
  if (!Array.isArray(risco.evidencias)) risco.evidencias = [];
  const ev = { id: gerarUuid(), arquivo_ref, capturada_em: capturada_em || agoraIso() };
  if (legenda && legenda.trim()) ev.legenda = legenda.trim();
  risco.evidencias.push(ev);
  salvar();
  return ev;
}

/** Atualiza a legenda (ou outros campos) de uma evidência. */
export function atualizarEvidencia(setorId, funcaoId, riscoId, evidenciaId, patch) {
  const funcao = obterFuncao(setorId, funcaoId);
  const risco = funcao?.avaliacoes_risco.find((r) => r.id === riscoId);
  const ev = risco?.evidencias?.find((e) => e.id === evidenciaId);
  if (!ev) return null;
  Object.assign(ev, patch);
  if (!ev.legenda || !String(ev.legenda).trim()) delete ev.legenda;
  salvar();
  return ev;
}

/** Remove uma evidência de um risco. */
export function removerEvidencia(setorId, funcaoId, riscoId, evidenciaId) {
  const funcao = obterFuncao(setorId, funcaoId);
  const risco = funcao?.avaliacoes_risco.find((r) => r.id === riscoId);
  if (!risco?.evidencias) return;
  risco.evidencias = risco.evidencias.filter((e) => e.id !== evidenciaId);
  salvar();
}

/* ---------- EPI / EPC (por função, schema 1.8.0) ---------- */

/** Adiciona uma VerificacaoEpiEpc à função e persiste. */
export function adicionarEpiEpc(setorId, funcaoId, dados) {
  const funcao = obterFuncao(setorId, funcaoId);
  if (!funcao) return null;
  const item = {
    id: gerarUuid(),
    tipo: dados.tipo,
    descricao: (dados.descricao || "").trim(),
    fornecido: dados.fornecido,
    em_uso: dados.em_uso,
    estado_conservacao: dados.estado_conservacao,
    conforme: dados.conforme,
    observacao: (dados.observacao || "").trim(),
  };
  if (dados.tipo === "epi" && dados.numero_ca) item.numero_ca = dados.numero_ca.trim();
  if (!item.observacao) delete item.observacao;
  funcao.verificacoes_epi_epc.push(item);
  salvar();
  return item;
}

/** Remove uma VerificacaoEpiEpc da função e persiste. */
export function removerEpiEpc(setorId, funcaoId, itemId) {
  const funcao = obterFuncao(setorId, funcaoId);
  if (!funcao) return;
  funcao.verificacoes_epi_epc = funcao.verificacoes_epi_epc.filter((i) => i.id !== itemId);
  salvar();
}

/* ---------- Encerramento e sanitização ---------- */

// Chaves cujo valor null é permitido pelo schema (não devem ser removidas).
const NULOS_PERMITIDOS = new Set(["sincronizado_em"]);

/**
 * Remove recursivamente campos opcionais "vazios" de um objeto:
 * strings vazias ("") e valores null (exceto os permitidos, ex.: sincronizado_em).
 * Corrige o caso do CEP em branco e similares (numero, bairro, grau_risco,
 * numero_trabalhadores, observacao...) que quebrariam padrões/enums do schema.
 */
function limparVazios(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(limparVazios);
    return;
  }
  if (obj && typeof obj === "object") {
    for (const chave of Object.keys(obj)) {
      const valor = obj[chave];
      if (valor === "" || (valor === null && !NULOS_PERMITIDOS.has(chave))) {
        delete obj[chave];
      } else if (valor && typeof valor === "object") {
        limparVazios(valor);
      }
    }
  }
}

/**
 * Retorna uma cópia da visita pronta para validação contra o schema:
 * clonada (não muta o estado) e sem campos opcionais vazios.
 * @param {object} [visita] visita a preparar (padrão: a visita atual).
 */
export function prepararParaValidacao(visita = estado.visita) {
  const clone = typeof structuredClone === "function"
    ? structuredClone(visita)
    : JSON.parse(JSON.stringify(visita));
  limparVazios(clone);
  return clone;
}

/**
 * Registra o encerramento da visita: parecer, hora de fim e assinaturas,
 * marcando o status como "concluida". Persiste ao final.
 */
export function registrarEncerramento({ hora_fim, parecer, assinaturas }) {
  const v = estado.visita;
  if (hora_fim) v.hora_fim = hora_fim;
  v.observacoes_gerais = parecer || "";
  v.assinaturas = assinaturas;
  v.status = "concluida";
  salvar();
  return v;
}
