/* =========================================================
   app.js — Bootstrap, tela inicial (lista de visitas) e navegação
   entre as 4 etapas do assistente. Persistência em IndexedDB (SST-05b).
   ========================================================= */

import {
  salvar,
  novaVisita,
  abrirVisita,
  listarVisitas,
  excluirVisita,
  migrarLocalStorage,
} from "./estado.js";
import {
  inicializarTelaIdentificacao,
  preencherIdentificacao,
  validarEComitar,
} from "./tela-identificacao.js";
import {
  inicializarTelaSetores,
  validarSetoresTela,
  renderizarLista,
} from "./tela-setores.js";
import {
  inicializarTelaRiscos,
  renderizarTelaRiscos,
} from "./tela-riscos.js";
import {
  inicializarTelaGhe,
  renderizarTelaGhe,
} from "./tela-ghe.js";
import {
  inicializarTelaTreinamentos,
  renderizarTelaTreinamentos,
} from "./tela-treinamentos.js";
import {
  inicializarTelaEncerramento,
  renderizarTelaEncerramento,
  resetarEncerramento,
  finalizarVisita,
} from "./tela-encerramento.js";
import { gerarRelatorio } from "./relatorio.js";
import {
  estaAutenticado,
  usuarioAtual,
  entrar,
  cadastrar,
  sair,
} from "./auth.js";

const $ = (sel) => document.querySelector(sel);

// Ordem das etapas do assistente.
const PASSOS = ["identificacao", "setores", "riscos", "ghe", "treinamentos", "encerramento"];
let indiceAtual = 0;

const btnAvancar = $("#btn-avancar");
const btnVoltar = $("#btn-voltar");
const btnInicio = $("#btn-inicio");

/* ---------- Tela inicial (lista de visitas) ---------- */

const STATUS_ROTULO = {
  rascunho: "Rascunho",
  concluida: "Concluída",
  sincronizada: "Sincronizada",
  cancelada: "Cancelada",
};

function formatarData(iso) {
  if (!iso) return "sem data";
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

async function renderizarListaVisitas() {
  const lista = $("#lista-visitas");
  const vazio = $("#visitas-vazio");
  const visitas = await listarVisitas();
  lista.innerHTML = "";
  vazio.hidden = visitas.length > 0;

  visitas.forEach((v) => {
    const li = document.createElement("li");
    li.className = "visita-card";

    const abrir = document.createElement("button");
    abrir.type = "button";
    abrir.className = "visita-card__abrir";

    const titulo = document.createElement("span");
    titulo.className = "visita-card__titulo";
    titulo.textContent = v.cliente?.razao_social || "(sem razão social)";

    const meta = document.createElement("span");
    meta.className = "visita-card__meta";
    meta.textContent = `${formatarData(v.data_visita)} · ${v.setores?.length || 0} setor(es)`;

    const badge = document.createElement("span");
    badge.className = `badge badge--${v.status}`;
    badge.textContent = STATUS_ROTULO[v.status] || v.status;

    abrir.append(titulo, meta, badge);
    abrir.addEventListener("click", async () => {
      await abrirVisita(v.id);
      entrarWizard();
    });

    const relatorio = document.createElement("button");
    relatorio.type = "button";
    relatorio.className = "visita-card__relatorio";
    relatorio.setAttribute("aria-label", "Gerar relatório (PDF)");
    relatorio.textContent = "⎙";
    relatorio.title = "Gerar relatório (PDF)";
    relatorio.addEventListener("click", (e) => {
      e.stopPropagation();
      gerarRelatorio(v);
    });

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "visita-card__excluir";
    excluir.setAttribute("aria-label", "Excluir visita");
    excluir.textContent = "✕";
    excluir.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Excluir esta visita? Esta ação não pode ser desfeita.")) {
        await excluirVisita(v.id);
        renderizarListaVisitas();
      }
    });

    li.append(abrir, relatorio, excluir);
    lista.appendChild(li);
  });
}

/** Exibe a tela inicial e esconde o assistente. */
async function mostrarInicio() {
  await renderizarListaVisitas();
  $("#tela-inicio").hidden = false;
  PASSOS.forEach((t) => ($("#tela-" + t).hidden = true));
  $("#passos").hidden = true;
  $("#rodape-nav").hidden = true;
  btnInicio.hidden = true;
  window.scrollTo({ top: 0 });
}

/** Entra no assistente com a visita atual (nova ou aberta), na etapa 1. */
function entrarWizard() {
  $("#tela-inicio").hidden = true;
  $("#passos").hidden = false;
  $("#rodape-nav").hidden = false;
  btnInicio.hidden = false;
  btnAvancar.hidden = false;
  resetarEncerramento();
  preencherIdentificacao();
  irPara(0);
}

/* ---------- Navegação do assistente ---------- */

