/* =========================================================
   imagem.js — Compressão de imagem no dispositivo (SST-15).
   Redimensiona e recomprime a foto (JPEG) para caber bem no
   IndexedDB, mantendo o funcionamento offline. Sem dependências.
   ========================================================= */

/**
 * Lê um arquivo de imagem, redimensiona (lado máximo) e recomprime em JPEG.
 * @param {File} file arquivo escolhido/capturado
 * @param {number} maxLado dimensão máxima (px) do maior lado
 * @param {number} qualidade 0..1 (JPEG)
 * @returns {Promise<string>} Data URL (image/jpeg)
 */
export function comprimirImagem(file, maxLado = 1280, qualidade = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Falha ao carregar a imagem."));
      img.onload = () => {
        let { width, height } = img;
        if (Math.max(width, height) > maxLado) {
          if (width >= height) {
            height = Math.round((height * maxLado) / width);
            width = maxLado;
          } else {
            width = Math.round((width * maxLado) / height);
            height = maxLado;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", qualidade));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
