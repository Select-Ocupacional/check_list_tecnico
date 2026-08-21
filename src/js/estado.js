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
const VERSAO_SCHEMA = "1.4.0";

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
    cliente: { razao_social: "", nome_fantasia: "", cnpj: "", contato_nome: "", contato_telefone: "" },
    unidade: {
      nome: "",
      endereco: { logradouro: "", numero: "", bairro: "", municipio: "", uf: "", cep: "" },
      grau_risco: null,
      numero_trabalhadores: null,
    },
    tecnico: { id: "", nome: "", funcao: "", registro_profissional: "" },
    setores: [],
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

/* ---------- Gestão de múltiplas visitas ---------- */

/** Cria uma nova visita, define como atual e persiste. */
export async function novaVisita() {
  estado.visita = criarVisitaVazia();
  await salvar();
  return estado.visita;
}

/** Abre uma visita salva pelo id e a define como atual. */
export async function abrirVisita(id) {
  const v = await dbObter(id);
  if (v) estado.visita = v;
  return v || null;
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
    avaliacoes_risco: [],
    verificacoes_epi_epc: [],
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
  const funcao = { id: gerarUuid(), nome: nome.trim() };
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

/* ---------- Riscos ocupacionais (por setor) ---------- */

/**
 * Marca/desmarca a presença de um risco no setor. Identidade = grupo + agente.
 * Ao marcar, cria uma AvaliacaoRisco no formato do schema; ao desmarcar, remove.
 * @returns {object|null} a avaliação criada, ou null ao remover.
 */
export function definirRiscoPresente(setorId, grupo, agente, presente) {
  const setor = obterSetor(setorId);
  if (!setor) return null;
  const idx = setor.avaliacoes_risco.findIndex(
    (r) => r.grupo === grupo && r.agente === agente
  );

  if (presente) {
    if (idx >= 0) return setor.avaliacoes_risco[idx];
    const risco = {
      id: gerarUuid(),
      grupo,
      agente,
      presente: true,
      nivel_exposicao: "nao_avaliado",
      observacao: "",
    };
    setor.avaliacoes_risco.push(risco);
    salvar();
    return risco;
  }

  if (idx >= 0) {
    setor.avaliacoes_risco.splice(idx, 1);
    salvar();
  }
  return null;
}

/** Aplica alterações a uma AvaliacaoRisco existente e persiste. */
export function atualizarRisco(setorId, riscoId, patch) {
  const setor = obterSetor(setorId);
  const risco = setor?.avaliacoes_risco.find((r) => r.id === riscoId);
  if (!risco) return null;
  Object.assign(risco, patch);
  // Remove chaves definidas como null/undefined no patch (ex.: quantificação vazia).
  for (const chave of Object.keys(patch)) {
    if (risco[chave] === null || risco[chave] === undefined) delete risco[chave];
  }
  salvar();
  return risco;
}

/* ---------- EPI / EPC (por setor) ---------- */

/** Adiciona uma VerificacaoEpiEpc ao setor e persiste. */
export function adicionarEpiEpc(setorId, dados) {
  const setor = obterSetor(setorId);
  if (!setor) return null;
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
  // numero_ca é obrigatório apenas para EPI (regra do schema).
  if (dados.tipo === "epi" && dados.numero_ca) item.numero_ca = dados.numero_ca.trim();
  if (!item.observacao) delete item.observacao;
  setor.verificacoes_epi_epc.push(item);
  salvar();
  return item;
}

/** Remove uma VerificacaoEpiEpc do setor e persiste. */
export function removerEpiEpc(setorId, itemId) {
  const setor = obterSetor(setorId);
  if (!setor) return;
  setor.verificacoes_epi_epc = setor.verificacoes_epi_epc.filter((i) => i.id !== itemId);
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
