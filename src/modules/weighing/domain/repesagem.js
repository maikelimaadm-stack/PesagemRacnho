// M1 (1.5.0) — Repesagem no mesmo dia (docs/plano-mestre/M1-FUNDACAO-NUMERO.md §4). Regra pura, sem Dexie e sem
// React: a tela do Lançamento decide se abre o diálogo e o weighingService confere de novo antes de gravar.
//
// Animal que JÁ tem pesagem com peso na MESMA data: "Esse animal já foi pesado hoje. Repesar?"
//   - Repesar (substitui): cancela a pesagem anterior do dia com o motivo "repesagem" (fluxo de cancelamento de
//     sempre, com auditoria) e grava a nova — numa única transação (weighingDataAdapter.replaceEntries);
//   - Cancelar: não grava nada.
// Só a pesagem de MANEJO se repesa: o Cadastro é o nascimento do animal no sistema (corrige-se editando) e a Saída
// encerra a vida dele (cancelar a venda/abate para lançar outra não é repesagem). Nesses casos o Lançamento continua
// recusando o segundo lançamento do dia, como antes.
// GMD nunca é calculado entre duas pesagens do mesmo dia: a busca da anterior usa data estritamente menor
// (calculateWeightGain), e a repesagem só troca a pesagem do dia — a anterior de verdade continua a mesma.
import { sameAnimal } from '../../animals/domain/animalHistory.js';
import { measuredWeightOf } from './weighingSeries.js';

export const MOTIVO_REPESAGEM = 'repesagem';

export const TEXTOS_REPESAGEM = Object.freeze({
  pergunta: 'Esse animal já foi pesado hoje. Repesar?',
  confirmar: 'Repesar (substitui)',
  cancelar: 'Cancelar',
});

/** Linha do diálogo com o peso de hoje e o novo (os números chegam já formatados em pt-BR). */
export function repesagemResumo({ pesoAnterior, pesoNovo }) {
  return `Peso de hoje: ${pesoAnterior} kg. Novo peso: ${pesoNovo} kg. A pesagem de hoje é cancelada (motivo: ${MOTIVO_REPESAGEM}) e a nova passa a valer.`;
}

/** Aviso extra quando a pesagem de hoje levou vacina/medicamento: o cancelamento leva as aplicações junto (ADR-049). */
export function repesagemAvisoSanidade(quantidade) {
  if (!(quantidade > 0)) return null;
  return quantidade === 1
    ? 'A pesagem de hoje tem 1 aplicação de sanidade, que é cancelada junto. Lance de novo no painel Sanidade, se precisar.'
    : `A pesagem de hoje tem ${quantidade} aplicações de sanidade, que são canceladas junto. Lance de novo no painel Sanidade, se precisar.`;
}

/** Tipos de lançamento que a repesagem substitui (e que podem substituir). */
export const TIPOS_REPESAVEIS = Object.freeze(['Manejo']);

const civilDate = (value) => String(value || '').slice(0, 10);

/**
 * Lançamentos do mesmo animal na data do novo e se o novo pode substituí-los.
 * @param {{ entries: object[], animal: object, date: string, tipoManejo: string, peso: number|null }} input
 *   entries: pesagens ativas já carregadas (view model); animal: { animal_id, numero_animal, marca } do lançamento.
 * @returns {{ conflito: boolean, repesar: boolean, anteriores: object[] }}
 *   conflito  o animal já tem lançamento nessa data;
 *   repesar   todos eles são Manejo com peso e o novo também é Manejo com peso (abre o diálogo);
 *   anteriores os lançamentos do dia que a repesagem cancelaria.
 */
export function planSameDayReweigh({ entries = [], animal, date, tipoManejo, peso } = {}) {
  const day = civilDate(date);
  if (!animal || !day) return { conflito: false, repesar: false, anteriores: [] };
  const anteriores = entries.filter((entry) => entry && !entry.deleted_at && civilDate(entry.data_pesagem) === day && sameAnimal(entry, animal));
  if (!anteriores.length) return { conflito: false, repesar: false, anteriores };
  const novaRepesavel = TIPOS_REPESAVEIS.includes(tipoManejo) && measuredWeightOf({ peso }) !== null;
  const anterioresRepesaveis = anteriores.every((entry) => TIPOS_REPESAVEIS.includes(entry.tipo_manejo) && measuredWeightOf(entry) !== null);
  return { conflito: true, repesar: novaRepesavel && anterioresRepesaveis, anteriores };
}
