/* =========================================================
   relatorio.js — Geração do laudo da visita em PDF (SST-17).
   Monta um relatório HTML formatado e aciona a impressão do
   navegador (Salvar como PDF). Sem dependências, funciona offline.
   ========================================================= */

import { formatarCnpj, formatarCep } from "./validacao.js";
import { resolverRef } from "./storage.js";

const NIVEL = {
  nao_avaliado: "Não avaliado", baixo: "Baixo", medio: "Médio", alto: "Alto", avaliar: "Avaliar",
};
const GRUPO = {
  fisico: "Físico", quimico: "Químico", biologico: "Biológico",
  ergonomico: "Ergonômico", acidente: "Acidente",
};
const SITUACAO = {
  possui: "Possui", necessita_reciclagem: "Necessita reciclagem", nao_possui: "Não possui",
};
const CONSERVACAO = { bom: "Adequado", regular: "Regular", ruim: "Inadequado", nao_aplicavel: "N/A" };
const STATUS_VISITA = {
  rascunho: "Rascunho", concluida: "Concluída", sincronizada: "Sincronizada", cancelada: "Cancelada",
};

/** Escapa texto para inserção segura no HTML. */
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtData(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/** Resolve o nome (e setor) de uma função pelo id, varrendo os setores. */
function resolverFuncao(visita, funcaoId) {
  for (const setor of visita.setores || []) {
    const f = (setor.funcoes || []).find((x) => x.id === funcaoId);
    if (f) return { nome: f.nome, setor: setor.nome };
  }
  return { nome: "(função removida)", setor: "" };
}

function nomesFuncoes(visita, refs) {
  return (refs || []).map((id) => esc(resolverFuncao(visita, id).nome)).join(", ") || "—";
}

/* ---------- Blocos do relatório ---------- */

function blocoIdentificacao(v) {
  const end = v.unidade.endereco || {};
  const endereco = [
    end.logradouro, end.numero, end.bairro, end.municipio, end.uf,
    end.cep ? "CEP " + formatarCep(end.cep) : "",
  ].filter(Boolean).map(esc).join(", ");
  return `
    <section class="rel-sec">
      <h2>Identificação da visita</h2>
      <div class="rel-grid">
        <div><span class="rel-rot">Data / hora</span>${fmtData(v.data_visita)} · ${esc(v.hora_inicio || "—")}${v.hora_fim ? " às " + esc(v.hora_fim) : ""}</div>
        <div><span class="rel-rot">Status</span>${esc(STATUS_VISITA[v.status] || v.status)}</div>
        <div><span class="rel-rot">Técnico</span>${esc(v.tecnico.nome || "—")}${v.tecnico.funcao ? " — " + esc(v.tecnico.funcao) : ""}</div>
        <div><span class="rel-rot">Cliente</span>${esc(v.cliente.razao_social || "—")}</div>
        <div><span class="rel-rot">CNPJ</span>${v.cliente.cnpj ? esc(formatarCnpj(v.cliente.cnpj)) : "—"}</div>
        <div><span class="rel-rot">Unidade</span>${esc(v.unidade.nome || "—")}${v.unidade.grau_risco ? " · Grau de risco " + esc(v.unidade.grau_risco) : ""}</div>
        <div class="rel-col2"><span class="rel-rot">Endereço</span>${endereco || "—"}</div>
      </div>
      ${(v.cliente.contatos || []).length ? `
        <p class="rel-rot" style="margin-top:8px">Contatos</p>
        <ul class="rel-lista">
          ${v.cliente.contatos.map((c) => `<li>${esc(c.nome)}${c.departamento ? " — " + esc(c.departamento) : ""}${c.email ? " · " + esc(c.email) : ""}${c.telefone ? " · " + esc(c.telefone) : ""}</li>`).join("")}
        </ul>` : ""}
    </section>`;
}

function blocoSetores(v) {
  if (!(v.setores || []).length) return "";
  return `
    <section class="rel-sec">
      <h2>Setores e funções</h2>
      ${v.setores.map((s) => `
        <div class="rel-item">
          <h3>${esc(s.nome)}</h3>
          ${s.descricao ? `<p class="rel-desc">${esc(s.descricao)}</p>` : ""}
          ${(s.funcoes || []).length ? `<ul class="rel-lista">${s.funcoes.map((f) => `<li>${esc(f.nome)}${f.quantidade != null ? ` — ${esc(f.quantidade)} func.` : ""}</li>`).join("")}</ul>` : `<p class="rel-desc">Sem funções cadastradas.</p>`}
        </div>`).join("")}
    </section>`;
}

function blocoRiscos(v) {
  const temAlgum = (v.setores || []).some((s) => (s.avaliacoes_risco || []).length || (s.verificacoes_epi_epc || []).length);
  if (!temAlgum) return "";
  return `
    <section class="rel-sec">
      <h2>Riscos ocupacionais e EPIs/EPCs</h2>
      ${v.setores.map((s) => {
        const riscos = s.avaliacoes_risco || [];
        const epis = s.verificacoes_epi_epc || [];
        if (!riscos.length && !epis.length) return "";
        return `
          <div class="rel-item">
            <h3>${esc(s.nome)}</h3>
            ${riscos.length ? `
              <table class="rel-tab">
                <thead><tr><th>Grupo</th><th>Agente</th><th>Nível</th><th>Quantificação</th><th>Observação</th></tr></thead>
                <tbody>
                  ${riscos.map((r) => {
                    const q = r.quantificacao;
                    const qtxt = q ? [q.data ? fmtData(q.data) : "", q.hora || "", q.equipamento ? esc(q.equipamento) : ""].filter(Boolean).join(" ") : "—";
                    return `<tr><td>${esc(GRUPO[r.grupo] || r.grupo)}</td><td>${esc(r.agente)}</td><td>${esc(NIVEL[r.nivel_exposicao] || "—")}</td><td>${qtxt || "—"}</td><td>${esc(r.observacao || "—")}</td></tr>`;
                  }).join("")}
                </tbody>
              </table>` : `<p class="rel-desc">Nenhum risco registrado.</p>`}
            ${(() => {
              const fotos = riscos.flatMap((r) => (r.evidencias || []).map((e) => ({ agente: r.agente, ...e })));
              if (!fotos.length) return "";
              return `
                <p class="rel-rot" style="margin-top:6px">Evidências fotográficas</p>
                <div class="rel-fotos">
                  ${fotos.map((f) => `<figure><img src="${f.arquivo_ref}" alt="Evidência" /><figcaption>${esc(f.agente)}${f.legenda ? " — " + esc(f.legenda) : ""}</figcaption></figure>`).join("")}
                </div>`;
            })()}
            ${epis.length ? `
              <p class="rel-rot" style="margin-top:6px">EPIs / EPCs</p>
              <table class="rel-tab">
                <thead><tr><th>Tipo</th><th>Descrição</th><th>CA</th><th>Fornece</th><th>Uso correto</th><th>Conservação</th><th>Conformidade</th></tr></thead>
                <tbody>
                  ${epis.map((e) => `<tr><td>${e.tipo === "epi" ? "EPI" : "EPC"}</td><td>${esc(e.descricao)}</td><td>${esc(e.numero_ca || "—")}</td><td>${e.fornecido ? "Sim" : "Não"}</td><td>${e.em_uso ? "Sim" : "Não"}</td><td>${esc(CONSERVACAO[e.estado_conservacao] || "—")}</td><td>${e.conforme === "conforme" ? "Conforme" : "Não conforme"}</td></tr>`).join("")}
                </tbody>
              </table>` : ""}
          </div>`;
      }).join("")}
    </section>`;
}

function blocoGhes(v) {
  if (!(v.ghes || []).length) return "";
  return `
    <section class="rel-sec">
      <h2>Grupos Homogêneos de Exposição (GHE)</h2>
      <ul class="rel-lista">
        ${v.ghes.map((g) => `<li><strong>${esc(g.nome)}</strong>${g.descricao ? " — " + esc(g.descricao) : ""}<br><span class="rel-desc">Funções: ${nomesFuncoes(v, g.funcoes_ref)}</span></li>`).join("")}
      </ul>
    </section>`;
}

function blocoTreinamentos(v) {
  if (!(v.treinamentos || []).length) return "";
  return `
    <section class="rel-sec">
      <h2>Treinamentos</h2>
      <table class="rel-tab">
        <thead><tr><th>Treinamento</th><th>Situação</th><th>Funções</th></tr></thead>
        <tbody>
          ${v.treinamentos.map((t) => `<tr><td>${esc(t.nome)}</td><td>${esc(SITUACAO[t.situacao] || t.situacao)}</td><td>${nomesFuncoes(v, t.funcoes_ref)}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>`;
}

function blocoEncerramento(v) {
  const assinaturas = (v.assinaturas || []).map((a) => `
    <div class="rel-assinatura">
      ${a.assinatura_ref ? `<img src="${a.assinatura_ref}" alt="Assinatura" />` : ""}
      <div class="rel-assinatura__linha"></div>
      <p>${esc(a.nome)}${a.cargo ? " — " + esc(a.cargo) : ""}<br><span class="rel-desc">${a.papel === "tecnico" ? "Técnico responsável" : "Responsável da empresa"}</span></p>
    </div>`).join("");
  return `
    <section class="rel-sec">
      <h2>Parecer técnico</h2>
      <p class="rel-parecer">${esc(v.observacoes_gerais || "—")}</p>
      ${assinaturas ? `<div class="rel-assinaturas">${assinaturas}</div>` : ""}
    </section>`;
}

/** Monta o HTML completo do relatório de uma visita. */
function montarHtml(v) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  return `
    <div class="rel-doc">
      <header class="rel-cabecalho">
        <div class="rel-logo">SO</div>
        <div>
          <h1>Check-list de Visita Técnica</h1>
          <p>Select Ocupacional — Saúde e Segurança do Trabalho</p>
        </div>
        ${v.codigo_visita ? `<div class="rel-codigo">${esc(v.codigo_visita)}</div>` : ""}
      </header>
      ${blocoIdentificacao(v)}
      ${blocoSetores(v)}
      ${blocoRiscos(v)}
      ${blocoGhes(v)}
      ${blocoTreinamentos(v)}
      ${blocoEncerramento(v)}
      <footer class="rel-rodape">
        Documento gerado pelo app em ${esc(geradoEm)}. Dados sensíveis (assinaturas) — uso restrito conforme LGPD.
      </footer>
    </div>`;
}

/**
 * Gera o relatório de uma visita e abre o diálogo de impressão
 * (o usuário escolhe "Salvar como PDF").
 */
export async function gerarRelatorio(visita) {
  if (!visita) return;
  const container = document.getElementById("relatorio-container");
  if (!container) return;

  // Clona e resolve os binários (data URL, cache local ou URL assinada).
  const v = typeof structuredClone === "function"
    ? structuredClone(visita)
    : JSON.parse(JSON.stringify(visita));
  for (const s of v.setores || []) {
    for (const r of s.avaliacoes_risco || []) {
      for (const ev of r.evidencias || []) {
        ev.arquivo_ref = await resolverRef(ev.arquivo_ref);
      }
    }
  }
  for (const a of v.assinaturas || []) {
    a.assinatura_ref = await resolverRef(a.assinatura_ref);
  }

  container.innerHTML = montarHtml(v);
  // Aguarda o layout e a decodificação das imagens antes de imprimir.
  setTimeout(() => window.print(), 300);
}
