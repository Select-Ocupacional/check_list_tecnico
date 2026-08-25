/* =========================================================
   tela-encerramento.js — Tela 4: parecer técnico, dados do responsável
   e assinaturas digitais (Canvas). Finaliza a visita gerando dados
   válidos contra o schema da SST-01 (via prepararParaValidacao).
   ========================================================= */

import {
  estado,
  agendarSalvamento,
  gerarUuid,
  registrarEncerramento,
  prepararParaValidacao,
} from "./estado.js";
import { criarPadAssinatura } from "./assinatura.js";
import { validarEncerramento } from "./validacao.js";
import { gerarRelatorio } from "./relatorio.js";
import { resolverRef } from "./storage.js";

const $ = (sel, ctx = document) => ctx.querySelector(sel);

let padResponsavel = null;
let padTecnico = null;
let finalizada = false;
// Referências das assinaturas já salvas, para preservá-las se o pad não for redesenhado.
let refTecnicoOriginal = null;
let refResponsavelOriginal = null;

/* ---------- Inicialização ---------- */

export function inicializarTelaEncerramento() {
  padResponsavel = criarPadAssinatura($("#assinatura-responsavel"));
  padTecnico = criarPadAssinatura($("#assinatura-tecnico"));

  // Botões "Limpar" das assinaturas.
  document.querySelectorAll("[data-limpar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const alvo = btn.dataset.limpar;
      if (alvo === "assinatura-responsavel") padResponsavel.limpar();
      if (alvo === "assinatura-tecnico") padTecnico.limpar();
    });
  });

  // Autosave dos campos de texto do encerramento (offline-first).
  const form = $("#form-encerramento");
  form?.addEventListener("input", () => {
    if (!estado.visita) return;
    estado.visita.observacoes_gerais = $("#parecer").value;
    if ($("#hora_fim").value) estado.visita.hora_fim = $("#hora_fim").value;
    agendarSalvamento();
  });

  inicializarDitado();

  // Ações do painel de sucesso.
  $("#btn-relatorio")?.addEventListener("click", () => gerarRelatorio(estado.visita));
  $("#btn-baixar-json")?.addEventListener("click", baixarJson);
  $("#btn-nova-visita")?.addEventListener("click", iniciarNovaVisita);
}

/** Ditado por voz (Web Speech API) para o campo Parecer. Requer conexão. */
function inicializarDitado() {
  const btn = $("#btn-ditar");
  const parecer = $("#parecer");
  if (!btn || !parecer) return;
  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Reconhecimento) return; // navegador sem suporte: botão fica oculto

  btn.hidden = false;
  const rec = new Reconhecimento();
  rec.lang = "pt-BR";
  rec.continuous = true;
  rec.interimResults = true;

  let ativo = false;
  let base = "";
  let finalAcum = "";

  const parar = () => {
    ativo = false;
    btn.classList.remove("btn-ditar--ativo");
    btn.textContent = "🎤 Ditar";
  };

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalAcum += t;
      else interim += t;
    }
    parecer.value = (base + finalAcum + interim).replace(/\s+/g, " ").trimStart();
    parecer.dispatchEvent(new Event("input", { bubbles: true })); // autosave
  };
  rec.onerror = () => parar();
  rec.onend = () => {
    parecer.value = (base + finalAcum).replace(/\s+/g, " ").trim();
    parecer.dispatchEvent(new Event("input", { bubbles: true }));
    parar();
  };

  btn.addEventListener("click", () => {
    if (ativo) { rec.stop(); return; }
    base = parecer.value ? parecer.value.trimEnd() + " " : "";
    finalAcum = "";
    ativo = true;
    btn.classList.add("btn-ditar--ativo");
    btn.textContent = "⏹ Parar";
    try {
      rec.start();
    } catch {
      parar();
    }
  });
}

/** (Re)renderiza a tela ao entrar: dimensiona canvas e pré-preenche. */
export function renderizarTelaEncerramento() {
  // Canvas precisa ser dimensionado quando visível.
  padResponsavel?.redimensionar();
  padTecnico?.redimensionar();

  const v = estado.visita;
  $("#rotulo-tecnico").textContent = v.tecnico.nome || "—";
  if (!$("#parecer").value) $("#parecer").value = v.observacoes_gerais || "";
  if (!$("#hora_fim").value) {
    v.hora_fim = v.hora_fim || horaAtual();
    $("#hora_fim").value = v.hora_fim;
  }

  // Ao editar uma visita salva: restaura os dados do responsável e as assinaturas.
  const assinaturas = v.assinaturas || [];
  const doResponsavel = assinaturas.find((a) => a.papel === "responsavel_empresa");
  const doTecnico = assinaturas.find((a) => a.papel === "tecnico");

  if (doResponsavel) {
    if (!$("#responsavel_nome").value) $("#responsavel_nome").value = doResponsavel.nome || "";
    if (!$("#responsavel_cargo").value) $("#responsavel_cargo").value = doResponsavel.cargo || "";
  }

  // Carrega as imagens das assinaturas nos respectivos pads (Data URL, cache ou URL assinada).
  refTecnicoOriginal = doTecnico?.assinatura_ref || null;
  refResponsavelOriginal = doResponsavel?.assinatura_ref || null;
  if (refTecnicoOriginal) resolverRef(refTecnicoOriginal).then((url) => padTecnico?.carregar(url));
  if (refResponsavelOriginal) resolverRef(refResponsavelOriginal).then((url) => padResponsavel?.carregar(url));
}

