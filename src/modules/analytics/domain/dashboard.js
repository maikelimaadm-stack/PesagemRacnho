// Painel do gestor (F18) — puro. Responde perguntas objetivas com amostra e janela explícitas:
//   • qual raça/era/lote/estação rende mais? (ranking com n, dias, IC e suficiência da amostra)
//   • quem está perdendo peso agora?
//   • quando começa e termina a seca? quantos dias cada lote ficou exposto?
//   • quantos estão acima/abaixo da meta? o peso projetado bate a meta de venda?
//   • comparação com outra janela (safra anterior)
// As mesmas tabelas (`dashboardTables`) alimentam a tela, o CSV, o XLSX e o PDF (paridade por construção).
import { ageAt } from '../../livestock/domain/ageModel.js';
import { DIMENSAO_LABELS, buildIntervals, groupPerformance, losingWeight } from './performance.js';
import { CENARIO_LABELS, projectWeight, scenarioResolver } from './projection.js';
import { PERIODO_LABELS, seasonAt } from './seasonCalendar.js';
import { compareToTarget, resolveTarget } from './targets.js';

const SAIDA = new Set(['VENDIDO', 'ABATIDO', 'MORTO', 'DOADO', 'TRANSFERIDO', 'CANCELADO', 'INATIVO']);
const fmt = (n, casas = 3) => (n === null || n === undefined ? null : Number(n.toFixed(casas)));
const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

function lastWeight(pesagens, animalId) {
  let best = null;
  for (const p of pesagens) {
    if (p.deleted_at || p.animal_id !== animalId) continue;
    const kg = Number(p.peso_kg ?? p.legacy_payload?.peso);
    if (!(kg > 0)) continue;
    if (!best || p.data_pesagem > best.data) best = { peso_kg: kg, data: p.data_pesagem, origem: p.legacy_payload?.peso_origem || 'PESAGEM_REGISTRADA' };
  }
  return best;
}

/**
 * @param {object} fontes { pesagens, animais, animalLotes, movimentos, operacoes, calendario, metas, policy }
 * @param {object} opts { from, to, hoje, dimensoes, diasMinimos, comparar: { from, to } | null, cenario, nomes }
 */
