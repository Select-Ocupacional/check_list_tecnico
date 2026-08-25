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
import { sincronizar, contarPendentes, excluirVisitaRemota } from "./sync.js";
import {
  obterPapel,
  ehAdmin,
  limparPapel,
  listarTodasVisitas,
  listarPerfis,
  definirPapel,
  abrirVisitaRemotaParaEdicao,
} from "./admin.js";

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
        excluirVisitaRemota(v.id); // best-effort no servidor
        renderizarListaVisitas();
        atualizarStatusSync();
      }
    });

    li.append(abrir, relatorio, excluir);
    lista.appendChild(li);
  });
}

/* ---------- Sincronização (SST-BE-3) ---------- */

let sincronizando = false;

async function atualizarStatusSync() {
  const el = $("#sync-status");
  if (!el) return;
  if (!navigator.onLine) {
    el.textContent = "Offline — as alterações serão enviadas ao reconectar.";
    return;
  }
  const n = await contarPendentes();
  el.textContent = n === 0 ? "Tudo sincronizado." : `${n} visita(s) pendente(s) de envio.`;
}

async function sincronizarAgora() {
  if (sincronizando) return;
  sincronizando = true;
  const btn = $("#btn-sincronizar");
  if (btn) { btn.disabled = true; btn.textContent = "Sincronizando…"; }
  try {
    const r = await sincronizar();
    if (r.enviadas || r.baixadas) await renderizarListaVisitas();
  } finally {
    sincronizando = false;
    if (btn) { btn.disabled = false; btn.textContent = "Sincronizar"; }
    await atualizarStatusSync();
  }
}

/* ---------- Painel Administrativo ---------- */

let adminVisitas = [];
let adminPerfis = [];

/** Nome do técnico de uma visita (perfil → fallback ao nome embutido em dados). */
function nomeTecnico(item) {
  const perfil = adminPerfis.find((p) => p.user_id === item.tecnico_id);
  return perfil?.nome || item.dados?.tecnico?.nome || "(técnico sem nome)";
}

/** Abre o Painel Admin e carrega os dados do servidor. */
async function mostrarAdmin() {
  $("#tela-inicio").hidden = true;
  $("#tela-admin").hidden = false;
  btnInicio.hidden = true;
  window.scrollTo({ top: 0 });
  await carregarAdmin();
}

/** Fecha o Painel Admin e volta à lista de visitas do usuário. */
async function fecharAdmin() {
  $("#tela-admin").hidden = true;
  await mostrarInicio();
}

/** Busca visitas + perfis no servidor e (re)desenha as duas abas. */
async function carregarAdmin() {
  const resumo = $("#admin-visitas-resumo");
  if (!navigator.onLine) {
    if (resumo) resumo.textContent = "Sem conexão — o painel precisa de internet para carregar.";
    return;
  }
  if (resumo) resumo.textContent = "Carregando…";
  try {
    [adminVisitas, adminPerfis] = await Promise.all([listarTodasVisitas(), listarPerfis()]);
  } catch (e) {
    console.warn("Falha ao carregar o painel admin:", e);
    if (resumo) resumo.textContent = "Falha ao carregar. Tente novamente.";
    return;
  }
  preencherFiltroTecnicos();
  renderizarAdminVisitas();
  renderizarAdminUsuarios();
}

/** Popula o seletor de técnicos com quem tem visitas. */
function preencherFiltroTecnicos() {
  const sel = $("#admin-filtro-tecnico");
  if (!sel) return;
  const atual = sel.value;
  const ids = [...new Set(adminVisitas.map((v) => v.tecnico_id))];
  sel.innerHTML = '<option value="">Todos os técnicos</option>';
  ids.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = nomeTecnico({ tecnico_id: id, dados: adminVisitas.find((v) => v.tecnico_id === id)?.dados });
    sel.appendChild(opt);
  });
  sel.value = atual; // preserva a seleção se ainda existir
}

