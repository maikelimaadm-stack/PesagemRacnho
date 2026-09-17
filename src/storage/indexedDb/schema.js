// Schema versionado do banco IndexedDB (Dexie) do app Pesagens Individuais.
// Campos de domínio estáveis (data_pesagem, animal_id etc.) preservam a
// compatibilidade dos registros locais entre versões do aplicativo.
// Contrato: docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md (Programa 2.0).
export const DB_NAME = 'pesagens-individuais';
export const DB_VERSION = 8; // v8: sanidade mínima em stores próprias (ADR-049); v7: cadastros mestres, identidade, usuários (ADR-018/034)
export const BACKUP_FORMAT = 'pesagens-individuais-indexeddb-backup';

// ---------------------------------------------------------------------------
// v6 (1.1.17): referência histórica usada pela migração e pelos gates.
// ---------------------------------------------------------------------------
export const STORES_V6 = {
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

// Definição da v5 necessária para o Dexie executar a migração v5 -> v6 e
// excluir fisicamente as três stores de sanidade removidas.
export const STORES_V5 = {
  ...STORES_V6,
  configuracoesSanidade: '++localId, &id, empresa_id, nome, tipo, ativo, created_at, updated_at, deleted_at',
  itensSanidade: '++localId, &id, configuracao_id, nome, ativo, created_at, updated_at, deleted_at',
  sanidadesAnimal: '++localId, &id, animal_id, pesagem_id, configuracao_id, data_aplicacao, status, created_at, updated_at, deleted_at',
};

export const REMOVED_STORES_V6 = {
  configuracoesSanidade: null,
  itensSanidade: null,
  sanidadesAnimal: null,
};

// ---------------------------------------------------------------------------
// v7 (1.2.0): cadastros mestres como stores, identidade por marca_id,
// identificadores com tipo/validade, usuários locais, remoção da store `lotes`
// (sem uso; `loteApartacoes` é a canônica — ADR-023).
// ---------------------------------------------------------------------------
export const STORES_V7 = {
  // existentes
  pesagens:
    '++localId, id, data_pesagem, animal_id, [animal_id+data_pesagem], lote_id, embarque_id, sessao_id, tipo_pesagem, created_at, updated_at, deleted_at',
  apartacoes: '++localId, id, nome, ativo, created_at, updated_at, deleted_at',
  loteApartacoes: '++localId, id, apartacao_id, situacao, categoria_id, created_at, updated_at, deleted_at',
  embarques: '++localId, id, data, status, parceiro_id, created_at, updated_at, deleted_at',
  documentosEmbarque: '++localId, id, embarque_id, tipo, created_at, updated_at, deleted_at',
  animais:
    '++localId, &id, empresa_id, identificacao_normalizada, situacao, marca_id, raca_id, categoria_id, propriedade_id, lote_atual_id, ultima_pesagem_data, created_at, updated_at, deleted_at',
  animalIdentificadores:
    '++localId, &id, animal_id, tipo, [tipo+valor_normalizado], [marca_id+valor_normalizado], faixa_id, ativo, created_at, updated_at, deleted_at',
  movimentosAnimais: '++localId, &id, animal_id, tipo, data_evento, lote_origem_id, lote_destino_id, created_at, updated_at, deleted_at',
  animalLotes: '++localId, &id, animal_id, lote_id, inicio, fim, created_at, updated_at, deleted_at',
  sessoesPesagem: '++localId, &id, data, [data+local], status, operador, operador_usuario_id, created_at, updated_at, deleted_at',
  auditoria: '++localId, &id, entidade, entidade_id, acao, usuario_id, created_at',
  importacoes: '++localId, &id, &arquivo_hash, status, created_at, updated_at',
  appSettings: 'key',
  backupHistory: '++localId, id, tipo, created_at',
  // cadastros mestres (ADR-018)
  marcas: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  racas: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  categoriasAnimal: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  parceiros: '++localId, &id, empresa_id, nome_normalizado, documento, *papeis, ativo, created_at, updated_at, deleted_at',
  propriedades: '++localId, &id, empresa_id, nome_normalizado, tipo, parceiro_id, ativo, created_at, updated_at, deleted_at',
  causasMorte: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  // estoque de identificadores (ADR-019)
  faixasIdentificadores: '++localId, &id, empresa_id, tipo, marca_id, situacao, ativo, created_at, updated_at, deleted_at',
  excecoesIdentificadores: '++localId, &id, faixa_id, [faixa_id+numero], motivo, created_at, updated_at, deleted_at',
  // autenticação local (ADR-043) — hash/salt nunca indexados
  usuarios: '++localId, &id, empresa_id, &login_normalizado, role, ativo, created_at, updated_at, deleted_at',
};

export const REMOVED_STORES_V7 = {
  lotes: null,
};

// ---------------------------------------------------------------------------
// v8 (ADR-049): sanidade mínima operacional. Versão ADITIVA: só acrescenta três
// stores (nenhuma removida, nenhum índice alterado nas existentes). Os nomes são
// DIFERENTES dos da v5 (configuracoesSanidade/itensSanidade/sanidadesAnimal
// continuam removidas): backup antigo com as stores v5 é ignorado no restore em
// vez de despejar linhas no formato legado dentro das stores novas.
// NUNCA editar STORES_V7 no lugar: o Dexie "remendaria" o esquema sem backup
// pré-migração nem estado técnico (preflight CURRENT-SCHEMA.md §3.6).
// ---------------------------------------------------------------------------
export const STORES_V8 = {
  ...STORES_V7,
  // cadastros de sanidade (preservados por "Limpar dados operacionais")
  programasSanidade: '++localId, &id, empresa_id, nome_normalizado, tipo, ativo, ordem, created_at, updated_at, deleted_at',
  medicamentos: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  // aplicações por animal: fato histórico (cancelado, nunca apagado; store operacional)
  aplicacoesSanidade:
    '++localId, &id, empresa_id, animal_id, data, [animal_id+data], programa_sanidade_id, medicamento_id, pesagem_id, sessao_id, cancelled_at, created_at, updated_at, deleted_at',
};

// Stores acrescentadas pela v8 (serviço de sanidade, migração, integridade e gates).
export const SANITY_REGISTRY_STORES = Object.freeze(['programasSanidade', 'medicamentos']);
export const SANITY_APPLICATIONS_STORE = 'aplicacoesSanidade';
export const SANITY_STORES = Object.freeze([...SANITY_REGISTRY_STORES, SANITY_APPLICATIONS_STORE]);

// Esquema vigente.
export const STORES = STORES_V8;

// Stores que entram no backup completo (todas as vigentes).
export const STORE_NAMES = Object.keys(STORES);

// Stores com o padrão soft-delete (deleted_at) e id de domínio.
export const DOMAIN_STORES = STORE_NAMES.filter((name) => !['appSettings', 'backupHistory'].includes(name));

// Stores de cadastro mestre (preservadas por "Limpar dados operacionais" — ADR-032).
// v8 (ADR-049): programas de sanidade e medicamentos são cadastros e sobrevivem à
// limpeza; `aplicacoesSanidade` é operacional e é apagada junto com as pesagens.
export const MASTER_REGISTRY_STORES = [
  'marcas',
  'racas',
  'categoriasAnimal',
  'parceiros',
  'propriedades',
  'causasMorte',
  'faixasIdentificadores',
  'excecoesIdentificadores',
  ...SANITY_REGISTRY_STORES,
];

// Stores de segurança/configuração preservadas por qualquer limpeza não destrutiva.
export const PROTECTED_STORES = ['usuarios', 'appSettings', 'backupHistory'];

// Store de usuários locais (ADR-043) e papéis (ADR-042).
export const USERS_STORE = 'usuarios';
export const USUARIO_ROLES = ['ADMIN', 'GESTOR', 'OPERADOR', 'CONSULTA'];

// Enumerações do contrato de dados (docs 12 §3).
export const ANIMAL_SITUACOES = ['ATIVO', 'VENDIDO', 'ABATIDO', 'MORTO', 'DOADO', 'TRANSFERIDO', 'CANCELADO', 'INATIVO'];
export const IDENTIFICADOR_TIPOS = ['VISUAL', 'RFID', 'SISBOV', 'MANEJO', 'TEMPORARIO', 'LEGADO'];
export const SESSAO_STATUS = ['ABERTA', 'CONFERENCIA', 'FECHADA', 'CANCELADA'];
export const LOTE_SITUACOES = ['ABERTO', 'FECHADO'];
export const PARCEIRO_PAPEIS = ['COMPRADOR', 'VENDEDOR', 'FRIGORIFICO', 'TRANSPORTADOR', 'PROPRIETARIO'];
export const USUARIO_PERFIS = USUARIO_ROLES; // alias legado (revisão 1)
export const FAIXA_TIPOS = ['VISUAL', 'RFID', 'SISBOV', 'MANEJO'];
export const FAIXA_SITUACOES = ['ATIVA', 'ESGOTADA', 'BLOQUEADA'];
export const EXCECAO_MOTIVOS = ['USADO_FORA_DE_ORDEM', 'PERDIDO', 'DANIFICADO', 'RESERVADO', 'DEVOLVIDO'];
