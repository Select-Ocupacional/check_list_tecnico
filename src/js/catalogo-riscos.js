/* =========================================================
   catalogo-riscos.js — Catálogo de agentes por grupo de risco.
   Base: Apêndice A de docs/01-arquitetura-e-estrutura-de-dados.md
   (grupos clássicos NR-09 / tabela de agentes nocivos do eSocial) +
   agentes do documento de riscos da Select (homologação).
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
    // Documento de riscos da Select
    "Temperaturas anormais (calor)",
    "Radiação solar",
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
    // Documento de riscos da Select
    "Óleo solúvel / óleo vegetal",
    "Produtos domissanitários",
    "Particulados não especificados (PNOS) — respiráveis",
    "Particulados totais",
    "Tolueno",
    "Hidrocarbonetos",
    "N-octano",
    "Nonano",
    "Ciclohexano",
    "Gasolina",
    "N-heptano",
    "N-hexano",
    "Ferro",
    "Manganês",
    "Cobre",
    "Cromo",
    "Chumbo",
    "Alumínio",
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
    // Documento de riscos da Select
    "Levantamento de peso até 10 kg",
    "Trabalho com teclado / digitação",
    "Alternância de posturas (em pé/sentado) intermitente",
    "Postura em pé por longos períodos",
    "Postura sentada por longos períodos",
    "Uso frequente de pedais",
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
    // Documento de riscos da Select
    "Queda de materiais sobre membros inferiores",
    "Queda com diferença de nível (escada fixa)",
    "Queda de nível diferente (escada portátil / tipo A)",
    "Acidente de trânsito / trajeto",
    "Atropelamento",
    "Queimaduras",
    "Choque elétrico",
    "Prensamento de membros superiores",
    "Perfuração ou corte de membros superiores",
    "Projeção de partículas/objetos nos olhos",
    "Uso de lixadeira / esmerilhadeira",
    "Uso de ar comprimido",
  ],
};
