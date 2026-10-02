// E1G — curva de peso da Ficha do Animal (docs/plano-mestre/E1G-GMD-E-GRAFICOS.md, Parte B). Puro: a tela
// (src/pages/FichaAnimal.jsx) e o gate animal:weight-curve:verify usam o MESMO código.
//
// Corrige a curva antiga: o eixo X era o ÍNDICE da pesagem (10 e 90 dias com o mesmo espaço — a inclinação mentia),
// os rótulos de data vinham de TODOS os eventos e os pontos só dos que têm peso (uma Saída sem peso desalinhava),
// não havia eixo Y nem valores, e com 1 pesagem a legenda dizia "+0,00 kg". Agora:
//   - só eventos COM peso (measuredWeightOf: número > 0; Saída sem balança não vira 0 kg), na ordem canônica do
//     histórico (compareWeighingEvents);
//   - X = tempo REAL (dia civil; a mesma escala proporcional dos gráficos dos relatórios — chartScale);
//   - GMD de cada trecho = (peso − peso anterior) ÷ dias, contra a pesagem com peso ANTERIOR (mesmo fora do
//     intervalo escolhido — é o histórico real); mesmo dia = sem GMD ("—"), nunca divisão por zero;
//   - o resultado é um ChartData de uma série (kind linha), desenhado por chartGeometry/renderChartSvg.
// M1 (1.5.0): cada trecho tem a QUALIDADE do GMD (contrato weighing/domain/gmdQuality — classifyGmd/gmdExibicao, com o
// mínimo de Configurações › Relatórios): o intervalo curto aparece com o número, em cinza e com o aviso; e a curva traz
// o "GMD (regressão)" do animal (weightRegression.computeWeightedGmd — janela de 120 dias até hoje).
import { compareWeighingEvents, measuredWeightOf } from '../../weighing/domain/weighingSeries.js';
import { DAY_MS, dayNumber } from '../../reporting/domain/chartScale.js';
import { GMD_DIAS_MINIMOS_PADRAO, GMD_QUALIDADE, classifyGmd, gmdExibicao, normalizeGmdDiasMinimos } from '../../weighing/domain/gmdQuality.js';
import { computeWeightedGmd } from '../../weighing/domain/weightRegression.js';

/** Intervalos da curva (botões 90 dias / 6 meses / Tudo): dias antes do último evento do animal. */
export const CURVE_RANGES = Object.freeze({ 90: 90, 183: 183, all: null });

const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const ni = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const civil = (value) => String(value ?? '').slice(0, 10);
const brDate = (iso) => civil(iso).split('-').reverse().join('/');
const shortDate = (iso) => { const [year, month, day] = civil(iso).split('-'); return `${day}/${month}/${String(year).slice(2)}`; };
const isoOfDay = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const kg = (value) => `${nf2.format(value)} kg`;
const signedKg = (value) => `${value > 0 ? '+' : ''}${kg(value)}`;
const eventName = (entry) => (entry.tipo_manejo === 'Cadastro' ? 'Cadastro' : entry.tipo_manejo === 'Saída' ? (entry.motivo_saida ? `Saída (${entry.motivo_saida})` : 'Saída') : 'Pesagem');

/** Primeiro dia do intervalo (aaaa-mm-dd) ou null ("Tudo"). */
export function curveCutoff(entries = [], range = 'all') {
  const days = CURVE_RANGES[range] ?? null;
  if (!days) return null;
  let latest = null;
  for (const entry of entries) {
    const day = dayNumber(civil(entry?.data_pesagem));
    if (day !== null && (latest === null || day > latest)) latest = day;
  }
  return latest === null ? null : isoOfDay(latest - days);
}

/**
 * Exibição de um GMD na Ficha (o formatador compartilhado do contrato): "1,200 kg/dia"; sem cálculo "—" (nunca 0); o
 * intervalo curto com o número, cinza, e o aviso ("intervalo curto (3 dias)").
 * @returns {{ texto: string, cinza: boolean, aviso: string|null, entraNaMedia: boolean }}
 */
export function curveGmdText({ gmd, gmdQualidade, gmdMotivo }, { unit = true } = {}) {
  const shown = gmdExibicao({ gmd, gmdQualidade, gmdMotivo }, { format: (value) => nf3.format(value) });
  const texto = shown.texto === '-' ? '—' : unit ? `${shown.texto} kg/dia` : shown.texto;
  return { ...shown, texto };
}

/**
 * Texto da legenda: "3 pesagens com peso · 100 dias · +102,00 kg"; com uma só pesagem, ganho "—" (nunca "+0,00 kg").
 * M1: gmdCinza/gmdAviso = o GMD do intervalo é curto (cinza, fora da média); regressao = "GMD (regressão): 1,083 kg/dia".
 */
