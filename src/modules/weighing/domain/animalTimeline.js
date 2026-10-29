// Linha do tempo de UM animal (P05, P07 — missão pesagens-integrada).
//
// Regra única usada por createEntry, updateEntry, edição coletiva, repesagem e importação: valida a
// SÉRIE INTEIRA depois da mudança proposta, não só o evento novo. Assim mover o Cadastro para depois
// dos Manejos, mover a Saída para antes deles ou lançar dois Manejos oficiais no mesmo dia é recusado
// antes de gravar qualquer coisa (sem mutação parcial).
//
// Ordem canônica do mesmo dia (sem inventar horário): Cadastro → Manejo → Saída (EVENT_TYPE_RANK).
// Invariantes:
//   1. no máximo um Cadastro ativo; nenhum evento antes dele (dia anterior);
//   2. no máximo uma Saída ativa; nenhum evento depois dela (dia posterior; no mesmo dia a Saída é a última);
//   3. no máximo UMA pesagem oficial de Manejo por animal e dia (a troca é pela repesagem, que cancela a
//      anterior na mesma transação); Cadastro/Saída no mesmo dia de um Manejo continuam permitidos;
//   4. toda data é dia civil válido (30/02 é recusado).
import { parseCivilDate } from './brazilianValues.js';
import { compareWeighingEvents } from './weighingSeries.js';

export class TimelineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TimelineError';
    this.code = code;
  }
}

const tipoOf = (event) => event?.tipo_manejo ?? event?.legacy_payload?.tipo_manejo ?? event?.tipo_pesagem ?? null;
const dateOf = (event) => event?.data_pesagem ?? event?.legacy_payload?.data_pesagem ?? null;
const motivoOf = (event) => event?.motivo_saida ?? event?.legacy_payload?.motivo_saida ?? null;
const view = (event) => ({
  id: event.id,
  tipo_manejo: tipoOf(event),
  data_pesagem: dateOf(event),
  created_at: event.created_at ?? event.created_date ?? null,
  motivo_saida: motivoOf(event),
});
const brDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso || '');
};

function activeSeries(events, { upsert = [], removeIds = [] } = {}) {
  const removed = new Set((removeIds || []).map(String));
  const byId = new Map();
  for (const event of events || []) {
    if (!event || event.deleted_at || removed.has(String(event.id))) continue;
    byId.set(String(event.id), view(event));
  }
  for (const event of upsert || []) {
    if (!event) continue;
    byId.set(String(event.id), view(event));
  }
  return [...byId.values()];
}

/**
 * Violações das invariantes numa série (sem lançar). Cada uma traz `key` (código + ids envolvidos) para
 * comparar o antes e o depois da mudança.
 * @returns {{ code: string, key: string, ids: string[], message: string }[]}
 */
export function findTimelineViolations(seriesInput) {
  const series = [...seriesInput];
  const violations = [];
  const push = (code, ids, message) => violations.push({ code, ids, key: `${code}:${[...ids].sort().join(',')}`, message });

  const valid = [];
  for (const event of series) {
    if (!parseCivilDate(event.data_pesagem)) {
      push('TIMELINE_DATA_INVALIDA', [event.id], `Data inválida (${event.data_pesagem || 'vazia'}): use um dia que exista no calendário.`);
    } else valid.push(event);
  }
  valid.sort(compareWeighingEvents);

  const cadastros = valid.filter((event) => event.tipo_manejo === 'Cadastro');
  if (cadastros.length > 1) {
    push('TIMELINE_CADASTRO_DUPLICADO', cadastros.map((e) => e.id), `O animal já possui cadastro em ${brDate(cadastros[0].data_pesagem)}. Use a edição do cadastro existente.`);
  }
  const cadastro = cadastros[0] || null;
  if (cadastro) {
    for (const anterior of valid.filter((event) => event.data_pesagem < cadastro.data_pesagem)) {
      push('TIMELINE_ANTES_DO_CADASTRO', [cadastro.id, anterior.id], `O lançamento de ${brDate(anterior.data_pesagem)} ficaria antes do cadastro do animal (${brDate(cadastro.data_pesagem)}). O cadastro precisa ser o primeiro evento.`);
    }
  }

  const saidas = valid.filter((event) => event.tipo_manejo === 'Saída');
  if (saidas.length > 1) {
    const motivo = (saidas[0].motivo_saida || 'saída').toLowerCase();
    push('TIMELINE_SAIDA_DUPLICADA', saidas.map((e) => e.id), `O animal já possui ${motivo} em ${brDate(saidas[0].data_pesagem)}. Cancele ou corrija esse evento antes de lançar outro.`);
  }
  const saida = saidas[0] || null;
  if (saida) {
    const motivo = (saida.motivo_saida || 'saída').toLowerCase();
    for (const posterior of valid.filter((event) => event.data_pesagem > saida.data_pesagem)) {
      push('TIMELINE_DEPOIS_DA_SAIDA', [saida.id, posterior.id], {
        saida: `Existem lançamentos posteriores a ${brDate(saida.data_pesagem)} (${brDate(posterior.data_pesagem)}). Corrija ou cancele esses eventos antes de registrar a saída nessa data.`,
        posterior: `O animal já possui ${motivo} em ${brDate(saida.data_pesagem)}. Cancele ou corrija esse evento antes de lançar outro.`,
      });
    }
  }

  const manejosPorDia = new Map();
  for (const event of valid) {
    if (event.tipo_manejo !== 'Manejo') continue;
    const ids = manejosPorDia.get(event.data_pesagem) || [];
    ids.push(event.id);
    manejosPorDia.set(event.data_pesagem, ids);
  }
  for (const [dia, ids] of manejosPorDia) {
    if (ids.length > 1) push('TIMELINE_MANEJO_DUPLICADO', ids, `O animal já possui pesagem de Manejo em ${brDate(dia)}. Para trocar o peso, use a repesagem.`);
  }
  return violations;
}

const messageFor = (violation, changedIds) => {
  if (typeof violation.message === 'string') return violation.message;
  // Saída × evento posterior: a mensagem depende de qual dos dois a mudança mexeu.
  const [saidaId] = violation.ids;
  return changedIds.has(String(saidaId)) ? violation.message.saida : violation.message.posterior;
};

/**
 * Aplica a mudança na série ativa do animal e confere as invariantes. Só recusa o que a MUDANÇA cria:
 * anomalia que já estava gravada (ex.: dois Manejos no dia vindos de importação com duplicata aceita) não
 * trava lançamento em outra data — fica para a verificação de integridade.
 * @param {object[]} events eventos ATIVOS do animal (registros do banco ou view models)
 * @param {{ upsert?: object[], removeIds?: string[] }} change eventos novos/alterados e ids cancelados
 * @returns {object[]} a série resultante, na ordem canônica
 * @throws {TimelineError}
 */
export function validateAnimalTimeline(events = [], change = {}) {
  const before = new Set(findTimelineViolations(activeSeries(events)).map((v) => v.key));
  const after = activeSeries(events, change);
  const changedIds = new Set([...(change.upsert || []).filter(Boolean).map((e) => String(e.id)), ...(change.removeIds || []).map(String)]);
  const nova = findTimelineViolations(after).find((v) => !before.has(v.key));
  if (nova) throw new TimelineError(nova.code, messageFor(nova, changedIds));
  return [...after].sort(compareWeighingEvents);
}
