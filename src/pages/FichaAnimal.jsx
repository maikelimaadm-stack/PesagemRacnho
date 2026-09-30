import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { loadOperationalCatalog } from '@/modules/operations/application/operationalInsightsService';
import { calculateCarcassTrade } from '@/modules/weighing/domain/commercialCalculations';
import { useAuth } from '@/components/auth/useAuth';
import SanidadeAnimalCard from '@/components/sanidade/SanidadeAnimalCard';
import { VIA_LABELS, listApplications } from '@/modules/sanity/application/sanityService';
import { buildAnimalWeightCurve, curveLegend, curvePointTip } from '@/modules/animals/domain/animalWeightCurve';
import { CHART_SCREEN_CSS } from '@/modules/reporting/infrastructure/exporters/chartStyles';
import ChartPlot from '@/components/reports/ChartPlot';
import '@/styles/operational-insights.css';

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n3 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const ni = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dateBr = (value) => value ? String(value).split('-').reverse().join('/') : '—';
const identityKey = (row) => row.animal_id || `${String(row.numero_animal || '').trim().toUpperCase()}::${String(row.marca || '').trim().toUpperCase()}`;
const hasNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const dayDiff = (from, to) => Math.max(0, Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000));
const download = (name, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function buildProfiles(catalog) {
  const groups = new Map();
  // Mapa por id: evita a busca linear por animal (O(n²) com dezenas de milhares de animais).
  const animalsById = new Map(catalog.animais.map((item) => [item.id, item]));
  catalog.pesagens.forEach((row) => {
    const key = identityKey(row);
    if (!key) return;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  });
  return [...groups.entries()].map(([key, entries]) => {
    entries.sort((a, b) => String(a.data_pesagem).localeCompare(String(b.data_pesagem)) || String(a.created_date || '').localeCompare(String(b.created_date || '')));
    const registration = entries.find((row) => row.tipo_manejo === 'Cadastro') || entries[0];
    const latest = entries.at(-1);
    const animal = animalsById.get(latest.animal_id) || {};
    return {
      key,
      entries,
      animalId: latest.animal_id,
      number: animal.numero_animal || latest.numero_animal || registration.numero_animal || 'Sem identificação',
      brand: animal.marca || latest.marca || registration.marca || 'Sem marca',
      sex: animal.sexo || registration.sexo || latest.sexo || '—',
      race: animal.raca || registration.raca || latest.raca || '—',
      era: animal.era || registration.era || latest.era || '—',
      status: animal.situacao || latest.status_animal || (latest.tipo_manejo === 'Saída' ? 'INATIVO' : 'ATIVO'),
      lot: latest.nome_lote || '—',
      apartacao: latest.nome_apartacao || '—',
    };
  }).sort((a, b) => String(a.number).localeCompare(String(b.number), 'pt-BR', { numeric: true }));
}

export default function FichaAnimal() {
  const navigate = useNavigate();
  const auth = useAuth();
  const pode = (action) => (auth ? Boolean(auth.can?.(action)) : true);
  const [catalog, setCatalog] = useState({ pesagens: [], apartacoes: [], lotes: [], animais: [], sessoes: [] });
  const [selectedKey, setSelectedKey] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [range, setRange] = useState('all');
  const [sanity, setSanity] = useState({ rows: [], loading: false, error: '' });

  useEffect(() => {
    loadOperationalCatalog().then((data) => setCatalog(data)).catch((error) => toast.error(error.message || 'Não foi possível carregar a ficha do animal.'));
  }, []);

  const profiles = useMemo(() => buildProfiles(catalog), [catalog]);
  const selected = profiles.find((profile) => profile.key === selectedKey) || profiles[0] || null;
  useEffect(() => { if (!selectedKey && profiles[0]) setSelectedKey(profiles[0].key); }, [profiles, selectedKey]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mb1:breadcrumb-detail', { detail: selected ? `Animal ${selected.number} · ${selected.brand}` : 'Ficha do Animal' }));
    return () => window.dispatchEvent(new CustomEvent('mb1:breadcrumb-detail', { detail: '' }));
  }, [selected]);

  // Sanidade do animal (weighing.read): aplicações da store aplicacoesSanidade, inclusive
  // canceladas (marcadas na seção). Somente leitura aqui.
  const canReadSanity = pode('weighing.read');
  const selectedAnimalId = selected?.animalId || null;
  useEffect(() => {
    if (!canReadSanity || !selectedAnimalId) {
      setSanity({ rows: [], loading: false, error: '' });
      return undefined;
    }
    let active = true;
    setSanity({ rows: [], loading: true, error: '' });
    listApplications({ animalId: selectedAnimalId, includeCancelled: true })
      .then((rows) => { if (active) setSanity({ rows: rows || [], loading: false, error: '' }); })
      .catch((error) => { if (active) setSanity({ rows: [], loading: false, error: error?.message || 'Não foi possível carregar as aplicações de sanidade.' }); });
    return () => { active = false; };
  }, [canReadSanity, selectedAnimalId]);

  const results = useMemo(() => {
    const term = query.trim().toLocaleUpperCase('pt-BR');
    if (!term) return profiles.slice(0, 10);
    return profiles.filter((profile) => `${profile.number} ${profile.brand} ${profile.race}`.toLocaleUpperCase('pt-BR').includes(term)).slice(0, 12);
  }, [profiles, query]);

  // E1G: curva com eixo de tempo REAL, eixo Y em kg e dica por ponto — o mesmo desenho dos gráficos dos relatórios
  // (chartGeometry/renderChartSvg), só com pesagens COM peso; a legenda sai do mesmo intervalo (curveLegend).
  const curve = useMemo(() => buildAnimalWeightCurve(selected?.entries ?? [], { range }), [selected, range]);
  const curveText = curveLegend(curve.resumo);

  if (!selected) return <main className="op-screen"><section className="op-card"><div className="op-empty">Nenhum animal cadastrado. Faça o primeiro lançamento para gerar a ficha.</div></section></main>;

  // Peso atual, ganho e GMD usam só eventos COM peso (Saída sem peso não vira 0 kg).
  const weighed = selected.entries.filter((row) => hasNumber(row.peso) && Number(row.peso) > 0);
  const first = weighed[0];
  const latest = selected.entries.at(-1);
  const latestWeighed = weighed.at(-1);
  const totalGain = weighed.length >= 2 ? Number(latestWeighed.peso) - Number(first.peso) : null;
  const totalDays = weighed.length >= 2 ? dayDiff(first.data_pesagem, latestWeighed.data_pesagem) : 0;
  // GMD do animal no período = (peso final − peso inicial) ÷ dias (ponderado por construção).
  const averageGmd = totalGain !== null && totalDays > 0 ? totalGain / totalDays : null;
  const carcass = calculateCarcassTrade({ weight: latestWeighed?.peso, yieldPercent: latestWeighed?.rendimento_carcaca });
  const latestGmd = hasNumber(latest?.gmd) ? Number(latest.gmd) : null;
  const historyRows = [...selected.entries].reverse();
  const events = historyRows.map((row, index) => ({
    title: `${row.tipo_manejo === 'Cadastro' ? 'Cadastro' : row.tipo_manejo === 'Saída' ? row.motivo_saida || 'Saída' : 'Pesagem'}${hasNumber(row.peso) ? ` ${nf.format(Number(row.peso))} kg` : ''}`,
    date: row.data_pesagem,
    detail: [row.tipo_manejo, row.nome_lote, hasNumber(row.gmd) ? `GMD ${n3.format(Number(row.gmd))} kg/dia` : null].filter(Boolean).join(' · '),
    color: row.tipo_manejo === 'Saída' ? '#dc2626' : index === historyRows.length - 1 ? '#5b6b80' : '#40de63',
  }));

  const choose = (profile) => {
    setSelectedKey(profile.key);
    setQuery(profile.number);
    setSearchOpen(false);
  };
  const exportHistory = () => {
    const headers = ['Data', 'Tipo', 'Peso', 'Dias', 'Ganho', 'GMD', 'Lote', 'Apartação', 'Observação'];
    const lines = historyRows.map((row) => [dateBr(row.data_pesagem), row.tipo_manejo, hasNumber(row.peso) ? nf.format(Number(row.peso)) : '', row.dias, hasNumber(row.ganho) ? nf.format(Number(row.ganho)) : '', hasNumber(row.gmd) ? n3.format(Number(row.gmd)) : '', row.nome_lote, row.nome_apartacao, row.observacao].map(csvCell).join(';'));
    download(`ficha-${selected.number}-${selected.brand}.csv`, `\ufeff${headers.map(csvCell).join(';')}\n${lines.join('\n')}`, 'text/csv;charset=utf-8');
    toast.success('Histórico do animal exportado.');
  };

  const kpis = [
    ['Peso atual', latestWeighed ? nf.format(Number(latestWeighed.peso)) : '—', dateBr(latestWeighed?.data_pesagem), ''],
    ['Ganho total', totalGain === null ? '—' : `${totalGain >= 0 ? '+' : ''}${nf.format(totalGain)}`, 'desde o cadastro', 'accent'],
    ['GMD médio', averageGmd === null ? '—' : n3.format(averageGmd), `kg/dia · ${ni.format(totalDays)} dias`, 'accent'],
    ['GMD última', latestGmd !== null ? n3.format(latestGmd) : '—', latest?.data_anterior ? `vs. ${dateBr(latest.data_anterior)}` : 'primeira pesagem', 'accent'],
    ...(pode('commercial.values') ? [['@ carcaça est.', carcass.arrobas === null ? '—' : nf.format(carcass.arrobas), carcass.yieldPercent === null ? 'sem rendimento informado' : `rendimento ${nf.format(carcass.yieldPercent)}% · 1 @ = 15 kg`, '']] : []),
    ['Pesagens', ni.format(selected.entries.length), 'série completa', ''],
  ];

  return (
    <main className="op-screen" aria-label="Ficha do Animal">
      <div className="op-toolbar op-toolbar--animal">
        <label className="op-field" style={{ width: 260 }}><Search /><input value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Brinco, nome ou marca" aria-label="Buscar animal" />{searchOpen && <div className="op-search-results">{results.map((profile) => <button className="op-search-result" type="button" key={profile.key} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(profile)}><span>{profile.number}</span><span className="op-pill">{profile.brand}</span><small>{profile.sex} · {profile.race}</small></button>)}{!results.length && <div className="op-empty">Nenhum animal encontrado.</div>}</div>}</label>
        <div className="op-animal-heading"><div className="op-animal-heading__line"><strong>{selected.number}</strong><span className="op-pill">{selected.brand}</span><span className={`op-pill ${['ATIVO', 'Ativo'].includes(selected.status) ? 'op-pill--active' : ''}`}>{selected.status}</span></div><span className="op-animal-heading__meta">{selected.sex} · {selected.race} · {selected.era} · {selected.lot} · {selected.apartacao}</span></div>
        <div className="op-toolbar-actions">{pode('reports.export') ? <button className="op-button" type="button" onClick={exportHistory}>Exportar histórico</button> : null}<button className="op-button op-button--primary" type="button" onClick={() => navigate('/LancamentoPesagensIndividuais')}>Lançar pesagem</button></div>
      </div>

      <div className="op-kpis">{kpis.map(([label, value, hint, accent]) => <div key={label} className={`op-kpi ${accent ? `op-kpi--${accent}` : ''}`}><span className="op-kpi__label">{label}</span><strong className="op-kpi__value">{value}</strong><span className="op-kpi__hint">{hint}</span></div>)}</div>

      <div className="op-grid-two">
        <section className="op-card"><header className="op-card__header"><h2>Curva de peso</h2><div className="op-segmented">{[['90', '90 dias'], ['183', '6 meses'], ['all', 'Tudo']].map(([value, label]) => <button className={range === value ? 'is-active' : ''} type="button" key={value} onClick={() => setRange(value)}>{label}</button>)}</div></header><div className="op-chart op-curve rpt-charts-host"><style>{CHART_SCREEN_CSS}</style>{curve.vazio ? <div className="op-empty">{curve.textoVazio}</div> : <ChartPlot chart={curve} uid="curva-peso" height={220} describe={curvePointTip} label="Curva de peso do animal" />}<div className="op-chart-legend"><span><i />Peso com balança</span><span>{curveText.pesagens} · {curveText.dias} · <strong className={curveText.tone === 'neg' ? 'is-negative' : curveText.tone === 'pos' ? 'is-positive' : ''}>{curveText.ganho}</strong></span></div></div></section>
        <section className="op-card"><header className="op-card__header"><h2>Linha do tempo</h2><span>{ni.format(events.length)} eventos</span></header><div className="op-timeline">{events.map((event, index) => <div className="op-event" key={`${event.date}-${index}`}><div className="op-event__rail"><span className="op-event__dot" style={{ background: event.color }} />{index < events.length - 1 && <span className="op-event__line" />}</div><div className="op-event__body"><strong>{event.title}</strong><time>{dateBr(event.date)}</time><span>{event.detail}</span></div></div>)}</div></section>
      </div>

      <section className="op-card"><header className="op-card__header"><h2>Histórico de pesagens</h2><span>{ni.format(historyRows.length)} registros</span></header><div className="op-table-scroll"><table className="op-table" style={{ minWidth: 820 }}><thead><tr><th>Data</th><th>Tipo</th><th className="is-number">Peso</th><th className="is-number">Dias</th><th className="is-number">Ganho</th><th className="is-number">GMD</th><th>Lote</th><th>Apartação</th><th>Observação</th></tr></thead><tbody>{historyRows.map((row) => { const gain = hasNumber(row.ganho) ? Number(row.ganho) : null; const gmd = hasNumber(row.gmd) ? Number(row.gmd) : null; return <tr key={row.id}><td>{dateBr(row.data_pesagem)}</td><td><span className={`op-type ${row.tipo_manejo === 'Cadastro' ? 'op-type--cadastro' : row.tipo_manejo === 'Saída' ? 'op-type--saida' : ''}`}>{row.tipo_manejo || 'Manejo'}</span></td><td className="is-number"><strong>{nf.format(Number(row.peso) || 0)}</strong></td><td className="is-number">{hasNumber(row.dias) ? ni.format(Number(row.dias)) : '—'}</td><td className={`is-number ${gain > 0 ? 'is-positive' : gain < 0 ? 'is-negative' : ''}`}>{gain !== null ? `${gain > 0 ? '+' : ''}${nf.format(gain)}` : '—'}</td><td className={`is-number ${gmd > 0 ? 'is-positive' : gmd < 0 ? 'is-negative' : ''}`}>{gmd !== null ? n3.format(gmd) : '—'}</td><td>{row.nome_lote || '—'}</td><td>{row.nome_apartacao || '—'}</td><td>{row.observacao || '—'}</td></tr>; })}</tbody></table></div></section>

      {canReadSanity ? <SanidadeAnimalCard applications={sanity.rows} loading={sanity.loading} error={sanity.error} viaLabels={VIA_LABELS} /> : null}
    </main>
  );
}
