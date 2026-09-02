/* =========================================================
   sync.js — Sincronização das visitas (IndexedDB ↔ Supabase, SST-BE-3).
   Local-first: envia (push) as visitas com alterações locais e baixa (pull)
   as do servidor, mesclando por auditoria.atualizado_em (last-write-wins).
   Cada visita é um documento (coluna jsonb "dados"). Funciona offline:
   quando não há rede/sessão, apenas não sincroniza.
   ========================================================= */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { tokenAcesso, usuarioAtual } from "./auth.js";
import {
  listarVisitas as dbListar,
  obterVisita as dbObter,
  salvarVisita as dbSalvar,
} from "./db.js";
import { uploadBinario, ehDataUrl, ehCaminhoStorage, removerBinarios } from "./storage.js";

const REST = `${SUPABASE_URL}/rest/v1`;

async function cabecalhos(extra = {}) {
  const token = await tokenAcesso();
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

/** Uma visita tem alterações locais ainda não enviadas? */
export function pendente(v) {
  const a = v?.auditoria || {};
  return !a.sincronizado_em || a.sincronizado_em !== a.atualizado_em;
}

/** Quantas visitas locais estão pendentes de envio. */
export async function contarPendentes() {
  const vs = await dbListar();
  return (vs || []).filter(pendente).length;
}

/**
 * Migra os binários (fotos/assinaturas) que ainda são data URL para o Storage,
 * substituindo o ref pelo caminho. Mantém o data URL em cache local (offline).
 */
async function subirBinarios(v) {
  const uid = usuarioAtual()?.id;
  if (!uid) return;

  for (const setor of v.setores || []) {
    for (const funcao of setor.funcoes || []) {
      for (const risco of funcao.avaliacoes_risco || []) {
        for (const ev of risco.evidencias || []) {
          if (ehDataUrl(ev.arquivo_ref)) {
            const path = `${uid}/${v.id}/evidencias/${ev.id}.jpg`;
            await uploadBinario(path, ev.arquivo_ref);
            ev.arquivo_ref = path;
          }
        }
      }
    }
  }

  for (const a of v.assinaturas || []) {
    if (ehDataUrl(a.assinatura_ref)) {
      const path = `${uid}/${v.id}/assinaturas/${a.id}.png`;
      await uploadBinario(path, a.assinatura_ref);
      a.assinatura_ref = path;
    }
  }
}

/** Envia (upsert) uma visita ao servidor e marca como sincronizada localmente. */
async function enviarVisita(v) {
  await subirBinarios(v); // fotos/assinaturas vão para o Storage; ref vira caminho
  v.auditoria.sincronizado_em = v.auditoria.atualizado_em; // registra antes de enviar
  const linha = {
    id: v.id,
    status: v.status,
    data_visita: v.data_visita || null,
    cliente_razao: v.cliente?.razao_social || null,
    dados: v,
  };
  const resp = await fetch(`${REST}/visitas`, {
    method: "POST",
    headers: await cabecalhos({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(linha),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`push ${resp.status}: ${txt}`);
  }
  await dbSalvar(v); // persiste o sincronizado_em (sem alterar atualizado_em)
}

/** Baixa as visitas do servidor (RLS retorna só as do usuário). */
async function baixarVisitas() {
  const resp = await fetch(`${REST}/visitas?select=id,dados`, {
    headers: await cabecalhos(),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`pull ${resp.status}: ${txt}`);
  }
  return resp.json();
}

/** Reúne os caminhos de Storage (fotos e assinaturas) de uma visita. */
function coletarBinarios(v) {
  const paths = [];
  (v?.setores || []).forEach((s) =>
    (s.funcoes || []).forEach((f) =>
      (f.avaliacoes_risco || []).forEach((r) =>
        (r.evidencias || []).forEach((e) => { if (e.arquivo_ref) paths.push(e.arquivo_ref); })
      )
    )
  );
  (v?.assinaturas || []).forEach((a) => { if (a.assinatura_ref) paths.push(a.assinatura_ref); });
  return paths.filter(ehCaminhoStorage);
}

/** A visita possui fotos/assinaturas guardadas no Storage? */
export function visitaTemFotos(v) {
  return coletarBinarios(v).length > 0;
}

/** Exclui do Storage as fotos/assinaturas da visita. Retorna nº removido (0 se offline/erro). */
export async function excluirFotosVisitaRemota(v) {
  if (!navigator.onLine) return 0;
  try {
    return await removerBinarios(coletarBinarios(v));
  } catch (e) {
    console.warn("Falha ao excluir fotos da visita", v?.id, e);
    return 0;
  }
}

/** Exclui uma visita no servidor (best-effort). */
export async function excluirVisitaRemota(id) {
  if (!navigator.onLine) return false;
  try {
    const resp = await fetch(`${REST}/visitas?id=eq.${id}`, {
      method: "DELETE",
      headers: await cabecalhos({ Prefer: "return=minimal" }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Sincroniza: envia pendentes e baixa/mescla as remotas.
 * @returns {Promise<{ok:boolean, enviadas:number, baixadas:number, erros:number, motivo?:string}>}
 */
export async function sincronizar() {
  if (!navigator.onLine) return { ok: false, enviadas: 0, baixadas: 0, erros: 0, motivo: "offline" };
  const token = await tokenAcesso();
  if (!token) return { ok: false, enviadas: 0, baixadas: 0, erros: 0, motivo: "sem_sessao" };

  const r = { enviadas: 0, baixadas: 0, erros: 0 };

  // PUSH — envia as visitas com alterações locais.
  const locais = await dbListar();
  for (const v of (locais || []).filter(pendente)) {
    try {
      await enviarVisita(v);
      r.enviadas++;
    } catch (e) {
      console.warn("Falha ao enviar visita", v.id, e);
      r.erros++;
    }
  }

  // PULL — baixa e mescla (mantém a versão mais recente por atualizado_em).
  try {
    const remotas = await baixarVisitas();
    for (const item of remotas || []) {
      const rv = item.dados;
      if (!rv?.id) continue;
      const local = await dbObter(rv.id);
      if (!local) {
        await dbSalvar(rv);
        r.baixadas++;
        continue;
      }
      const la = local.auditoria?.atualizado_em || "";
      const ra = rv.auditoria?.atualizado_em || "";
      if (ra > la) {
        await dbSalvar(rv); // servidor mais novo
        r.baixadas++;
      }
      // local >= remoto: mantém o local (será enviado se estiver pendente)
    }
  } catch (e) {
    console.warn("Falha ao baixar visitas", e);
    r.erros++;
  }

  return { ok: r.erros === 0, ...r };
}
