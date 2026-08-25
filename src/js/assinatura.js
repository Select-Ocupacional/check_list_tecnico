/* =========================================================
   assinatura.js — Componente de assinatura digital em <canvas>.
   Suporta desenho com o dedo (touch) e mouse via Pointer Events,
   com escala para telas de alta densidade (devicePixelRatio).
   Offline-first: exporta a assinatura como Data URL (PNG), sem upload.
   ========================================================= */

/**
 * Inicializa um pad de assinatura sobre um elemento <canvas>.
 * @param {HTMLCanvasElement} canvas
 * @returns {{limpar:Function, estaVazio:Function, paraDataURL:Function, redimensionar:Function}}
 */
export function criarPadAssinatura(canvas) {
  const ctx = canvas.getContext("2d");
  let desenhando = false;
  let vazio = true;
  let ultimo = null;
  let modificado = false; // true quando o usuário desenhou/limpou após carregar

  /** Ajusta o buffer do canvas à densidade da tela. Deve rodar com o canvas visível. */
  function redimensionar() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return; // canvas ainda oculto — reagenda no show
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); // evita acúmulo de escala
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0D1B3E"; // navy institucional
    vazio = true;
  }

  function posicao(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function iniciar(ev) {
    ev.preventDefault();
    desenhando = true;
    ultimo = posicao(ev);
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* ignora */ }
  }

  function mover(ev) {
    if (!desenhando) return;
    ev.preventDefault();
    const p = posicao(ev);
    ctx.beginPath();
    ctx.moveTo(ultimo.x, ultimo.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo = p;
    vazio = false;
    modificado = true;
  }

  function terminar() {
    desenhando = false;
    ultimo = null;
  }

  canvas.addEventListener("pointerdown", iniciar);
  canvas.addEventListener("pointermove", mover);
  canvas.addEventListener("pointerup", terminar);
  canvas.addEventListener("pointercancel", terminar);
  canvas.addEventListener("pointerleave", terminar);

  /** Limpa o traçado. */
  function limpar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    vazio = true;
    modificado = true;
  }

  /**
   * Desenha uma assinatura já existente (Data URL ou URL) sobre o canvas, para
   * edição de uma visita salva. Carregar não conta como modificação — assim, se
   * o usuário não redesenhar, a referência original pode ser preservada.
   * @param {string} fonte Data URL ou URL da imagem da assinatura.
   */
  function carregar(fonte) {
    if (!fonte) return;
    const img = new Image();
    img.crossOrigin = "anonymous"; // evita "tainting" ao reexportar (URLs remotas com CORS)
    img.onload = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || canvas.width;
      const h = rect.height || canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      vazio = false;
      modificado = false;
    };
    img.onerror = () => { /* imagem indisponível: mantém o pad vazio */ };
    img.src = fonte;
  }

  return {
    limpar,
    carregar,
    redimensionar,
    estaVazio: () => vazio,
    foiModificado: () => modificado,
    paraDataURL: () => canvas.toDataURL("image/png"),
  };
}
