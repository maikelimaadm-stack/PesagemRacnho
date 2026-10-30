import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import MakDateControl from '@/components/mak/MakDateControl';
import { CLASSES_ENTRADA, CLASSES_SAIDA, CLASSE_LABELS, getInventory } from '@/modules/livestock/application/operationsService';
import { downloadCsvFile } from '@/modules/weighing/export/csvDownload';
import {
  READ_PERMISSION,
  csvEscape,
  describeError,
  firstDayOfMonth,
  fmtDate,
  fmtInt,
  loadRebanhoCatalog,
  rebanhoPermissions,
  todayIso,
} from '@/components/rebanho/rebanhoModel';
import '@/styles/rebanho.css';

// Menu REBANHO › Inventário (F17): saldo do período pelo livro de movimentos —
// saldo inicial + entradas + nascimentos − saídas − mortes ± ajustes = saldo final —, por lote, propriedade,
// sexo, raça, categoria e marca. Conferência com o cadastro dos animais e divergências por animal: nada é
// corrigido aqui; ajustes entram como operação de Entrada/Saída com justificativa.
export default function Inventario() {
  const auth = useAuth();
  const { canRead } = rebanhoPermissions(auth);
  const [periodo, setPeriodo] = useState({ from: firstDayOfMonth(), to: todayIso() });
  const [filtros, setFiltros] = useState({ lote_id: '', propriedade_id: '', sexo: '', raca_id: '', categoria_id: '', marca_id: '' });
  const [catalog, setCatalog] = useState({ lotes: [], propriedades: [], racas: [], marcas: [] });
  const [categorias, setCategorias] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canRead) return;
    loadRebanhoCatalog().then((c) => {
      setCatalog(c);
      const ids = new Map();
      for (const a of c.animais) if (a.categoria_id) ids.set(a.categoria_id, a.categoria_nome || a.categoria_id);
      setCategorias([...ids.entries()].map(([value, label]) => ({ value, label })));
    }).catch(() => {});
  }, [canRead]);

  const calcular = useCallback(async () => {
    setLoading(true);
    try {
      const limpos = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
      if (limpos.lote_id && limpos.propriedade_id) delete limpos.propriedade_id;
      setResult(await getInventory({ from: periodo.from, to: periodo.to, filtros: limpos }));
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível calcular o inventário.'));
    } finally {
      setLoading(false);
    }
  }, [periodo, filtros]);

  // Primeiro cálculo ao abrir; depois só no botão Calcular.
  const [primeiro, setPrimeiro] = useState(true);
  useEffect(() => {
    if (canRead && primeiro) { setPrimeiro(false); calcular(); }
  }, [canRead, primeiro, calcular]);

  const linhasEntrada = useMemo(() => (result ? CLASSES_ENTRADA.filter((c) => result.entradas.por_classe[c]) : []), [result]);
  const linhasSaida = useMemo(() => (result ? CLASSES_SAIDA.filter((c) => result.saidas.por_classe[c]) : []), [result]);

  const exportar = () => {
    if (!result) return;
    const linhas = [
      ['Inventário', `${fmtDate(result.periodo.from)} a ${fmtDate(result.periodo.to)}`],
      ['Saldo inicial', result.saldo_inicial],
      ...CLASSES_ENTRADA.map((c) => [`+ ${CLASSE_LABELS[c]}`, result.entradas.por_classe[c]]),
      ...CLASSES_SAIDA.map((c) => [`- ${CLASSE_LABELS[c]}`, result.saidas.por_classe[c]]),
      ...(result.internas ? [['+ Transferências internas recebidas', result.internas.recebidas], ['- Transferências internas enviadas', result.internas.enviadas]] : []),
      ['Saldo final', result.saldo_final],
      [],
      ['Animais no saldo final'],
      ['Número', 'Marca', 'Sexo', 'Raça'],
      ...result.animais_no_saldo_final.map((a) => [a.numero_animal || '(sem identificação)', a.marca || '', a.sexo || '', a.raca || '']),
      [],
      ...(result.limitacoes?.length ? [['Limitações'], ...result.limitacoes.map((l) => [l]), []] : []),
      ...(result.conferencia.indeterminados?.length ? [['Local indeterminado'], ...result.conferencia.indeterminados.map((d) => [d.numero_animal]), []] : []),
      ['Divergências'],
      ['Número', 'Motivo'],
      ...result.conferencia.divergencias.map((d) => [d.numero_animal, d.motivo]),
    ];
    const content = `\uFEFF${linhas.map((l) => l.map(csvEscape).join(';')).join('\r\n')}`;
    downloadCsvFile({ content, fileName: `inventario-${result.periodo.from}-a-${result.periodo.to}.csv` });
  };

  if (!canRead) return <AccessDenied role={auth?.user?.role} permission={READ_PERMISSION} />;
  const setF = (campo) => (event) => setFiltros((f) => ({ ...f, [campo]: event.target.value }));
  const opts = (rows, campo = 'nome') => rows.map((r) => <option key={r.id} value={r.id}>{r[campo] || r.nome}</option>);

  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page rb-page">
      <ModeloBase1PageHeader title="Inventário" description="Saldo do rebanho no período pelo livro de movimentos, com conferência por animal." />
      <div className="rb-toolbar" role="toolbar" aria-label="Filtros do inventário">
        <span className="rb-toolbar__label">De</span>
        <MakDateControl value={periodo.from} onChange={(e) => setPeriodo((p) => ({ ...p, from: e.target.value }))} ariaLabel="Data inicial" />
        <span className="rb-toolbar__label">até</span>
        <MakDateControl value={periodo.to} onChange={(e) => setPeriodo((p) => ({ ...p, to: e.target.value }))} ariaLabel="Data final" />
        <select className="rb-control rb-control--compact" value={filtros.lote_id} onChange={setF('lote_id')} aria-label="Lote"><option value="">Todos os lotes</option>{opts(catalog.lotes, 'nome_lote')}</select>
        <select className="rb-control rb-control--compact" value={filtros.propriedade_id} onChange={setF('propriedade_id')} aria-label="Propriedade" disabled={Boolean(filtros.lote_id)}><option value="">Todas as propriedades</option>{opts(catalog.propriedades)}</select>
        <select className="rb-control rb-control--compact" value={filtros.sexo} onChange={setF('sexo')} aria-label="Sexo"><option value="">Ambos os sexos</option><option value="M">Machos</option><option value="F">Fêmeas</option></select>
        <select className="rb-control rb-control--compact" value={filtros.raca_id} onChange={setF('raca_id')} aria-label="Raça"><option value="">Todas as raças</option>{opts(catalog.racas)}</select>
        <select className="rb-control rb-control--compact" value={filtros.marca_id} onChange={setF('marca_id')} aria-label="Marca a fogo"><option value="">Todas as marcas</option>{opts(catalog.marcas)}</select>
        {categorias.length ? <select className="rb-control rb-control--compact" value={filtros.categoria_id} onChange={setF('categoria_id')} aria-label="Categoria" title="Categoria ATUAL do animal (não a da data)"><option value="">Todas as categorias (atual)</option>{categorias.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select> : null}
        <button type="button" className="rb-btn rb-btn--primary" onClick={calcular} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> Calcular</button>
        <button type="button" className="rb-btn" onClick={exportar} disabled={!result}><Download size={14} aria-hidden="true" /> CSV</button>
      </div>
      <div className="rb-scroll">
        {!result ? <p className="rb-empty">{loading ? 'Calculando…' : 'Escolha o período e clique em Calcular.'}</p> : (
          <>
            <section className="rb-card" aria-label="Saldo do período">
              <table className="rb-table rb-table--balance">
                <tbody>
                  <tr className="rb-balance-strong"><th scope="row">Saldo inicial ({fmtDate(result.periodo.from)})</th><td className="rb-num">{fmtInt(result.saldo_inicial)}</td></tr>
                  {linhasEntrada.map((c) => <tr key={c}><th scope="row">+ {CLASSE_LABELS[c]}</th><td className="rb-num">{fmtInt(result.entradas.por_classe[c])}</td></tr>)}
                  {linhasSaida.map((c) => <tr key={c}><th scope="row">− {CLASSE_LABELS[c]}</th><td className="rb-num">{fmtInt(result.saidas.por_classe[c])}</td></tr>)}
                  {result.internas ? (
                    <>
                      <tr><th scope="row">+ Transferências internas recebidas</th><td className="rb-num">{fmtInt(result.internas.recebidas)}</td></tr>
                      <tr><th scope="row">− Transferências internas enviadas</th><td className="rb-num">{fmtInt(result.internas.enviadas)}</td></tr>
                    </>
                  ) : null}
                  <tr className="rb-balance-strong"><th scope="row">Saldo final ({fmtDate(result.periodo.to)})</th><td className="rb-num">{fmtInt(result.saldo_final)}</td></tr>
                </tbody>
              </table>
              <p className={`rb-note ${result.conferencia.fecha ? 'rb-note--ok' : 'rb-note--warn'}`}>
                {result.conferencia.fecha
                  ? `Conferido: ${fmtInt(result.conferencia.presentes_no_livro)} animal(is) no saldo final, igual ao cadastro na data.`
                  : `Não fecha: livro ${fmtInt(result.conferencia.presentes_no_livro)} × cadastro ${fmtInt(result.conferencia.presentes_pelo_cadastro)}. Veja as divergências abaixo; corrija pela operação ou pesagem de origem (nada é ajustado em silêncio).`}
              </p>
              {result.dimensao ? <p className="rb-note">Por {result.dimensao === 'lote_id' ? 'lote' : 'propriedade'} na data de cada movimento: transferências internas aparecem separadas e não contam como compra ou venda.</p> : null}
              {result.limitacoes?.length ? <ul className="rb-alerts rb-alerts--warn" aria-label="Limitações do cálculo">{result.limitacoes.map((l) => <li key={l}>{l}</li>)}</ul> : null}
            </section>
            {result.conferencia.indeterminados?.length ? (
              <section className="rb-card" aria-label="Local indeterminado">
                <h3 className="rb-subtitle">Local indeterminado ({fmtInt(result.conferencia.indeterminados.length)})</h3>
                <p className="rb-note">Sem propriedade registrada na entrada nem movimentação interna: não dá para afirmar onde estavam no período, então não entram no saldo desta propriedade.</p>
                <table className="rb-table"><thead><tr><th>Animal</th></tr></thead>
                  <tbody>{result.conferencia.indeterminados.slice(0, 500).map((d) => <tr key={d.animal_id}><td>{d.numero_animal}</td></tr>)}</tbody>
                </table>
              </section>
            ) : null}
            {result.conferencia.divergencias.length ? (
              <section className="rb-card" aria-label="Divergências">
                <h3 className="rb-subtitle">Divergências ({fmtInt(result.conferencia.divergencias.length)})</h3>
                {result.conferencia.divergencias.some((d) => /sem movimento de entrada/.test(d.motivo)) ? <p className="rb-note rb-note--warn">Animais com Cadastro e sem movimento de entrada vêm de dados antigos: um administrador pode recompor os movimentos a partir das pesagens em Manutenção avançada › Reconciliar derivados (cria backup antes).</p> : null}
                <table className="rb-table"><thead><tr><th>Animal</th><th>Motivo</th></tr></thead>
                  <tbody>{result.conferencia.divergencias.map((d) => <tr key={d.animal_id}><td>{d.numero_animal}</td><td className="rb-cell--text">{d.motivo}</td></tr>)}</tbody>
                </table>
              </section>
            ) : null}
            <section className="rb-card" aria-label="Animais no saldo final">
              <h3 className="rb-subtitle">Animais no saldo final ({fmtInt(result.animais_no_saldo_final.length)})</h3>
              <table className="rb-table"><thead><tr><th>Número</th><th>Marca a fogo</th><th>Sexo</th><th>Raça</th></tr></thead>
                <tbody>{result.animais_no_saldo_final.slice(0, 500).map((a) => <tr key={a.id}><td>{a.numero_animal || '(sem identificação)'}</td><td>{a.marca || '—'}</td><td>{a.sexo || '—'}</td><td>{a.raca || '—'}</td></tr>)}</tbody>
              </table>
              {result.animais_no_saldo_final.length > 500 ? <p className="rb-note">Mostrando 500; a lista completa vai no CSV.</p> : null}
            </section>
          </>
        )}
      </div>
    </ModeloBase1PageContainer>
  );
}
