/* =========================================================
   catalogo-epi.js — Principais EPIs (NR-06 / Anexo I) e EPCs comuns.
   Sugestões para o campo de descrição (o técnico pode digitar um
   EPI/EPC que não esteja na lista).
   [VERIFICAR VIGÊNCIA DA NORMA] antes de uso normativo formal.
   ========================================================= */

export const EPIS_NR06 = [
  // Proteção da cabeça
  "Capacete de segurança",
  "Capuz / balaclava",
  // Proteção dos olhos e face
  "Óculos de segurança (incolor)",
  "Óculos de segurança (escuro)",
  "Óculos ampla visão (sobrepor)",
  "Protetor facial (face shield)",
  "Máscara de solda",
  // Proteção auditiva
  "Protetor auditivo tipo concha",
  "Protetor auditivo tipo plug (inserção)",
  // Proteção respiratória
  "Respirador descartável PFF1",
  "Respirador descartável PFF2",
  "Respirador descartável PFF3",
  "Respirador semifacial",
  "Respirador facial inteira",
  "Máscara com filtro para vapores/gases",
  // Proteção dos membros superiores
  "Luva de segurança (nitrílica)",
  "Luva de segurança (látex)",
  "Luva de segurança (vaqueta)",
  "Luva de segurança (raspa)",
  "Luva de segurança (malha de aço)",
  "Luva de segurança (PVC)",
  "Luva isolante para eletricidade",
  "Manga / mangote de proteção",
  "Creme protetor de segurança",
  // Proteção do tronco
  "Avental de raspa",
  "Avental de PVC",
  "Avental aluminizado",
  "Colete refletivo",
  "Vestimenta de proteção (macacão)",
  // Proteção dos membros inferiores
  "Calçado de segurança (com biqueira)",
  "Calçado de segurança (sem biqueira)",
  "Bota de PVC / borracha",
  "Perneira de segurança",
  // Proteção contra quedas
  "Cinturão de segurança tipo paraquedista",
  "Talabarte de segurança",
  "Trava-quedas",
];

/** EPCs (Equipamentos de Proteção Coletiva) comuns — várias NRs. */
export const EPCS_COMUNS = [
  // Ruído
  "Enclausuramento acústico",
  "Barreira / tratamento acústico",
  // Agentes químicos / ar
  "Sistema de exaustão / ventilação local",
  "Ventilação geral diluidora",
  "Cabine / biombo de solda",
  // Máquinas (NR-12)
  "Proteção fixa/móvel de máquina",
  "Dispositivo de parada de emergência",
  "Sensor / cortina de luz",
  // Quedas / altura
  "Guarda-corpo e rodapé",
  "Corrimão",
  "Rede de proteção contra quedas",
  "Piso antiderrapante",
  // Elétrico (NR-10)
  "Aterramento elétrico",
  "Dispositivo diferencial residual (DR)",
  "Bloqueio e etiquetagem (lockout/tagout)",
  // Incêndio / emergência
  "Extintor de incêndio",
  "Sistema de detecção e alarme de incêndio",
  "Chuveiro e lava-olhos de emergência",
  "Kit de contenção de vazamentos",
  // Sinalização
  "Sinalização de segurança",
];