export function curveLegend(resumo) {
  const n = resumo?.pesagens ?? 0;
  const gmd = curveGmdText({ gmd: resumo?.gmd ?? null, gmdQualidade: resumo?.gmdQualidade ?? (resumo?.gmd == null ? GMD_QUALIDADE.SEM_GMD : GMD_QUALIDADE.CONFIAVEL), gmdMotivo: resumo?.gmdMotivo ?? null });
  const regressao = resumo?.regressao ?? null;
  const regressaoText = regressao ? curveGmdText({ gmd: regressao.gmd, gmdQualidade: regressao.qualidade, gmdMotivo: regressao.motivo ?? null }) : null;
  return {
    pesagens: `${ni.format(n)} ${n === 1 ? 'pesagem' : 'pesagens'} com peso`,
    dias: `${ni.format(resumo?.dias ?? 0)} ${resumo?.dias === 1 ? 'dia' : 'dias'}`,
    ganho: resumo?.ganho == null ? '—' : signedKg(resumo.ganho),
    gmd: gmd.texto,
    gmdCinza: gmd.cinza,
    gmdAviso: gmd.aviso,
    regressao: regressaoText ? `GMD (regressão): ${regressaoText.texto}${regressaoText.cinza && regressaoText.aviso ? ` (${regressaoText.aviso})` : ''}` : null,
    regressaoCinza: Boolean(regressaoText?.cinza),
    tone: resumo?.ganho == null ? null : resumo.ganho < 0 ? 'neg' : 'pos',
  };
}

/**
 * Revisão E1G — dica de um ponto da curva na Ficha (ChartPlot `describe`): data, evento, peso, dias, ganho e GMD do
 * trecho. Duas pesagens no MESMO dia caem no mesmo x (o mouse só alcança a primeira): a dica mostra as duas.
 * @returns {{ title: string, lines: string[] }}
 */
export function curvePointTip(curve, target) {
  const points = curve?.series?.[0]?.points ?? [];
  const point = points.find((item) => item.xKey === target?.xKey);
  if (!point) return { title: target?.label ?? '', lines: [] };
  const sameDay = points.filter((item) => item.x === point.x);
  if (sameDay.length === 1) return { title: `${brDate(point.data)} · ${point.evento}`, lines: point.detalhe };
  return { title: `${brDate(point.data)} · ${sameDay.length} pesagens no dia`, lines: sameDay.flatMap((item) => [`${item.evento}: ${item.text}`, ...item.detalhe.slice(1)]) };
}

/**
 * Curva de peso de UM animal.
 * @param entries todos os eventos do animal (Cadastro, Manejo, Saída — com ou sem peso)
 * @param {{ range?: '90'|'183'|'all', gmdDiasMinimos?: number, hoje?: string|null }} options
 *   gmdDiasMinimos (M1): intervalo mínimo do GMD (Configurações › Relatórios; padrão 21) — a qualidade de cada trecho;
 *   hoje (M1): referência da janela de 120 dias do GMD (regressão) — a Ficha passa o dia de hoje (o mesmo do Rebanho
 *   atual); sem ela, a última pesagem com peso do animal
 * @returns ChartData (domain/reportCharts) de uma série, com `resumo` { pesagens, dias, ganho, gmd, gmdQualidade,
 *   gmdMotivo, regressao } do intervalo (regressao = computeWeightedGmd sobre o histórico inteiro do animal)
 */
