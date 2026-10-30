import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import MakDateControl from '@/components/mak/MakDateControl';
import {
  AVISO_PAINEL,
  CENARIOS,
  CENARIO_LABELS,
  DIMENSOES,
  DIMENSAO_LABELS,
  exportDashboard,
  getDashboard,
  projectAnimal,
} from '@/modules/analytics/application/analyticsService';
import { describeError, fmtDate, isAnimalAtivo, loadRebanhoCatalog, todayIso } from '@/components/rebanho/rebanhoModel';
import '@/styles/rebanho.css';

// Menu RELATÓRIOS › Desempenho (F11–F14, F18): painel do gestor com janela, agrupamento (até duas dimensões),
// comparação com a janela anterior, metas e projeção por cenário. As tabelas da tela são as mesmas do CSV, do
// XLSX e do PDF. Projeção é estimativa do cenário: nunca vira pesagem.
const umAnoAntes = (iso) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;

function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Desempenho() {
  const auth = useAuth();
  const can = (action) => (auth ? Boolean(auth.can?.(action)) : true);
  const hoje = todayIso();
  const [janela, setJanela] = useState({ from: `${hoje.slice(0, 4)}-01-01`, to: hoje });
  const [dims, setDims] = useState(['raca']);
  const [comparar, setComparar] = useState(false);
  const [cenario, setCenario] = useState('BASE');
  const [painel, setPainel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [animais, setAnimais] = useState([]);
  const [proj, setProj] = useState({ animalId: '', alvo: '', resultado: null });

  const opts = useMemo(() => ({ ...janela, dimensoes: dims, cenario, hoje, comparar: comparar ? { from: umAnoAntes(janela.from), to: umAnoAntes(janela.to) } : null }), [janela, dims, cenario, comparar, hoje]);

  const calcular = useCallback(async () => {
    setLoading(true);
    try {
      setPainel(await getDashboard(opts));
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível montar o painel.'));
    } finally {
      setLoading(false);
    }
  }, [opts]);

  const podeLer = can('reports.read');
  const [primeiro, setPrimeiro] = useState(true);
  useEffect(() => {
    if (!podeLer || !primeiro) return;
    setPrimeiro(false);
    calcular();
    loadRebanhoCatalog().then((c) => setAnimais(c.animais.filter(isAnimalAtivo))).catch(() => {});
  }, [podeLer, primeiro, calcular]);

  const exportar = async (formato) => {
    try {
      const nome = `painel-desempenho-${janela.from}-a-${janela.to}`;
      if (formato === 'csv') {
        const r = await exportDashboard(opts, 'csv');
        download(`${nome}.csv`, r.text, 'text/csv;charset=utf-8');
      } else if (formato === 'xlsx') {
        const r = await exportDashboard(opts, 'xlsx');
        download(`${nome}.xlsx`, r.bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        const r = await exportDashboard(opts, 'html');
        const api = typeof window !== 'undefined' ? window.pesagemApp?.reports : null;
        if (api?.printToPdf) {
          const res = await api.printToPdf({ html: r.html, landscape: true, suggestedName: `${nome}.pdf` });
          if (res?.ok === false) throw new Error(res.error?.message || 'Falha ao gerar o PDF.');
        } else {
          const w = window.open('', '_blank');
          if (w) { w.document.write(r.html); w.document.close(); w.print(); }
        }
      }
      toast.success('Exportação concluída.');
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível exportar.'));
    }
  };

  const projetar = async () => {
    try {
      setProj((p) => ({ ...p, resultado: null }));
      const r = await projectAnimal(proj.animalId, proj.alvo);
      setProj((p) => ({ ...p, resultado: r }));
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  if (!podeLer) return <AccessDenied role={auth?.user?.role} permission="reports.read" />;
  const toggleDim = (d) => setDims((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d].slice(-2)));

  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page rb-page">
      <ModeloBase1PageHeader title="Desempenho" description="Ganho por raça, era, lote, origem e estação; metas, projeções e exposição à seca." />
      <div className="rb-toolbar" role="toolbar" aria-label="Filtros do painel">
        <span className="rb-toolbar__label">De</span>
        <MakDateControl value={janela.from} onChange={(e) => setJanela((j) => ({ ...j, from: e.target.value }))} ariaLabel="Início da janela" />
        <span className="rb-toolbar__label">até</span>
        <MakDateControl value={janela.to} onChange={(e) => setJanela((j) => ({ ...j, to: e.target.value }))} ariaLabel="Fim da janela" />
        <select className="rb-control rb-control--compact" value={cenario} onChange={(e) => setCenario(e.target.value)} aria-label="Cenário da projeção">{CENARIOS.map((c) => <option key={c} value={c}>Cenário {CENARIO_LABELS[c].toLowerCase()}</option>)}</select>
        <label className="rb-check"><input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} /> Comparar com o ano anterior</label>
        <button type="button" className="rb-btn rb-btn--primary" onClick={calcular} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> Calcular</button>
        {can('reports.export') ? (
          <>
            <button type="button" className="rb-btn" onClick={() => exportar('csv')} disabled={!painel}><Download size={14} aria-hidden="true" /> CSV</button>
            <button type="button" className="rb-btn" onClick={() => exportar('xlsx')} disabled={!painel}><Download size={14} aria-hidden="true" /> Excel</button>
            <button type="button" className="rb-btn" onClick={() => exportar('pdf')} disabled={!painel}><FileText size={14} aria-hidden="true" /> PDF</button>
          </>
        ) : null}
      </div>
      <div className="rb-toolbar" aria-label="Agrupar por">
        <span className="rb-toolbar__label">Agrupar por (até 2):</span>
        {DIMENSOES.map((d) => <label key={d} className="rb-check"><input type="checkbox" checked={dims.includes(d)} onChange={() => toggleDim(d)} /> {DIMENSAO_LABELS[d]}</label>)}
      </div>
      <div className="rb-scroll">
        <p className="rb-note">{AVISO_PAINEL} GMD só com intervalos de pelo menos {painel?.dias_minimos ?? '…'} dias (Configurações › Relatórios); grupo com menos de 3 animais com GMD fica como "sem dados suficientes".</p>
        {!painel ? <p className="rb-empty">{loading ? 'Calculando…' : 'Escolha a janela e clique em Calcular.'}</p> : painel.tabelas.map((t) => (
          <section key={t.id} className="rb-card" aria-label={t.titulo}>
            <h3 className="rb-subtitle">{t.titulo}</h3>
            <div className="rb-table-wrap rb-table-wrap--inline">
              <table className="rb-table">
                <thead><tr>{t.colunas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {t.linhas.length ? t.linhas.slice(0, 300).map((l, i) => <tr key={i}>{l.map((v, j) => <td key={j} className={typeof v === 'number' ? 'rb-num' : ''}>{v === null ? '—' : String(v)}</td>)}</tr>) : <tr><td colSpan={t.colunas.length} className="rb-empty">Sem dados na janela.</td></tr>}
                </tbody>
              </table>
            </div>
            {t.linhas.length > 300 ? <p className="rb-note">Mostrando 300 linhas; a exportação leva todas.</p> : null}
          </section>
        ))}

        <section className="rb-card" aria-label="Projeção de peso">
          <h3 className="rb-subtitle">Projeção de peso por animal (dia a dia, a partir do último peso real)</h3>
          <div className="rb-inline rb-inline--wrap">
            <select className="rb-control rb-control--compact" value={proj.animalId} onChange={(e) => setProj((p) => ({ ...p, animalId: e.target.value, resultado: null }))} aria-label="Animal para projetar">
              <option value="">Animal</option>
              {animais.slice(0, 2000).map((a) => <option key={a.id} value={a.id}>{a.numero_animal || '(sem identificação)'}{a.marca ? ` · ${a.marca}` : ''}</option>)}
            </select>
            <MakDateControl value={proj.alvo} onChange={(e) => setProj((p) => ({ ...p, alvo: e.target.value, resultado: null }))} ariaLabel="Data alvo da projeção" />
            <button type="button" className="rb-btn" onClick={projetar} disabled={!proj.animalId || !proj.alvo}>Projetar</button>
          </div>
          {proj.resultado ? (
            <div>
              <p className="rb-note">Base: {proj.resultado.base ? `${proj.resultado.base.peso_kg} kg em ${fmtDate(proj.resultado.base.data)} (peso real)` : 'animal sem peso real — não há projeção'}.</p>
              {Object.keys(proj.resultado.cenarios || {}).length ? Object.entries(proj.resultado.cenarios).map(([nome, r]) => (
                <p key={nome} className="rb-note"><strong>{CENARIO_LABELS[nome]}:</strong> {r.ok ? `${r.peso_kg.toLocaleString('pt-BR')} kg em ${fmtDate(r.alvo)} (${r.dias} dias: ${r.trechos.map((t) => `${t.dias} d × ${t.gmd} kg/dia ${t.fonte}`).join(' + ')})` : r.motivo}</p>
              )) : <p className="rb-note">Nenhum cenário cadastrado para este animal (Sistema › Parametrização › Metas e cenários).</p>}
            </div>
          ) : null}
        </section>
      </div>
    </ModeloBase1PageContainer>
  );
}
