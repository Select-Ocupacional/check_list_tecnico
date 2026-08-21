/* =========================================================
   tabela-cnae-nr04.js — Grau de risco por CNAE (Quadro I da NR-04).

   ⚠️ [VERIFICAR VIGÊNCIA DA NORMA] — [AGUARDA TABELA OFICIAL COMPLETA]
   O mapa abaixo é uma AMOSTRA ILUSTRATIVA, apenas para demonstrar o
   mecanismo de preenchimento automático. NÃO é a tabela oficial e os
   valores DEVEM ser validados/substituídos pelo Quadro I da NR-04 vigente
   (gov.br/trabalho) antes de uso em produção.

   Formato da chave: CNAE subclasse com 7 dígitos (só números).
   Ex.: "2599-3/99" -> "2599399".
   ========================================================= */

export const GRAU_POR_CNAE = {
  // --- EXEMPLOS NÃO VALIDADOS (substituir pela tabela oficial) ---
  "2599399": 3, // Fabricação de outros produtos de metal
  "2512800": 3, // Fabricação de esquadrias de metal
  "4120400": 3, // Construção de edifícios
  "8610101": 3, // Atividades de atendimento hospitalar
  "5611201": 2, // Restaurantes e similares
  "4711302": 2, // Comércio varejista de mercadorias (hiper/supermercados)
  "6201501": 1, // Desenvolvimento de programas de computador sob encomenda
};

/**
 * Retorna o grau de risco (1..4) para um CNAE, ou null se não encontrado.
 * @param {string} cnae CNAE (com ou sem máscara)
 */
export function grauPorCnae(cnae) {
  const digitos = String(cnae || "").replace(/\D/g, "");
  if (digitos.length !== 7) return null;
  return GRAU_POR_CNAE[digitos] ?? null;
}
