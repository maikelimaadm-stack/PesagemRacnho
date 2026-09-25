// Logo da propriedade (E1B 1.4.0): ajuste no navegador antes de gravar. Aceita só PNG ou
// JPG; desenha num canvas com no máximo 400 px de largura (proporção mantida, nunca
// amplia) e guarda como data URL PNG. Se passar de 300 KB, pinta o fundo de branco e
// tenta JPEG com qualidade decrescente (0,9 → 0,5); se ainda passar, recusa com mensagem
// simples. A leitura usa createImageBitmap ou <img> + blob: (o CSP do app permite
// blob:/data:). Imports relativos: o gate registry:property-header exercita a escolha de
// formato e as recusas em Node com um canvas de teste.
import { LOGO_MAX_BYTES, LOGO_MAX_WIDTH_PX, LOGO_MIME_TYPES, dataUrlBytes, fitWithin, isAcceptedLogo } from '../../modules/catalog/domain/propertyHeader.js';

export const LOGO_JPEG_QUALITIES = Object.freeze([0.9, 0.8, 0.7, 0.6, 0.5]);
export const LOGO_TYPE_MESSAGE = 'Escolha uma imagem PNG ou JPG.';
export const LOGO_READ_MESSAGE = 'Não foi possível abrir a imagem. Escolha outro arquivo PNG ou JPG.';
export const LOGO_TOO_BIG_MESSAGE = `O logo continua grande demais mesmo depois de ajustado (limite de ${LOGO_MAX_BYTES / 1024} KB). Use uma imagem mais simples.`;

export class LogoImageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LogoImageError';
    this.code = 'LOGO_INVALID';
  }
}

/** Só PNG ou JPEG (pelo tipo que o sistema informa do arquivo). */
export function isAcceptedLogoFile(file) {
  return Boolean(file) && LOGO_MIME_TYPES.includes(String(file.type || '').toLowerCase());
}

// Lê a imagem: createImageBitmap quando existe; senão <img> com URL blob: temporária.
async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
    } catch { /* tenta pelo <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('imagem ilegível'));
      img.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Escolhe o formato a partir de um canvas: PNG se couber em 300 KB; senão JPEG (fundo
 * branco, via `paintWhite`) com qualidade decrescente. Sem nenhum que caiba → erro.
 * @returns {{ dataUrl: string, formato: 'PNG'|'JPEG', qualidade: number|null, bytes: number }}
 */
export function encodeLogoCanvas(canvas, paintWhite = () => {}) {
  const png = canvas.toDataURL('image/png');
  if (isAcceptedLogo(png)) return { dataUrl: png, formato: 'PNG', qualidade: null, bytes: dataUrlBytes(png) };
  paintWhite();
  for (const qualidade of LOGO_JPEG_QUALITIES) {
    const jpeg = canvas.toDataURL('image/jpeg', qualidade);
    if (isAcceptedLogo(jpeg)) return { dataUrl: jpeg, formato: 'JPEG', qualidade, bytes: dataUrlBytes(jpeg) };
  }
  throw new LogoImageError(LOGO_TOO_BIG_MESSAGE);
}

/**
 * Arquivo escolhido → data URL pronto para gravar (≤ 400 px de largura, ≤ 300 KB).
 * `deps` só existe para o gate trocar a leitura e o canvas em Node.
 * @returns {Promise<{ dataUrl: string, width: number, height: number, formato: string, qualidade: number|null, bytes: number }>}
 */
export async function prepareLogoFromFile(file, { decode = decodeImage, makeCanvas = createCanvas } = {}) {
  if (!isAcceptedLogoFile(file)) throw new LogoImageError(LOGO_TYPE_MESSAGE);
  let image;
  try {
    image = await decode(file);
  } catch {
    throw new LogoImageError(LOGO_READ_MESSAGE);
  }
  try {
    if (!(image.width > 0) || !(image.height > 0)) throw new LogoImageError(LOGO_READ_MESSAGE);
    const { width, height } = fitWithin(image.width, image.height, LOGO_MAX_WIDTH_PX);
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new LogoImageError(LOGO_READ_MESSAGE);
    const draw = (fundo) => {
      context.clearRect(0, 0, width, height);
      if (fundo) {
        context.fillStyle = fundo;
        context.fillRect(0, 0, width, height);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image.source, 0, 0, width, height);
    };
    draw(null);
    // JPEG não tem transparência: o fundo branco evita o preto no lugar do transparente.
    const encoded = encodeLogoCanvas(canvas, () => draw('#ffffff'));
    return { ...encoded, width, height };
  } finally {
    image.release?.();
  }
}
