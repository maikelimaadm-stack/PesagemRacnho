// Linhas canônicas do grão EVENT. Uma única transformação alimenta a Relação de Pesagens e os
// relatórios de pesagens: mesma deduplicação, mesmos nomes de cadastro, mesmos campos.
import { storageRecordToViewModel } from '../../../weighing/domain/weighingMapper.js';
import { pendenciesOf } from '../../../operations/domain/closingPendencies.js';

/**
 * Deduplica por id de domínio mantendo a linha ativa mais recente (maior localId).
 * O `id` de pesagem não é único no IndexedDB (chave primária é localId).
 */
export function dedupeById(rows) {
  const byId = new Map();
  const withoutId = [];
  for (const row of rows) {
    if (row.id === null || row.id === undefined) { withoutId.push(row); continue; }
    const current = byId.get(row.id);
    const localId = row._localId ?? row.localId ?? -1;
    if (!current || localId > (current._localId ?? current.localId ?? -1)) byId.set(row.id, row);
  }
  return [...byId.values(), ...withoutId];
}

const nameMap = (rows, label = (row) => row.nome) => new Map((rows || []).filter((row) => !row.deleted_at).map((row) => [row.id, label(row)]));

function sessionLabel(session) {
  const date = String(session.data || '').split('-').reverse().join('/');
  const status = session.status ? ` · ${String(session.status).toLowerCase()}` : '';
  return `${date}${status}`;
}

/** Mapas id → nome a partir das stores de cadastro (pequenas) e das entidades referenciadas. */
export function buildEventLookups({ marcas, racas, categorias, apartacoes, lotes, sessoes, usuarios, animais, salesPolicy = {} } = {}) {
  return {
    salesPolicy,
    marcas: nameMap(marcas),
    racas: nameMap(racas),
    categorias: nameMap(categorias),
    apartacoes: nameMap(apartacoes, (row) => row.nome_apartacao ?? row.nome),
    lotes: nameMap(lotes, (row) => row.nome_lote ?? row.nome),
    sessoes: nameMap(sessoes, sessionLabel),
    // Só o nome: nenhum outro campo de usuário entra em relatório.
    usuarios: nameMap(usuarios, (row) => row.nome ?? row.login ?? null),
    situacaoAnimal: new Map((animais || []).filter((row) => !row.deleted_at).map((row) => [row.id, row.situacao ?? null])),
  };
}

/**
 * View models (storageRecordToViewModel) → event rows enriquecidas. Função pura.
 * `documentCounts` conta pesagens por documento dentro da população recebida.
 */
export function enrichEventRows(viewModels, lookups = buildEventLookups()) {
  const rows = dedupeById(viewModels);
  const documentCounts = new Map();
  for (const row of rows) {
    if (row.documento_embarque_id) documentCounts.set(row.documento_embarque_id, (documentCounts.get(row.documento_embarque_id) || 0) + 1);
  }
  return rows.map((row) => ({
    ...row,
    marca_nome: row.marca_id ? lookups.marcas.get(row.marca_id) ?? null : null,
    raca_nome: row.raca_id ? lookups.racas.get(row.raca_id) ?? null : null,
    categoria_nome: row.categoria_id ? lookups.categorias.get(row.categoria_id) ?? null : null,
    lote_nome_atual: row.lote_id ? lookups.lotes.get(row.lote_id) ?? null : null,
    apartacao_nome_atual: row.apartacao_id ? lookups.apartacoes.get(row.apartacao_id) ?? null : null,
    sessao_label: row.sessao_id ? lookups.sessoes.get(row.sessao_id) ?? null : null,
    operador_nome: row.created_by_user_id ? lookups.usuarios.get(row.created_by_user_id) ?? null : null,
    situacao_atual: row.animal_id ? lookups.situacaoAnimal.get(row.animal_id) ?? null : null,
    doc_qtd: row.documento_embarque_id ? documentCounts.get(row.documento_embarque_id) : null,
    // Mesmas regras do Fechamento do Dia (closingPendencies).
    pendencias: pendenciesOf(row, lookups.salesPolicy).map((item) => item.type).join(', ') || null,
    embarque_vinculado: Boolean(row.embarque_id || row.documento_embarque_id),
  }));
}

/** Registro Dexie → view model com os campos de topo que o mapper não projeta. */
export function storageRowToEventViewModel(row) {
  const viewModel = storageRecordToViewModel(row);
  if (!viewModel) return null;
  return {
    ...viewModel,
    sessao_id: row.sessao_id ?? viewModel.sessao_id ?? null,
    created_by_user_id: row.created_by_user_id ?? null,
    tipo_pesagem: row.tipo_pesagem ?? null,
    empresa_id: viewModel.empresa_id ?? null,
  };
}
