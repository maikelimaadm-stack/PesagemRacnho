// Schema versionado do banco IndexedDB (Dexie) do app Pesagens Individuais.
// Campos de domínio estáveis (data_pesagem, animal_id etc.) preservam a
// compatibilidade dos registros locais entre versões do aplicativo.
export const DB_NAME = 'pesagens-individuais';
export const DB_VERSION = 6; // v6: remoção integral do domínio de sanidade
export const BACKUP_FORMAT = 'pesagens-individuais-indexeddb-backup';

// Cada store tem um localId autoincrement + id (uuid do domínio) indexado.
export const STORES = {
  pesagens:
    '++localId, id, data_pesagem, animal_id, [animal_id+data_pesagem], lote_id, embarque_id, sessao_id, tipo_pesagem, created_at, updated_at, deleted_at',
  apartacoes: '++localId, id, nome, created_at, updated_at, deleted_at',
  loteApartacoes: '++localId, id, apartacao_id, lote_id, created_at, updated_at, deleted_at',
  embarques: '++localId, id, data, status, created_at, updated_at, deleted_at',
  documentosEmbarque: '++localId, id, embarque_id, tipo, created_at, updated_at, deleted_at',
  animais: '++localId, &id, empresa_id, identificacao_normalizada, situacao, created_at, updated_at, deleted_at',
  lotes: '++localId, id, nome, created_at, updated_at',
  animalIdentificadores: '++localId, &id, animal_id, [tipo+valor_normalizado], ativo, created_at, updated_at, deleted_at',
  movimentosAnimais: '++localId, &id, animal_id, tipo, data_evento, lote_origem_id, lote_destino_id, created_at, updated_at, deleted_at',
  animalLotes: '++localId, &id, animal_id, lote_id, inicio, fim, created_at, updated_at, deleted_at',
  sessoesPesagem: '++localId, &id, data, status, operador, created_at, updated_at, deleted_at',
  auditoria: '++localId, &id, entidade, entidade_id, acao, created_at',
  importacoes: '++localId, &id, &arquivo_hash, status, created_at, updated_at',
  appSettings: 'key',
  backupHistory: '++localId, id, tipo, created_at',
};

// Definição da versão anterior necessária para o Dexie executar a migração
// v5 -> v6 e excluir fisicamente as três stores removidas.
export const STORES_V5 = {
  ...STORES,
  configuracoesSanidade: '++localId, &id, empresa_id, nome, tipo, ativo, created_at, updated_at, deleted_at',
  itensSanidade: '++localId, &id, configuracao_id, nome, ativo, created_at, updated_at, deleted_at',
  sanidadesAnimal: '++localId, &id, animal_id, pesagem_id, configuracao_id, data_aplicacao, status, created_at, updated_at, deleted_at',
};

export const REMOVED_STORES_V6 = {
  configuracoesSanidade: null,
  itensSanidade: null,
  sanidadesAnimal: null,
};

// Stores que guardam dados de domínio (entram no backup completo).
export const STORE_NAMES = Object.keys(STORES);

// Stores com o padrão soft-delete (deleted_at) e id de domínio.
export const DOMAIN_STORES = [
  'pesagens',
  'apartacoes',
  'loteApartacoes',
  'embarques',
  'documentosEmbarque',
  'animais',
  'lotes',
  'animalIdentificadores',
  'movimentosAnimais',
  'animalLotes',
  'sessoesPesagem',
  'auditoria',
  'importacoes',
];
