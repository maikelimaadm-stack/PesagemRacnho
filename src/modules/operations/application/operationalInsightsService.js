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
  const sessions = await storage.sessoesPesagem.list({ data: date });
  const timestamp = new Date().toISOString();
  if (sessions.length) {
    // P17: lançar depois de fechar abre uma sessão nova na mesma data; fechar de novo fecha TODAS as
    // abertas da data (antes só a primeira — a segunda ficava aberta sem ninguém ver).
    const abertas = sessions.filter((session) => session.status !== 'FECHADA');
    const alvo = abertas.length ? abertas : [sessions[0]];
    let last = null;
    for (const session of alvo) {
      last = await storage.sessoesPesagem.update(session.id, {
        status: 'FECHADA',
        operador: session.operador || operator,
        fim: timestamp,
        justificativas: justifications,
      });
    }
    return last;
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
  const sessions = await storage.sessoesPesagem.list({ data: date });
  if (!sessions.length) throw new Error('Não existe sessão de pesagem para essa data.');
  // Reabre a sessão mais recente da data (uma só fica aberta para os próximos lançamentos).
  const existing = [...sessions].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
  return storage.sessoesPesagem.update(existing.id, { status: 'ABERTA', fim: null });
}

/** Registro do animal na store `animais` (ids de cadastro, categoria, era); null quando não existe. */
export async function getAnimalRecord(animalId) {
  if (!animalId) return null;
  try {
    return await storage.animais.get(String(animalId));
  } catch {
    return null;
  }
}
