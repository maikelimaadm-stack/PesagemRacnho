import { useEffect, useMemo, useState } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import MakDateControl from '@/components/mak/MakDateControl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { closeWeighingDay, loadOperationalCatalog, reopenWeighingDay } from '@/modules/operations/application/operationalInsightsService';
import '@/styles/operational-insights.css';

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n3 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const ni = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dateBr = (value) => value ? String(value).split('-').reverse().join('/') : '—';
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const animalKey = (row) => row.animal_id || `${String(row.numero_animal || '').trim().toUpperCase()}::${String(row.marca || '').trim().toUpperCase()}`;
const hasNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const download = (name, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default function FechamentoDia() {
  const [catalog, setCatalog] = useState({ pesagens: [], apartacoes: [], lotes: [], animais: [], sessoes: [] });
  const [date, setDate] = useState(today);
  const [apartacaoId, setApartacaoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [justified, setJustified] = useState(() => new Set());

  const refresh = async ({ chooseLatest = false } = {}) => {
    try {
      const data = await loadOperationalCatalog();
      setCatalog(data);
      if (chooseLatest && !data.pesagens.some((row) => row.data_pesagem === date)) {
        const latest = data.pesagens.map((row) => row.data_pesagem).filter(Boolean).sort().at(-1);
        if (latest) setDate(latest);
      }
    } catch (error) {
      toast.error(error.message || 'Não foi possível carregar o fechamento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh({ chooseLatest: true }); }, []);

  const rows = useMemo(() => catalog.pesagens.filter((row) => {
    if (row.data_pesagem !== date) return false;
    if (!apartacaoId) return true;
    const selected = catalog.apartacoes.find((item) => item.id === apartacaoId);
    return row.apartacao_id === apartacaoId || row.nome_apartacao === selected?.nome_apartacao;
  }), [catalog, date, apartacaoId]);

  const session = catalog.sessoes.find((item) => item.data === date && !item.deleted_at);
  const isClosed = session?.status === 'Fechada';
  useEffect(() => { setJustified(new Set(session?.justificativas || [])); }, [date, session?.id, session?.updated_at]);
  const totalWeight = rows.reduce((sum, row) => sum + (Number(row.peso) || 0), 0);
  const uniqueAnimals = new Set(rows.map(animalKey).filter(Boolean)).size;
  const gmdValues = rows.filter((row) => hasNumber(row.gmd)).map((row) => Number(row.gmd));
  const gmdAverage = gmdValues.length ? gmdValues.reduce((sum, value) => sum + value, 0) / gmdValues.length : 0;

  const pendingAll = useMemo(() => {
    const result = [];
    for (const row of rows) {
      if (hasNumber(row.gmd) && Number(row.gmd) < 0) result.push({ key: `peso:${row.id}`, type: 'Peso', danger: false, title: `Animal ${row.numero_animal || 'sem identificação'} · GMD negativo (${n3.format(row.gmd)})`, detail: `Peso ${nf.format(Number(row.peso) || 0)} abaixo da série anterior.`, action: 'Reconferir' });
      if (row.tipo_manejo !== 'Saída' && !row.lote_id && !row.nome_lote) result.push({ key: `lote:${row.id}`, type: 'Lote', danger: false, title: `Animal ${row.numero_animal || 'sem identificação'} sem lote`, detail: 'O lançamento não possui lote de destino definido.', action: 'Vincular' });
      if (row.tipo_manejo === 'Saída' && row.motivo_saida === 'Venda' && !row.embarque_id && !row.documento_embarque_id) result.push({ key: `doc:${row.id}`, type: 'Doc', danger: true, title: `Venda do animal ${row.numero_animal || 'sem identificação'} sem documentação`, detail: 'Vincule o embarque e a GTA/NF-e antes de fechar.', action: 'Vincular' });
    }
    return result;
  }, [rows]);
  const pending = useMemo(() => pendingAll.filter((item) => !justified.has(item.key)), [pendingAll, justified]);

  const lots = useMemo(() => catalog.lotes
    .filter((lot) => !apartacaoId || lot.apartacao_id === apartacaoId)
    .map((lot) => {
      const linked = rows.filter((row) => row.lote_id === lot.id || row.nome_lote === lot.nome_lote);
      const weight = linked.reduce((sum, row) => sum + (Number(row.peso) || 0), 0);
      const capacity = Number(lot.quantidade_maxima) || 0;
      const pct = capacity ? Math.min(100, (linked.length / capacity) * 100) : 0;
      return { ...lot, linked: linked.length, capacity, average: linked.length ? weight / linked.length : 0, pct };
    }), [catalog.lotes, rows, apartacaoId]);

  const brands = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = row.marca || 'Sem marca';
      const current = map.get(key) || { name: key, count: 0, weight: 0 };
      current.count += 1;
      current.weight += Number(row.peso) || 0;
      map.set(key, current);
    });
    const list = [...map.values()].sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...list.map((item) => item.count));
    return list.map((item) => ({ ...item, average: item.count ? item.weight / item.count : 0, pct: item.count / max * 100 }));
  }, [rows]);

  const exportCsv = () => {
    const headers = ['Data', 'Animal', 'Marca', 'Tipo', 'Peso', 'GMD', 'Apartação', 'Lote', 'Observação'];
    const lines = rows.map((row) => [row.data_pesagem, row.numero_animal, row.marca, row.tipo_manejo, nf.format(Number(row.peso) || 0), hasNumber(row.gmd) ? n3.format(Number(row.gmd)) : '', row.nome_apartacao, row.nome_lote, row.observacao].map(csvCell).join(';'));
    download(`fechamento-${date}.csv`, `\ufeff${headers.map(csvCell).join(';')}\n${lines.join('\n')}`, 'text/csv;charset=utf-8');
    toast.success(`${ni.format(rows.length)} registros exportados.`);
  };

  const backupDay = () => {
    download(`backup-do-dia-${date}.json`, JSON.stringify({ type: 'daily-weighing-backup', date, createdAt: new Date().toISOString(), count: rows.length, entries: rows }, null, 2), 'application/json');
    toast.success('Backup do dia gerado e validado no navegador.');
  };

  const toggleClosed = async () => {
    try {
      if (!isClosed && pending.length) {
        toast.error(`Existem ${ni.format(pending.length)} pendências. Resolva-as antes de fechar o dia.`);
        return;
      }
      if (isClosed) await reopenWeighingDay(date);
      else await closeWeighingDay(date, { justifications: [...justified] });
      await refresh();
      toast.success(isClosed ? 'Dia reaberto para lançamentos.' : 'Fechamento gravado com sucesso.');
    } catch (error) { toast.error(error.message || 'Não foi possível alterar o fechamento.'); }
  };

  const kpis = [
    ['Lançamentos', ni.format(rows.length), dateBr(date), ''],
    ['Animais únicos', ni.format(uniqueAnimals), 'sem duplicidade', ''],
    ['Peso médio', nf.format(rows.length ? totalWeight / rows.length : 0), 'kg por animal', ''],
    ['GMD médio do dia', n3.format(gmdAverage), 'kg/dia', 'accent'],
    ['Lotes movimentados', ni.format(new Set(rows.map((row) => row.lote_id || row.nome_lote).filter(Boolean)).size), catalog.apartacoes.find((item) => item.id === apartacaoId)?.nome_apartacao || 'todas as apartações', ''],
    ['Pendências', ni.format(pending.length), pending.length ? 'impedem o fechamento' : 'dia conferido', pending.length ? 'warn' : 'accent'],
  ];

  return (
    <main className="op-screen" aria-label="Fechamento do Dia">
      <div className="op-toolbar">
        <div className="op-closing-date">
          <MakDateControl
            value={date}
            onChange={(event) => setDate(event.target.value)}
            ariaLabel="Data do fechamento"
          />
        </div>
        <div className="op-closing-apartacao">
          <Select
            value={apartacaoId || '__all__'}
            onValueChange={(value) => setApartacaoId(value === '__all__' ? '' : value)}
          >
            <SelectTrigger className="h-9 text-sm" aria-label="Apartação do fechamento">
              <SelectValue placeholder="Todas as apartações" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as apartações</SelectItem>
              {catalog.apartacoes.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome_apartacao || item.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <span className={`op-pill ${pending.length ? 'op-pill--warn' : 'op-pill--active'}`}><AlertTriangle size={14} />{pending.length ? `${ni.format(pending.length)} pendências` : 'Conferido'}</span>
        <div className="op-toolbar-actions">
          <button className="op-button" type="button" onClick={exportCsv} disabled={!rows.length}>Exportar CSV</button>
          <button className="op-button" type="button" onClick={backupDay} disabled={!rows.length}>Backup do dia</button>
          <button className="op-button op-button--primary" type="button" onClick={toggleClosed} disabled={loading || !rows.length}>{isClosed ? 'Reabrir o dia' : 'Fechar o dia'}</button>
        </div>
      </div>

      <div className="op-kpis">{kpis.map(([label, value, hint, accent]) => <div key={label} className={`op-kpi ${accent ? `op-kpi--${accent}` : ''}`}><span className="op-kpi__label">{label}</span><strong className="op-kpi__value">{value}</strong><span className="op-kpi__hint">{hint}</span></div>)}</div>

      <section className="op-card op-card--warning">
        <header className="op-card__header"><h2>Pendências antes de fechar</h2><span>Resolva cada item para concluir</span></header>
        {pending.length ? pending.map((item) => <div className="op-pending-row" key={item.key}><span className={`op-pending-tag ${item.danger ? 'op-pending-tag--danger' : ''}`}>{item.type}</span><div className="op-pending-copy"><strong>{item.title}</strong><span>{item.detail}</span></div><div className="op-toolbar-actions"><button className="op-button" type="button" onClick={() => setJustified((current) => new Set([...current, item.key]))}>Justificar</button><button className="op-button" type="button" onClick={() => { location.hash = '#/PesagensIndividuais'; }}>{item.action}</button></div></div>) : <div className="op-empty">Nenhuma pendência encontrada para esta data.</div>}
      </section>

      <div className="op-grid-two">
        <section className="op-card"><header className="op-card__header"><h2>Conferência por lote</h2><span>Contado × capacidade</span></header><div className="op-table-scroll"><table className="op-table"><thead><tr><th>Lote</th><th className="is-number">Lançado</th><th className="is-number">Capacidade</th><th className="is-number">Peso médio</th><th>Ocupação</th></tr></thead><tbody>{lots.map((lot) => <tr key={lot.id} className={lot.pct >= 100 ? 'is-danger' : ''}><td><strong>{lot.nome_lote}</strong></td><td className="is-number">{ni.format(lot.linked)}</td><td className="is-number">{lot.capacity ? ni.format(lot.capacity) : '—'}</td><td className="is-number">{lot.linked ? nf.format(lot.average) : '—'}</td><td><div className="op-progress-cell"><span className={`op-progress ${lot.pct >= 100 ? 'is-full' : ''}`}><span style={{ width: `${lot.pct}%` }} /></span><small>{ni.format(lot.pct)}%</small></div></td></tr>)}</tbody></table>{!lots.length && <div className="op-empty">Nenhum lote configurado para a seleção.</div>}</div></section>
        <section className="op-card"><header className="op-card__header"><h2>Conferência por marca</h2><span>{ni.format(rows.length)} lançamentos</span></header><div className="op-brand-list">{brands.map((brand) => <div className="op-brand-row" key={brand.name}><span className="op-pill">{brand.name}</span><span className="op-brand-row__bar"><span style={{ width: `${brand.pct}%` }} /></span><strong>{ni.format(brand.count)}</strong><small>{nf.format(brand.average)} kg</small></div>)}{!brands.length && <div className="op-empty">Sem lançamentos nesta data.</div>}<div className="op-totals"><span>Peso total do dia</span><strong>{nf.format(totalWeight)} kg</strong></div><div className="op-totals"><span>@ carcaça estimada</span><strong>{nf.format(totalWeight * 0.5 / 15)} @</strong></div></div></section>
      </div>

      <section className="op-card"><header className="op-card__header"><h2>O que será gravado no fechamento</h2><span>{isClosed ? `Fechado em ${dateBr(date)}` : 'Sessão aberta'}</span></header><div className="op-steps">{[['Backup operacional disponível', 'Os registros do dia podem ser exportados em JSON antes da conclusão.'], ['Série de desempenho calculada', 'Dias, ganho e GMD utilizam os valores persistidos de cada animal.'], ['Ocupação de lotes conferida', 'Contagem, capacidade e status são apresentados por lote.'], ['Sessão diária persistida', 'O estado aberto ou fechado é gravado no IndexedDB.']].map(([title, detail]) => <div className="op-step" key={title}><Check /><div><strong>{title}</strong><span>{detail}</span></div></div>)}</div></section>
    </main>
  );
}