export function buildDashboard(fontes, { from, to, hoje, dimensoes = ['raca'], diasMinimos = 21, comparar = null, cenario = 'BASE', nomes = {} } = {}) {
  const { animais = [], pesagens = [], calendario = [], metas = [], policy } = fontes;
  const intervalos = buildIntervals(fontes, { from, to, diasMinimos, policy });
  const rotulos = {
    raca: nomes.racas, lote: nomes.lotes, propriedade: nomes.propriedades,
    estacao: new Map(Object.entries({ ...PERIODO_LABELS, MISTO: 'Mista (atravessa estações)', SEM_CALENDARIO: 'Sem calendário' })),
    sexo: new Map([['M', 'Machos'], ['F', 'Fêmeas']]),
  };
  const desempenho = groupPerformance(intervalos, dimensoes, { rotulos });
  const anterior = comparar?.from && comparar?.to
    ? groupPerformance(buildIntervals(fontes, { from: comparar.from, to: comparar.to, diasMinimos, policy }), dimensoes, { rotulos })
    : null;
  if (anterior) {
    const porChave = new Map(anterior.linhas.map((l) => [JSON.stringify(l.grupo), l]));
    for (const l of desempenho.linhas) {
      const a = porChave.get(JSON.stringify(l.grupo));
      l.gmd_anterior = a?.gmd_ponderado ?? null;
      l.variacao = l.gmd_ponderado !== null && l.gmd_anterior !== null ? fmt(l.gmd_ponderado - l.gmd_anterior) : null;
    }
  }

  const animalPorId = new Map(animais.map((a) => [a.id, a]));
  const perdendo = losingWeight(intervalos).map((p) => ({ ...p, numero_animal: animalPorId.get(p.animal_id)?.numero_animal || '—', lote_nome: nomes.lotes?.get?.(p.lote) || p.lote || '—' }));

  // Estação: períodos do calendário que tocam a janela + dias de seca por lote (intervalos observados).
  const periodos = calendario.filter((p) => !p.deleted_at && p.inicio <= to && p.fim >= from)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((p) => ({ propriedade: p.propriedade_id ? (nomes.propriedades?.get?.(p.propriedade_id) || p.propriedade_id) : 'Todas', periodo: p.periodo, inicio: p.inicio, fim: p.fim, fonte: p.fonte }));
  const secaPorLote = new Map();
  for (const it of intervalos) {
    const k = it.dims.lote || null;
    const acc = secaPorLote.get(k) || { animais: new Set(), dias_seca: 0, dias_total: 0, dias_sem_calendario: 0 };
    acc.animais.add(it.animal_id);
    acc.dias_seca += it.exposicao.SECA;
    acc.dias_total += it.exposicao.total;
    acc.dias_sem_calendario += it.exposicao.SEM_CALENDARIO;
    secaPorLote.set(k, acc);
  }
  const exposicao = [...secaPorLote.entries()].map(([lote, acc]) => ({
    lote: lote ? (nomes.lotes?.get?.(lote) || lote) : 'Sem lote',
    animais: acc.animais.size,
    dias_seca: acc.dias_seca,
    dias_seca_por_animal: acc.animais.size ? fmt(acc.dias_seca / acc.animais.size, 1) : null,
    dias_observados: acc.dias_total,
    dias_sem_calendario: acc.dias_sem_calendario,
  })).sort((a, b) => b.dias_seca - a.dias_seca);

  // Metas: animais ativos na data `hoje`.
  const ativos = animais.filter((a) => !a.deleted_at && !SAIDA.has(a.situacao));
  const contagem = { ACIMA: 0, NO_ALVO: 0, ABAIXO: 0, INSUFICIENTE: 0, CONFLITO: 0, SEM_META: 0 };
  const metasLinhas = [];
  for (const animal of ativos) {
    const lote = animal.lote_atual_id || null;
    const ctx = { animal_id: animal.id, lote_id: lote, propriedade_id: animal.propriedade_id || null, raca_id: animal.raca_id || null, sexo: animal.sexo || null, era: null, estacao: seasonAt(calendario, animal.propriedade_id, hoje)?.periodo || null };
    const idade = ageAt(animal, hoje);
    if (!idade.desconhecida && policy) {
      const i = policy.faixas_meses.findIndex((l) => idade.meses <= l);
      ctx.era = policy.eras[i === -1 ? policy.faixas_meses.length : i];
    }
    const r = resolveTarget(metas, ctx, hoje);
    if (r.conflito) { contagem.CONFLITO += 1; metasLinhas.push({ numero_animal: animal.numero_animal || '—', situacao: 'CONFLITO', detalhe: `${r.conflito.length} metas no nível ${r.nivel}` }); continue; }
    if (!r.meta) { contagem.SEM_META += 1; continue; }
    const ultimo = lastWeight(pesagens, animal.id);
    let projecao = null;
    if (r.meta.tipo === 'PESO_DATA' && ultimo && r.meta.data_alvo > ultimo.data) {
      const rc = resolveTarget(metas, ctx, hoje, { tipos: ['CENARIO'], cenario });
      projecao = rc.meta
        ? projectWeight(ultimo, r.meta.data_alvo, scenarioResolver(rc.meta, { calendario, propriedadeId: animal.propriedade_id }))
        : { ok: false, motivo: `Sem cenário ${CENARIO_LABELS[cenario] || cenario} para projetar.` };
    }
    const cmp = compareToTarget(r.meta, { intervalos: intervalos.filter((it) => it.animal_id === animal.id), projecao, ultimoPeso: ultimo });
    contagem[cmp.situacao] = (contagem[cmp.situacao] || 0) + 1;
    metasLinhas.push({
      numero_animal: animal.numero_animal || '—',
      situacao: cmp.situacao,
      nivel: r.nivel,
      meta: r.meta.tipo === 'GMD' ? `${r.meta.gmd_kg_dia} kg/dia` : `${r.meta.peso_kg} kg em ${br(r.meta.data_alvo)}`,
      realizado: cmp.gmd_observado ?? cmp.peso_observado ?? cmp.peso_projetado ?? null,
      base: cmp.base || (r.meta.tipo === 'GMD' ? 'observado' : null),
      desvio: cmp.desvio_kg_dia ?? cmp.desvio_kg ?? null,
      detalhe: cmp.motivo || (projecao?.ok ? `projeção ${CENARIO_LABELS[cenario] || cenario} a partir de ${projecao.base.peso_kg} kg em ${br(projecao.base.data)}` : ''),
    });
  }

  return {
    janela: { from, to, hoje },
    comparacao: comparar || null,
    dimensoes,
    dias_minimos: diasMinimos,
    desempenho: desempenho.linhas,
    perdendo,
    periodos,
    exposicao,
    metas: { contagem, linhas: metasLinhas },
    total_intervalos: intervalos.length,
  };
}

