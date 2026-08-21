/* =========================================================
   validacao.js — Validações de integridade no dispositivo (princípio P4).
   Retorna mapas { campo: "mensagem" } para exibição inline.
   ========================================================= */

/** Mantém apenas dígitos de uma string. */
export function apenasDigitos(valor) {
  return (valor || "").replace(/\D/g, "");
}

/** Valida CNPJ (14 dígitos + dígitos verificadores). */
export function validarCnpj(valor) {
  const c = apenasDigitos(valor);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // rejeita sequências iguais

  const calc = (base) => {
    let soma = 0;
    let peso = base.length - 7;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dv1 = calc(c.slice(0, 12));
  const dv2 = calc(c.slice(0, 12) + dv1);
  return c.endsWith(`${dv1}${dv2}`);
}

/** Formata CNPJ para exibição: 00.000.000/0000-00. */
export function formatarCnpj(valor) {
  const c = apenasDigitos(valor).slice(0, 14);
  return c
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/**
 * Valida a Tela 1 (Identificação) a partir da visita.
 * @returns {Object<string,string>} mapa de erros por campo (vazio = OK).
 */
export function validarIdentificacao(visita) {
  const erros = {};
  const obrig = (valor, campo, msg) => {
    if (!valor || String(valor).trim() === "") erros[campo] = msg;
  };

  obrig(visita.data_visita, "data_visita", "Informe a data da visita.");
  obrig(visita.hora_inicio, "hora_inicio", "Informe a hora de início.");

  obrig(visita.cliente.razao_social, "razao_social", "Informe a razão social.");
  if (!validarCnpj(visita.cliente.cnpj)) {
    erros.cnpj = visita.cliente.cnpj
      ? "CNPJ inválido — confira os dígitos."
      : "Informe o CNPJ.";
  }

  obrig(visita.unidade.nome, "unidade_nome", "Informe o nome da unidade.");
  obrig(visita.unidade.endereco.logradouro, "logradouro", "Informe o logradouro.");
  obrig(visita.unidade.endereco.municipio, "municipio", "Informe o município.");
  const uf = visita.unidade.endereco.uf || "";
  if (!/^[A-Za-z]{2}$/.test(uf)) erros.uf = "UF com 2 letras.";

  obrig(visita.tecnico.nome, "tecnico_nome", "Informe o nome do técnico.");

  return erros;
}

/** Valida a Tela 2 (Setores): exige ao menos um setor. */
export function validarSetores(visita) {
  const erros = {};
  if (!Array.isArray(visita.setores) || visita.setores.length === 0) {
    erros.setores = "Cadastre ao menos um setor avaliado.";
  }
  return erros;
}

/** Formata CNAE (subclasse) para exibição: 0000-0/00. */
export function formatarCnae(valor) {
  const c = apenasDigitos(valor).slice(0, 7);
  return c
    .replace(/^(\d{4})(\d)/, "$1-$2")
    .replace(/^(\d{4})-(\d)(\d)/, "$1-$2/$3");
}

/** Formata telefone: (00) 0000-0000 (fixo) ou (00) 00000-0000 (celular). */
export function formatarTelefone(valor) {
  const c = apenasDigitos(valor).slice(0, 11);
  const p = [];
  if (c.length > 0) p.push("(" + c.slice(0, 2));
  if (c.length >= 2) p.push(") ");
  if (c.length > 2 && c.length <= 6) {
    p.push(c.slice(2));
  } else if (c.length > 6 && c.length <= 10) {
    p.push(c.slice(2, 6) + "-" + c.slice(6)); // fixo
  } else if (c.length > 6) {
    p.push(c.slice(2, 7) + "-" + c.slice(7)); // celular
  }
  return p.join("");
}

/** Formata CEP para exibição: 00000-000. */
export function formatarCep(valor) {
  const c = apenasDigitos(valor).slice(0, 8);
  return c.replace(/^(\d{5})(\d)/, "$1-$2");
}

/**
 * Valida a Tela 4 (Encerramento).
 * @param {object} dados { parecer, responsavelNome,
 *                          assinaturaTecnico, assinaturaResponsavel }
 *   As duas últimas são booleanas: true = assinatura coletada.
 * @returns {Object<string,string>} mapa de erros por campo.
 */
export function validarEncerramento(dados) {
  const erros = {};
  if (!dados.parecer || !dados.parecer.trim()) {
    erros.parecer = "Descreva o parecer técnico da visita.";
  }
  if (!dados.responsavelNome || !dados.responsavelNome.trim()) {
    erros.responsavel_nome = "Informe o nome do responsável.";
  }
  if (!dados.assinaturaTecnico) {
    erros.assinatura_tecnico = "Colete a assinatura do técnico.";
  }
  if (!dados.assinaturaResponsavel) {
    erros.assinatura_responsavel = "Colete a assinatura do responsável.";
  }
  return erros;
}
