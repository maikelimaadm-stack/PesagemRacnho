// Lançamento de Pesagens × operações de rebanho (integração Entrada / Manejo-Pesagem / Saída).
//
// O Lançamento continua usando os modos históricos 'Cadastro' | 'Manejo' | 'Saída' (stores, relatórios e contexto
// da tela não mudam); aqui só se faz o mapeamento para o livro de operações da v9 (CONTRATO-OPERACOES.md):
//   Cadastro + motivo da entrada → operação ENTRADA (COMPRA, TRANSFERENCIA_RECEBIDA, NASCIMENTO, AJUSTE_ENTRADA)
//   Saída    + motivo da saída   → operação SAIDA   (VENDA, ABATE, TRANSFERENCIA_ENVIADA, MORTE, DOACAO, AJUSTE_SAIDA)
//   Manejo                       → pesagem (sem operação), como sempre.
// Animal "SN" (sem número), edição e repesagem seguem o caminho de pesagem de antes.
import { isSnIdentifier } from '../../animals/domain/snAnimal.js';

export const LAUNCH_MODE_LABELS = Object.freeze({
  Cadastro: 'Entrada (novo animal)',
  Manejo: 'Manejo / Pesagem',
  'Saída': 'Saída',
});

export const ENTRADA_SUBTIPOS_LANCAMENTO = Object.freeze(['COMPRA', 'TRANSFERENCIA_RECEBIDA', 'NASCIMENTO', 'AJUSTE_ENTRADA']);
export const ENTRADA_SUBTIPO_LABELS = Object.freeze({
  COMPRA: 'Compra',
  TRANSFERENCIA_RECEBIDA: 'Transferência recebida',
  NASCIMENTO: 'Nascimento',
  AJUSTE_ENTRADA: 'Ajuste de entrada',
});
export const ENTRADA_SUBTIPO_PADRAO = 'COMPRA';

// Motivos de saída do Lançamento (valores históricos gravados na pesagem) → subtipo da operação.
export const SUBTIPO_SAIDA_POR_MOTIVO = Object.freeze({
  Venda: 'VENDA',
  Abate: 'ABATE',
  'Transferência': 'TRANSFERENCIA_ENVIADA',
  Morte: 'MORTE',
  'Doação': 'DOACAO',
  Outros: 'AJUSTE_SAIDA',
});
export const MOTIVO_SAIDA_LABELS = Object.freeze({
  Venda: 'Venda',
  Abate: 'Abate',
  'Transferência': 'Transferência enviada',
  Morte: 'Morte',
  'Doação': 'Doação',
  Outros: 'Ajuste de saída',
});
export const MOTIVOS_SAIDA_ORDEM = Object.freeze(['Venda', 'Abate', 'Transferência', 'Morte', 'Doação', 'Outros']);
// Ajustes exigem justificativa (operationRules: JUSTIFICATIVA_MIN) — a Observação do Lançamento.
export const SUBTIPOS_COM_JUSTIFICATIVA = Object.freeze(['AJUSTE_ENTRADA', 'AJUSTE_SAIDA']);

/** O lançamento novo vira operação? (Entrada ou Saída, animal identificado, sem edição nem repesagem). */
export function launchUsesOperation({ tipoManejo, editing = false, numeroAnimal = '', repesagem = false }) {
  if (editing || repesagem) return false;
  if (isSnIdentifier(numeroAnimal)) return false;
  return tipoManejo === 'Cadastro' || tipoManejo === 'Saída';
}

const texto = (valor) => {
  const t = valor === null || valor === undefined ? '' : String(valor).trim();
  return t || null;
};

/**
 * Entrada do serviço registerLaunchOperation a partir do Lançamento. `pesagem` é o payload que a tela já monta
 * para o createEntry (com aplicacoes_sanidade); o item e o cabeçalho vêm dos mesmos dados — uma só fonte.
 */
export function buildLaunchOperationInput({
  id, tipoManejo, subtipoEntrada, motivoSaida, dataPesagem, pesagem, numeroAnimal, animalId = null,
  marcaId = null, sexo = null, racaId = null, loteId = null, pesoKg = null, pesoOrigem = null,
  valor = null, causaMorteId = null, observacao = null, gtaNumero = null, nfNumero = null, aceitarAvisos = false,
  empresaId = null,
}) {
  const entrada = tipoManejo === 'Cadastro';
  const subtipo = entrada ? (subtipoEntrada || ENTRADA_SUBTIPO_PADRAO) : SUBTIPO_SAIDA_POR_MOTIVO[motivoSaida];
  if (!subtipo) throw new Error('Escolha o motivo da saída.');
  const temPeso = pesoKg !== null && pesoKg !== undefined;
  const item = entrada
    ? { numero_animal: texto(numeroAnimal), marca_id: texto(marcaId), sexo: texto(sexo), raca_id: texto(racaId), lote_id: texto(loteId) }
    : { animal_id: texto(animalId) };
  Object.assign(item, {
    peso_kg: temPeso ? pesoKg : null,
    peso_origem: temPeso ? (pesoOrigem === 'BALANCA' ? 'BALANCA' : 'MANUAL') : null,
    valor: valor ?? null,
    causa_morte_id: subtipo === 'MORTE' ? texto(causaMorteId) : null,
    observacao: texto(observacao),
  });
  return {
    id,
    empresa_id: empresaId || undefined,
    tipo: entrada ? 'ENTRADA' : 'SAIDA',
    subtipo,
    data: dataPesagem,
    gta_numero: texto(gtaNumero),
    nf_numero: texto(nfNumero),
    observacao: texto(observacao),
    aceitarAvisos: aceitarAvisos === true,
    item,
    pesagem,
  };
}

/** Mensagem de sucesso: tipo, animal, situação, referência da operação e se houve pesagem. */
export function launchOperationMessage(result, { numeroAnimal } = {}) {
  const op = result?.operacao || {};
  const item = result?.itens?.[0] || {};
  const entrada = op.tipo === 'ENTRADA';
  const rotulo = entrada ? ENTRADA_SUBTIPO_LABELS[op.subtipo] : MOTIVO_SAIDA_LABELS[Object.keys(SUBTIPO_SAIDA_POR_MOTIVO).find((m) => SUBTIPO_SAIDA_POR_MOTIVO[m] === op.subtipo)];
  const ref = op.id ? String(op.id).slice(0, 8) : '';
  // Peso é o que conta para o operador: a Saída sem peso também gera o registro de saída, mas sem peso nenhum.
  const pesado = item.peso_kg !== null && item.peso_kg !== undefined;
  const pesagem = pesado ? 'com pesagem' : (entrada ? 'sem pesagem — animal pendente de pesagem' : 'sem peso');
  return `${entrada ? 'Entrada' : 'Saída'} confirmada: animal ${numeroAnimal || ''} · ${rotulo || op.subtipo} · ${pesagem} · operação ${ref}${result?.repetida ? ' (já estava gravada)' : ''}`;
}