/** Aplica os filtros e desenha a lista de todas as visitas. */
function renderizarAdminVisitas() {
  const lista = $("#admin-lista-visitas");
  const vazio = $("#admin-visitas-vazio");
  const resumo = $("#admin-visitas-resumo");
  if (!lista) return;

  const termo = ($("#admin-busca")?.value || "").trim().toLowerCase();
  const fTecnico = $("#admin-filtro-tecnico")?.value || "";
  const fStatus = $("#admin-filtro-status")?.value || "";

  const filtradas = adminVisitas.filter((v) => {
    if (fTecnico && v.tecnico_id !== fTecnico) return false;
    if (fStatus && v.status !== fStatus) return false;
    if (termo && !(v.cliente_razao || "").toLowerCase().includes(termo)) return false;
    return true;
  });

  lista.innerHTML = "";
  if (vazio) vazio.hidden = filtradas.length > 0;
  if (resumo) resumo.textContent = `${filtradas.length} de ${adminVisitas.length} visita(s).`;

  filtradas.forEach((v) => {
    const li = document.createElement("li");
    li.className = "visita-card";

    const info = document.createElement("div");
    info.className = "visita-card__abrir";

    const titulo = document.createElement("span");
    titulo.className = "visita-card__titulo";
    titulo.textContent = v.cliente_razao || "(sem razão social)";

    const meta = document.createElement("span");
    meta.className = "visita-card__meta";
    meta.textContent = `${nomeTecnico(v)} · ${formatarData(v.data_visita)} · ${v.dados?.setores?.length || 0} setor(es)`;

    const badge = document.createElement("span");
    badge.className = `badge badge--${v.status}`;
    badge.textContent = STATUS_ROTULO[v.status] || v.status;

    info.append(titulo, meta, badge);

    const relatorio = document.createElement("button");
    relatorio.type = "button";
    relatorio.className = "visita-card__relatorio";
    relatorio.setAttribute("aria-label", "Gerar relatório (PDF)");
    relatorio.title = "Gerar relatório (PDF)";
    relatorio.textContent = "⎙";
    relatorio.addEventListener("click", () => gerarRelatorio(v.dados));

    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "visita-card__relatorio";
    editar.setAttribute("aria-label", "Editar visita");
    editar.title = "Editar visita";
    editar.textContent = "✎";
    editar.addEventListener("click", async () => {
      await abrirVisitaRemotaParaEdicao(v.dados);
      await abrirVisita(v.id);
      $("#tela-admin").hidden = true;
      entrarWizard();
    });

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "visita-card__excluir";
    excluir.setAttribute("aria-label", "Excluir visita");
    excluir.textContent = "✕";
    excluir.addEventListener("click", async () => {
      if (!confirm(`Excluir a visita de "${v.cliente_razao || "sem razão social"}" (técnico ${nomeTecnico(v)})? Esta ação não pode ser desfeita.`)) return;
      const ok = await excluirVisitaRemota(v.id);
      if (!ok) { alert("Não foi possível excluir no servidor."); return; }
      await excluirVisita(v.id); // remove a cópia local, se houver
      adminVisitas = adminVisitas.filter((x) => x.id !== v.id);
      renderizarAdminVisitas();
    });

    li.append(info, relatorio, editar, excluir);
    lista.appendChild(li);
  });
}

