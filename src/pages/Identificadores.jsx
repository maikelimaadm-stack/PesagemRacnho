import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, PackagePlus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import MakDateControl from '@/components/mak/MakDateControl';
import {
  ACAO_LABELS,
  SITUACAO_LABELS,
  TIPOS_IDENTIFICADOR,
  TIPO_IDENTIFICADOR_LABELS,
  listStock,
  physicalStockCount,
  receiveIdentifiers,
  stockAction,
} from '@/modules/livestock/application/animalProfileService';
import { describeError, fmtDate, fmtInt, todayIso } from '@/components/rebanho/rebanhoModel';
import '@/styles/rebanho.css';

// Menu CADASTROS › Identificadores (F06): estoque de brincos, RFID e códigos SISBOV pelo livro
// `movimentosIdentificadores` — recebimento por faixa, reserva, perda, dano, devolução, bloqueio e
// conferência física. A aplicação no animal é feita na Ficha do Animal (o saldo muda exatamente uma vez).
const ACOES_LINHA = Object.freeze({
  DISPONIVEL: ['RESERVADO', 'BLOQUEADO', 'PERDIDO', 'DANIFICADO', 'DEVOLVIDO'],
  RESERVADO: ['LIBERADO', 'PERDIDO', 'DANIFICADO', 'DEVOLVIDO'],
  BLOQUEADO: ['LIBERADO', 'DEVOLVIDO', 'PERDIDO'],
  APLICADO: ['PERDIDO', 'DANIFICADO'],
});

