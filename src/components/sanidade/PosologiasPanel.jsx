// Aba "Posologias" da Sanidade (F08): regra de dose versionada por medicamento. Rascunho editável; aprovação
// com responsável técnico (exige regra completa: princípio ativo, apresentação, indicação, via, fonte,
// vigência e carência de carne); aprovada é imutável e só é substituída por nova versão ou suspensa com
// motivo. "Testar dose" mostra o cálculo com um peso, sem gravar nada.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import MakDateControl from '@/components/mak/MakDateControl';
import {
  ARREDONDAMENTOS,
  ARREDONDAMENTO_LABELS,
  POSOLOGIA_FONTES,
  POSOLOGIA_FONTE_LABELS,
  POSOLOGIA_STATUS_LABELS,
  UNIDADES_DOSE,
  VIAS_APLICACAO,
  VIA_LABELS,
  approvePosology,
  computeDose,
  describeRule,
  listPosologies,
  missingForApproval,
  savePosologyDraft,
  suspendPosology,
} from '@/modules/sanity/application/sanityService';
import { describeError, fmtDate } from '@/components/rebanho/rebanhoModel';
import '@/styles/rebanho.css';

const vazio = (medicamentoId = '') => ({
  id: null, medicamento_id: medicamentoId, modo: 'PROPORCIONAL', unidade: 'ml', dose_por_unidade: '', kg_por_unidade: '',
  faixasTexto: '', principio_ativo: '', apresentacao: '', indicacao: '', via_aplicacao: '', arredondamento_modo: 'NENHUM',
  arredondamento_passo: '', dose_minima: '', dose_maxima: '', carencia_carne_dias: '', carencia_leite_dias: '', fonte: '',
  fonte_referencia: '', vigencia_inicio: '', vigencia_fim: '', observacao: '',
});

const faixasToText = (faixas = []) => faixas.map((f) => `${f.peso_min}-${f.peso_max}=${f.dose}`).join('\n');
const textToFaixas = (text) => String(text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => {
  const m = /^([\d.,]+)\s*-\s*([\d.,]+)\s*=\s*([\d.,]+)$/.exec(l);
  return m ? { peso_min: m[1], peso_max: m[2], dose: m[3] } : { peso_min: null, peso_max: null, dose: null };
});