/** Tabelas planas do painel — fonte única da tela e das exportações (CSV, XLSX, PDF). */
export function dashboardTables(d) {
  const dimLabel = d.dimensoes.map((x) => DIMENSAO_LABELS[x]).join(' · ');
  const tabelas = [
    {
      id: 'desempenho',
      titulo: `Desempenho por ${dimLabel} (${br(d.janela.from)} a ${br(d.janela.to)}; GMD só com intervalos ≥ ${d.dias_minimos} dias)`,
      colunas: ['Posição', dimLabel, 'Animais', 'Animais com GMD', 'Intervalos', 'Dias observados', 'Ganho total (kg)', 'GMD ponderado (kg/dia)', 'GMD médio individual', 'IC 95%', 'Ganharam', 'Perderam', 'Mantiveram', 'Sem GMD', 'Amostra', ...(d.comparacao ? ['GMD janela anterior', 'Variação'] : [])],
      linhas: d.desempenho.map((l) => [l.posicao, l.rotulo, l.n_animais, l.n_animais_com_gmd, l.n_intervalos, l.dias_observados, l.ganho_total_kg, l.gmd_ponderado ?? 'sem dados suficientes', l.gmd_medio_individual ?? 'sem dados suficientes', l.ic95 ? `${l.ic95[0]} a ${l.ic95[1]}` : '—', l.ganharam, l.perderam, l.mantiveram, l.sem_gmd, l.amostra === 'SUFICIENTE' ? 'Suficiente' : 'Insuficiente', ...(d.comparacao ? [l.gmd_anterior ?? '—', l.variacao ?? '—'] : [])]),
    },
    {
      id: 'perdendo',
      titulo: 'Animais perdendo peso (último intervalo confiável)',
      colunas: ['Animal', 'Lote', 'De', 'Até', 'Dias', 'Ganho (kg)', 'GMD (kg/dia)'],
      linhas: d.perdendo.map((p) => [p.numero_animal, p.lote_nome, br(p.de), br(p.ate), p.dias, p.ganho, p.gmd]),
    },
    {
      id: 'calendario',
      titulo: 'Calendário de águas, transição e seca na janela',
      colunas: ['Propriedade', 'Período', 'Início', 'Fim', 'Fonte'],
      linhas: d.periodos.map((p) => [p.propriedade, PERIODO_LABELS[p.periodo], br(p.inicio), br(p.fim), p.fonte]),
    },
    {
      id: 'exposicao',
      titulo: 'Dias de seca por lote (intervalos observados)',
      colunas: ['Lote', 'Animais', 'Dias de seca', 'Dias de seca por animal', 'Dias observados', 'Dias sem calendário'],
      linhas: d.exposicao.map((e) => [e.lote, e.animais, e.dias_seca, e.dias_seca_por_animal, e.dias_observados, e.dias_sem_calendario]),
    },
    {
      id: 'metas',
      titulo: `Metas: ${d.metas.contagem.ACIMA} acima, ${d.metas.contagem.NO_ALVO} no alvo, ${d.metas.contagem.ABAIXO} abaixo, ${d.metas.contagem.INSUFICIENTE} sem amostra, ${d.metas.contagem.CONFLITO} em conflito`,
      colunas: ['Animal', 'Situação', 'Nível da meta', 'Meta', 'Realizado/projetado', 'Base', 'Desvio', 'Detalhe'],
      linhas: d.metas.linhas.map((m) => [m.numero_animal, m.situacao, m.nivel || '—', m.meta || '—', m.realizado ?? '—', m.base || '—', m.desvio ?? '—', m.detalhe || '']),
    },
  ];
  return tabelas;
}