/** Restaura a tela para o estado inicial (ao abrir/nova visita). */
export function resetarEncerramento() {
  finalizada = false;
  const form = $("#form-encerramento");
  if (form) { form.hidden = false; form.reset(); }
  $("#encerramento-sucesso").hidden = true;
  padResponsavel?.limpar();
  padTecnico?.limpar();
  refTecnicoOriginal = null;
  refResponsavelOriginal = null;
  limparErros();
}

/* ---------- Finalização ---------- */

function limparErros() {
  document.querySelectorAll("#form-encerramento .campo__erro").forEach((el) => (el.textContent = ""));
  document.querySelectorAll("#form-encerramento .invalido").forEach((el) => el.classList.remove("invalido"));
}

function mostrarErros(erros) {
  limparErros();
  Object.keys(erros).forEach((campo) => {
    const alvo = $(`#form-encerramento [data-erro="${campo}"]`);
    if (alvo) alvo.textContent = erros[campo];
    const input = $("#" + campo);
    if (input) input.classList.add("invalido");
  });
}

/**
 * Valida e finaliza a visita. Chamado pelo botão "Finalizar visita".
 * @returns {boolean} true se finalizou com sucesso.
 */
export function finalizarVisita() {
  const parecer = $("#parecer").value;
  const responsavelNome = $("#responsavel_nome").value;

  const erros = validarEncerramento({
    parecer,
    responsavelNome,
    assinaturaTecnico: !padTecnico.estaVazio(),
    assinaturaResponsavel: !padResponsavel.estaVazio(),
  });

  if (Object.keys(erros).length) {
    mostrarErros(erros);
    const primeiro = Object.keys(erros)[0];
    $("#" + primeiro)?.focus();
    return false;
  }
  limparErros();

  const agora = new Date().toISOString();
  const assinaturas = [
    limparIndefinidos({
      id: gerarUuid(),
      papel: "tecnico",
      nome: estado.visita.tecnico.nome,
      cargo: estado.visita.tecnico.funcao || undefined,
      // Preserva a assinatura salva se o pad não foi redesenhado ao editar.
      assinatura_ref: (!padTecnico.foiModificado() && refTecnicoOriginal)
        ? refTecnicoOriginal : padTecnico.paraDataURL(),
      assinado_em: agora,
    }),
    limparIndefinidos({
      id: gerarUuid(),
      papel: "responsavel_empresa",
      nome: responsavelNome.trim(),
      cargo: $("#responsavel_cargo").value.trim() || undefined,
      assinatura_ref: (!padResponsavel.foiModificado() && refResponsavelOriginal)
        ? refResponsavelOriginal : padResponsavel.paraDataURL(),
      assinado_em: agora,
    }),
  ];

  registrarEncerramento({
    hora_fim: $("#hora_fim").value,
    parecer: parecer.trim(),
    assinaturas,
  });

  finalizada = true;
  mostrarSucesso();
  return true;
}

function mostrarSucesso() {
  $("#form-encerramento").hidden = true;
  const painel = $("#encerramento-sucesso");
  painel.hidden = false;

  const v = estado.visita;
  const nSetores = v.setores.length;
  const funcoes = v.setores.flatMap((x) => x.funcoes || []);
  const nRiscos = funcoes.reduce((s, f) => s + (f.avaliacoes_risco?.length || 0), 0);
  const nEpis = funcoes.reduce((s, f) => s + (f.verificacoes_epi_epc?.length || 0), 0);
  $("#sucesso-resumo").textContent =
    `${v.cliente.razao_social} — ${nSetores} setor(es), ${nRiscos} risco(s) e ${nEpis} EPI/EPC registrados. Rascunho salvo neste dispositivo.`;

  painel.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** true quando a visita já foi finalizada nesta sessão. */
export function estaFinalizada() {
  return finalizada;
}

/* ---------- Ações do sucesso ---------- */

function baixarJson() {
  const limpo = prepararParaValidacao();
  const blob = new Blob([JSON.stringify(limpo, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visita-tecnica-${(estado.visita.data_visita || "sem-data")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function iniciarNovaVisita() {
  // A visita finalizada já está salva no IndexedDB; apenas inicia uma nova.
  document.dispatchEvent(new CustomEvent("solicitar-nova-visita"));
}

/* ---------- Utilitários ---------- */

function horaAtual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Remove chaves com valor undefined de um objeto raso. */
function limparIndefinidos(obj) {
  Object.keys(obj).forEach((k) => obj[k] === undefined && delete obj[k]);
  return obj;
}