function irPara(indice) {
  indiceAtual = Math.max(0, Math.min(indice, PASSOS.length - 1));
  const passo = PASSOS[indiceAtual];

  $("#tela-identificacao").hidden = passo !== "identificacao";
  $("#tela-setores").hidden = passo !== "setores";
  $("#tela-riscos").hidden = passo !== "riscos";
  $("#tela-ghe").hidden = passo !== "ghe";
  $("#tela-treinamentos").hidden = passo !== "treinamentos";
  $("#tela-encerramento").hidden = passo !== "encerramento";

  document.querySelectorAll(".passos__item").forEach((item) => {
    const p = item.dataset.passo;
    item.removeAttribute("aria-current");
    item.classList.remove("passos__item--concluido");
    if (!p) return;
    const idx = PASSOS.indexOf(p);
    if (idx === indiceAtual) item.setAttribute("aria-current", "step");
    else if (idx > -1 && idx < indiceAtual) item.classList.add("passos__item--concluido");
  });

  btnVoltar.hidden = indiceAtual === 0;
  btnAvancar.textContent = passo === "encerramento" ? "Finalizar visita" : "Avançar";

  if (passo === "setores") renderizarLista();
  if (passo === "riscos") renderizarTelaRiscos();
  if (passo === "ghe") renderizarTelaGhe();
  if (passo === "treinamentos") renderizarTelaTreinamentos();
  if (passo === "encerramento") renderizarTelaEncerramento();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function podeAvancarDe(passo) {
  if (passo === "identificacao") return validarEComitar();
  if (passo === "setores") return validarSetoresTela();
  return true;
}

/* ---------- Autenticação (SST-BE-2) ---------- */

let modoCadastro = false;

function mostrarLogin() {
  $("#tela-login").hidden = false;
}

/** Entra no app após autenticado: esconde o login e faz o boot. */
async function entrarApp() {
  $("#tela-login").hidden = true;
  const u = usuarioAtual();
  if (u) $("#usuario-email").textContent = u.email || "";
  await migrarLocalStorage();
  await mostrarInicio();
}

function inicializarLogin() {
  const form = $("#form-login");
  const erro = $('[data-erro="login"]');
  const campoNome = $("#campo-login-nome");
  const btnLogin = $("#btn-login");
  const btnToggle = $("#btn-toggle-cadastro");

  btnToggle.addEventListener("click", () => {
    modoCadastro = !modoCadastro;
    campoNome.hidden = !modoCadastro;
    btnLogin.textContent = modoCadastro ? "Criar conta" : "Entrar";
    btnToggle.textContent = modoCadastro ? "Já tenho conta" : "Criar conta";
    if (erro) erro.textContent = "";
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (erro) erro.textContent = "";
    const email = $("#login_email").value.trim();
    const senha = $("#login_senha").value;
    const nome = $("#login_nome").value.trim();
    if (!email || !senha) { if (erro) erro.textContent = "Informe e-mail e senha."; return; }

    btnLogin.disabled = true;
    const textoOriginal = btnLogin.textContent;
    btnLogin.textContent = "Aguarde…";
    try {
      if (modoCadastro) {
        const s = await cadastrar(email, senha, nome);
        if (!s) {
          if (erro) erro.textContent = "Conta criada! Confirme o e-mail e depois faça login.";
          btnToggle.click(); // volta ao modo login
          return;
        }
      } else {
        await entrar(email, senha);
      }
      await entrarApp();
    } catch (e) {
      if (erro) erro.textContent = navigator.onLine ? (e.message || "Falha na autenticação.") : "Sem conexão. O primeiro acesso precisa de internet.";
    } finally {
      btnLogin.disabled = false;
      btnLogin.textContent = textoOriginal;
    }
  });

  $("#btn-sair").addEventListener("click", () => {
    sair();
    location.reload();
  });
}

/* ---------- Bootstrap ---------- */

async function inicializar() {
  inicializarLogin();
  inicializarTelaIdentificacao();
  inicializarTelaSetores();
  inicializarTelaRiscos();
  inicializarTelaGhe();
  inicializarTelaTreinamentos();
  inicializarTelaEncerramento();

  btnAvancar.addEventListener("click", () => {
    const passoAtual = PASSOS[indiceAtual];
    if (passoAtual === "encerramento") {
      if (finalizarVisita()) {
        btnAvancar.hidden = true;
        btnVoltar.hidden = true;
      }
      return;
    }
    if (!podeAvancarDe(passoAtual)) return;
    irPara(indiceAtual + 1);
  });

  btnVoltar.addEventListener("click", () => irPara(indiceAtual - 1));

  // Voltar à lista de visitas (salva o que estiver aberto).
  btnInicio.addEventListener("click", async () => {
    await salvar();
    mostrarInicio();
  });

  // Nova visita a partir da tela inicial.
  $("#btn-nova-visita-inicio").addEventListener("click", async () => {
    await novaVisita();
    entrarWizard();
  });

  // "Iniciar nova visita" a partir do painel de sucesso (Tela 4).
  document.addEventListener("solicitar-nova-visita", async () => {
    await novaVisita();
    entrarWizard();
  });

  // Gate de autenticação: só entra no app se houver sessão.
  if (estaAutenticado()) {
    await entrarApp();
  } else {
    mostrarLogin();
  }
}

document.addEventListener("DOMContentLoaded", inicializar);
