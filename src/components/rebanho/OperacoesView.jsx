// Tela de operações do rebanho (F01 Entradas, F02 Saídas, F03 Movimentações): lista com filtros, editor de
// rascunho (cabeçalho + animais), conferência e confirmação, consulta e cancelamento com motivo. As regras
// (validação, efeito único no livro, atomicidade) ficam no operationsService; a tela só monta o pedido.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Ban, CheckCircle2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import MakDateControl from '@/components/mak/MakDateControl';
import {
  OPERACAO_STATUS,
  PESO_ORIGENS,
  PESO_ORIGEM_LABELS,
  STATUS_LABELS,
  SUBTIPOS,
  SUBTIPOS_PESO_OBRIGATORIO,
  SUBTIPO_LABELS,
  cancelOperation,
  confirmOperation,
  discardDraft,
  getOperation,
  listOperations,
  registerWithdrawalRelease,
  saveDraft,
  summarizeOperation,
} from '@/modules/livestock/application/operationsService';
import {
  READ_PERMISSION,
  animalLabel,
  describeError,
  fmtDate,
  fmtInt,
  fmtKg,
  fmtMoney,
  isAnimalAtivo,
  loadRebanhoCatalog,
  nameIndex,
  rebanhoPermissions,
  todayIso,
} from './rebanhoModel';
import '@/styles/rebanho.css';

const EMPTY_CATALOG = { animais: [], marcas: [], racas: [], lotes: [], propriedades: [], parceiros: [], causasMorte: [] };
const PARCEIRO_ROTULO = { COMPRA: 'Vendedor', VENDA: 'Comprador', ABATE: 'Frigorífico', TRANSFERENCIA_ENVIADA: 'Destino (parceiro)', TRANSFERENCIA_RECEBIDA: 'Origem (parceiro)', DOACAO: 'Recebedor' };

function emptyHeader(tipo) {
  return {
    tipo, subtipo: SUBTIPOS[tipo][0], data: todayIso(), quantidade_prevista: '', parceiro_id: '',
    propriedade_origem_id: '', propriedade_destino_id: '', lote_destino_id: '', gta_numero: '', nf_numero: '',
    valor_total: '', frete: '', observacao: '',
  };
}
const emptyNovo = () => ({ key: crypto.randomUUID(), numero_animal: '', marca_id: '', sexo: '', raca_id: '', mae_animal_id: '', peso: '', peso_origem: 'MANUAL', valor: '' });

function Field({ label, children, wide = false, required = false }) {
  return (
    <label className={`rb-field${wide ? ' rb-field--wide' : ''}`}>
      <span className={`rb-field__label${required ? ' is-required' : ''}`}>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, placeholder = '—', disabled, ariaLabel }) {
  return (
    <select className="rb-control" value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} aria-label={ariaLabel}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function Text({ value, onChange, disabled, inputMode, placeholder, ariaLabel }) {
  return <input className="rb-control" value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} inputMode={inputMode} placeholder={placeholder} aria-label={ariaLabel} autoComplete="off" />;
}

const toOptions = (rows, campo = 'nome') => rows.map((row) => ({ value: row.id, label: row[campo] || row.nome || row.id }));