export default function PosologiasPanel({ medicamentos = [], canWrite }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [erros, setErros] = useState([]);
  const [busy, setBusy] = useState(false);
  const [acao, setAcao] = useState(null); // { id, tipo: 'aprovar'|'suspender', texto }
  const [teste, setTeste] = useState({ id: null, kg: '' });
  const medNome = useMemo(() => new Map(medicamentos.map((m) => [m.id, m.nome])), [medicamentos]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setRows(await listPosologies()); } catch (error) { toast.error(describeError(error)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const editar = (p) => setForm({ ...vazio(), ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? ''])), faixasTexto: faixasToText(p.faixas), arredondamento_modo: p.arredondamento?.modo || 'NENHUM', arredondamento_passo: p.arredondamento?.passo ?? '' });

  const salvar = async () => {
    setBusy(true);
    setErros([]);
    try {
      await savePosologyDraft({ ...form, id: form.id || null, faixas: textToFaixas(form.faixasTexto), arredondamento: { modo: form.arredondamento_modo, passo: form.arredondamento_passo } });
      toast.success('Rascunho da posologia salvo.');
      setForm(null);
      await refresh();
    } catch (error) {
      setErros(error?.erros?.length ? error.erros : [describeError(error)]);
    } finally {
      setBusy(false);
    }
  };

  const executar = async () => {
    setBusy(true);
    try {
      if (acao.tipo === 'aprovar') await approvePosology(acao.id, { responsavel: acao.texto });
      else await suspendPosology(acao.id, { motivo: acao.texto });
      toast.success(acao.tipo === 'aprovar' ? 'Posologia aprovada.' : 'Posologia suspensa.');
      setAcao(null);
      await refresh();
    } catch (error) {
      toast.error(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rb-scroll sanidade-posologias">
      <div className="rb-toolbar">
        <button type="button" className="rb-btn" onClick={refresh} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> Atualizar</button>
        <span className="rb-toolbar__spacer" />
        {canWrite ? <button type="button" className="rb-btn rb-btn--primary" onClick={() => setForm(vazio(medicamentos[0]?.id || ''))} disabled={!medicamentos.length}><Plus size={14} aria-hidden="true" /> Nova posologia</button> : null}
      </div>
      <p className="rb-note">Dose sugerida só sai de posologia <strong>aprovada</strong>, completa e vigente, com o peso do animal; o operador confirma a dose aplicada. Carência vazia = desconhecida (diferente de zero). A dose padrão em texto do medicamento continua apenas como referência.</p>

      {form ? (
        <section className="rb-card rb-grid" aria-label="Posologia">
          <label className="rb-field"><span className="rb-field__label is-required">Medicamento</span><select className="rb-control" value={form.medicamento_id} onChange={set('medicamento_id')} disabled={Boolean(form.id)} aria-label="Medicamento da posologia">{medicamentos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
          <label className="rb-field"><span className="rb-field__label is-required">Princípio ativo</span><input className="rb-control" value={form.principio_ativo} onChange={set('principio_ativo')} aria-label="Princípio ativo" /></label>
          <label className="rb-field"><span className="rb-field__label is-required">Apresentação</span><input className="rb-control" value={form.apresentacao} onChange={set('apresentacao')} aria-label="Apresentação" /></label>
          <label className="rb-field"><span className="rb-field__label is-required">Indicação</span><input className="rb-control" value={form.indicacao} onChange={set('indicacao')} aria-label="Indicação" /></label>
          <label className="rb-field"><span className="rb-field__label is-required">Via</span><select className="rb-control" value={form.via_aplicacao} onChange={set('via_aplicacao')} aria-label="Via da posologia"><option value="">—</option>{VIAS_APLICACAO.map((v) => <option key={v} value={v}>{VIA_LABELS[v]}</option>)}</select></label>
          <label className="rb-field"><span className="rb-field__label is-required">Modo</span><select className="rb-control" value={form.modo} onChange={set('modo')} aria-label="Modo da posologia"><option value="PROPORCIONAL">Proporcional ao peso</option><option value="FAIXAS">Tabela de faixas da bula</option></select></label>
          <label className="rb-field"><span className="rb-field__label is-required">Unidade</span><select className="rb-control" value={form.unidade} onChange={set('unidade')} aria-label="Unidade da posologia">{UNIDADES_DOSE.map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
          {form.modo === 'PROPORCIONAL' ? (
            <>
              <label className="rb-field"><span className="rb-field__label is-required">Dose</span><input className="rb-control" value={form.dose_por_unidade} onChange={set('dose_por_unidade')} inputMode="decimal" aria-label="Dose por unidade de peso" /></label>
              <label className="rb-field"><span className="rb-field__label is-required">a cada (kg)</span><input className="rb-control" value={form.kg_por_unidade} onChange={set('kg_por_unidade')} inputMode="decimal" aria-label="Quilos por unidade de dose" /></label>
            </>
          ) : (
            <label className="rb-field rb-field--wide"><span className="rb-field__label is-required">Faixas (uma por linha: peso mín-peso máx=dose)</span><textarea className="rb-textarea" value={form.faixasTexto} onChange={set('faixasTexto')} placeholder={'0-100=2\n100,01-200=4'} aria-label="Faixas da bula" /></label>
          )}
          <label className="rb-field"><span className="rb-field__label">Arredondamento</span><select className="rb-control" value={form.arredondamento_modo} onChange={set('arredondamento_modo')} aria-label="Arredondamento">{ARREDONDAMENTOS.map((a) => <option key={a} value={a}>{ARREDONDAMENTO_LABELS[a]}</option>)}</select></label>
          {form.arredondamento_modo !== 'NENHUM' ? <label className="rb-field"><span className="rb-field__label is-required">Passo</span><input className="rb-control" value={form.arredondamento_passo} onChange={set('arredondamento_passo')} inputMode="decimal" aria-label="Passo do arredondamento" /></label> : null}
          <label className="rb-field"><span className="rb-field__label">Dose mínima</span><input className="rb-control" value={form.dose_minima} onChange={set('dose_minima')} inputMode="decimal" aria-label="Dose mínima" /></label>
          <label className="rb-field"><span className="rb-field__label">Dose máxima</span><input className="rb-control" value={form.dose_maxima} onChange={set('dose_maxima')} inputMode="decimal" aria-label="Dose máxima" /></label>
          <label className="rb-field"><span className="rb-field__label is-required">Carência carne (dias)</span><input className="rb-control" value={form.carencia_carne_dias} onChange={set('carencia_carne_dias')} inputMode="numeric" aria-label="Carência de carne em dias" /></label>
          <label className="rb-field"><span className="rb-field__label">Carência leite (dias)</span><input className="rb-control" value={form.carencia_leite_dias} onChange={set('carencia_leite_dias')} inputMode="numeric" aria-label="Carência de leite em dias" /></label>
          <label className="rb-field"><span className="rb-field__label is-required">Fonte</span><select className="rb-control" value={form.fonte} onChange={set('fonte')} aria-label="Fonte da posologia"><option value="">—</option>{POSOLOGIA_FONTES.map((f) => <option key={f} value={f}>{POSOLOGIA_FONTE_LABELS[f]}</option>)}</select></label>
          <label className="rb-field"><span className="rb-field__label">Referência da fonte</span><input className="rb-control" value={form.fonte_referencia} onChange={set('fonte_referencia')} aria-label="Referência da fonte" /></label>
          <label className="rb-field"><span className="rb-field__label is-required">Vigência a partir de</span><MakDateControl value={form.vigencia_inicio} onChange={set('vigencia_inicio')} ariaLabel="Início da vigência" /></label>
          {erros.length ? <ul className="rb-alerts rb-alerts--error rb-field--wide">{erros.map((e) => <li key={e}>{e}</li>)}</ul> : null}
          <div className="rb-inline rb-field--wide">
            <button type="button" className="rb-btn rb-btn--primary" onClick={salvar} disabled={busy}><Save size={14} aria-hidden="true" /> Salvar rascunho</button>
            <button type="button" className="rb-btn" onClick={() => { setForm(null); setErros([]); }}>Cancelar</button>
          </div>
        </section>
      ) : null}

      <section className="rb-card" aria-label="Posologias cadastradas">
        <table className="rb-table">
          <thead><tr><th>Medicamento</th><th className="rb-num">Versão</th><th>Situação</th><th>Regra</th><th>Carência carne/leite</th><th>Vigência</th><th>Aprovação</th><th>Ações</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="rb-empty">Carregando…</td></tr> : null}
            {!loading && !rows.length ? <tr><td colSpan={8} className="rb-empty">Nenhuma posologia. Sem posologia aprovada, a dose é sempre manual.</td></tr> : null}
            {rows.map((p) => {
              const faltando = missingForApproval(p);
              const resultado = teste.id === p.id && Number(String(teste.kg).replace(',', '.')) > 0
                ? computeDose(p, { kg: teste.kg, origem: 'MANUAL' }, { dataAplicacao: p.vigencia_inicio || undefined })
                : null;
              return (
                <tr key={p.id}>
                  <td>{medNome.get(p.medicamento_id) || p.medicamento_id}</td>
                  <td className="rb-num">{p.versao}</td>
                  <td>{POSOLOGIA_STATUS_LABELS[p.status] || p.status}{p.status === 'RASCUNHO' && faltando.length ? <span className="rb-tag rb-tag--warn" title={faltando.join(', ')}>incompleta</span> : null}</td>
                  <td className="rb-cell--text">{describeRule(p)}</td>
                  <td>{p.carencia_carne_dias ?? 'desconhecida'} / {p.carencia_leite_dias ?? 'desconhecida'}</td>
                  <td>{fmtDate(p.vigencia_inicio)}{p.vigencia_fim ? ` a ${fmtDate(p.vigencia_fim)}` : ''}</td>
                  <td className="rb-cell--text">{p.aprovado_por || '—'}</td>
                  <td className="rb-cell--text">
                    {canWrite && p.status === 'RASCUNHO' ? <button type="button" className="rb-btn" onClick={() => editar(p)}>Editar</button> : null}
                    {canWrite && p.status === 'RASCUNHO' ? <button type="button" className="rb-btn" onClick={() => setAcao({ id: p.id, tipo: 'aprovar', texto: '' })} disabled={faltando.length > 0} title={faltando.length ? `Falta: ${faltando.join(', ')}` : undefined}><CheckCircle2 size={14} aria-hidden="true" /> Aprovar</button> : null}
                    {canWrite && p.status === 'APROVADA' ? <button type="button" className="rb-btn" onClick={() => setAcao({ id: p.id, tipo: 'suspender', texto: '' })}>Suspender</button> : null}
                    <input className="rb-control rb-control--compact" value={teste.id === p.id ? teste.kg : ''} onChange={(e) => setTeste({ id: p.id, kg: e.target.value })} placeholder="Testar: peso kg" aria-label={`Testar dose com peso (versão ${p.versao})`} />
                    {resultado ? <span className="rb-note"> {resultado.ok ? `${resultado.dose} ${resultado.unidade}` : resultado.bloqueios[0]}</span> : null}
                    {acao?.id === p.id ? (
                      <span className="rb-inline">
                        <input className="rb-control" value={acao.texto} onChange={(e) => setAcao((a) => ({ ...a, texto: e.target.value }))} placeholder={acao.tipo === 'aprovar' ? 'Responsável técnico (nome e registro)' : 'Motivo da suspensão'} aria-label={acao.tipo === 'aprovar' ? 'Responsável técnico' : 'Motivo da suspensão'} />
                        <button type="button" className="rb-btn rb-btn--primary" onClick={executar} disabled={busy || acao.texto.trim().length < 5}>{acao.tipo === 'aprovar' ? 'Confirmar aprovação' : 'Confirmar suspensão'}</button>
                        <button type="button" className="rb-btn" onClick={() => setAcao(null)}>Voltar</button>
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