/** Desenha a aba de usuários com contagem de visitas e gestão de papéis. */
function renderizarAdminUsuarios() {
  const lista = $("#admin-lista-usuarios");
  const vazio = $("#admin-usuarios-vazio");
  if (!lista) return;
  lista.innerHTML = "";
  if (vazio) vazio.hidden = adminPerfis.length > 0;

  const meuId = usuarioAtual()?.id;

  adminPerfis.forEach((p) => {
    const n = adminVisitas.filter((v) => v.tecnico_id === p.user_id).length;
    const li = document.createElement("li");
    li.className = "visita-card";

    const info = document.createElement("div");
    info.className = "visita-card__abrir";

    const titulo = document.createElement("span");
    titulo.className = "visita-card__titulo";
    titulo.textContent = p.nome || "(sem nome)";

    const meta = document.createElement("span");
    meta.className = "visita-card__meta";
    meta.textContent = `${n} visita(s)${p.user_id === meuId ? " · você" : ""}`;

    const badge = document.createElement("span");
    badge.className = `badge badge--${p.papel === "admin" ? "concluida" : "rascunho"}`;
    badge.textContent = p.papel === "admin" ? "Admin" : "Técnico";

    info.append(titulo, meta, badge);

    const alternar = document.createElement("button");
    alternar.type = "button";
    alternar.className = "btn btn--secundario admin-papel-btn";
    const novoPapel = p.papel === "admin" ? "tecnico" : "admin";
    alternar.textContent = p.papel === "admin" ? "Tornar técnico" : "Tornar admin";
    alternar.addEventListener("click", async () => {
      if (p.user_id === meuId && novoPapel === "tecnico" &&
          !confirm("Você está removendo o seu próprio acesso de administrador. Continuar?")) return;
      alternar.disabled = true;
      try {
        await definirPapel(p.user_id, novoPapel);
        p.papel = novoPapel;
        if (p.user_id === meuId) {
          await obterPapel(true); // reavalia o próprio papel
          $("#btn-abrir-admin").hidden = !ehAdmin();
        }
        renderizarAdminUsuarios();
      } catch (e) {
        console.warn("Falha ao alterar papel:", e);
        alert("Não foi possível alterar o papel. Verifique se a policy de admin foi aplicada no banco.");
        alternar.disabled = false;
      }
    });

    li.append(info, alternar);
    lista.appendChild(li);
  });
}

/** Liga os controles do Painel Admin (uma vez, no boot). */
function inicializarAdmin() {
  $("#btn-abrir-admin")?.addEventListener("click", () => mostrarAdmin());
  $("#btn-admin-voltar")?.addEventListener("click", () => fecharAdmin());
  $("#btn-admin-atualizar")?.addEventListener("click", () => carregarAdmin());

  $("#admin-busca")?.addEventListener("input", renderizarAdminVisitas);
  $("#admin-filtro-tecnico")?.addEventListener("change", renderizarAdminVisitas);
  $("#admin-filtro-status")?.addEventListener("change", renderizarAdminVisitas);

  document.querySelectorAll(".admin-aba").forEach((aba) => {
    aba.addEventListener("click", () => {
      document.querySelectorAll(".admin-aba").forEach((a) => {
        const ativa = a === aba;
        a.classList.toggle("admin-aba--ativa", ativa);
        a.setAttribute("aria-selected", ativa ? "true" : "false");
      });
      const alvo = aba.dataset.aba;
      $("#admin-painel-visitas").hidden = alvo !== "visitas";
      $("#admin-painel-usuarios").hidden = alvo !== "usuarios";
    });
  });
}

/** Exibe a tela inicial e esconde o assistente. */
async function mostrarInicio() {
  await renderizarListaVisitas();
  await atualizarStatusSync();
  $("#tela-inicio").hidden = false;
  $("#tela-admin").hidden = true;
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
  sincronizarAgora(); // sincroniza em segundo plano ao entrar

  // Resolve o papel e revela o Painel Admin apenas para administradores.
  obterPapel().then(() => {
    const btn = $("#btn-abrir-admin");
    if (btn) btn.hidden = !ehAdmin();
  });
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
    limparPapel();
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
  inicializarAdmin();

  btnAvancar.addEventListener("click", () => {
    const passoAtual = PASSOS[indiceAtual];
    if (passoAtual === "encerramento") {
      if (finalizarVisita()) {
        btnAvancar.hidden = true;
        btnVoltar.hidden = true;
        sincronizarAgora(); // envia a visita concluída
      }
      return;
    }
    if (!podeAvancarDe(passoAtual)) return;
    irPara(indiceAtual + 1);
  });

  btnVoltar.addEventListener("click", () => irPara(indiceAtual - 1));

  // Voltar à lista de visitas (salva o que estiver aberto e sincroniza).
  btnInicio.addEventListener("click", async () => {
    await salvar();
    await mostrarInicio();
    sincronizarAgora();
  });

  // Sincronização manual.
  $("#btn-sincronizar").addEventListener("click", () => sincronizarAgora());

  // Sincroniza automaticamente ao reconectar.
  window.addEventListener("online", () => sincronizarAgora());
  window.addEventListener("offline", () => atualizarStatusSync());

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
