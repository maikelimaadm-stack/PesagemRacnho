// Inventário conciliado (F17) — puro, a partir do livro de movimentos (`movimentosAnimais`, natureza v9).
//
//   saldo_inicial + entradas + nascimentos − saídas − mortes ± ajustes = saldo_final
//
// Conta EVENTOS na data (não o status atual): o saldo de 31/03 é o rebanho de 31/03, mesmo que o animal tenha
// sido vendido depois. Cancelados não contam (só movimentos ativos chegam aqui). Transferência INTERNA (lote,
// propriedade própria) não é entrada/saída do rebanho; só aparece quando o filtro é por lote ou propriedade
// (recebida/enviada). A conferência compara o saldo do livro com os animais presentes na data pelo cadastro
// (entrada e data de saída) e lista as divergências por animal — nada é corrigido em silêncio.
import { naturezaDe } from './movementNature.js';

export const CLASSES_ENTRADA = Object.freeze(['COMPRA', 'TRANSFERENCIA_RECEBIDA', 'NASCIMENTO', 'AJUSTE_ENTRADA', 'CADASTRO_LEGADO']);
export const CLASSES_SAIDA = Object.freeze(['VENDA', 'ABATE', 'TRANSFERENCIA_ENVIADA', 'MORTE', 'DOACAO', 'AJUSTE_SAIDA', 'SAIDA_SEM_MOTIVO']);
export const CLASSE_LABELS = Object.freeze({
  COMPRA: 'Compras',
  TRANSFERENCIA_RECEBIDA: 'Transferências recebidas',
  NASCIMENTO: 'Nascimentos',
  AJUSTE_ENTRADA: 'Ajustes (entrada)',
  CADASTRO_LEGADO: 'Cadastros sem tipo de entrada',
  VENDA: 'Vendas',
  ABATE: 'Abates',
  TRANSFERENCIA_ENVIADA: 'Transferências enviadas',
  MORTE: 'Mortes',
  DOACAO: 'Doações',
  AJUSTE_SAIDA: 'Ajustes (saída)',
  SAIDA_SEM_MOTIVO: 'Saídas sem motivo',
});

const ENTRADA_POR_TIPO = {
  entrada: 'CADASTRO_LEGADO', compra: 'COMPRA', nascimento: 'NASCIMENTO',
  'transferência recebida': 'TRANSFERENCIA_RECEBIDA', 'transferencia recebida': 'TRANSFERENCIA_RECEBIDA',
  'ajuste de entrada': 'AJUSTE_ENTRADA',
};
const SAIDA_POR_TIPO = {
  venda: 'VENDA', abate: 'ABATE', morte: 'MORTE', 'doação': 'DOACAO', doacao: 'DOACAO',
  'transferência': 'TRANSFERENCIA_ENVIADA', transferencia: 'TRANSFERENCIA_ENVIADA',
  'transferência enviada': 'TRANSFERENCIA_ENVIADA', 'transferencia enviada': 'TRANSFERENCIA_ENVIADA',
  outros: 'AJUSTE_SAIDA', 'ajuste de saída': 'AJUSTE_SAIDA', 'ajuste de saida': 'AJUSTE_SAIDA',
  'saída': 'SAIDA_SEM_MOTIVO', saida: 'SAIDA_SEM_MOTIVO',
};
const SUBTIPO_PARA_CLASSE = { LEGADO_CADASTRO: 'CADASTRO_LEGADO' };

