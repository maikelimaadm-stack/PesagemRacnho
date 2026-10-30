// Ficha do Animal › Identidade, idade e rastreabilidade (F04, F05, F06, F15). Mostra cada atributo com a
// fonte e a certeza (data exata × estimada × desconhecida), permite corrigir nascimento e categoria produtiva
// (auditado), registrar dentição observada, aplicar/trocar identificadores e exportar o dossiê interno.
import { useCallback, useEffect, useState } from 'react';
import { Download, Plus, Replace, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MakDateControl from '@/components/mak/MakDateControl';
import {
  AVISO_DOSSIE,
  DENTICAO_LABELS,
  DENTICOES,
  FONTES_NASCIMENTO,
  FONTE_LABELS,
  PRECISAO_LABELS,
  TIPOS_IDENTIFICADOR,
  TIPO_IDENTIFICADOR_LABELS,
  addDentition,
  applyIdentifier,
  cancelDentition,
  describeAge,
  getTraceabilityDossier,
  listDentitions,
  setProductiveCategory,
  substituteIdentifier,
  traceabilityRows,
  updateBirth,
} from '@/modules/livestock/application/animalProfileService';
import { csvEscape, describeError, fmtDate, todayIso } from './rebanhoModel';
import DocumentosPanel from './DocumentosPanel';
import '@/styles/rebanho.css';

const birthForm = (animal) => ({
  nascimento_precisao: animal?.nascimento_precisao || (animal?.nascimento_data ? 'DIA' : 'DESCONHECIDA'),
  nascimento_data: animal?.nascimento_data || '',
  nascimento_mes: animal?.nascimento_precisao === 'MES' && animal?.nascimento_data ? animal.nascimento_data.slice(0, 7) : '',
  idade_declarada_meses: animal?.idade_declarada_meses ?? '',
  idade_referencia_data: animal?.idade_referencia_data || todayIso(),
  nascimento_fonte: animal?.nascimento_fonte || '',
});

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AnimalProfileCard({ animal, canEdit, canWrite, onChanged }) {
  const [info, setInfo] = useState(null);
  const [dossie, setDossie] = useState(null);
  const [dentes, setDentes] = useState([]);
  const [editBirth, setEditBirth] = useState(false);
  const [form, setForm] = useState(() => birthForm(animal));
  const [categoria, setCategoria] = useState(animal?.categoria_produtiva || '');
  const [novaDent, setNovaDent] = useState({ dentes: '', data: todayIso() });
  const [ident, setIdent] = useState({ tipo: 'BRINCO', valor: '', antigo: '', motivo: 'PERDIDO', data: todayIso() });
  const [busy, setBusy] = useState(false);
  const [cancelDent, setCancelDent] = useState(null); // { id, motivo }

  const reload = useCallback(async () => {
    if (!animal?.id) return;
    try {
      const [descr, dossieAtual, dent] = await Promise.all([describeAge(animal), getTraceabilityDossier(animal.id, { hoje: todayIso() }), listDentitions(animal.id)]);
      setInfo(descr);
      setDossie(dossieAtual);
      setDentes(dent);
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível carregar a identidade do animal.'));
    }
  }, [animal]);

  useEffect(() => { setForm(birthForm(animal)); setCategoria(animal?.categoria_produtiva || ''); reload(); }, [animal, reload]);

  const run = async (fn, sucesso) => {
    setBusy(true);
    try {
      await fn();
      if (sucesso) toast.success(sucesso);
      await onChanged?.();
      await reload();
      return true;
    } catch (error) {
      toast.error(describeError(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!animal?.id) return null;
  const idade = info?.idade;
  const setF = (campo) => (value) => setForm((f) => ({ ...f, [campo]: value }));
  const identAtivos = (dossie?.identidade.identificadores || []).filter((i) => i.ativo);
  const identHistorico = (dossie?.identidade.identificadores || []).filter((i) => !i.ativo);

  const exportCsv = () => {
    const rows = traceabilityRows(dossie);
    download(`rastreabilidade-${animal.numero_animal || animal.id}.csv`, `\uFEFFSeção;Campo;Valor\r\n${rows.map((r) => r.map(csvEscape).join(';')).join('\r\n')}`, 'text/csv;charset=utf-8');
  };
  const exportJson = () => download(`rastreabilidade-${animal.numero_animal || animal.id}.json`, JSON.stringify(dossie, null, 2), 'application/json');

  return (
    <section className="op-card rb-profile" aria-label="Identidade, idade e rastreabilidade">
      <header className="op-card__header"><h2>Identidade, idade e rastreabilidade</h2>
        <span className="rb-inline">
          <button type="button" className="rb-btn" onClick={exportCsv} disabled={!dossie}><Download size={14} aria-hidden="true" /> Dossiê CSV</button>
          <button type="button" className="rb-btn" onClick={exportJson} disabled={!dossie}><Download size={14} aria-hidden="true" /> JSON</button>
        </span>
      </header>
      <dl className="rb-dl">
        <div><dt>Idade hoje</dt><dd>{idade?.texto || '—'}</dd></div>
        <div><dt>Nascimento</dt><dd>{animal.nascimento_data ? (animal.nascimento_precisao === 'MES' ? `${animal.nascimento_data.slice(5, 7)}/${animal.nascimento_data.slice(0, 4)} (estimado)` : fmtDate(animal.nascimento_data)) : idade?.precisao === 'IDADE_DECLARADA' ? `${animal.idade_declarada_meses} meses em ${fmtDate(animal.idade_referencia_data)}` : 'Desconhecido'}</dd></div>
        <div><dt>Precisão / fonte</dt><dd>{PRECISAO_LABELS[idade?.precisao] || '—'}{animal.nascimento_fonte ? ` · ${FONTE_LABELS[animal.nascimento_fonte] || animal.nascimento_fonte}` : ''}</dd></div>
        <div><dt>Era (faixa de idade)</dt><dd>{info?.era ? `${info.era.rotulo}${info.era.incerta ? ' (no limite: estimativa)' : ''}` : 'Sem idade conhecida'}</dd></div>
        <div><dt>Categoria produtiva</dt><dd>{info?.categoria?.valor ? `${info.categoria.valor} (${info.categoria.origem === 'SUGERIDA' ? 'sugerida pela política' : 'informada'})` : '—'}</dd></div>
        <div><dt>Classe por peso (histórico)</dt><dd>{animal.era || '—'}</dd></div>
        <div><dt>Dentição</dt><dd>{dentes[0] ? `${DENTICAO_LABELS[dentes[0].dentes]} em ${fmtDate(dentes[0].data)}` : 'Não avaliada'}</dd></div>
        <div><dt>Mãe</dt><dd>{dossie?.nascimento.mae || 'Não informada'}</dd></div>
        <div><dt>Origem</dt><dd>{dossie?.origem ? `${dossie.origem.tipo} em ${fmtDate(dossie.origem.data)}${dossie.origem.operacao?.gta ? ` · GTA ${dossie.origem.operacao.gta}` : ''}${dossie.origem.operacao?.parceiro ? ` · ${dossie.origem.operacao.parceiro}` : ''}` : 'Sem entrada registrada'}</dd></div>
        <div><dt>Carência (carne)</dt><dd>{dossie?.carencia_carne_aberta_ate ? `até ${fmtDate(dossie.carencia_carne_aberta_ate)}` : 'Sem carência em aberto'}</dd></div>
        <div className="rb-dl__wide"><dt>Identificadores ativos</dt><dd>{identAtivos.length ? identAtivos.map((i) => `${TIPO_IDENTIFICADOR_LABELS[i.tipo] || i.tipo}: ${i.valor}`).join(' · ') : '—'}</dd></div>
        {identHistorico.length ? <div className="rb-dl__wide"><dt>Identificadores anteriores</dt><dd>{identHistorico.map((i) => `${i.tipo} ${i.valor} (até ${fmtDate(i.ate)}${i.motivo_troca ? `, ${i.motivo_troca.toLowerCase()}` : ''})`).join(' · ')}</dd></div> : null}
        {dossie?.desconhecidos?.length ? <div className="rb-dl__wide"><dt>Não informado</dt><dd>{dossie.desconhecidos.join(' · ')}</dd></div> : null}
      </dl>

      {canEdit ? (
        <div className="rb-subsection">
          {!editBirth ? <button type="button" className="rb-btn" onClick={() => setEditBirth(true)}>Corrigir nascimento/idade</button> : (
            <div className="rb-grid">
              <label className="rb-field"><span className="rb-field__label is-required">Precisão</span>
                <select className="rb-control" value={form.nascimento_precisao} onChange={(e) => setF('nascimento_precisao')(e.target.value)} aria-label="Precisão do nascimento">
                  {Object.entries(PRECISAO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></label>
              {form.nascimento_precisao === 'DIA' ? <label className="rb-field"><span className="rb-field__label is-required">Data de nascimento</span><MakDateControl value={form.nascimento_data} onChange={(e) => setF('nascimento_data')(e.target.value)} ariaLabel="Data de nascimento" /></label> : null}
              {form.nascimento_precisao === 'MES' ? <label className="rb-field"><span className="rb-field__label is-required">Mês e ano (AAAA-MM)</span><input className="rb-control" value={form.nascimento_mes} onChange={(e) => setF('nascimento_mes')(e.target.value)} placeholder="2025-03" aria-label="Mês e ano de nascimento" /></label> : null}
              {form.nascimento_precisao === 'IDADE_DECLARADA' ? (
                <>
                  <label className="rb-field"><span className="rb-field__label is-required">Idade declarada (meses)</span><input className="rb-control" inputMode="numeric" value={form.idade_declarada_meses} onChange={(e) => setF('idade_declarada_meses')(e.target.value)} aria-label="Idade declarada em meses" /></label>
                  <label className="rb-field"><span className="rb-field__label is-required">Na data</span><MakDateControl value={form.idade_referencia_data} onChange={(e) => setF('idade_referencia_data')(e.target.value)} ariaLabel="Data da idade declarada" /></label>
                </>
              ) : null}
              {form.nascimento_precisao !== 'DESCONHECIDA' ? <label className="rb-field"><span className="rb-field__label is-required">Fonte</span>
                <select className="rb-control" value={form.nascimento_fonte} onChange={(e) => setF('nascimento_fonte')(e.target.value)} aria-label="Fonte do nascimento"><option value="">Escolha</option>{FONTES_NASCIMENTO.map((f) => <option key={f} value={f}>{FONTE_LABELS[f]}</option>)}</select></label> : null}
              <div className="rb-inline rb-field--wide">
                <button type="button" className="rb-btn rb-btn--primary" disabled={busy} onClick={async () => { if (await run(() => updateBirth(animal.id, { ...form, idade_declarada_meses: form.idade_declarada_meses === '' ? null : Number(form.idade_declarada_meses) }), 'Nascimento corrigido (auditado).')) setEditBirth(false); }}><Save size={14} aria-hidden="true" /> Salvar</button>
                <button type="button" className="rb-btn" onClick={() => { setEditBirth(false); setForm(birthForm(animal)); }}>Cancelar</button>
              </div>
            </div>
          )}
          <div className="rb-inline">
            <input className="rb-control" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoria produtiva (ex.: Garrote)" aria-label="Categoria produtiva" maxLength={60} />
            <button type="button" className="rb-btn" disabled={busy || categoria === (animal.categoria_produtiva || '')} onClick={() => run(() => setProductiveCategory(animal.id, categoria), 'Categoria produtiva gravada.')}>Gravar categoria</button>
          </div>
        </div>
      ) : null}

      <div className="rb-subsection">
        <h3 className="rb-subtitle">Dentição observada</h3>
        <table className="rb-table"><thead><tr><th>Data</th><th>Dentição</th><th>Avaliador</th><th /></tr></thead>
          <tbody>
            {dentes.map((d) => <tr key={d.id}><td>{fmtDate(d.data)}</td><td>{DENTICAO_LABELS[d.dentes]}</td><td>{d.avaliador || '—'}</td><td>{canEdit ? (cancelDent?.id === d.id ? (
              <span className="rb-inline">
                <input className="rb-control rb-control--compact" value={cancelDent.motivo} onChange={(e) => setCancelDent({ id: d.id, motivo: e.target.value })} placeholder="Motivo" aria-label="Motivo do cancelamento da avaliação" />
                <button type="button" className="rb-btn rb-btn--danger" disabled={busy || cancelDent.motivo.trim().length < 3} onClick={async () => { if (await run(() => cancelDentition(d.id, { motivo: cancelDent.motivo }), 'Avaliação cancelada.')) setCancelDent(null); }}>Cancelar avaliação</button>
                <button type="button" className="rb-btn" onClick={() => setCancelDent(null)}>Voltar</button>
              </span>
            ) : <button type="button" className="rb-icon-btn" aria-label={`Cancelar avaliação de ${fmtDate(d.data)}`} onClick={() => setCancelDent({ id: d.id, motivo: '' })}><Trash2 size={14} /></button>) : null}</td></tr>)}
            {!dentes.length ? <tr><td colSpan={4} className="rb-empty">Nenhuma avaliação. A dentição nunca é deduzida da idade.</td></tr> : null}
          </tbody>
        </table>
        {canWrite ? (
          <div className="rb-inline">
            <select className="rb-control rb-control--compact" value={novaDent.dentes} onChange={(e) => setNovaDent((n) => ({ ...n, dentes: e.target.value }))} aria-label="Dentes permanentes"><option value="">Dentes</option>{DENTICOES.map((n) => <option key={n} value={n}>{DENTICAO_LABELS[n]}</option>)}</select>
            <MakDateControl value={novaDent.data} onChange={(e) => setNovaDent((n) => ({ ...n, data: e.target.value }))} ariaLabel="Data da avaliação" />
            <button type="button" className="rb-btn" disabled={busy || novaDent.dentes === ''} onClick={() => run(() => addDentition(animal.id, { dentes: Number(novaDent.dentes), data: novaDent.data }), 'Dentição registrada.')}><Plus size={14} aria-hidden="true" /> Registrar</button>
          </div>
        ) : null}
      </div>

      {canWrite ? (
        <div className="rb-subsection">
          <h3 className="rb-subtitle">Aplicar ou trocar identificador</h3>
          <div className="rb-inline rb-inline--wrap">
            <select className="rb-control rb-control--compact" value={ident.tipo} onChange={(e) => setIdent((i) => ({ ...i, tipo: e.target.value }))} aria-label="Tipo de identificador">{TIPOS_IDENTIFICADOR.map((t) => <option key={t} value={t}>{TIPO_IDENTIFICADOR_LABELS[t]}</option>)}</select>
            <input className="rb-control rb-control--compact" value={ident.valor} onChange={(e) => setIdent((i) => ({ ...i, valor: e.target.value }))} placeholder="Código novo" aria-label="Código do identificador" />
            <MakDateControl value={ident.data} onChange={(e) => setIdent((i) => ({ ...i, data: e.target.value }))} ariaLabel="Data do identificador" />
            <button type="button" className="rb-btn" disabled={busy || !ident.valor.trim()} onClick={() => run(() => applyIdentifier({ animalId: animal.id, tipo: ident.tipo, valor: ident.valor, data: ident.data }), 'Identificador aplicado.')}><Plus size={14} aria-hidden="true" /> Aplicar</button>
            <input className="rb-control rb-control--compact" value={ident.antigo} onChange={(e) => setIdent((i) => ({ ...i, antigo: e.target.value }))} placeholder="Código atual (troca)" aria-label="Código atual a substituir" />
            <select className="rb-control rb-control--compact" value={ident.motivo} onChange={(e) => setIdent((i) => ({ ...i, motivo: e.target.value }))} aria-label="Motivo da troca"><option value="PERDIDO">Perdido</option><option value="DANIFICADO">Danificado</option><option value="REMOVIDO">Retirado</option></select>
            <button type="button" className="rb-btn" disabled={busy || !ident.valor.trim() || !ident.antigo.trim()} onClick={() => run(() => substituteIdentifier({ animalId: animal.id, tipo: ident.tipo, antigo: ident.antigo, novo: ident.valor, motivo: ident.motivo, data: ident.data }), 'Identificador trocado (histórico preservado).')}><Replace size={14} aria-hidden="true" /> Trocar</button>
          </div>
        </div>
      ) : null}
      <DocumentosPanel animalId={animal.id} canWrite={canWrite} canCancel={canEdit} titulo="Documentos do animal" />
      <p className="rb-note">{AVISO_DOSSIE}</p>
    </section>
  );
}
