// Dossiê de rastreabilidade INTERNA do animal (F15) — puro. Junta o que o banco local sabe: identidade e
// troca de identificadores, nascimento (com precisão e fonte), origem e documentos, permanências em
// propriedade e lote, operações, pesagens, sanidade com carência, dentição e destino. O que não se sabe é
// listado como DESCONHECIDO — nada é presumido. Não é certificação: sem selo SISBOV/EUDR/ERAS.
import { PRECISAO_LABELS, ageAt, eraAt } from './ageModel.js';

export const AVISO_DOSSIE = 'Dossiê interno de rastreabilidade gerado pelo sistema local. Não é certificado nem documento oficial (SISBOV, EUDR ou outro).';

const addDays = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const tipoOf = (row) => row?.legacy_payload?.tipo_manejo ?? row?.tipo_pesagem ?? null;
const ui = (row) => (row?.legacy_payload && typeof row.legacy_payload === 'object' ? row.legacy_payload : {});

/** Carência de carne/leite de uma aplicação: data + dias do snapshot (ou do medicamento); sem dado = null. */
export function withdrawalOf(aplicacao, medicamento) {
  const snap = aplicacao.posologia_snapshot || {};
  const carne = Number.isInteger(snap.carencia_carne_dias) ? snap.carencia_carne_dias
    : Number.isInteger(aplicacao.carencia_carne_dias) ? aplicacao.carencia_carne_dias
      : Number.isInteger(medicamento?.carencia_dias) ? medicamento.carencia_dias : null;
  const leite = Number.isInteger(snap.carencia_leite_dias) ? snap.carencia_leite_dias : null;
  return {
    carne_ate: carne === null ? null : addDays(aplicacao.data, carne),
    leite_ate: leite === null ? null : addDays(aplicacao.data, leite),
    carne_dias: carne,
    leite_dias: leite,
  };
}

