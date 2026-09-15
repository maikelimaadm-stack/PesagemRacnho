import storage from '../../../storage/storageAdapter.js';
import * as weighingService from '../../weighing/application/weighingService.js';
import * as apartacaoService from '../../auxiliary/application/apartacaoService.js';

export async function loadOperationalCatalog() {
  const [pesagens, apartacoes, lotes, animais, sessoes] = await Promise.all([
    weighingService.listEntries(),
    apartacaoService.listApartacoes(),
    apartacaoService.listLoteApartacoes(),
    storage.animais.list(),
    storage.sessoesPesagem.list(),
  ]);
  return { pesagens, apartacoes, lotes, animais, sessoes };
}

export async function closeWeighingDay(date, { operator = 'LOCAL', justifications = [] } = {}) {
  if (!date) throw new Error('Informe a data operacional.');
  const existing = (await storage.sessoesPesagem.list({ data: date }))[0];
  const timestamp = new Date().toISOString();
  if (existing) {
    return storage.sessoesPesagem.update(existing.id, {
      status: 'FECHADA',
      operador: existing.operador || operator,
      fim: timestamp,
      justificativas: justifications,
    });
  }
  return storage.sessoesPesagem.create({
    data: date,
    status: 'FECHADA',
    operador: operator,
    inicio: timestamp,
    fim: timestamp,
    justificativas: justifications,
  });
}

export async function reopenWeighingDay(date) {
  const existing = (await storage.sessoesPesagem.list({ data: date }))[0];
  if (!existing) throw new Error('Não existe sessão de pesagem para essa data.');
  return storage.sessoesPesagem.update(existing.id, { status: 'ABERTA', fim: null });
}

/** Registro do animal na store `animais` (ids de cadastro, nascimento, categoria); null quando não existe. */
export async function getAnimalRecord(animalId) {
  if (!animalId) return null;
  try {
    return await storage.animais.get(String(animalId));
  } catch {
    return null;
  }
}
