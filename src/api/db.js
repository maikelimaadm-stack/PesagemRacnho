// Armazenamento local do app: IndexedDB/Dexie (ver src/storage/storageAdapter.js).
// O antigo proxy `db.entities` (JSON via IPC) e os caminhos de arquivo do banco
// foram removidos no cutover Dexie — não existe mais arquivo de banco para abrir.
import storage from '../storage/storageAdapter.js';

export const DEFAULT_EMPRESA_ID = 'local';

export const ensureEmpresaId = () => {
  if (!localStorage.getItem('empresa_selecionada_id')) {
    localStorage.setItem('empresa_selecionada_id', DEFAULT_EMPRESA_ID);
  }
  return localStorage.getItem('empresa_selecionada_id');
};

/** Garante o armazenamento local pronto na primeira abertura (sem configuração). */
export const bootstrapLocalDb = async () => {
  ensureEmpresaId();
  try {
    await storage.ensureReady();
  } catch (err) {
    console.warn('[storage] ensureReady falhou:', err.message);
  }
  return true;
};

/** Abre a pasta de dados (backups/exportações) — via IPC de sistema de arquivos. */
export const openDataFolder = () => window.pesagemApp?.openDataFolder?.();

/** Limpa os dados somente com a evidência de um backup físico já validado. */
export const clearAllData = (safetyEvidence) => storage.clearAllData({ safetyEvidence });

ensureEmpresaId();