/** Dia civil anterior (AAAA-MM-DD). */
export function previousDay(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function classify(movimento, natureza, operacoesPorId) {
  const operacao = movimento.operacao_id ? operacoesPorId.get(movimento.operacao_id) : null;
  const lista = natureza === 'ENTRADA' ? CLASSES_ENTRADA : CLASSES_SAIDA;
  if (operacao) {
    const classe = SUBTIPO_PARA_CLASSE[operacao.subtipo] || operacao.subtipo;
    if (lista.includes(classe)) return classe;
  }
  const tipo = String(movimento.tipo || '').trim().toLowerCase();
  if (natureza === 'ENTRADA') return ENTRADA_POR_TIPO[tipo] || 'CADASTRO_LEGADO';
  return SAIDA_POR_TIPO[tipo] || 'SAIDA_SEM_MOTIVO';
}

const zeros = (lista) => Object.fromEntries(lista.map((classe) => [classe, 0]));
const within = (date, from, to) => date >= from && date <= to;

/** Local desconhecido na data (R06): o animal NÃO entra no saldo de nenhuma propriedade nesse intervalo. */
export const LOCAL_INDETERMINADO = 'INDETERMINADO';

/**
 * Presença numa dimensão de local (lote ou propriedade) como intervalos [inicio, fim).
 * R06: a propriedade é a DA DATA, pelo livro — destino da entrada, depois as movimentações internas. Sem destino
 * na entrada, vale a origem da 1ª movimentação; sem nenhum registro, o local é INDETERMINADO (antes caía na
 * propriedade ATUAL do animal, que pode ter mudado depois). Única exceção: se só existiu uma propriedade no
 * cadastro (`propriedadeUnica`), não há outra possível.
 */
function locationStays(dimensao, animal, ledger, animalLotes, { propriedadeUnica = null } = {}) {
  if (dimensao === 'lote_id') {
    return animalLotes.filter((row) => row.animal_id === animal.id)
      .map((row) => ({ valor: row.lote_id, inicio: row.inicio, fim: row.fim || null }));
  }
  const entrada = ledger.find((ev) => ev.natureza === 'ENTRADA');
  if (!entrada) return [];
  const mudancas = ledger.filter((ev) => ev.natureza === 'INTERNA' && ev.mov.propriedade_destino_id);
  let atual = entrada.mov.propriedade_destino_id || mudancas[0]?.mov.propriedade_origem_id || propriedadeUnica || LOCAL_INDETERMINADO;
  const stays = [];
  let aberta = { valor: atual, inicio: entrada.data, fim: null };
  stays.push(aberta);
  for (const ev of ledger) {
    if (ev.natureza === 'INTERNA' && ev.mov.propriedade_destino_id && ev.mov.propriedade_destino_id !== atual) {
      aberta.fim = ev.data;
      atual = ev.mov.propriedade_destino_id;
      aberta = { valor: atual, inicio: ev.data, fim: null };
      stays.push(aberta);
    } else if (ev.natureza === 'SAIDA' && !aberta.fim) {
      aberta.fim = ev.data;
    }
  }
  return stays;
}

const stayAt = (stays, valor, date) => stays.some((s) => s.valor === valor && s.inicio <= date && (!s.fim || s.fim > date));

/**
 * @param {{ animais, movimentos, operacoes, animalLotes, cadastros, propriedadesIds? }} fontes (só registros ativos;
 *   `propriedadesIds`: todas as propriedades já cadastradas, inclusive inativas/excluídas)
 * @param {{ from: string, to: string, filtros?: { sexo?, raca_id?, categoria_id?, marca_id?, lote_id?, propriedade_id? } }} opcoes
 */
export function computeInventory(fontes, { from, to, filtros = {} } = {}) {
  if (!from || !to || from > to) throw new Error('Período inválido: informe início e fim (início ≤ fim).');
  const { animais = [], movimentos = [], operacoes = [], animalLotes = [], cadastros = [], propriedadesIds = null } = fontes;
  const propriedadeUnica = Array.isArray(propriedadesIds) && propriedadesIds.length === 1 ? propriedadesIds[0] : null;
  const operacoesPorId = new Map(operacoes.map((op) => [op.id, op]));
  const movimentosPorAnimal = new Map();
  for (const mov of movimentos) {
    if (!mov.animal_id || mov.deleted_at) continue;
    const natureza = naturezaDe(mov);
    if (!natureza) continue;
    const lista = movimentosPorAnimal.get(mov.animal_id) || [];
    lista.push({ natureza, data: String(mov.data_evento || ''), mov });
    movimentosPorAnimal.set(mov.animal_id, lista);
  }
  const cadastroPorAnimal = new Map();
  for (const row of cadastros) if (row.animal_id && !cadastroPorAnimal.has(row.animal_id)) cadastroPorAnimal.set(row.animal_id, row.data_pesagem);

  const dimensao = filtros.lote_id ? 'lote_id' : filtros.propriedade_id ? 'propriedade_id' : null;
  const local = dimensao ? filtros[dimensao] : null;
  const atributo = (animal) => (!filtros.sexo || animal.sexo === filtros.sexo)
    && (!filtros.raca_id || animal.raca_id === filtros.raca_id)
    && (!filtros.categoria_id || animal.categoria_id === filtros.categoria_id)
    && (!filtros.marca_id || animal.marca_id === filtros.marca_id);

  const antes = previousDay(from);
  let saldoInicial = 0;
  const entradas = zeros(CLASSES_ENTRADA);
  const saidas = zeros(CLASSES_SAIDA);
  const internas = { recebidas: 0, enviadas: 0 };
  const divergencias = [];
  const presentesNoFim = [];
  let presentesPeloCadastro = 0;
  // R2-04: duas listas diferentes. `indeterminadosNoFim`: sem local conhecido EXATAMENTE na data final — é a
  // categoria da conciliação (P1 + P2 + … + indeterminados no fim = rebanho). `incertezaHistorica`: passou parte do
  // período sem local, mas tem local conhecido no fim — só alerta, não é divergência do saldo.
  const indeterminadosNoFim = [];
  const incertezaHistorica = [];

  for (const animal of animais) {
    if (!atributo(animal)) continue;
    const ledger = (movimentosPorAnimal.get(animal.id) || []).sort((a, b) => a.data.localeCompare(b.data) || String(a.mov.created_at).localeCompare(String(b.mov.created_at)));
    const saldoAte = (date) => ledger.reduce((acc, ev) => acc + (ev.data <= date ? (ev.natureza === 'ENTRADA' ? 1 : ev.natureza === 'SAIDA' ? -1 : 0) : 0), 0);

    if (!dimensao) {
      const inicial = saldoAte(antes);
      const final = saldoAte(to);
      saldoInicial += inicial;
      for (const ev of ledger) {
        if (!within(ev.data, from, to) || ev.natureza === 'INTERNA') continue;
        if (ev.natureza === 'ENTRADA') entradas[classify(ev.mov, 'ENTRADA', operacoesPorId)] += 1;
        else saidas[classify(ev.mov, 'SAIDA', operacoesPorId)] += 1;
      }
      // Conferência pelo cadastro do animal: entrada (1º movimento de entrada ou Cadastro) e data de saída.
      const dataEntrada = ledger.find((ev) => ev.natureza === 'ENTRADA')?.data || cadastroPorAnimal.get(animal.id) || null;
      const presenteCadastro = Boolean(dataEntrada && dataEntrada <= to && (!animal.data_saida || animal.data_saida > to));
      if (presenteCadastro) presentesPeloCadastro += 1;
      if (final === 1) presentesNoFim.push(animal);
      const numero = animal.numero_animal || '(sem identificação)';
      if (final < 0 || final > 1 || inicial < 0 || inicial > 1) {
        divergencias.push({ animal_id: animal.id, numero_animal: numero, motivo: 'Entradas e saídas do livro não se alternam (movimento duplicado ou faltando).' });
      } else if (!ledger.some((ev) => ev.natureza === 'ENTRADA') && cadastroPorAnimal.has(animal.id)) {
        divergencias.push({ animal_id: animal.id, numero_animal: numero, motivo: 'Animal com Cadastro mas sem movimento de entrada no livro.' });
      } else if ((final === 1) !== presenteCadastro) {
        divergencias.push({ animal_id: animal.id, numero_animal: numero, motivo: final === 1 ? 'No saldo do livro, mas o cadastro indica saída até a data.' : 'Fora do saldo do livro, mas o cadastro indica presença na data.' });
      }
      continue;
    }

    const todas = locationStays(dimensao, animal, ledger, animalLotes, { propriedadeUnica });
    const ref = { animal_id: animal.id, numero_animal: animal.numero_animal || '(sem identificação)' };
    if (stayAt(todas, LOCAL_INDETERMINADO, to)) indeterminadosNoFim.push(ref);
    else if (todas.some((s) => s.valor === LOCAL_INDETERMINADO && s.inicio <= to && (!s.fim || s.fim > from))) incertezaHistorica.push(ref);
    const stays = todas.filter((s) => s.valor === local);
    if (!stays.length) continue;
    if (stayAt(stays, local, antes)) saldoInicial += 1;
    for (const stay of stays) {
      if (within(stay.inicio, from, to)) {
        const entrada = ledger.find((ev) => ev.natureza === 'ENTRADA' && ev.data === stay.inicio);
        if (entrada) entradas[classify(entrada.mov, 'ENTRADA', operacoesPorId)] += 1;
        else internas.recebidas += 1;
      }
      if (stay.fim && within(stay.fim, from, to)) {
        const saida = ledger.find((ev) => ev.natureza === 'SAIDA' && ev.data === stay.fim);
        if (saida) saidas[classify(saida.mov, 'SAIDA', operacoesPorId)] += 1;
        else internas.enviadas += 1;
      }
    }
    if (stayAt(stays, local, to)) { presentesNoFim.push(animal); presentesPeloCadastro += 1; }
  }

  // R06: o que o inventário NÃO consegue afirmar fica visível no resultado.
  const limitacoes = [];
  if (filtros.categoria_id) limitacoes.push('Filtro de categoria usa a categoria ATUAL de cada animal, não a da data; a era na data está no painel de Desempenho.');
  if (indeterminadosNoFim.length) limitacoes.push(`${indeterminadosNoFim.length} animal(is) sem propriedade conhecida na data final (local INDETERMINADO): não entram no saldo de nenhuma propriedade. Registre a propriedade de destino na entrada ou uma movimentação interna.`);
  if (incertezaHistorica.length) limitacoes.push(`${incertezaHistorica.length} animal(is) passaram parte do período sem propriedade registrada (incerteza histórica); no fim do período o local é conhecido e já está no saldo.`);
  const totalEntradas = Object.values(entradas).reduce((a, b) => a + b, 0);
  const totalSaidas = Object.values(saidas).reduce((a, b) => a + b, 0);
  const saldoFinal = saldoInicial + totalEntradas - totalSaidas + internas.recebidas - internas.enviadas;
  return {
    periodo: { from, to },
    filtros: { ...filtros },
    dimensao,
    saldo_inicial: saldoInicial,
    entradas: { total: totalEntradas, por_classe: entradas },
    saidas: { total: totalSaidas, por_classe: saidas },
    nascimentos: entradas.NASCIMENTO,
    mortes: saidas.MORTE,
    ajustes: entradas.AJUSTE_ENTRADA - saidas.AJUSTE_SAIDA,
    internas: dimensao ? internas : null,
    saldo_final: saldoFinal,
    conferencia: {
      presentes_no_livro: presentesNoFim.length,
      presentes_pelo_cadastro: presentesPeloCadastro,
      fecha: saldoFinal === presentesNoFim.length && !divergencias.length && presentesNoFim.length === presentesPeloCadastro && !indeterminadosNoFim.length,
      divergencias,
      indeterminados_no_fim: indeterminadosNoFim,
      incerteza_historica: incertezaHistorica,
      // Compatibilidade (R1): `indeterminados` = os do fim (categoria da conciliação).
      indeterminados: indeterminadosNoFim,
    },
    limitacoes,
    animais_no_saldo_final: presentesNoFim.map((animal) => ({ id: animal.id, numero_animal: animal.numero_animal || null, marca: animal.marca || null, sexo: animal.sexo || null, raca: animal.raca || null })),
  };
}