export function buildDossier(src, { hoje, policy } = {}) {
  const { animal, mae, identificadores = [], lotes = [], pesagens = [], movimentos = [], aplicacoes = [], denticoes = [], operacoes = [], medicamentos = [], nomes = {} } = src;
  const nome = (mapa, id) => (id ? mapa?.get?.(id) || id : null);
  const opPorId = new Map(operacoes.map((op) => [op.id, op]));
  const medPorId = new Map(medicamentos.map((m) => [m.id, m]));
  const desconhecidos = [];

  const idade = ageAt(animal, hoje);
  const era = eraAt(animal, hoje, policy);
  if (idade.desconhecida) desconhecidos.push('Data de nascimento / idade');
  if (!animal.propriedade_nascimento_id && animal.nascimento_fonte !== 'OPERACAO_NASCIMENTO') desconhecidos.push('Propriedade de nascimento');
  if (!animal.mae_animal_id) desconhecidos.push('Mãe');

  const entradas = movimentos.filter((m) => m.natureza === 'ENTRADA').sort((a, b) => String(a.data_evento).localeCompare(String(b.data_evento)));
  const entrada = entradas[0] || null;
  const opEntrada = entrada?.operacao_id ? opPorId.get(entrada.operacao_id) : null;
  if (!entrada) desconhecidos.push('Movimento de entrada no rebanho');
  if (!opEntrada || opEntrada.origem === 'LEGADO' || (!opEntrada.gta_numero && !opEntrada.nf_numero)) desconhecidos.push('Documento de origem (GTA/NF)');
  if (!opEntrada?.parceiro_id && opEntrada?.subtipo !== 'NASCIMENTO') desconhecidos.push('Parceiro de origem');

  const saidas = movimentos.filter((m) => m.natureza === 'SAIDA');
  const saida = saidas.sort((a, b) => String(b.data_evento).localeCompare(String(a.data_evento)))[0] || null;
  const opSaida = saida?.operacao_id ? opPorId.get(saida.operacao_id) : null;
  const pesagemSaida = saida?.pesagem_id ? pesagens.find((p) => p.id === saida.pesagem_id) : null;

  const pesadas = pesagens.filter((p) => Number(p.peso_kg) > 0).sort((a, b) => String(a.data_pesagem).localeCompare(String(b.data_pesagem)));
  const sanidade = aplicacoes.map((a) => {
    const carencia = withdrawalOf(a, medPorId.get(a.medicamento_id));
    return {
      data: a.data,
      medicamento: a.posologia_snapshot?.medicamento_nome || medPorId.get(a.medicamento_id)?.nome || null,
      dose: a.dose_aplicada ?? a.dose ?? null,
      unidade: a.unidade || null,
      via: a.via_aplicacao || null,
      cancelada: Boolean(a.cancelled_at),
      carencia_carne_ate: a.cancelled_at ? null : carencia.carne_ate,
      carencia_leite_ate: a.cancelled_at ? null : carencia.leite_ate,
      carencia_conhecida: carencia.carne_dias !== null,
    };
  }).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  if (sanidade.some((s) => !s.cancelada && !s.carencia_conhecida)) desconhecidos.push('Carência de alguma aplicação (medicamento sem carência cadastrada)');
  const carenciaAberta = sanidade.filter((s) => !s.cancelada && s.carencia_carne_ate && s.carencia_carne_ate > hoje).map((s) => s.carencia_carne_ate).sort().at(-1) || null;

  const propriedadesHist = [];
  // R06: propriedade da entrada pelo livro (destino; senão a origem da 1ª movimentação). Sem registro, o dossiê diz
  // "Indeterminado" — a propriedade ATUAL do animal não é usada como se fosse a da entrada.
  const internas = movimentos.filter((m) => m.natureza === 'INTERNA' && m.propriedade_destino_id).sort((a, b) => String(a.data_evento).localeCompare(String(b.data_evento)));
  const propriedadeEntrada = entrada?.propriedade_destino_id || internas[0]?.propriedade_origem_id || null;
  if (entrada) propriedadesHist.push({ propriedade: propriedadeEntrada ? nome(nomes.propriedades, propriedadeEntrada) : 'Indeterminado (sem registro na entrada)', desde: entrada.data_evento, ate: null, origem: 'entrada' });
  for (const mov of internas) {
    if (propriedadesHist.length) propriedadesHist.at(-1).ate = mov.data_evento;
    propriedadesHist.push({ propriedade: nome(nomes.propriedades, mov.propriedade_destino_id), desde: mov.data_evento, ate: null, origem: 'movimentação' });
  }
  if (saida && propriedadesHist.length && !propriedadesHist.at(-1).ate) propriedadesHist.at(-1).ate = saida.data_evento;

  return {
    aviso: AVISO_DOSSIE,
    gerado_em: hoje,
    identidade: {
      animal_id: animal.id,
      numero_animal: animal.numero_animal || null,
      marca_a_fogo: animal.marca || nome(nomes.marcas, animal.marca_id),
      sexo: animal.sexo || null,
      raca: animal.raca || null,
      situacao: animal.situacao,
      situacao_cadastro: animal.situacao_cadastro || 'OK',
      identificadores: identificadores.filter((i) => !i.deleted_at).map((i) => ({ tipo: i.tipo, valor: i.valor_normalizado || i.valor, desde: i.inicio || null, ate: i.fim || null, ativo: i.ativo !== false && !i.fim, motivo_troca: i.motivo_troca || null })),
    },
    nascimento: {
      data: animal.nascimento_data || null,
      precisao: PRECISAO_LABELS[idade.precisao] || idade.precisao,
      fonte: animal.nascimento_fonte || null,
      idade_hoje: idade.texto,
      era: era?.rotulo || null,
      mae: mae?.numero_animal || null,
    },
    origem: entrada ? {
      data: entrada.data_evento,
      tipo: entrada.tipo,
      operacao: opEntrada ? { subtipo: opEntrada.subtipo, origem: opEntrada.origem, gta: opEntrada.gta_numero || null, nf: opEntrada.nf_numero || null, parceiro: nome(nomes.parceiros, opEntrada.parceiro_id), propriedade_origem: nome(nomes.propriedades, opEntrada.propriedade_origem_id) } : null,
    } : null,
    propriedades: propriedadesHist,
    lotes: lotes.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))).map((l) => ({ lote: nome(nomes.lotes, l.lote_id), desde: l.inicio, ate: l.fim || null })),
    pesagens: { quantidade: pesadas.length, primeira: pesadas[0] ? { data: pesadas[0].data_pesagem, peso_kg: pesadas[0].peso_kg } : null, ultima: pesadas.at(-1) ? { data: pesadas.at(-1).data_pesagem, peso_kg: pesadas.at(-1).peso_kg } : null },
    sanidade,
    carencia_carne_aberta_ate: carenciaAberta,
    denticao: denticoes.map((d) => ({ data: d.data, dentes: d.dentes, origem: d.origem })).sort((a, b) => String(a.data).localeCompare(String(b.data))),
    destino: saida ? {
      data: saida.data_evento,
      motivo: saida.tipo,
      operacao: opSaida ? { subtipo: opSaida.subtipo, gta: opSaida.gta_numero || null, nf: opSaida.nf_numero || null, parceiro: nome(nomes.parceiros, opSaida.parceiro_id) } : null,
      peso_kg: pesagemSaida?.peso_kg ?? null,
      comprador_texto: ui(pesagemSaida).comprador || ui(pesagemSaida).frigorifico || null,
    } : null,
    eventos: [...movimentos.map((m) => ({ data: m.data_evento, evento: m.tipo, natureza: m.natureza })), ...pesagens.filter((p) => tipoOf(p) === 'Manejo').map((p) => ({ data: p.data_pesagem, evento: `Pesagem ${p.peso_kg ?? '—'} kg`, natureza: 'PESAGEM' }))]
      .sort((a, b) => String(a.data).localeCompare(String(b.data))),
    desconhecidos,
  };
}

