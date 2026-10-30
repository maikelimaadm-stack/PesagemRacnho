import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import { AGE_POLICY_DEFAULTS, getAgePolicy, saveAgePolicy } from '@/modules/livestock/application/animalProfileService';
import {
  CENARIOS,
  CENARIO_LABELS,
  ESCOPOS,
  ESCOPO_LABELS,
  FONTES_CALENDARIO,
  FONTE_CALENDARIO_LABELS,
  PERIODOS,
  PERIODO_LABELS,
  TIPOS_META,
  TIPO_META_LABELS,
  listSeasons,
  listTargets,
  removeSeason,
  removeTarget,
  saveSeason,
  saveTarget,
} from '@/modules/analytics/application/analyticsService';
import { describeError, fmtDate, loadRebanhoCatalog } from '@/components/rebanho/rebanhoModel';
import MakDateControl from '@/components/mak/MakDateControl';
import { ConfigSection } from './Configuracoes';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import '@/styles/rebanho.css';

// Menu SISTEMA › Parametrização (F25): regras de negócio por seção, cada uma salva isolada. Esta versão traz
// Pesagens e alertas, GMD e indicadores e Comercial e saídas (as MESMAS chaves de appSettings das Configurações,
// cada seção salva sozinha), "Idade, era e categorias" (F05), Sanidade e carência (link), "Calendário de seca e
// águas" (F12) e "Metas e cenários" (F13).
// Mudança de regra não reescreve histórico: idade e era são calculadas na hora, para a data consultada.
const toText = (list) => list.join(', ');
const fromNumbers = (text) => text.split(/[,;\s]+/).filter(Boolean).map(Number);
const fromLabels = (text) => text.split(/[,;]/).map((t) => t.trim());

