// Projeção das operações LEGADAS a partir das pesagens já gravadas (v9Backfill S3/S4) — pura.
//
// Cada Cadastro ativo vira item de uma operação de ENTRADA "LEGADO_CADASTRO" do mesmo dia; cada Saída
// ativa vira item de uma operação de SAÍDA do mesmo dia e motivo. Nada é inventado: sem parceiro, preço,
// frete nem documento (documento_situacao SEM_DOCUMENTO); comprador/frigorífico ficam como texto legado do
// item. O item guarda `origem_pesagem_id`: pesagem já convertida não gera outro item (idempotente).

const tipoOf = (row) => row?.legacy_payload?.tipo_manejo ?? row?.tipo_manejo ?? row?.tipo_pesagem ?? null;
const uiOf = (row) => (row && typeof row.legacy_payload === 'object' ? row.legacy_payload : {});

export const SUBTIPO_SAIDA_POR_MOTIVO = Object.freeze({
  Venda: 'VENDA',
  Abate: 'ABATE',
  Morte: 'MORTE',
  'Doação': 'DOACAO',
  'Transferência': 'TRANSFERENCIA_ENVIADA',
});

export function subtipoSaida(motivo) {
  return SUBTIPO_SAIDA_POR_MOTIVO[motivo] || 'SAIDA_SEM_MOTIVO';
}

/**
 * @param {object[]} pesagens registros do banco (ativos e cancelados)
 * @param {Set<string>} jaConvertidas ids de pesagem que já têm item de operação
 * @returns {{ operacoes: object[], itens: object[], ignoradas: number }}
 */
export function planLegacyOperations(pesagens = [], jaConvertidas = new Set()) {
  const grupos = new Map();
  let ignoradas = 0;
  for (const row of pesagens) {
    if (!row || row.deleted_at || !row.animal_id) continue;
    const tipo = tipoOf(row);
    if (tipo !== 'Cadastro' && tipo !== 'Saída') continue;
    if (jaConvertidas.has(String(row.id))) { ignoradas += 1; continue; }
    const ui = uiOf(row);
    const entrada = tipo === 'Cadastro';
    const subtipo = entrada ? 'LEGADO_CADASTRO' : subtipoSaida(ui.motivo_saida);
    const chave = `${entrada ? 'ENTRADA' : 'SAIDA'}|${row.data_pesagem}|${subtipo}`;
    const grupo = grupos.get(chave) || { tipo: entrada ? 'ENTRADA' : 'SAIDA', subtipo, data: row.data_pesagem, pesagens: [] };
    grupo.pesagens.push(row);
    grupos.set(chave, grupo);
  }
  const operacoes = [];
  const itens = [];
  for (const grupo of [...grupos.values()].sort((a, b) => String(a.data).localeCompare(String(b.data)) || a.tipo.localeCompare(b.tipo) || a.subtipo.localeCompare(b.subtipo))) {
    const operacaoId = crypto.randomUUID();
    operacoes.push({
      id: operacaoId,
      empresa_id: 'local',
      tipo: grupo.tipo,
      subtipo: grupo.subtipo,
      status: 'CONFIRMADA',
      data: grupo.data,
      origem: 'LEGADO',
      documento_situacao: 'SEM_DOCUMENTO',
      conciliacao: 'PENDENTE_CONCILIACAO',
      parceiro_id: null,
      propriedade_origem_id: null,
      propriedade_destino_id: null,
      quantidade_prevista: grupo.pesagens.length,
      observacao: grupo.tipo === 'ENTRADA'
        ? 'Gerada na atualização a partir dos Cadastros já lançados (sem documento nem valores).'
        : 'Gerada na atualização a partir das Saídas já lançadas (sem documento nem valores).',
    });
    for (const row of grupo.pesagens) {
      const ui = uiOf(row);
      const peso = Number(row.peso_kg ?? ui.peso);
      itens.push({
        id: crypto.randomUUID(),
        operacao_id: operacaoId,
        animal_id: row.animal_id,
        status: 'CONFIRMADO',
        pesagem_id: row.id,
        origem_pesagem_id: row.id,
        peso_kg: Number.isFinite(peso) && peso > 0 ? peso : null,
        peso_origem: Number.isFinite(peso) && peso > 0 ? 'PESAGEM_LEGADA' : null,
        texto_legado: grupo.tipo === 'SAIDA'
          ? [ui.comprador, ui.frigorifico, ui.destino_venda].filter(Boolean).join(' · ') || null
          : (ui.origem_animal || null),
      });
    }
  }
  return { operacoes, itens, ignoradas };
}
