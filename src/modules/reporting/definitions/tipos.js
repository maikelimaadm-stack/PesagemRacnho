// E1E — "Tipo Relatório" de todos os relatórios (docs/plano-mestre/E1E-TODOS-RELATORIOS-ESTILO-MAKGESTAO.md,
// item 3): os agrupamentos úteis de hoje — os antigos relatórios separados da 1.3.x (aliases da E1) — viram
// tipos nomeados, sempre com um tipo lista (Analítico). Só seleção (agrupamento, modo, totais, colunas, ordem e
// a população fixa de alguns); nenhuma conta nova: o motor da E1 faz tudo.
//
// Tipo resumido: a folha "resumo" (seções nos níveis de cima, tabela no nível folha, totais em linha de texto).
// Os totais do tipo são as colunas dele ("Colunas Painel": a pessoa escolhe quais aparecem, por tipo). Um
// estado antigo com parte desses totais continua sendo o tipo (reportViews.matchView).
// Tipo lista: Detalhado (a folha "lista": títulos de grupo, tabela e subtotal em linha de texto), com o seletor
// "Colunas" dele (E1F: todas as colunas do relatório; a escolha fica por tipo e usuário).
import { metricKeysOf } from '../domain/reportDefinition.js';

const levels = (groups) => groups.map((group) => (typeof group === 'string' ? { columnId: group } : { ...group }));

/**
 * Tipo resumido. `defaults` = chaves dos totais que aparecem sem escolha da pessoa (padrão: todas).
 * @param {string} id  id estável (vai para último estado, modelos e manifesto)
 * @param {(string|{columnId, direction?})[]} groups níveis (1 a 3)
 */
export function resumoTipo(id, label, groups, aggregates, { defaults, ...extra } = {}) {
  const keys = metricKeysOf(aggregates);
  return {
    id, label, mode: 'RESUMIDO', titleKind: 'Sintético', groups: levels(groups), aggregates: aggregates.map((spec) => ({ ...spec })),
    columnChoices: { available: keys, defaults: defaults ? [...defaults] : keys },
    ...extra,
  };
}

/**
 * Tipo lista (Detalhado): colunas, totais (subtotal e total geral) e ordem das linhas próprios.
 * E1F: `from` = colunas do relatório → o tipo ganha o seletor "Colunas" próprio (columnChoices: as do tipo
 * primeiro, depois as demais do relatório; só de cálculo fica fora) — a escolha fica guardada por tipo e por
 * usuário (report-type-columns), como nos tipos de Pesagens. Sem `from`, sem seletor (o "Colunas" genérico).
 */
export function listaTipo(id, label, { groups = [], columns, aggregates, sort, from, ...extra }) {
  const others = (from ?? []).filter((column) => !column.metricOnly && !columns.includes(column.id)).map((column) => column.id);
  return {
    id, label, mode: 'DETALHADO', titleKind: 'Analítico', groups: levels(groups), columns: [...columns],
    aggregates: aggregates.map((spec) => ({ ...spec })), ...(sort ? { sort: sort.map((item) => ({ ...item })) } : {}),
    ...(from ? { columnChoices: { available: [...columns, ...others], defaults: [...columns] } } : {}),
    ...extra,
  };
}
