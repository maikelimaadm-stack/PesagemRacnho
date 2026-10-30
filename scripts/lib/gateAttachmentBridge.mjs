// Ponte de anexos para os gates Node: mesma lógica dos handlers de electron/ipc/attachmentIpc.cjs, sobre o
// armazenamento real (attachmentStore.cjs) e o registro real de seleções (backupSelection.cjs), com o formato de
// resposta do wrapIpcHandler ({ ok, data } | { ok: false, error: { code, message, details } }).
// `falhas` permite injetar erro de gravação no preparo/efetivação (R02) sem tocar no código de produção.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { createAttachmentStore } = require('../../electron/ipc/attachmentStore.cjs');
const { createSelectionRegistry } = require('../../electron/ipc/backupSelection.cjs');
const { createCriticalStateStore } = require('../../electron/ipc/criticalState.cjs');

const wrap = (fn) => async (args) => {
  try { return { ok: true, data: await fn(args || {}) }; } catch (err) { return { ok: false, error: { code: err.code, message: err.message, details: err.details || {} } }; }
};
const objectsOf = (list) => (Array.isArray(list) ? list : []).map((o) => ({ sha256: o?.sha256, ext: o?.ext }));
const falhaGravacao = () => Object.assign(new Error('EIO: falha de gravação do anexo (simulada)'), { code: 'EIO' });

export function createGateAttachmentBridge(dataDir, { importar = null } = {}) {
  const store = createAttachmentStore(dataDir);
  const selecoes = createSelectionRegistry();
  const falhas = { preparo: false, efetivar: false, marcador: false };

  /** Simula o diálogo nativo: lê o arquivo escolhido e devolve o mesmo formato do processo principal. */
  function selecionar(filePath) {
    const bytes = readFileSync(filePath);
    const sel = selecoes.remember(filePath, bytes);
    return { canceled: false, fileName: filePath.split(/[\\/]/).pop(), payload: JSON.parse(bytes.toString('utf8')), selecao: sel.token, fileSha256: sel.sha256 };
  }

  const attachments = {
    selectAndImport: wrap(async () => (importar ? store.importFromPath(importar()) : { canceled: true })),
    verify: wrap(async ({ objects }) => store.verify(objectsOf(objects))),
    snapshot: wrap(async ({ backupFile, objects }) => store.snapshot(backupFile, objectsOf(objects))),
    verifyBackup: wrap(async ({ backupFile, objects }) => store.verifyBackup(backupFile, objectsOf(objects))),
    read: wrap(async ({ sha256, ext }) => store.readObject(sha256, ext)),
    preflightSelected: wrap(async ({ selecao, objects }) => {
      const sel = selecoes.resolve(selecao);
      return { arquivo: { fileName: sel.fileName, sha256: sel.sha256, size: sel.size }, conteudoSha256: sel.conteudoSha256, ...(objectsOf(objects).length ? store.verifyBackup(sel.fileName, objectsOf(objects), sel.dir) : { total: 0, ok: 0, faltando: [], corrompidos: [] }) };
    }),
    stage: wrap(async ({ selecao, objects, inline }) => {
      const antesDeCopiar = () => { if (falhas.preparo) throw falhaGravacao(); };
      if (Array.isArray(inline)) return store.stageInline(inline, { antesDeCopiar });
      const sel = selecoes.resolve(selecao);
      return store.stageFromBackup(sel.fileName, objectsOf(objects), sel.dir, { antesDeCopiar });
    }),
    commitStage: wrap(async ({ stageId, objects }) => store.commitStage(stageId, objectsOf(objects), { antesDeMover: () => { if (falhas.efetivar) throw falhaGravacao(); } })),
    discardStage: wrap(async ({ stageId }) => store.discardStage(stageId)),
  };

  // R3-01: o mesmo armazenamento do marcador crítico do processo principal (arquivo de nome fixo em dataDir).
  const critico = createCriticalStateStore(dataDir);
  const criticalState = {
    get: wrap(async () => critico.get()),
    set: wrap(async (input) => { if (falhas.marcador) throw Object.assign(new Error('ENOSPC: disco cheio (simulado)'), { code: 'ENOSPC' }); return critico.set(input); }),
    clear: wrap(async (input) => critico.clear(input)),
  };
  return { store, attachments, selecionar, falhas, criticalState, critico };
}
