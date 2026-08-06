/* =========================================================
   estado.js — Modelo de dados em memória + persistência local.
   Alinhado ao contrato schema/checklist-visita-tecnica.schema.json (SST-01).
   Princípio offline-first: tudo persiste em localStorage e nasce no dispositivo.
   ========================================================= */

const CHAVE_STORAGE = "select_visita_tecnica_rascunho";
const VERSAO_SCHEMA = "1.0.0";

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

// Estado único da aplicação (a visita em edição).
export const estado = { visita: criarVisitaVazia() };

/** Carrega rascunho salvo, se houver. Retorna true quando recuperou algo. */
export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return false;
    const dados = JSON.parse(bruto);
    if (dados && typeof dados === "object" && dados.id) {
      estado.visita = dados;
      return true;
    }
  } catch (e) {
    console.warn("Não foi possível carregar o rascunho:", e);
  }
  return false;
}

/** Persiste a visita atual no armazenamento local (offline-first). */
export function salvar() {
  estado.visita.auditoria.atualizado_em = agoraIso();
  try {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado.visita));
    return true;
  } catch (e) {
    console.warn("Não foi possível salvar o rascunho:", e);
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
