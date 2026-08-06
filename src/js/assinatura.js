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
  }

  return {
    limpar,
    redimensionar,
    estaVazio: () => vazio,
    paraDataURL: () => canvas.toDataURL("image/png"),
  };
}
