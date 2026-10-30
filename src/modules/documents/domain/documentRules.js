// Documentos (F16) — puro. Metadados de GTA, NF-e, laudo, comprovante, certificado, evidência sanitária,
// romaneio ou outro, vinculados a operação, animal e/ou propriedade. O arquivo (opcional) não fica no banco:
// o documento guarda só o SHA-256, a extensão, o tamanho e o nome original do anexo guardado offline.
import { isFutureCivilDate, parseCivilDate } from '../../weighing/domain/brazilianValues.js';

export class DocumentError extends Error {
  constructor(message, erros = [message], code = 'DOCUMENTO_INVALIDO') {
    super(message);
    this.name = 'DocumentError';
    this.code = code;
    this.erros = erros;
  }
}

export const TIPOS_DOCUMENTO = Object.freeze(['GTA', 'NFE', 'ROMANEIO', 'LAUDO', 'COMPROVANTE', 'CERTIFICADO', 'EVIDENCIA_SANITARIA', 'OUTRO']);
export const TIPO_DOCUMENTO_LABELS = Object.freeze({
  GTA: 'GTA', NFE: 'NF-e', ROMANEIO: 'Romaneio', LAUDO: 'Laudo', COMPROVANTE: 'Comprovante',
  CERTIFICADO: 'Certificado', EVIDENCIA_SANITARIA: 'Evidência sanitária', OUTRO: 'Outro',
});
const EXTENSOES = Object.freeze(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'xml', 'txt', 'csv']);

const text = (v, max = 200) => {
  const t = v === null || v === undefined ? '' : String(v).trim();
  return t ? t.slice(0, max) : null;
};

export function validateAttachment(anexo) {
  if (!anexo) return null;
  const erros = [];
  if (!/^[a-f0-9]{64}$/.test(String(anexo.sha256 || ''))) erros.push('Anexo: identificador inválido.');
  const ext = String(anexo.ext || '').toLowerCase();
  if (!EXTENSOES.includes(ext)) erros.push('Anexo: tipo de arquivo não permitido.');
  if (!(Number(anexo.size) > 0)) erros.push('Anexo: tamanho inválido.');
  if (erros.length) throw new DocumentError(erros[0], erros);
  return { sha256: anexo.sha256, ext, size: Number(anexo.size), nome_original: text(anexo.nome_original, 120) };
}

export function validateDocumentInput(input = {}) {
  const erros = [];
  const tipo = String(input.tipo || '').toUpperCase();
  if (!TIPOS_DOCUMENTO.includes(tipo)) erros.push('Escolha o tipo do documento.');
  const data = parseCivilDate(input.data);
  if (!data) erros.push('Informe a data do documento.');
  else if (isFutureCivilDate(data)) erros.push('A data do documento não pode estar no futuro.');
  const vinculo = { operacao_id: text(input.operacao_id, 80), animal_id: text(input.animal_id, 80), propriedade_id: text(input.propriedade_id, 80) };
  if (!vinculo.operacao_id && !vinculo.animal_id && !vinculo.propriedade_id) erros.push('Vincule o documento a uma operação, um animal ou uma propriedade.');
  let anexo = null;
  try { anexo = validateAttachment(input.anexo); } catch (err) { erros.push(...err.erros); }
  if (erros.length) throw new DocumentError(erros[0], erros);
  return {
    tipo, numero: text(input.numero, 60), data, emissor: text(input.emissor), referencia: text(input.referencia), observacao: text(input.observacao, 500),
    ...vinculo,
    sha256: anexo?.sha256 ?? null, anexo_ext: anexo?.ext ?? null, anexo_tamanho: anexo?.size ?? null, anexo_nome: anexo?.nome_original ?? null,
    status: 'ATIVO',
  };
}

/** Objetos (sha256 + ext) dos anexos dos documentos — o que o backup completo precisa carregar. */
export function attachmentObjects(documentos = []) {
  const vistos = new Map();
  for (const d of documentos) {
    if (!d || !d.sha256 || !d.anexo_ext) continue;
    vistos.set(d.sha256, { sha256: d.sha256, ext: d.anexo_ext });
  }
  return [...vistos.values()];
}
