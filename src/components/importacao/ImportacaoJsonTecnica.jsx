// Importação técnica de pesagens a partir de um JSON exportado pelo próprio sistema (antes em Backup e Manutenção —
// F24: a importação fica na tela de Importação). Analisa sem gravar (dry-run), mostra válidos/duplicados/conflitos e
// só importa com confirmação; antes de gravar, o sistema cria e verifica um backup automático.
import { useState } from 'react';
import { toast } from 'sonner';
import * as maintenanceService from '@/modules/maintenance/application/maintenanceService';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

export default function ImportacaoJsonTecnica() {
  const [estado, setEstado] = useState({ dry: null, payload: null, nome: '' });
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);

  const analisar = async () => {
    setBusy(true);
    try {
      const sel = await maintenanceService.selectImportJsonFile();
      if (sel?.canceled) return;
      const dry = await maintenanceService.dryRunImportWeighingJson(sel.payload);
      setEstado({ dry, payload: sel.payload, nome: sel.fileName || 'arquivo.json' });
      setConfirmar(false);
    } catch (err) {
      toast.error('Não foi possível analisar o arquivo.', { description: err.message });
    } finally { setBusy(false); }
  };

  const importar = async () => {
    setBusy(true);
    try {
      const r = await maintenanceService.applyImportWeighingJson(estado.payload, { skipDuplicates: true });
      toast.success('Importação concluída.', { description: r?.safetyBackup?.path || undefined });
      setEstado({ dry: null, payload: null, nome: '' });
      setConfirmar(false);
    } catch (err) {
      toast.error('Não foi possível importar os dados.', { description: err.message });
    } finally { setBusy(false); }
  };

  const d = estado.dry;
  return (
    <section className="importacao-json-tecnica" aria-label="Importação técnica de JSON de pesagens">
      <h3 className="text-xs font-semibold uppercase tracking-wide">Importar JSON de pesagens (técnico)</h3>
      <p className="text-xs text-slate-500">Para arquivos "Exportar JSON técnico" gerados por este sistema. Não é restauração de backup (essa fica em Sistema › Backup e Restauração).</p>
      <button type="button" className="emp-toolbar-btn px-4" onClick={analisar} disabled={busy}>Selecionar JSON e analisar</button>
      {d ? (
        <div className="text-sm space-y-1">
          <p>Arquivo: {estado.nome} · Registros: {fmt(d.totalRecords ?? d.total)} · Válidos: {fmt(d.validRecords ?? d.valid)} · Inválidos: {fmt(d.invalidRecords ?? d.invalid)} · Duplicados: {fmt(d.duplicates)} · Conflitos: {fmt(d.conflicts ?? 0)}</p>
          <label className="text-xs"><input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} /> Antes da importação, o sistema criará e verificará um backup automático. Quero importar.</label>
          <button type="button" className="emp-toolbar-btn emp-toolbar-btn-save px-4" onClick={importar} disabled={busy || !confirmar}>Importar dados</button>
        </div>
      ) : null}
    </section>
  );
}