export default function Identificadores() {
  const auth = useAuth();
  const can = (action) => (auth ? Boolean(auth.can?.(action)) : true);
  const canRead = can('animal.read');
  const canReceive = can('registry.write');
  const canMove = can('weighing.write');
  const [tipo, setTipo] = useState('BRINCO');
  const [situacao, setSituacao] = useState('');
  const [texto, setTexto] = useState('');
  const [data, setData] = useState({ codigos: [], resumo: null });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receber, setReceber] = useState({ modo: 'faixa', prefixo: '', inicio: '', fim: '', lista: '', data: todayIso(), fornecedor: '' });
  const [contagem, setContagem] = useState('');
  const [conferencia, setConferencia] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listStock({ tipo }));
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível carregar o estoque.'));
    } finally {
      setLoading(false);
    }
  }, [tipo]);
  useEffect(() => { if (canRead) refresh(); }, [canRead, refresh]);

  const visiveis = useMemo(() => {
    const t = texto.trim().toUpperCase();
    return data.codigos.filter((c) => (!situacao || c.situacao === situacao) && (!t || c.valor_normalizado.includes(t)));
  }, [data.codigos, situacao, texto]);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (error) {
      toast.error(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const doReceber = () => run(() => receiveIdentifiers({
    tipo,
    data: receber.data,
    fornecedor: receber.fornecedor || null,
    ...(receber.modo === 'faixa' ? { faixa: { prefixo: receber.prefixo, inicio: receber.inicio, fim: receber.fim } } : { codigos: receber.lista.split(/[\s,;]+/) }),
  }), 'Identificadores recebidos.');

  const doConferir = async () => {
    try {
      setConferencia(await physicalStockCount({ tipo, contados: contagem.split(/[\s,;]+/).filter(Boolean) }));
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  if (!canRead) return <AccessDenied role={auth?.user?.role} permission="animal.read" />;
  const resumo = data.resumo || {};

  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page rb-page">
      <ModeloBase1PageHeader title="Identificadores" description="Estoque de brincos, RFID e códigos SISBOV: recebimento, situação e conferência física." />
      <div className="rb-toolbar" role="toolbar" aria-label="Filtros do estoque">
        <select className="rb-control rb-control--compact" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de identificador">{TIPOS_IDENTIFICADOR.map((t) => <option key={t} value={t}>{TIPO_IDENTIFICADOR_LABELS[t]}</option>)}</select>
        <select className="rb-control rb-control--compact" value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação"><option value="">Todas as situações</option>{Object.entries(SITUACAO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input className="rb-control rb-control--compact" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Código" aria-label="Buscar código" />
        <button type="button" className="rb-btn" onClick={refresh} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> Atualizar</button>
      </div>
      <div className="rb-scroll">
        <div className="rb-summary" aria-label="Saldo">
          {['DISPONIVEL', 'RESERVADO', 'APLICADO', 'PERDIDO', 'DANIFICADO', 'DEVOLVIDO', 'BLOQUEADO'].map((s) => <div key={s} className="rb-summary__item"><strong>{fmtInt(resumo[s] || 0)}</strong><span>{SITUACAO_LABELS[s]}</span></div>)}
          <div className="rb-summary__item"><strong>{fmtInt(resumo.TOTAL || 0)}</strong><span>Total</span></div>
        </div>

        {canReceive ? (
          <section className="rb-card" aria-label="Receber identificadores">
            <h3 className="rb-subtitle">Receber {TIPO_IDENTIFICADOR_LABELS[tipo].toLowerCase()}</h3>
            <div className="rb-inline rb-inline--wrap">
              <select className="rb-control rb-control--compact" value={receber.modo} onChange={(e) => setReceber((r) => ({ ...r, modo: e.target.value }))} aria-label="Forma de recebimento"><option value="faixa">Faixa numérica</option><option value="lista">Lista de códigos</option></select>
              {receber.modo === 'faixa' ? (
                <>
                  <input className="rb-control rb-control--compact" value={receber.prefixo} onChange={(e) => setReceber((r) => ({ ...r, prefixo: e.target.value }))} placeholder="Prefixo (opcional)" aria-label="Prefixo" />
                  <input className="rb-control rb-control--compact" value={receber.inicio} onChange={(e) => setReceber((r) => ({ ...r, inicio: e.target.value }))} placeholder="Início (ex.: 0001)" inputMode="numeric" aria-label="Número inicial" />
                  <input className="rb-control rb-control--compact" value={receber.fim} onChange={(e) => setReceber((r) => ({ ...r, fim: e.target.value }))} placeholder="Fim (ex.: 0500)" inputMode="numeric" aria-label="Número final" />
                </>
              ) : <textarea className="rb-textarea" value={receber.lista} onChange={(e) => setReceber((r) => ({ ...r, lista: e.target.value }))} placeholder="Um código por linha" aria-label="Lista de códigos" />}
              <input className="rb-control rb-control--compact" value={receber.fornecedor} onChange={(e) => setReceber((r) => ({ ...r, fornecedor: e.target.value }))} placeholder="Fornecedor" aria-label="Fornecedor" />
              <MakDateControl value={receber.data} onChange={(e) => setReceber((r) => ({ ...r, data: e.target.value }))} ariaLabel="Data do recebimento" />
              <button type="button" className="rb-btn rb-btn--primary" onClick={doReceber} disabled={busy}><PackagePlus size={14} aria-hidden="true" /> Receber</button>
            </div>
            <p className="rb-note">Código repetido cancela o recebimento inteiro. "SN" não é código de estoque. SISBOV usa 15 dígitos e nunca é reaproveitado depois de aplicado.</p>
          </section>
        ) : null}

        <section className="rb-card" aria-label="Códigos">
          <table className="rb-table">
            <thead><tr><th>Código</th><th>Situação</th><th>Animal</th><th>Última ação</th><th>Data</th>{canMove ? <th>Ações</th> : null}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="rb-empty">Carregando…</td></tr> : null}
              {!loading && !visiveis.length ? <tr><td colSpan={6} className="rb-empty">Nenhum código no filtro.</td></tr> : null}
              {!loading && visiveis.slice(0, 500).map((c) => (
                <tr key={`${c.tipo}:${c.valor_normalizado}`}>
                  <td>{c.valor_normalizado}</td>
                  <td>{SITUACAO_LABELS[c.situacao] || c.situacao}</td>
                  <td>{c.animal_numero || '—'}</td>
                  <td>{ACAO_LABELS[c.ultima_acao] || c.ultima_acao}</td>
                  <td>{fmtDate(c.ultima_data)}</td>
                  {canMove ? (
                    <td>
                      <select className="rb-control rb-control--compact" value="" disabled={busy || !(ACOES_LINHA[c.situacao] || []).length} aria-label={`Ação para ${c.valor_normalizado}`}
                        onChange={(e) => { const acao = e.target.value; if (acao) run(() => stockAction({ tipo: c.tipo, valor: c.valor_normalizado, acao, data: todayIso() }), `${ACAO_LABELS[acao]}: ${c.valor_normalizado}.`); }}>
                        <option value="">—</option>
                        {(ACOES_LINHA[c.situacao] || []).filter((acao) => canReceive || !['DEVOLVIDO', 'BLOQUEADO', 'LIBERADO'].includes(acao)).map((acao) => <option key={acao} value={acao}>{ACAO_LABELS[acao]}</option>)}
                      </select>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {visiveis.length > 500 ? <p className="rb-note">Mostrando 500 de {fmtInt(visiveis.length)}; refine o filtro.</p> : null}
        </section>

        <section className="rb-card" aria-label="Conferência física">
          <h3 className="rb-subtitle">Conferência física ({TIPO_IDENTIFICADOR_LABELS[tipo].toLowerCase()})</h3>
          <textarea className="rb-textarea" value={contagem} onChange={(e) => setContagem(e.target.value)} placeholder="Códigos contados no almoxarifado, um por linha" aria-label="Códigos contados" />
          <div className="rb-inline"><button type="button" className="rb-btn" onClick={doConferir}><ClipboardCheck size={14} aria-hidden="true" /> Conferir</button></div>
          {conferencia ? (
            <div>
              <p className={`rb-note ${conferencia.fecha ? 'rb-note--ok' : 'rb-note--warn'}`}>{conferencia.fecha ? `Confere: ${fmtInt(conferencia.conferem)} disponíveis contados.` : `Não confere: ${fmtInt(conferencia.disponiveis_no_sistema)} disponíveis no sistema, ${fmtInt(conferencia.contados)} contados.`}</p>
              {conferencia.faltando.length ? <p className="rb-note">Faltando (disponível no sistema, não contado): {conferencia.faltando.join(', ')}</p> : null}
              {conferencia.sobrando.length ? <p className="rb-note">Sobrando (contado, não disponível no sistema): {conferencia.sobrando.map((s) => `${s.valor} (${SITUACAO_LABELS[s.situacao_no_sistema] || 'não recebido'})`).join(', ')}</p> : null}
              <p className="rb-note">Nada é ajustado automaticamente: marque perdido, receba ou investigue cada caso.</p>
            </div>
          ) : null}
        </section>
      </div>
    </ModeloBase1PageContainer>
  );
}