export function buildAnimalWeightCurve(entries = [], { range = 'all', gmdDiasMinimos = GMD_DIAS_MINIMOS_PADRAO, hoje = null } = {}) {
  const minimo = normalizeGmdDiasMinimos(gmdDiasMinimos);
  const ordered = [...(entries ?? [])].filter((entry) => entry && !entry.deleted_at).sort(compareWeighingEvents);
  const cutoff = curveCutoff(ordered, range);
  const weighed = ordered.filter((entry) => measuredWeightOf(entry) !== null && dayNumber(civil(entry.data_pesagem)) !== null);
  // Trechos sobre a série inteira: a primeira pesagem do intervalo compara com a anterior real.
  const stretches = weighed.map((entry, index) => {
    const peso = measuredWeightOf(entry);
    const previous = index > 0 ? weighed[index - 1] : null;
    const dias = previous ? dayNumber(civil(entry.data_pesagem)) - dayNumber(civil(previous.data_pesagem)) : null;
    const ganho = previous ? peso - measuredWeightOf(previous) : null;
    const gmd = dias !== null && dias > 0 ? ganho / dias : null;
    // M1: qualidade do trecho pelos dias (o mesmo contrato dos relatórios); mesmo dia ou primeira = SEM_GMD.
    const { gmdQualidade, gmdMotivo } = classifyGmd({ dias, gmd }, minimo);
    return { entry, peso, previous, dias, ganho, gmd, gmdQualidade, gmdMotivo };
  });
  const shown = cutoff ? stretches.filter((item) => civil(item.entry.data_pesagem) >= cutoff) : stretches;
  const points = shown.map((item, index) => {
    const date = civil(item.entry.data_pesagem);
    const detalhe = [`Peso: ${kg(item.peso)}`];
    if (!item.previous) detalhe.push('Primeira pesagem com peso');
    else {
      detalhe.push(`Desde ${brDate(item.previous.data_pesagem)}: ${ni.format(item.dias)} ${item.dias === 1 ? 'dia' : 'dias'}`);
      detalhe.push(`Ganho: ${signedKg(item.ganho)}`);
      const shownGmd = curveGmdText(item);
      if (item.gmd === null) detalhe.push('GMD do trecho: — (mesmo dia da pesagem anterior)');
      else detalhe.push(shownGmd.cinza ? `GMD do trecho: ${shownGmd.texto} — ${shownGmd.aviso}, fora da média` : `GMD do trecho: ${shownGmd.texto}`);
    }
    return {
      xKey: item.entry.id != null ? String(item.entry.id) : `${date}#${index}`,
      x: dayNumber(date), xLabel: shortDate(date), data: date, evento: eventName(item.entry),
      y: item.peso, text: kg(item.peso), cab: null,
      dias: item.dias, ganho: item.ganho, gmd: item.gmd, detalhe,
      // M1: o GMD do trecho em cinza (intervalo curto, fora da média) e o motivo.
      gmdQualidade: item.gmdQualidade, gmdMotivo: item.gmdMotivo, gmdCinza: item.gmdQualidade === GMD_QUALIDADE.NAO_CONFIAVEL,
      tooltip: `${brDate(date)} · ${eventName(item.entry)} · ${detalhe.join(' · ')}`,
    };
  });
  const first = shown[0] ?? null;
  const last = shown.at(-1) ?? null;
  const dias = shown.length >= 2 ? dayNumber(civil(last.entry.data_pesagem)) - dayNumber(civil(first.entry.data_pesagem)) : 0;
  const ganho = shown.length >= 2 ? last.peso - first.peso : null;
  const gmdResumo = ganho !== null && dias > 0 ? ganho / dias : null;
  const qualidadeResumo = classifyGmd({ dias, gmd: gmdResumo }, minimo);
  // M1 §2: GMD (regressão) do animal — todas as pesagens com peso; a janela (120 dias até hoje) é da própria conta.
  // A qualidade é a MESMA regra dos relatórios (classifyGmd pelos dias cobertos, com o mesmo mínimo) — o número
  // da Ficha e o da coluna do Rebanho atual saem iguais, inclusive o cinza. Sem conta possível: SEM_GMD ("—").
  const reta = computeWeightedGmd(weighed.map((entry) => ({ data: civil(entry.data_pesagem), peso: measuredWeightOf(entry) })), { ...(hoje ? { hoje } : {}), diasMinimos: minimo });
  const regressaoQualidade = classifyGmd({ dias: reta?.diasCobertos ?? null, gmd: reta?.gmd ?? null }, minimo);
  const resumo = {
    pesagens: shown.length, dias, ganho, gmd: gmdResumo, gmdQualidade: qualidadeResumo.gmdQualidade, gmdMotivo: qualidadeResumo.gmdMotivo,
    regressao: {
      gmd: reta?.gmd ?? null, n: reta?.n ?? 0, diasCobertos: reta?.diasCobertos ?? 0, erroPadrao: reta?.erroPadrao ?? null,
      qualidade: regressaoQualidade.gmdQualidade, motivo: regressaoQualidade.gmdMotivo,
    },
  };
  const legend = curveLegend(resumo);
  return {
    id: 'curva-peso', kind: 'linha', title: 'Curva de peso',
    subtitle: [cutoff ? `Desde ${brDate(cutoff)}` : 'Todo o histórico', legend.pesagens].join(' · '),
    unit: 'kg', valueColumn: 'peso', xType: 'tempo', yZero: false,
    eixos: { x: { titulo: 'Data', categorias: [] }, y: { titulo: 'kg' } },
    series: [{ key: 'peso', label: 'Peso', slot: 1, oculto: false, cab: null, points }],
    referencia: null, total: { valor: last?.peso ?? null, text: last ? kg(last.peso) : '-', cab: null },
    cobertura: null, semValor: null, notas: [], controls: [], config: {},
    legenda: false, vazio: points.length === 0,
    textoVazio: points.length ? null : 'Nenhuma pesagem com peso neste intervalo.',
    tabela: {
      cabecalho: ['Data', 'Evento', 'Peso', 'Dias', 'Ganho', 'GMD do trecho'],
      linhas: points.map((point) => [brDate(point.data), point.evento, point.text, point.dias === null ? '—' : ni.format(point.dias), point.ganho === null ? '—' : signedKg(point.ganho), curveGmdText(point, { unit: false }).texto]),
      // M1: por linha, o GMD em cinza (intervalo curto) e o aviso — a mesma marca da folha dos relatórios.
      cinza: points.map((point) => point.gmdCinza),
      avisos: points.map((point) => (point.gmdCinza ? point.gmdMotivo : null)),
    },
    resumo,
  };
}