function AgePolicySection({ canEdit }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erros, setErros] = useState([]);

  const load = async () => {
    const policy = await getAgePolicy();
    const next = {
      faixas: toText(policy.faixas_meses),
      eras: toText(policy.eras),
      sugerir: policy.sugerir_categoria_produtiva,
      catM: toText(policy.categorias_produtivas.M),
      catF: toText(policy.categorias_produtivas.F),
    };
    setForm(next);
    setSaved(next);
  };
  useEffect(() => { load().catch((error) => toast.error(describeError(error))); }, []);

  if (!form) return <section className="rb-card"><p className="rb-empty">Carregando…</p></section>;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const salvar = async () => {
    setBusy(true);
    setErros([]);
    try {
      await saveAgePolicy({
        faixas_meses: fromNumbers(form.faixas),
        eras: fromLabels(form.eras),
        sugerir_categoria_produtiva: form.sugerir,
        categorias_produtivas: { M: fromLabels(form.catM), F: fromLabels(form.catF) },
      });
      toast.success('Idade, era e categorias salvas.');
      await load();
    } catch (error) {
      setErros(error?.erros?.length ? error.erros : [describeError(error)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rb-card" aria-label="Idade, era e categorias">
      <div className="rb-section-head"><h3>Idade, era e categorias</h3>{dirty ? <span className="rb-tag rb-tag--warn">alterações não salvas</span> : null}</div>
      <p className="rb-note">A era é o rótulo da faixa de idade (não do peso). A classe por peso dos lançamentos antigos continua guardada como histórico. A idade é sempre calculada para a data consultada.</p>
      <div className="rb-grid">
        <label className="rb-field rb-field--wide"><span className="rb-field__label is-required">Limites das faixas (meses, crescentes)</span><input className="rb-control" value={form.faixas} onChange={set('faixas')} disabled={!canEdit} aria-label="Limites das faixas em meses" /></label>
        <label className="rb-field rb-field--wide"><span className="rb-field__label is-required">Rótulo de cada era (uma a mais que os limites)</span><input className="rb-control" value={form.eras} onChange={set('eras')} disabled={!canEdit} aria-label="Rótulos das eras" /></label>
        <label className="rb-check rb-field--wide"><input type="checkbox" checked={form.sugerir} onChange={set('sugerir')} disabled={!canEdit} /> Sugerir categoria produtiva pela idade e sexo (a categoria informada no animal sempre prevalece)</label>
        {form.sugerir ? (
          <>
            <label className="rb-field rb-field--wide"><span className="rb-field__label">Categorias por faixa — machos</span><input className="rb-control" value={form.catM} onChange={set('catM')} disabled={!canEdit} aria-label="Categorias de machos por faixa" /></label>
            <label className="rb-field rb-field--wide"><span className="rb-field__label">Categorias por faixa — fêmeas</span><input className="rb-control" value={form.catF} onChange={set('catF')} disabled={!canEdit} aria-label="Categorias de fêmeas por faixa" /></label>
          </>
        ) : null}
      </div>
      {erros.length ? <ul className="rb-alerts rb-alerts--error">{erros.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      {canEdit ? (
        <div className="rb-inline">
          <button type="button" className="rb-btn rb-btn--primary" onClick={salvar} disabled={busy || !dirty}><Save size={14} aria-hidden="true" /> Salvar seção</button>
          <button type="button" className="rb-btn" onClick={() => setForm(saved)} disabled={busy || !dirty}>Descartar alterações</button>
          <button type="button" className="rb-btn" onClick={() => setForm({ faixas: toText(AGE_POLICY_DEFAULTS.faixas_meses), eras: toText(AGE_POLICY_DEFAULTS.eras), sugerir: false, catM: toText(AGE_POLICY_DEFAULTS.categorias_produtivas.M), catF: toText(AGE_POLICY_DEFAULTS.categorias_produtivas.F) })} disabled={busy}>Restaurar padrão</button>
        </div>
      ) : null}
    </section>
  );
}

function useCatalog() {
  const [catalog, setCatalog] = useState({ propriedades: [], lotes: [], racas: [], animais: [] });
  useEffect(() => { loadRebanhoCatalog().then(setCatalog).catch(() => {}); }, []);
  return catalog;
}

// F12: calendário de águas/transição/seca por propriedade (ou todas) e ano, com fonte; sem sobreposição.
function SeasonSection({ canEdit, catalog }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ propriedade_id: '', periodo: 'SECA', inicio: '', fim: '', fonte: 'CONFIGURADO', observacao: '' });
  const [motivo, setMotivo] = useState({ id: null, texto: '' });
  const load = () => listSeasons().then(setRows).catch((error) => toast.error(describeError(error)));
  useEffect(() => { load(); }, []);
  const nomeProp = (id) => catalog.propriedades.find((p) => p.id === id)?.nome || 'Todas as propriedades';
  const salvar = async () => {
    try {
      await saveSeason({ ...form, propriedade_id: form.propriedade_id || null });
      toast.success('Período salvo.');
      setForm((f) => ({ ...f, inicio: '', fim: '', observacao: '' }));
      load();
    } catch (error) { toast.error(describeError(error)); }
  };
  const excluir = async () => {
    try { await removeSeason(motivo.id, { motivo: motivo.texto }); setMotivo({ id: null, texto: '' }); toast.success('Período excluído (auditado).'); load(); } catch (error) { toast.error(describeError(error)); }
  };
  return (
    <section className="rb-card" aria-label="Calendário de seca e águas">
      <div className="rb-section-head"><h3>Calendário de seca e águas</h3></div>
      <p className="rb-note">Datas reais ou planejadas de cada propriedade e ano, com a fonte. Nenhum período é imposto: sem calendário, o painel mostra "sem calendário". O período da propriedade prevalece sobre o de "todas".</p>
      <table className="rb-table"><thead><tr><th>Propriedade</th><th>Período</th><th>Início</th><th>Fim</th><th>Fonte</th><th>Observação</th>{canEdit ? <th /> : null}</tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.id}><td>{nomeProp(r.propriedade_id)}</td><td>{PERIODO_LABELS[r.periodo]}</td><td>{fmtDate(r.inicio)}</td><td>{fmtDate(r.fim)}</td><td>{FONTE_CALENDARIO_LABELS[r.fonte] || r.fonte}</td><td className="rb-cell--text">{r.observacao || ''}</td>{canEdit ? <td>{motivo.id === r.id ? <span className="rb-inline"><input className="rb-control rb-control--compact" value={motivo.texto} onChange={(e) => setMotivo({ id: r.id, texto: e.target.value })} placeholder="Motivo" aria-label="Motivo da exclusão do período" /><button type="button" className="rb-btn rb-btn--danger" onClick={excluir} disabled={motivo.texto.trim().length < 3}>Excluir</button></span> : <button type="button" className="rb-btn" onClick={() => setMotivo({ id: r.id, texto: '' })}>Excluir</button>}</td> : null}</tr>)}
          {!rows.length ? <tr><td colSpan={7} className="rb-empty">Nenhum período cadastrado.</td></tr> : null}
        </tbody>
      </table>
      {canEdit ? (
        <div className="rb-inline rb-inline--wrap">
          <select className="rb-control rb-control--compact" value={form.propriedade_id} onChange={(e) => setForm((f) => ({ ...f, propriedade_id: e.target.value }))} aria-label="Propriedade do período"><option value="">Todas as propriedades</option>{catalog.propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
          <select className="rb-control rb-control--compact" value={form.periodo} onChange={(e) => setForm((f) => ({ ...f, periodo: e.target.value }))} aria-label="Período">{PERIODOS.map((x) => <option key={x} value={x}>{PERIODO_LABELS[x]}</option>)}</select>
          <MakDateControl value={form.inicio} onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))} ariaLabel="Início do período" />
          <MakDateControl value={form.fim} onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))} ariaLabel="Fim do período" />
          <select className="rb-control rb-control--compact" value={form.fonte} onChange={(e) => setForm((f) => ({ ...f, fonte: e.target.value }))} aria-label="Fonte do período">{FONTES_CALENDARIO.map((x) => <option key={x} value={x}>{FONTE_CALENDARIO_LABELS[x]}</option>)}</select>
          <input className="rb-control rb-control--compact" value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} placeholder="Observação" aria-label="Observação do período" />
          <button type="button" className="rb-btn rb-btn--primary" onClick={salvar}><Save size={14} aria-hidden="true" /> Adicionar período</button>
        </div>
      ) : null}
    </section>
  );
}

