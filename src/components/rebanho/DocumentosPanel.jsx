// Documentos de uma operação, animal ou propriedade (F16): lista, cadastro com anexo opcional (diálogo nativo
// do Electron; o arquivo fica na pasta de anexos e entra no backup completo), abrir e cancelar com motivo
// (o arquivo é preservado).
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Paperclip, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MakDateControl from '@/components/mak/MakDateControl';
import {
  TIPOS_DOCUMENTO,
  TIPO_DOCUMENTO_LABELS,
  cancelDocument,
  listDocuments,
  openAttachment,
  pickAttachment,
  saveDocument,
} from '@/modules/documents/application/documentsService';
import { describeError, fmtDate, todayIso } from './rebanhoModel';

const vazio = () => ({ tipo: 'GTA', numero: '', data: todayIso(), emissor: '', referencia: '', anexo: null });

export default function DocumentosPanel({ operacaoId = null, animalId = null, propriedadeId = null, canWrite, canCancel, titulo = 'Documentos' }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [cancelar, setCancelar] = useState({ id: null, motivo: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const filtro = operacaoId ? { operacaoId } : animalId ? { animalId } : { propriedadeId };
    try { setRows(await listDocuments(filtro)); } catch (error) { toast.error(describeError(error)); }
  }, [operacaoId, animalId, propriedadeId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast.success(okMsg); await load(); return true; } catch (error) { toast.error(describeError(error)); return false; } finally { setBusy(false); }
  };

  const anexar = async () => {
    try {
      const anexo = await pickAttachment();
      if (anexo) setForm((f) => ({ ...f, anexo }));
    } catch (error) { toast.error(describeError(error)); }
  };

  const salvar = () => run(async () => {
    await saveDocument({ ...form, operacao_id: operacaoId, animal_id: animalId, propriedade_id: propriedadeId });
    setForm(null);
  }, 'Documento registrado.');

  return (
    <section className="rb-card" aria-label={titulo}>
      <div className="rb-section-head">
        <h3>{titulo}</h3>
        <span className="rb-toolbar__spacer" />
        {canWrite && !form ? <button type="button" className="rb-btn" onClick={() => setForm(vazio())}><Plus size={14} aria-hidden="true" /> Documento</button> : null}
      </div>
      <table className="rb-table">
        <thead><tr><th>Tipo</th><th>Número</th><th>Data</th><th>Emissor</th><th>Anexo</th><th /></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>{TIPO_DOCUMENTO_LABELS[d.tipo] || d.tipo}</td>
              <td>{d.numero || '—'}</td>
              <td>{fmtDate(d.data)}</td>
              <td>{d.emissor || '—'}</td>
              <td>{d.sha256 ? <button type="button" className="rb-btn" onClick={() => openAttachment(d).catch((error) => toast.error(describeError(error)))} title={`SHA-256 ${d.sha256}`}><ExternalLink size={14} aria-hidden="true" /> {d.anexo_nome || `arquivo .${d.anexo_ext}`}</button> : 'Sem arquivo'}</td>
              <td>{canCancel ? (cancelar.id === d.id ? (
                <span className="rb-inline">
                  <input className="rb-control rb-control--compact" value={cancelar.motivo} onChange={(e) => setCancelar({ id: d.id, motivo: e.target.value })} placeholder="Motivo" aria-label="Motivo do cancelamento do documento" />
                  <button type="button" className="rb-btn rb-btn--danger" disabled={busy || cancelar.motivo.trim().length < 3} onClick={async () => { if (await run(() => cancelDocument(d.id, { motivo: cancelar.motivo }), 'Documento cancelado (o arquivo é mantido).')) setCancelar({ id: null, motivo: '' }); }}>Cancelar documento</button>
                </span>
              ) : <button type="button" className="rb-icon-btn" aria-label={`Cancelar documento ${d.numero || d.tipo}`} onClick={() => setCancelar({ id: d.id, motivo: '' })}><Trash2 size={14} /></button>) : null}</td>
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan={6} className="rb-empty">Nenhum documento.</td></tr> : null}
        </tbody>
      </table>
      {form ? (
        <div className="rb-inline rb-inline--wrap">
          <select className="rb-control rb-control--compact" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} aria-label="Tipo do documento">{TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{TIPO_DOCUMENTO_LABELS[t]}</option>)}</select>
          <input className="rb-control rb-control--compact" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} placeholder="Número" aria-label="Número do documento" />
          <MakDateControl value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} ariaLabel="Data do documento" />
          <input className="rb-control rb-control--compact" value={form.emissor} onChange={(e) => setForm((f) => ({ ...f, emissor: e.target.value }))} placeholder="Emissor" aria-label="Emissor do documento" />
          <button type="button" className="rb-btn" onClick={anexar} disabled={busy}><Paperclip size={14} aria-hidden="true" /> {form.anexo ? form.anexo.nome_original : 'Anexar arquivo'}</button>
          <button type="button" className="rb-btn rb-btn--primary" onClick={salvar} disabled={busy}>Salvar documento</button>
          <button type="button" className="rb-btn" onClick={() => setForm(null)}>Cancelar</button>
        </div>
      ) : null}
      <p className="rb-note">Arquivo opcional (PDF, imagem, XML, TXT ou CSV, até 25 MB). Fica no computador, na pasta de anexos, e vai junto do backup completo.</p>
    </section>
  );
}