export default function OperacoesView({ tipo, title, singular, description }) {
  const auth = useAuth();
  const { canRead, canWrite, canCancel } = rebanhoPermissions(auth);
  const [catalog, setCatalog] = useState(EMPTY_CATALOG);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', from: '', to: '' });
  const [mode, setMode] = useState('list'); // list | edit | view
  const [current, setCurrent] = useState(null); // { operacao, itens, resumo, conferencia }
  const [header, setHeader] = useState(() => emptyHeader(tipo));
  const [novos, setNovos] = useState([]); // ENTRADA: animais novos
  const [selecionados, setSelecionados] = useState([]); // SAÍDA/MOVIMENTAÇÃO: { animal_id, peso, peso_origem, valor, causa_morte_id }
  const [busca, setBusca] = useState({ texto: '', lote: '', sexo: '', raca: '' });
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState('');
  const [erros, setErros] = useState([]);
  const [liberacao, setLiberacao] = useState({ motivo: '', responsavel: '', evidencia: '', data: todayIso() });
  const canRelease = auth ? Boolean(auth.can?.('registry.write')) : true;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listOperations({ tipo, status: filters.status || null, from: filters.from || null, to: filters.to || null }));
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível carregar as operações.'));
    } finally {
      setLoading(false);
    }
  }, [tipo, filters]);

  const refreshCatalog = useCallback(async () => {
    try {
      setCatalog(await loadRebanhoCatalog());
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível carregar animais e cadastros.'));
    }
  }, []);

  useEffect(() => { if (canRead) refresh(); }, [canRead, refresh]);
  useEffect(() => { if (canRead) refreshCatalog(); }, [canRead, refreshCatalog]);

  const idx = useMemo(() => ({
    animais: new Map(catalog.animais.map((a) => [a.id, a])),
    lotes: nameIndex(catalog.lotes, 'nome_lote'),
    parceiros: nameIndex(catalog.parceiros),
    propriedades: nameIndex(catalog.propriedades),
  }), [catalog]);

  const setH = (campo) => (value) => setHeader((h) => ({ ...h, [campo]: value }));

  const abrirNovo = () => {
    setHeader(emptyHeader(tipo));
    setNovos(tipo === 'ENTRADA' ? [emptyNovo()] : []);
    setSelecionados([]);
    setCurrent(null);
    setAck(false);
    setErros([]);
    setMode('edit');
  };

  const abrir = async (row) => {
    try {
      const found = await getOperation(row.id);
      if (!found) return;
      setCurrent(found);
      setErros([]);
      setAck(false);
      setMotivoCancel('');
      if (found.operacao.status === OPERACAO_STATUS.RASCUNHO && canWrite) {
        const op = found.operacao;
        setHeader({
          ...emptyHeader(tipo),
          ...Object.fromEntries(Object.keys(emptyHeader(tipo)).map((k) => [k, op[k] ?? ''])),
          quantidade_prevista: op.quantidade_prevista ?? '',
        });
        if (tipo === 'ENTRADA') {
          setNovos(found.itens.map((item) => ({ key: item.id, ...emptyNovo(), ...(item.dados || {}), animal_id: item.animal_id || '', peso: item.peso_kg ?? '', peso_origem: item.peso_origem || 'MANUAL', valor: item.valor ?? '' })));
        } else {
          setSelecionados(found.itens.map((item) => ({ animal_id: item.animal_id, peso: item.peso_kg ?? '', peso_origem: item.peso_origem || 'MANUAL', valor: item.valor ?? '', causa_morte_id: item.causa_morte_id || '' })));
        }
        setMode('edit');
      } else {
        setMode('view');
      }
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  const voltar = async () => {
    setMode('list');
    setCurrent(null);
    await refresh();
  };

  // ---------------------------------------------------------------------------
  // Montagem do pedido
  const pedido = () => ({
    id: current?.operacao?.id || null,
    ...header,
    itens: tipo === 'ENTRADA'
      ? novos.map(({ key: _key, ...item }) => item)
      : selecionados.map((item) => ({ ...item })),
  });

  const salvar = async ({ silencioso = false } = {}) => {
    setBusy(true);
    setErros([]);
    try {
      const salvo = await saveDraft(pedido());
      setCurrent(salvo);
      if (!silencioso) toast.success('Rascunho salvo.');
      return salvo;
    } catch (error) {
      setErros(error?.erros?.length ? error.erros : [describeError(error)]);
      toast.error(describeError(error, 'Confira os campos.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const confirmar = async () => {
    const salvo = await salvar({ silencioso: true });
    if (!salvo) return;
    if (!salvo.conferencia.ok) {
      setErros(salvo.conferencia.bloqueios);
      toast.error(salvo.conferencia.bloqueios[0]);
      return;
    }
    if (salvo.conferencia.avisos.length && !ack) {
      toast.warning('Confira os avisos e marque "Conferi" para confirmar.');
      return;
    }
    setBusy(true);
    try {
      const done = await confirmOperation(salvo.operacao.id, { aceitarAvisos: ack });
      toast.success(`${SUBTIPO_LABELS[done.operacao.subtipo]} confirmada: ${fmtInt(done.quantidade)} animal(is).`);
      await refreshCatalog();
      await voltar();
    } catch (error) {
      setErros(error?.conferencia?.bloqueios?.length ? error.conferencia.bloqueios : [describeError(error)]);
      toast.error(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const descartar = async () => {
    if (!current?.operacao?.id) { await voltar(); return; }
    setBusy(true);
    try {
      await discardDraft(current.operacao.id);
      toast.success('Rascunho descartado.');
      await voltar();
    } catch (error) {
      toast.error(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const cancelar = async () => {
    setBusy(true);
    try {
      const updated = await cancelOperation(current.operacao.id, { motivo: motivoCancel });
      setCurrent((c) => ({ ...c, ...updated }));
      toast.success('Operação cancelada. O histórico foi preservado.');
      await refreshCatalog();
      await voltar();
    } catch (error) {
      toast.error(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const liberar = async () => {
    if (!current?.operacao?.id) return;
    setBusy(true);
    try {
      const updated = await registerWithdrawalRelease(current.operacao.id, liberacao);
      setCurrent((c) => ({ ...c, ...updated }));
      setErros([]);
      toast.success('Liberação técnica registrada. Confira e confirme a saída.');
    } catch (error) {
      toast.error(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Seleção de animais (Saída/Movimentação)
  const candidatos = useMemo(() => {
    if (tipo === 'ENTRADA') return [];
    const ja = new Set(selecionados.map((s) => s.animal_id));
    const texto = busca.texto.trim().toUpperCase();
    return catalog.animais
      .filter((a) => isAnimalAtivo(a) && !ja.has(a.id))
      .filter((a) => !texto || String(a.numero_animal || '').toUpperCase().includes(texto))
      .filter((a) => !busca.lote || a.lote_atual_id === busca.lote)
      .filter((a) => !busca.sexo || a.sexo === busca.sexo)
      .filter((a) => !busca.raca || a.raca_id === busca.raca)
      .sort((a, b) => String(a.numero_animal || '').localeCompare(String(b.numero_animal || ''), 'pt-BR', { numeric: true }));
  }, [tipo, catalog.animais, selecionados, busca]);

  const adicionar = (animais) => setSelecionados((list) => [...list, ...animais.map((a) => ({ animal_id: a.id, peso: '', peso_origem: 'MANUAL', valor: '', causa_morte_id: '' }))]);
  const setSel = (animalId, campo, value) => setSelecionados((list) => list.map((s) => (s.animal_id === animalId ? { ...s, [campo]: value } : s)));
  const setNovo = (key, campo, value) => setNovos((list) => list.map((n) => (n.key === key ? { ...n, [campo]: value } : n)));

  const resumoLocal = useMemo(() => {
    const itens = tipo === 'ENTRADA'
      ? novos.map((n) => ({ peso_kg: Number(String(n.peso).replace(',', '.')) || null, valor: n.valor === '' ? null : Number(String(n.valor).replace(/\./g, '').replace(',', '.')) }))
      : selecionados.map((s) => ({ peso_kg: Number(String(s.peso).replace(',', '.')) || null, valor: s.valor === '' ? null : Number(String(s.valor).replace(/\./g, '').replace(',', '.')) }));
    const valorTotal = header.valor_total === '' ? null : Number(String(header.valor_total).replace(/\./g, '').replace(',', '.'));
    return summarizeOperation({ quantidade_prevista: Number(header.quantidade_prevista) || null, valor_total: Number.isFinite(valorTotal) ? valorTotal : null, frete: null }, itens);
  }, [tipo, novos, selecionados, header.valor_total, header.quantidade_prevista]);

  if (!canRead) return <AccessDenied role={auth?.user?.role} permission={READ_PERMISSION} />;

  const subtipoOptions = SUBTIPOS[tipo].map((value) => ({ value, label: SUBTIPO_LABELS[value] }));
  const pesoObrigatorio = SUBTIPOS_PESO_OBRIGATORIO.includes(header.subtipo);
  const mostraParceiro = Boolean(PARCEIRO_ROTULO[header.subtipo]);
  const mostraValor = ['COMPRA', 'VENDA', 'ABATE'].includes(header.subtipo);

  // ---------------------------------------------------------------------------
  if (mode === 'list') {
    return (
      <ModeloBase1PageContainer variant="table" className="d17b-page rb-page">
        <ModeloBase1PageHeader title={title} description={description} />
        <div className="rb-toolbar" role="toolbar" aria-label={`Ações de ${title}`}>
          <select className="rb-control rb-control--compact" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} aria-label="Situação">
            <option value="">Todas as situações</option>
            {Object.keys(STATUS_LABELS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <span className="rb-toolbar__label">De</span>
          <MakDateControl value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} ariaLabel="Data inicial" />
          <span className="rb-toolbar__label">até</span>
          <MakDateControl value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} ariaLabel="Data final" />
          <button type="button" className="rb-btn" onClick={refresh} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> Atualizar</button>
          <span className="rb-toolbar__spacer" />
          {canWrite ? <button type="button" className="rb-btn rb-btn--primary" onClick={abrirNovo}><Plus size={14} aria-hidden="true" /> Nova {singular}</button> : null}
        </div>
        <div className="rb-table-wrap">
          <table className="rb-table">
            <thead>
              <tr><th>Data</th><th>Tipo</th><th>Situação</th><th className="rb-num">Animais</th><th>Parceiro</th><th>Documento</th><th>Observação</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="rb-empty">Carregando…</td></tr> : null}
              {!loading && !rows.length ? <tr><td colSpan={7} className="rb-empty">Nenhuma operação no filtro. {canWrite ? 'Use “Nova” para lançar.' : ''}</td></tr> : null}
              {!loading && rows.map((row) => (
                <tr key={row.id} className={`rb-row rb-row--${String(row.status).toLowerCase()}`} onClick={() => abrir(row)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') abrir(row); }}>
                  <td>{fmtDate(row.data)}</td>
                  <td>{SUBTIPO_LABELS[row.subtipo] || row.subtipo}{row.origem === 'LEGADO' ? <span className="rb-tag">legado</span> : null}</td>
                  <td><span className={`rb-status rb-status--${String(row.status).toLowerCase()}`}>{STATUS_LABELS[row.status] || row.status}</span></td>
                  <td className="rb-num">{fmtInt(row.quantidade)}</td>
                  <td>{idx.parceiros.get(row.parceiro_id) || '—'}</td>
                  <td>{[row.gta_numero && `GTA ${row.gta_numero}`, row.nf_numero && `NF ${row.nf_numero}`].filter(Boolean).join(' · ') || (row.documento_situacao === 'SEM_DOCUMENTO' ? 'Sem documento' : '—')}</td>
                  <td className="rb-cell--text">{row.observacao || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ModeloBase1PageContainer>
    );
  }

  // ---------------------------------------------------------------------------
  if (mode === 'view' && current) {
    const op = current.operacao;
    const podeCancelar = canCancel && op.status === OPERACAO_STATUS.CONFIRMADA && op.origem !== 'LEGADO';
    return (
      <ModeloBase1PageContainer variant="table" className="d17b-page rb-page">
        <ModeloBase1PageHeader title={`${SUBTIPO_LABELS[op.subtipo] || op.subtipo} · ${fmtDate(op.data)}`} description={`${title} — ${STATUS_LABELS[op.status] || op.status}`} />
        <div className="rb-toolbar">
          <button type="button" className="rb-btn" onClick={voltar}><ArrowLeft size={14} aria-hidden="true" /> Voltar</button>
        </div>
        <div className="rb-scroll">
          <section className="rb-card" aria-label="Cabeçalho">
            <dl className="rb-dl">
              <div><dt>Situação</dt><dd><span className={`rb-status rb-status--${String(op.status).toLowerCase()}`}>{STATUS_LABELS[op.status]}</span></dd></div>
              <div><dt>Parceiro</dt><dd>{idx.parceiros.get(op.parceiro_id) || '—'}</dd></div>
              <div><dt>Propriedade de origem</dt><dd>{idx.propriedades.get(op.propriedade_origem_id) || '—'}</dd></div>
              <div><dt>Propriedade de destino</dt><dd>{idx.propriedades.get(op.propriedade_destino_id) || '—'}</dd></div>
              <div><dt>Lote de destino</dt><dd>{idx.lotes.get(op.lote_destino_id) || '—'}</dd></div>
              <div><dt>Documento</dt><dd>{[op.gta_numero && `GTA ${op.gta_numero}`, op.nf_numero && `NF ${op.nf_numero}`].filter(Boolean).join(' · ') || 'Sem documento'}</dd></div>
              <div><dt>Valor total</dt><dd>{fmtMoney(current.resumo?.valor_total)}</dd></div>
              <div><dt>Frete</dt><dd>{fmtMoney(op.frete)}</dd></div>
              <div><dt>Animais</dt><dd>{fmtInt(current.resumo?.quantidade)}{op.quantidade_prevista ? ` de ${fmtInt(op.quantidade_prevista)} previstos` : ''}</dd></div>
              <div><dt>Peso total / médio</dt><dd>{fmtKg(current.resumo?.peso_total_kg)} / {fmtKg(current.resumo?.peso_medio_kg)}</dd></div>
              <div className="rb-dl__wide"><dt>Observação</dt><dd>{op.observacao || '—'}</dd></div>
              {op.status === 'CANCELADA' ? <div className="rb-dl__wide"><dt>Motivo do cancelamento</dt><dd>{op.motivo_cancelamento || '—'}</dd></div> : null}
              {op.origem === 'LEGADO' ? <div className="rb-dl__wide"><dt>Origem</dt><dd>Gerada na atualização a partir das pesagens antigas (sem documento nem valores). Correções pela Relação de Pesagens.</dd></div> : null}
            </dl>
          </section>
          <table className="rb-table">
            <thead><tr><th>Animal</th><th>Situação do item</th><th className="rb-num">Peso</th><th>Origem do peso</th><th className="rb-num">Valor</th><th>Observação</th></tr></thead>
            <tbody>
              {current.itens.map((item) => {
                const animal = idx.animais.get(item.animal_id);
                return (
                  <tr key={item.id}>
                    <td>{animal ? animalLabel(animal) : (item.dados?.numero_animal || '—')}{animal?.situacao_cadastro && animal.situacao_cadastro !== 'OK' ? <span className="rb-tag rb-tag--warn">{animal.situacao_cadastro === 'PENDENTE_PESAGEM' ? 'pendente de pesagem' : 'pendente de identificação'}</span> : null}</td>
                    <td>{item.status === 'CANCELADO' ? 'Cancelado' : item.status === 'CONFIRMADO' ? 'Confirmado' : 'Rascunho'}{item.pesagem_cancelada ? <span className="rb-tag rb-tag--warn">pesagem cancelada fora da operação</span> : null}</td>
                    <td className="rb-num">{fmtKg(item.peso_kg)}</td>
                    <td>{item.peso_origem ? (PESO_ORIGEM_LABELS[item.peso_origem] || item.peso_origem) : (item.peso_kg ? '—' : 'Sem peso')}</td>
                    <td className="rb-num">{fmtMoney(item.valor)}</td>
                    <td className="rb-cell--text">{item.observacao || item.texto_legado || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {podeCancelar ? (
            <section className="rb-card rb-card--danger" aria-label="Cancelar operação">
              <p className="rb-note">Cancelar desfaz o efeito no rebanho (entradas, saídas ou movimentações) e preserva o histórico com o motivo. Entrada de animal que já tem pesagens ou movimentações posteriores não pode ser cancelada.</p>
              <div className="rb-inline">
                <Text value={motivoCancel} onChange={setMotivoCancel} placeholder="Motivo do cancelamento" ariaLabel="Motivo do cancelamento" />
                <button type="button" className="rb-btn rb-btn--danger" onClick={cancelar} disabled={busy || motivoCancel.trim().length < 3}><Ban size={14} aria-hidden="true" /> Cancelar operação</button>
              </div>
            </section>
          ) : null}
        </div>
      </ModeloBase1PageContainer>
    );
  }

  // ---------------------------------------------------------------------------
  // Editor (rascunho)
  const conferencia = current?.conferencia;
  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page rb-page">
      <ModeloBase1PageHeader title={current?.operacao ? `${title}: rascunho` : `Nova ${singular}`} description="Preencha o cabeçalho, inclua os animais, confira e confirme." />
      <div className="rb-toolbar">
        <button type="button" className="rb-btn" onClick={voltar} disabled={busy}><ArrowLeft size={14} aria-hidden="true" /> Voltar</button>
        <span className="rb-toolbar__spacer" />
        <button type="button" className="rb-btn" onClick={descartar} disabled={busy}><Trash2 size={14} aria-hidden="true" /> Descartar</button>
        <button type="button" className="rb-btn" onClick={() => salvar()} disabled={busy}><Save size={14} aria-hidden="true" /> Salvar rascunho</button>
        <button type="button" className="rb-btn rb-btn--primary" onClick={confirmar} disabled={busy}><CheckCircle2 size={14} aria-hidden="true" /> Conferir e confirmar</button>
      </div>
      <div className="rb-scroll">
        <section className="rb-card rb-grid" aria-label="Cabeçalho da operação">
          <Field label="Tipo" required><Select value={header.subtipo} onChange={setH('subtipo')} options={subtipoOptions} placeholder="Escolha" ariaLabel="Tipo" /></Field>
          <Field label="Data" required><MakDateControl value={header.data} onChange={(e) => setH('data')(e.target.value)} ariaLabel="Data da operação" /></Field>
          {tipo !== 'MOVIMENTACAO' ? <Field label="Quantidade prevista"><Text value={header.quantidade_prevista} onChange={setH('quantidade_prevista')} inputMode="numeric" ariaLabel="Quantidade prevista" /></Field> : null}
          {mostraParceiro ? <Field label={PARCEIRO_ROTULO[header.subtipo]}><Select value={header.parceiro_id} onChange={setH('parceiro_id')} options={toOptions(catalog.parceiros)} ariaLabel={PARCEIRO_ROTULO[header.subtipo]} /></Field> : null}
          {tipo === 'ENTRADA' ? <Field label="Propriedade de origem"><Select value={header.propriedade_origem_id} onChange={setH('propriedade_origem_id')} options={toOptions(catalog.propriedades)} ariaLabel="Propriedade de origem" /></Field> : null}
          {tipo === 'ENTRADA' || header.subtipo === 'MUDANCA_PROPRIEDADE' ? <Field label="Propriedade de destino" required={header.subtipo === 'MUDANCA_PROPRIEDADE'}><Select value={header.propriedade_destino_id} onChange={setH('propriedade_destino_id')} options={toOptions(catalog.propriedades)} ariaLabel="Propriedade de destino" /></Field> : null}
          {tipo !== 'SAIDA' ? <Field label="Lote de destino" required={header.subtipo === 'MUDANCA_LOTE'}><Select value={header.lote_destino_id} onChange={setH('lote_destino_id')} options={toOptions(catalog.lotes, 'nome_lote')} ariaLabel="Lote de destino" /></Field> : null}
          {tipo !== 'MOVIMENTACAO' ? <Field label="GTA"><Text value={header.gta_numero} onChange={setH('gta_numero')} ariaLabel="Número da GTA" /></Field> : null}
          {tipo !== 'MOVIMENTACAO' ? <Field label="NF-e"><Text value={header.nf_numero} onChange={setH('nf_numero')} ariaLabel="Número da NF-e" /></Field> : null}
          {mostraValor ? <Field label="Valor total (R$)"><Text value={header.valor_total} onChange={setH('valor_total')} inputMode="decimal" ariaLabel="Valor total" /></Field> : null}
          {header.subtipo === 'COMPRA' ? <Field label="Frete (R$)"><Text value={header.frete} onChange={setH('frete')} inputMode="decimal" ariaLabel="Frete" /></Field> : null}
          <Field label={header.subtipo.startsWith('AJUSTE') ? 'Justificativa' : 'Observação'} wide required={header.subtipo.startsWith('AJUSTE')}><Text value={header.observacao} onChange={setH('observacao')} ariaLabel="Observação" /></Field>
        </section>

        {tipo === 'ENTRADA' ? (
          <section className="rb-card" aria-label="Animais da entrada">
            <div className="rb-section-head">
              <h3>Animais ({novos.length})</h3>
              <span className="rb-note">Peso em branco = animal fica pendente de pesagem (nenhum peso é inventado). Sem número = pendente de identificação.</span>
              <span className="rb-toolbar__spacer" />
              <button type="button" className="rb-btn" onClick={() => setNovos((l) => [...l, emptyNovo()])}><Plus size={14} aria-hidden="true" /> Animal</button>
              <button type="button" className="rb-btn" onClick={() => setNovos((l) => [...l, ...Array.from({ length: 10 }, emptyNovo)])}>+10 linhas</button>
            </div>
            <table className="rb-table rb-table--edit">
              <thead><tr><th>#</th><th>Número</th><th>Marca a fogo</th><th>Sexo</th><th>Raça</th>{header.subtipo === 'NASCIMENTO' ? <th>Mãe</th> : null}<th>Peso (kg)</th><th>Origem do peso</th>{mostraValor ? <th>Valor (R$)</th> : null}<th /></tr></thead>
              <tbody>
                {novos.map((n, i) => (
                  <tr key={n.key}>
                    <td className="rb-num">{i + 1}</td>
                    <td><Text value={n.numero_animal} onChange={(v) => setNovo(n.key, 'numero_animal', v)} ariaLabel={`Número do animal ${i + 1}`} /></td>
                    <td><Select value={n.marca_id} onChange={(v) => setNovo(n.key, 'marca_id', v)} options={toOptions(catalog.marcas)} ariaLabel={`Marca do animal ${i + 1}`} /></td>
                    <td><Select value={n.sexo} onChange={(v) => setNovo(n.key, 'sexo', v)} options={[{ value: 'M', label: 'Macho' }, { value: 'F', label: 'Fêmea' }]} ariaLabel={`Sexo do animal ${i + 1}`} /></td>
                    <td><Select value={n.raca_id} onChange={(v) => setNovo(n.key, 'raca_id', v)} options={toOptions(catalog.racas)} ariaLabel={`Raça do animal ${i + 1}`} /></td>
                    {header.subtipo === 'NASCIMENTO' ? <td><Select value={n.mae_animal_id} onChange={(v) => setNovo(n.key, 'mae_animal_id', v)} options={catalog.animais.filter((a) => isAnimalAtivo(a) && a.sexo === 'F').map((a) => ({ value: a.id, label: animalLabel(a) }))} placeholder="Não informada" ariaLabel={`Mãe do animal ${i + 1}`} /></td> : null}
                    <td><Text value={n.peso} onChange={(v) => setNovo(n.key, 'peso', v)} inputMode="decimal" ariaLabel={`Peso do animal ${i + 1}`} /></td>
                    <td><Select value={n.peso_origem} onChange={(v) => setNovo(n.key, 'peso_origem', v)} options={PESO_ORIGENS.map((value) => ({ value, label: PESO_ORIGEM_LABELS[value] }))} ariaLabel={`Origem do peso ${i + 1}`} /></td>
                    {mostraValor ? <td><Text value={n.valor} onChange={(v) => setNovo(n.key, 'valor', v)} inputMode="decimal" ariaLabel={`Valor do animal ${i + 1}`} /></td> : null}
                    <td><button type="button" className="rb-icon-btn" onClick={() => setNovos((l) => l.filter((x) => x.key !== n.key))} aria-label={`Remover animal ${i + 1}`}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="rb-card" aria-label="Animais">
            <div className="rb-section-head">
              <h3>Selecionar animais ativos</h3>
              <Text value={busca.texto} onChange={(v) => setBusca((b) => ({ ...b, texto: v }))} placeholder="Número" ariaLabel="Buscar por número" />
              <Select value={busca.lote} onChange={(v) => setBusca((b) => ({ ...b, lote: v }))} options={toOptions(catalog.lotes, 'nome_lote')} placeholder="Todos os lotes" ariaLabel="Filtrar por lote" />
              <Select value={busca.sexo} onChange={(v) => setBusca((b) => ({ ...b, sexo: v }))} options={[{ value: 'M', label: 'Macho' }, { value: 'F', label: 'Fêmea' }]} placeholder="Ambos os sexos" ariaLabel="Filtrar por sexo" />
              <Select value={busca.raca} onChange={(v) => setBusca((b) => ({ ...b, raca: v }))} options={toOptions(catalog.racas)} placeholder="Todas as raças" ariaLabel="Filtrar por raça" />
              <button type="button" className="rb-btn" onClick={() => adicionar(candidatos)} disabled={!candidatos.length}>Adicionar todos ({fmtInt(candidatos.length)})</button>
            </div>
            <div className="rb-picker">
              {candidatos.slice(0, 200).map((a) => (
                <button type="button" key={a.id} className="rb-chip" onClick={() => adicionar([a])} title={`Lote: ${idx.lotes.get(a.lote_atual_id) || '—'} · último peso: ${fmtKg(a.ultimo_peso_kg)}`}>{animalLabel(a)}</button>
              ))}
              {candidatos.length > 200 ? <span className="rb-note">Mostrando 200 de {fmtInt(candidatos.length)}; refine a busca ou use “Adicionar todos”.</span> : null}
              {!candidatos.length ? <span className="rb-note">Nenhum animal ativo no filtro.</span> : null}
            </div>
            <h3 className="rb-subtitle">Na operação ({selecionados.length})</h3>
            <table className="rb-table rb-table--edit">
              <thead><tr><th>Animal</th><th>Lote atual</th><th className="rb-num">Último peso</th>{tipo === 'SAIDA' ? <><th>Peso (kg){pesoObrigatorio ? ' *' : ''}</th><th>Origem do peso</th></> : null}{tipo === 'SAIDA' && mostraValor ? <th>Valor (R$)</th> : null}{header.subtipo === 'MORTE' ? <th>Causa da morte</th> : null}<th /></tr></thead>
              <tbody>
                {selecionados.map((s) => {
                  const a = idx.animais.get(s.animal_id);
                  return (
                    <tr key={s.animal_id}>
                      <td>{animalLabel(a)}</td>
                      <td>{idx.lotes.get(a?.lote_atual_id) || '—'}</td>
                      <td className="rb-num">{fmtKg(a?.ultimo_peso_kg)}</td>
                      {tipo === 'SAIDA' ? (
                        <>
                          <td><Text value={s.peso} onChange={(v) => setSel(s.animal_id, 'peso', v)} inputMode="decimal" ariaLabel={`Peso de ${animalLabel(a)}`} /></td>
                          <td><Select value={s.peso_origem} onChange={(v) => setSel(s.animal_id, 'peso_origem', v)} options={PESO_ORIGENS.map((value) => ({ value, label: PESO_ORIGEM_LABELS[value] }))} ariaLabel={`Origem do peso de ${animalLabel(a)}`} /></td>
                        </>
                      ) : null}
                      {tipo === 'SAIDA' && mostraValor ? <td><Text value={s.valor} onChange={(v) => setSel(s.animal_id, 'valor', v)} inputMode="decimal" ariaLabel={`Valor de ${animalLabel(a)}`} /></td> : null}
                      {header.subtipo === 'MORTE' ? <td><Select value={s.causa_morte_id} onChange={(v) => setSel(s.animal_id, 'causa_morte_id', v)} options={toOptions(catalog.causasMorte)} placeholder="Não informada" ariaLabel={`Causa da morte de ${animalLabel(a)}`} /></td> : null}
                      <td><button type="button" className="rb-icon-btn" onClick={() => setSelecionados((l) => l.filter((x) => x.animal_id !== s.animal_id))} aria-label={`Remover ${animalLabel(a)}`}><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
                {!selecionados.length ? <tr><td colSpan={8} className="rb-empty">Nenhum animal incluído.</td></tr> : null}
              </tbody>
            </table>
          </section>
        )}

        <section className="rb-card" aria-label="Conferência">
          <dl className="rb-dl">
            <div><dt>Animais</dt><dd>{fmtInt(resumoLocal.quantidade)}{resumoLocal.quantidade_prevista ? ` de ${fmtInt(resumoLocal.quantidade_prevista)} previstos` : ''}</dd></div>
            {tipo !== 'MOVIMENTACAO' ? <div><dt>Pesados / sem peso</dt><dd>{fmtInt(resumoLocal.pesados)} / {fmtInt(resumoLocal.sem_peso)}</dd></div> : null}
            {tipo !== 'MOVIMENTACAO' ? <div><dt>Peso total / médio</dt><dd>{fmtKg(resumoLocal.peso_total_kg)} / {fmtKg(resumoLocal.peso_medio_kg)}</dd></div> : null}
            {mostraValor ? <div><dt>Valor total / por cabeça</dt><dd>{fmtMoney(resumoLocal.valor_total)} / {fmtMoney(resumoLocal.valor_por_cabeca)}</dd></div> : null}
          </dl>
          {erros.length ? <ul className="rb-alerts rb-alerts--error">{erros.map((e) => <li key={e}>{e}</li>)}</ul> : null}
          {header.subtipo === 'ABATE' && erros.some((e) => /carência/.test(e)) && current?.operacao?.id ? (
            canRelease ? (
              <div className="rb-subsection" aria-label="Liberação técnica de carência">
                <p className="rb-note">Animal em carência não vai para abate sem <strong>liberação técnica</strong> registrada (responsável, motivo e evidência). Fica na operação e na auditoria.</p>
                <div className="rb-inline rb-inline--wrap">
                  <input className="rb-control" value={liberacao.responsavel} onChange={(e) => setLiberacao((l) => ({ ...l, responsavel: e.target.value }))} placeholder="Responsável técnico (nome e registro)" aria-label="Responsável técnico" />
                  <input className="rb-control" value={liberacao.motivo} onChange={(e) => setLiberacao((l) => ({ ...l, motivo: e.target.value }))} placeholder="Motivo da liberação" aria-label="Motivo da liberação" />
                  <input className="rb-control rb-control--compact" value={liberacao.evidencia} onChange={(e) => setLiberacao((l) => ({ ...l, evidencia: e.target.value }))} placeholder="Evidência (laudo, documento)" aria-label="Evidência da liberação" />
                  <MakDateControl value={liberacao.data} onChange={(e) => setLiberacao((l) => ({ ...l, data: e.target.value }))} ariaLabel="Data da liberação" />
                  <button type="button" className="rb-btn" onClick={liberar} disabled={busy}>Registrar liberação</button>
                </div>
              </div>
            ) : <p className="rb-note rb-note--warn">Peça a um gestor para registrar a liberação técnica de carência.</p>
          ) : null}
          {current?.operacao?.liberacao_carencia ? <p className="rb-note">Liberação técnica: {current.operacao.liberacao_carencia.responsavel} — {current.operacao.liberacao_carencia.motivo}</p> : null}
          {conferencia?.avisos?.length ? (
            <>
              <ul className="rb-alerts rb-alerts--warn">{conferencia.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
              <label className="rb-check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Conferi os avisos acima</label>
            </>
          ) : null}
        </section>
      </div>
    </ModeloBase1PageContainer>
  );
}