// F13: metas (GMD ou peso numa data) e cenários de projeção, com escopo, vigência e precedência explícita.
const metaVazia = () => ({ escopo: 'GERAL', tipo: 'GMD', alvo_id: '', raca_id: '', sexo: '', era: '', estacao: '', gmd_kg_dia: '', peso_kg: '', data_alvo: '', cenario: 'BASE', AGUAS: '', TRANSICAO: '', SECA: '', vigencia_inicio: '', vigencia_fim: '', nome: '' });

function TargetsSection({ canEdit, catalog }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(metaVazia);
  const [erros, setErros] = useState([]);
  const [motivo, setMotivo] = useState({ id: null, texto: '' });
  const load = () => listTargets().then(setRows).catch((error) => toast.error(describeError(error)));
  useEffect(() => { load(); }, []);
  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const alvoOpcoes = form.escopo === 'LOTE' ? catalog.lotes.map((l) => [l.id, l.nome_lote]) : form.escopo === 'PROPRIEDADE' ? catalog.propriedades.map((p) => [p.id, p.nome]) : form.escopo === 'INDIVIDUAL' ? catalog.animais.slice(0, 2000).map((a) => [a.id, a.numero_animal || a.id]) : [];
  const descreve = (m) => {
    const alvo = m.escopo === 'LOTE' ? catalog.lotes.find((l) => l.id === m.alvo_id)?.nome_lote : m.escopo === 'PROPRIEDADE' ? catalog.propriedades.find((p) => p.id === m.alvo_id)?.nome : m.escopo === 'INDIVIDUAL' ? catalog.animais.find((a) => a.id === m.alvo_id)?.numero_animal : m.escopo === 'COORTE' ? [m.coorte?.raca_id && catalog.racas.find((r) => r.id === m.coorte.raca_id)?.nome, m.coorte?.sexo, m.coorte?.era, m.coorte?.estacao && PERIODO_LABELS[m.coorte.estacao]].filter(Boolean).join(' · ') : 'Todos';
    const valor = m.tipo === 'GMD' ? `${m.gmd_kg_dia} kg/dia` : m.tipo === 'PESO_DATA' ? `${m.peso_kg} kg em ${fmtDate(m.data_alvo)}` : `${CENARIO_LABELS[m.cenario]}: ${m.gmd_por_periodo ? Object.entries(m.gmd_por_periodo).map(([k, v]) => `${PERIODO_LABELS[k]} ${v}`).join(', ') : ''}${m.gmd_por_mes ? ` meses ${Object.entries(m.gmd_por_mes).map(([k, v]) => `${k}:${v}`).join(' ')}` : ''}${m.gmd_kg_dia !== null && m.gmd_kg_dia !== undefined && m.tipo === 'CENARIO' ? ` único ${m.gmd_kg_dia}` : ''}`;
    return { alvo: alvo || '—', valor };
  };
  const salvar = async () => {
    setErros([]);
    try {
      await saveTarget({
        escopo: form.escopo, tipo: form.tipo, alvo_id: form.alvo_id || null, nome: form.nome,
        coorte: { raca_id: form.raca_id || null, sexo: form.sexo || null, era: form.era || null, estacao: form.estacao || null },
        gmd_kg_dia: form.gmd_kg_dia, peso_kg: form.peso_kg, data_alvo: form.data_alvo, cenario: form.cenario,
        gmd_por_periodo: { AGUAS: form.AGUAS, TRANSICAO: form.TRANSICAO, SECA: form.SECA },
        vigencia_inicio: form.vigencia_inicio, vigencia_fim: form.vigencia_fim || null,
      });
      toast.success('Meta salva.');
      setForm(metaVazia());
      load();
    } catch (error) { setErros(error?.erros?.length ? error.erros : [describeError(error)]); }
  };
  const excluir = async () => {
    try { await removeTarget(motivo.id, { motivo: motivo.texto }); setMotivo({ id: null, texto: '' }); toast.success('Meta encerrada (auditada).'); load(); } catch (error) { toast.error(describeError(error)); }
  };
  return (
    <section className="rb-card" aria-label="Metas e cenários">
      <div className="rb-section-head"><h3>Metas e cenários</h3></div>
      <p className="rb-note">Precedência: animal &gt; lote &gt; coorte &gt; propriedade &gt; geral. Duas metas do mesmo nível para o mesmo animal aparecem como CONFLITO no painel — nenhuma é aplicada em silêncio. Cenários alimentam a projeção diária (GMD por estação do calendário).</p>
      <table className="rb-table"><thead><tr><th>Escopo</th><th>Alvo</th><th>Tipo</th><th>Valor</th><th>Vigência</th>{canEdit ? <th /> : null}</tr></thead>
        <tbody>
          {rows.map((m) => { const d = descreve(m); return <tr key={m.id}><td>{ESCOPO_LABELS[m.escopo]}</td><td>{d.alvo}</td><td>{TIPO_META_LABELS[m.tipo]}</td><td className="rb-cell--text">{d.valor}</td><td>{fmtDate(m.vigencia_inicio)}{m.vigencia_fim ? ` a ${fmtDate(m.vigencia_fim)}` : ''}</td>{canEdit ? <td>{motivo.id === m.id ? <span className="rb-inline"><input className="rb-control rb-control--compact" value={motivo.texto} onChange={(e) => setMotivo({ id: m.id, texto: e.target.value })} placeholder="Motivo" aria-label="Motivo do encerramento da meta" /><button type="button" className="rb-btn rb-btn--danger" onClick={excluir} disabled={motivo.texto.trim().length < 3}>Encerrar</button></span> : <button type="button" className="rb-btn" onClick={() => setMotivo({ id: m.id, texto: '' })}>Encerrar</button>}</td> : null}</tr>; })}
          {!rows.length ? <tr><td colSpan={6} className="rb-empty">Nenhuma meta. Metas são opcionais.</td></tr> : null}
        </tbody>
      </table>
      {canEdit ? (
        <div className="rb-grid">
          <label className="rb-field"><span className="rb-field__label is-required">Tipo</span><select className="rb-control" value={form.tipo} onChange={set('tipo')} aria-label="Tipo da meta">{TIPOS_META.map((t) => <option key={t} value={t}>{TIPO_META_LABELS[t]}</option>)}</select></label>
          <label className="rb-field"><span className="rb-field__label is-required">Escopo</span><select className="rb-control" value={form.escopo} onChange={set('escopo')} aria-label="Escopo da meta">{ESCOPOS.map((e) => <option key={e} value={e}>{ESCOPO_LABELS[e]}</option>)}</select></label>
          {alvoOpcoes.length || ['LOTE', 'PROPRIEDADE', 'INDIVIDUAL'].includes(form.escopo) ? <label className="rb-field"><span className="rb-field__label is-required">Alvo</span><select className="rb-control" value={form.alvo_id} onChange={set('alvo_id')} aria-label="Alvo da meta"><option value="">—</option>{alvoOpcoes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label> : null}
          {form.escopo === 'COORTE' ? (
            <>
              <label className="rb-field"><span className="rb-field__label">Raça</span><select className="rb-control" value={form.raca_id} onChange={set('raca_id')} aria-label="Raça da coorte"><option value="">Todas</option>{catalog.racas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
              <label className="rb-field"><span className="rb-field__label">Sexo</span><select className="rb-control" value={form.sexo} onChange={set('sexo')} aria-label="Sexo da coorte"><option value="">Ambos</option><option value="M">Machos</option><option value="F">Fêmeas</option></select></label>
              <label className="rb-field"><span className="rb-field__label">Estação</span><select className="rb-control" value={form.estacao} onChange={set('estacao')} aria-label="Estação da coorte"><option value="">Todas</option>{PERIODOS.map((x) => <option key={x} value={x}>{PERIODO_LABELS[x]}</option>)}</select></label>
            </>
          ) : null}
          {form.tipo === 'GMD' ? <label className="rb-field"><span className="rb-field__label is-required">GMD (kg/dia)</span><input className="rb-control" value={form.gmd_kg_dia} onChange={set('gmd_kg_dia')} inputMode="decimal" aria-label="GMD da meta" /></label> : null}
          {form.tipo === 'PESO_DATA' ? (
            <>
              <label className="rb-field"><span className="rb-field__label is-required">Peso (kg)</span><input className="rb-control" value={form.peso_kg} onChange={set('peso_kg')} inputMode="decimal" aria-label="Peso da meta" /></label>
              <label className="rb-field"><span className="rb-field__label is-required">Na data</span><MakDateControl value={form.data_alvo} onChange={set('data_alvo')} ariaLabel="Data alvo da meta" /></label>
            </>
          ) : null}
          {form.tipo === 'CENARIO' ? (
            <>
              <label className="rb-field"><span className="rb-field__label is-required">Cenário</span><select className="rb-control" value={form.cenario} onChange={set('cenario')} aria-label="Cenário">{CENARIOS.map((c) => <option key={c} value={c}>{CENARIO_LABELS[c]}</option>)}</select></label>
              {PERIODOS.map((x) => <label key={x} className="rb-field"><span className="rb-field__label">GMD {PERIODO_LABELS[x].toLowerCase()} (kg/dia)</span><input className="rb-control" value={form[x]} onChange={set(x)} inputMode="decimal" aria-label={`GMD do cenário na ${PERIODO_LABELS[x].toLowerCase()}`} /></label>)}
            </>
          ) : null}
          <label className="rb-field"><span className="rb-field__label is-required">Vigência a partir de</span><MakDateControl value={form.vigencia_inicio} onChange={set('vigencia_inicio')} ariaLabel="Início da vigência da meta" /></label>
          <label className="rb-field"><span className="rb-field__label">até</span><MakDateControl value={form.vigencia_fim} onChange={set('vigencia_fim')} ariaLabel="Fim da vigência da meta" /></label>
          {erros.length ? <ul className="rb-alerts rb-alerts--error rb-field--wide">{erros.map((e) => <li key={e}>{e}</li>)}</ul> : null}
          <div className="rb-inline rb-field--wide"><button type="button" className="rb-btn rb-btn--primary" onClick={salvar}><Save size={14} aria-hidden="true" /> Salvar meta</button></div>
        </div>
      ) : null}
    </section>
  );
}

export default function Parametrizacao() {
  const auth = useAuth();
  const can = (action) => (auth ? Boolean(auth.can?.(action)) : true);
  const catalog = useCatalog();
  if (!can('settings.operational')) return <AccessDenied role={auth?.user?.role} permission="settings.operational" />;
  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page rb-page">
      <ModeloBase1PageHeader title="Parametrização" description="Regras de negócio, cada seção salva separadamente." />
      <div className="rb-scroll">
        {can('settings.manage') ? <ConfigSection id="curral" /> : null}
        {can('settings.reports') ? <ConfigSection id="relatorios" /> : null}
        {can('settings.manage') ? <ConfigSection id="comercial" /> : null}
        <AgePolicySection canEdit={can('settings.manage')} />
        <section className="rb-card" aria-label="Sanidade e carência">
          <div className="rb-section-head"><h3>Sanidade e carência</h3></div>
          <p className="rb-note">A regra de dose (posologia) e a carência de cada medicamento são versionadas e aprovadas por responsável técnico em <Link to={createPageUrl('Sanidade')}>Operação › Sanidade › Posologias</Link>. A carência do abate é conferida na Saída.</p>
        </section>
        <SeasonSection canEdit={can('settings.manage')} catalog={catalog} />
        <TargetsSection canEdit={can('settings.manage')} catalog={catalog} />
      </div>
    </ModeloBase1PageContainer>
  );
}
