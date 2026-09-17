// Fingerprint canônico de um evento importado (missão §33): empresa | animal | data | tipo |
// peso com 2 casas (vazio sem peso) [| ext:<id_externo>]. `animal` é o id resolvido ou, para
// animal ainda não criado, a chave de identidade do plano. Gravado em
// legacy_payload.import_fingerprint junto com importacao_id: é a evidência da origem de cada
// evento; a detecção de "JÁ EXISTE" compara a série do animal (vale também para eventos
// lançados à mão, que não têm fingerprint).
import { weightKey } from './importValues.js';

export function eventFingerprint({ empresaId = 'local', animalRef = '', data = '', tipo = '', peso = null, idExterno = null } = {}) {
  const parts = [empresaId || 'local', animalRef || '', data || '', tipo || '', weightKey(peso)];
  if (idExterno) parts.push(`ext:${idExterno}`);
  return parts.join('|');
}
