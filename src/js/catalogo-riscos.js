/* =========================================================
   catalogo-riscos.js — Catálogo de agentes por grupo de risco.
   Base: Apêndice A de docs/01-arquitetura-e-estrutura-de-dados.md
   (grupos clássicos NR-09 / tabela de agentes nocivos do eSocial).
   [VERIFICAR VIGÊNCIA DA NORMA] antes de uso normativo formal.
   ========================================================= */

/** Metadados de exibição de cada grupo (rótulo + ícone acessível). */
export const GRUPOS = [
  { chave: "fisico", rotulo: "Físicos", icone: "🔊" },
  { chave: "quimico", rotulo: "Químicos", icone: "🧪" },
  { chave: "biologico", rotulo: "Biológicos", icone: "🦠" },
  { chave: "ergonomico", rotulo: "Ergonômicos", icone: "🧍" },
  { chave: "acidente", rotulo: "Acidentes", icone: "⚠️" },
];

/** Agentes sugeridos por grupo (autocompletam os toggles da Tela 3). */
export const CATALOGO_RISCOS = {
  fisico: [
    "Ruído contínuo ou intermitente",
    "Ruído de impacto",
    "Vibração de mãos e braços",
    "Vibração de corpo inteiro",
    "Calor",
    "Frio",
    "Umidade",
    "Radiação ionizante",
    "Radiação não-ionizante",
    "Pressões anormais",
  ],
  quimico: [
    "Poeiras minerais (sílica)",
    "Poeiras diversas",
    "Fumos metálicos",
    "Névoas",
    "Neblinas",
    "Gases",
    "Vapores",
    "Produtos químicos em geral",
  ],
  biologico: ["Vírus", "Bactérias", "Fungos", "Parasitas", "Bacilos"],
  ergonomico: [
    "Levantamento/transporte manual de peso",
    "Postura inadequada",
    "Esforço físico intenso",
    "Ritmo excessivo / monotonia",
    "Trabalho em turnos / noturno",
    "Jornada prolongada",
    "Mobiliário inadequado",
  ],
  acidente: [
    "Máquinas/equipamentos sem proteção",
    "Arranjo físico inadequado",
    "Eletricidade",
    "Incêndio / explosão",
    "Trabalho em altura",
    "Quedas (mesmo nível/diferença)",
    "Espaço confinado",
    "Animais peçonhentos",
    "Ferramentas defeituosas",
  ],
};
