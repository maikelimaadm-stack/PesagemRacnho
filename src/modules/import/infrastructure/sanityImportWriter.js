// Gravação de um lote de APLICAÇÕES DE SANIDADE do plano de importação (tipo SANIDADE).
// Um lote = UMA transação Dexie com as stores da sanidade, `animais`, `auditoria` e
// `importacoes`: qualquer aplicação inválida no meio do lote aborta a transação inteira e
// nada daquele lote é gravado.
//
// A montagem das linhas e da auditoria é a do PRÓPRIO serviço de sanidade
// (sanityDataAdapter.prepareApplicationRowsInTransaction): mesmas regras de referência
// (programa/medicamento existente e ativo), mesmo snapshot de nomes e mesma ação de
// auditoria CRIAR_APLICACAO_SANIDADE com o ator real. Nada é escrito na store por fora.
import {
  APLICACOES_STORE,
  MEDICAMENTOS_STORE,
  PROGRAMAS_STORE,
  prepareApplicationRowsInTransaction,
} from '../../sanity/infrastructure/sanityDataAdapter.js';
import { isPendingMasterId } from '../domain/sanityImportPlanner.js';
import { advanceJobInTransaction } from './importJobs.js';

export const SANITY_IMPORT_WRITE_STORES = Object.freeze([
  APLICACOES_STORE, PROGRAMAS_STORE, MEDICAMENTOS_STORE, 'animais', 'auditoria', 'importacoes',
]);

export class SanityImportWriteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SanityImportWriteError';
    this.code = code;
  }
}

/**
 * writeSanityImportBatch(db, { rows, job, empresaId }) → contagens do lote.
 * `rows` são linhas NOVO do plano (cada uma com `payload` já validado pelo dry-run).
 */
export async function writeSanityImportBatch(db, { rows, job, empresaId }) {
  const ts = new Date().toISOString();
  const tables = SANITY_IMPORT_WRITE_STORES.map((name) => db.table(name));
  const counters = { registros_criados: 0, aplicacoes_criadas: 0, animais_conciliados: 0 };
  await db.transaction('rw', tables, async () => {
    const created = [];
    const audits = [];
    const animals = new Set();
    for (const row of rows) {
      const payload = row?.payload;
      if (!payload) continue;
      // Id provisório de cadastro ausente nunca chega aqui: o serviço cria os cadastros e
      // refaz a análise antes de gravar. Se sobrar, o plano está velho.
      if (isPendingMasterId(payload.programa_sanidade_id) || isPendingMasterId(payload.medicamento_id)) {
        throw new SanityImportWriteError('IMPORT_STALE_PLAN', `A linha ${row.line} cita um cadastro de sanidade que ainda não existe; refaça a análise.`);
      }
      const animalId = String(payload.animal_id ?? '');
      const animal = (await db.table('animais').where('id').equals(animalId).toArray()).find((item) => !item.deleted_at);
      if (!animal) {
        throw new SanityImportWriteError('IMPORT_STALE_PLAN', `O animal da linha ${row.line} não existe mais; refaça a análise.`);
      }
      const prepared = await prepareApplicationRowsInTransaction(db, [payload], {
        animalId: animal.id,
        data: payload.data,
        sessaoId: null,
        pesagemId: null,
        empresaId,
        ts,
        origem: 'importacao',
      });
      created.push(...prepared.rows);
      audits.push(...prepared.audits);
      animals.add(String(animal.id));
    }
    if (created.length) await db.table(APLICACOES_STORE).bulkAdd(created.map((row) => ({ ...row })));
    if (audits.length) await db.table('auditoria').bulkAdd(audits);
    counters.registros_criados = created.length;
    counters.aplicacoes_criadas = created.length;
    counters.animais_conciliados = animals.size;
    await advanceJobInTransaction(db, job.id, counters, { lastKey: rows.at(-1)?.line ?? null, animals: animals.size });
  });
  return counters;
}