/** Linhas planas (seção; campo; valor) para CSV. */
export function dossierRows(d) {
  const rows = [['Aviso', '', d.aviso], ['Gerado em', '', d.gerado_em]];
  for (const [k, v] of Object.entries(d.identidade)) if (k !== 'identificadores') rows.push(['Identidade', k, v ?? '']);
  for (const i of d.identidade.identificadores) rows.push(['Identificador', i.tipo, `${i.valor} (${i.desde || '?'} → ${i.ate || 'atual'})${i.motivo_troca ? ` ${i.motivo_troca}` : ''}`]);
  for (const [k, v] of Object.entries(d.nascimento)) rows.push(['Nascimento', k, v ?? '']);
  if (d.origem) rows.push(['Origem', d.origem.tipo, `${d.origem.data}${d.origem.operacao ? ` · ${d.origem.operacao.subtipo}${d.origem.operacao.gta ? ` · GTA ${d.origem.operacao.gta}` : ''}${d.origem.operacao.nf ? ` · NF ${d.origem.operacao.nf}` : ''}${d.origem.operacao.parceiro ? ` · ${d.origem.operacao.parceiro}` : ''}` : ''}`]);
  for (const p of d.propriedades) rows.push(['Propriedade', p.propriedade || '', `${p.desde} → ${p.ate || 'atual'}`]);
  for (const l of d.lotes) rows.push(['Lote', l.lote || '', `${l.desde} → ${l.ate || 'atual'}`]);
  for (const s of d.sanidade) rows.push(['Sanidade', s.data, `${s.medicamento || '—'}${s.dose ? ` ${s.dose} ${s.unidade || ''}` : ''}${s.cancelada ? ' (cancelada)' : ''}${s.carencia_carne_ate ? ` · carência carne até ${s.carencia_carne_ate}` : s.carencia_conhecida ? '' : ' · carência desconhecida'}`]);
  for (const t of d.denticao) rows.push(['Dentição', t.data, `${t.dentes} dentes (${t.origem})`]);
  if (d.destino) rows.push(['Destino', d.destino.motivo, `${d.destino.data}${d.destino.peso_kg ? ` · ${d.destino.peso_kg} kg` : ''}${d.destino.operacao?.gta ? ` · GTA ${d.destino.operacao.gta}` : ''}${d.destino.operacao?.parceiro ? ` · ${d.destino.operacao.parceiro}` : d.destino.comprador_texto ? ` · ${d.destino.comprador_texto}` : ''}`]);
  for (const e of d.eventos) rows.push(['Evento', e.data, `${e.evento} (${e.natureza})`]);
  for (const u of d.desconhecidos) rows.push(['Desconhecido', u, 'não informado']);
  return rows;
}
