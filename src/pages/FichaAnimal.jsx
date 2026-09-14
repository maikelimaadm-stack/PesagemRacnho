import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { loadOperationalCatalog } from '@/modules/operations/application/operationalInsightsService';
import '@/styles/operational-insights.css';

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n3 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const ni = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dateBr = (value) => value ? String(value).split('-').reverse().join('/') : '—';
const shortDate = (value) => value ? dateBr(value).slice(0, 5) : '—';
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
    const animal = catalog.animais.find((item) => item.id === latest.animal_id) || {};
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
  const [catalog, setCatalog] = useState({ pesagens: [], apartacoes: [], lotes: [], animais: [], sessoes: [] });
  const [selectedKey, setSelectedKey] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [range, setRange] = useState('all');

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

  const results = useMemo(() => {
    const term = query.trim().toLocaleUpperCase('pt-BR');
    if (!term) return profiles.slice(0, 10);
    return profiles.filter((profile) => `${profile.number} ${profile.brand} ${profile.race}`.toLocaleUpperCase('pt-BR').includes(term)).slice(0, 12);
  }, [profiles, query]);

  const rangedEntries = useMemo(() => {
    if (!selected) return [];
    if (range === 'all') return selected.entries;
    const latest = selected.entries.at(-1)?.data_pesagem;
    if (!latest) return selected.entries;
    const days = range === '90' ? 90 : 183;
    const cutoff = new Date(`${latest}T12:00:00`);
    cutoff.setDate(cutoff.getDate() - days);
    const iso = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    return selected.entries.filter((entry) => entry.data_pesagem >= iso);
  }, [selected, range]);

  const chart = useMemo(() => {
    const values = rangedEntries.map((row) => Number(row.peso)).filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) return { points: '', area: '', dots: [], min: 0, max: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(1, max - min);
    const dots = values.map((value, index) => ({
      x: values.length === 1 ? 310 : 20 + index * 580 / (values.length - 1),
      y: 176 - (value - min) / spread * 142,
      value,
    }));
    const points = dots.map((dot) => `${dot.x},${dot.y}`).join(' ');
    return { points, area: `${points} ${dots.at(-1).x},199 ${dots[0].x},199`, dots, min, max };
  }, [rangedEntries]);

  if (!selected) return <main className="op-screen"><section className="op-card"><div className="op-empty">Nenhum animal cadastrado. Faça o primeiro lançamento para gerar a ficha.</div></section></main>;

  const first = selected.entries[0];
  const latest = selected.entries.at(-1);
  const totalGain = (Number(latest?.peso) || 0) - (Number(first?.peso) || 0);
  const totalDays = first?.data_pesagem && latest?.data_pesagem ? dayDiff(first.data_pesagem, latest.data_pesagem) : 0;
  const averageGmd = totalDays ? totalGain / totalDays : 0;
  const latestGmd = hasNumber(latest?.gmd) ? Number(latest.gmd) : null;
  const historyRows = [...selected.entries].reverse();
  const events = historyRows.map((row, index) => ({
    title: `${row.tipo_manejo === 'Cadastro' ? 'Cadastro' : row.tipo_manejo === 'Saída' ? row.motivo_saida || 'Saída' : 'Pesagem'} ${nf.format(Number(row.peso) || 0)} kg`,
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
    const lines = historyRows.map((row) => [dateBr(row.data_pesagem), row.tipo_manejo, nf.format(Number(row.peso) || 0), row.dias, hasNumber(row.ganho) ? nf.format(Number(row.ganho)) : '', hasNumber(row.gmd) ? n3.format(Number(row.gmd)) : '', row.nome_lote, row.nome_apartacao, row.observacao].map(csvCell).join(';'));
    download(`ficha-${selected.number}-${selected.brand}.csv`, `\ufeff${headers.map(csvCell).join(';')}\n${lines.join('\n')}`, 'text/csv;charset=utf-8');
    toast.success('Histórico do animal exportado.');
  };

  const kpis = [
    ['Peso atual', nf.format(Number(latest?.peso) || 0), dateBr(latest?.data_pesagem), ''],
    ['Ganho total', `${totalGain >= 0 ? '+' : ''}${nf.format(totalGain)}`, 'desde o cadastro', 'accent'],
    ['GMD médio', n3.format(averageGmd), `kg/dia · ${ni.format(totalDays)} dias`, 'accent'],
    ['GMD última', latestGmd !== null ? n3.format(latestGmd) : '—', latest?.data_anterior ? `vs. ${dateBr(latest.data_anterior)}` : 'primeira pesagem', 'accent'],
    ['@ carcaça est.', nf.format((Number(latest?.peso) || 0) * .5 / 15), 'rendimento 50%', ''],
    ['Pesagens', ni.format(selected.entries.length), 'série completa', ''],
  ];

  return (
    <main className="op-screen" aria-label="Ficha do Animal">
      <div className="op-toolbar op-toolbar--animal">
        <label className="op-field" style={{ width: 260 }}><Search /><input value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Brinco, nome ou marca" aria-label="Buscar animal" />{searchOpen && <div className="op-search-results">{results.map((profile) => <button className="op-search-result" type="button" key={profile.key} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(profile)}><span>{profile.number}</span><span className="op-pill">{profile.brand}</span><small>{profile.sex} · {profile.race}</small></button>)}{!results.length && <div className="op-empty">Nenhum animal encontrado.</div>}</div>}</label>
        <div className="op-animal-heading"><div className="op-animal-heading__line"><strong>{selected.number}</strong><span className="op-pill">{selected.brand}</span><span className={`op-pill ${['ATIVO', 'Ativo'].includes(selected.status) ? 'op-pill--active' : ''}`}>{selected.status}</span></div><span className="op-animal-heading__meta">{selected.sex} · {selected.race} · {selected.era} · {selected.lot} · {selected.apartacao}</span></div>
        <div className="op-toolbar-actions"><button className="op-button" type="button" onClick={exportHistory}>Exportar histórico</button><button className="op-button op-button--primary" type="button" onClick={() => navigate('/LancamentoPesagensIndividuais')}>Lançar pesagem</button></div>
      </div>

      <div className="op-kpis">{kpis.map(([label, value, hint, accent]) => <div key={label} className={`op-kpi ${accent ? `op-kpi--${accent}` : ''}`}><span className="op-kpi__label">{label}</span><strong className="op-kpi__value">{value}</strong><span className="op-kpi__hint">{hint}</span></div>)}</div>

      <div className="op-grid-two">
        <section className="op-card"><header className="op-card__header"><h2>Curva de peso</h2><div className="op-segmented">{[['90', '90 dias'], ['183', '6 meses'], ['all', 'Tudo']].map(([value, label]) => <button className={range === value ? 'is-active' : ''} type="button" key={value} onClick={() => setRange(value)}>{label}</button>)}</div></header><div className="op-chart"><svg viewBox="0 0 620 200" preserveAspectRatio="none" role="img" aria-label="Curva de peso do animal"><line x1="0" y1="20" x2="620" y2="20" stroke="#eef1f4" /><line x1="0" y1="65" x2="620" y2="65" stroke="#eef1f4" /><line x1="0" y1="110" x2="620" y2="110" stroke="#eef1f4" /><line x1="0" y1="155" x2="620" y2="155" stroke="#eef1f4" /><line x1="0" y1="199" x2="620" y2="199" stroke="#e4e8ed" />{chart.dots.length > 1 && <polygon points={chart.area} fill="rgba(64,222,99,.12)" />}{chart.dots.length > 1 && <polyline points={chart.points} fill="none" stroke="#40de63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}{chart.dots.map((dot, index) => <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r={index === chart.dots.length - 1 ? 6 : 5} fill={index === chart.dots.length - 1 ? '#40de63' : '#fff'} stroke="#40de63" strokeWidth="3" />)}</svg><div className="op-chart-labels">{rangedEntries.map((entry) => <span key={entry.id}>{shortDate(entry.data_pesagem)}</span>)}</div><div className="op-chart-legend"><span><i />Peso registrado</span><span>{ni.format(rangedEntries.length)} pesagens · {ni.format(totalDays)} dias · <strong className={totalGain >= 0 ? 'is-positive' : 'is-negative'}>{totalGain >= 0 ? '+' : ''}{nf.format(totalGain)} kg</strong></span></div></div></section>
        <section className="op-card"><header className="op-card__header"><h2>Linha do tempo</h2><span>{ni.format(events.length)} eventos</span></header><div className="op-timeline">{events.map((event, index) => <div className="op-event" key={`${event.date}-${index}`}><div className="op-event__rail"><span className="op-event__dot" style={{ background: event.color }} />{index < events.length - 1 && <span className="op-event__line" />}</div><div className="op-event__body"><strong>{event.title}</strong><time>{dateBr(event.date)}</time><span>{event.detail}</span></div></div>)}</div></section>
      </div>

      <section className="op-card"><header className="op-card__header"><h2>Histórico de pesagens</h2><span>{ni.format(historyRows.length)} registros</span></header><div className="op-table-scroll"><table className="op-table" style={{ minWidth: 820 }}><thead><tr><th>Data</th><th>Tipo</th><th className="is-number">Peso</th><th className="is-number">Dias</th><th className="is-number">Ganho</th><th className="is-number">GMD</th><th>Lote</th><th>Apartação</th><th>Observação</th></tr></thead><tbody>{historyRows.map((row) => { const gain = hasNumber(row.ganho) ? Number(row.ganho) : null; const gmd = hasNumber(row.gmd) ? Number(row.gmd) : null; return <tr key={row.id}><td>{dateBr(row.data_pesagem)}</td><td><span className={`op-type ${row.tipo_manejo === 'Cadastro' ? 'op-type--cadastro' : row.tipo_manejo === 'Saída' ? 'op-type--saida' : ''}`}>{row.tipo_manejo || 'Manejo'}</span></td><td className="is-number"><strong>{nf.format(Number(row.peso) || 0)}</strong></td><td className="is-number">{hasNumber(row.dias) ? ni.format(Number(row.dias)) : '—'}</td><td className={`is-number ${gain > 0 ? 'is-positive' : gain < 0 ? 'is-negative' : ''}`}>{gain !== null ? `${gain > 0 ? '+' : ''}${nf.format(gain)}` : '—'}</td><td className={`is-number ${gmd > 0 ? 'is-positive' : gmd < 0 ? 'is-negative' : ''}`}>{gmd !== null ? n3.format(gmd) : '—'}</td><td>{row.nome_lote || '—'}</td><td>{row.nome_apartacao || '—'}</td><td>{row.observacao || '—'}</td></tr>; })}</tbody></table></div></section>
    </main>
  );
}
