import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fmtInt } from '@/components/common/formatNumber';
import { IMPORT_TYPE_LABELS } from './importacaoModel';

// Confirmação explícita antes de gravar: mostra o que será criado, lembra do backup
// (apenas texto e link para Manutenção — a tela não executa backup) e acompanha o
// progresso informado por applyImport (onProgress).
export default function ConfirmarImportacaoDialog({ open, onOpenChange, plan, progresso, gravando, onConfirmar }) {
  const summary = plan?.summary;
  const percentual = progresso && progresso.lotes ? Math.min(100, Math.round((progresso.lote / progresso.lotes) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={(valor) => { if (!gravando) onOpenChange(valor); }}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--medium importacao-confirm-dialog">
        <DialogHeader>
          <DialogTitle>Confirmar importação</DialogTitle>
          <DialogDescription>Depois de gravar, os registros passam a valer no sistema.</DialogDescription>
        </DialogHeader>

        <div className="d17b-standard-dialog__body importacao-confirm-dialog__body">
          <p>
            Tipo: <strong>{IMPORT_TYPE_LABELS[plan?.type] || '—'}</strong>
            {plan?.fileName ? <> · Arquivo: <strong>{plan.fileName}</strong></> : null}
          </p>
          <ul className="importacao-list">
            <li><strong>{fmtInt(summary?.novos)}</strong> linha(s) serão gravadas</li>
            <li><strong>{fmtInt(summary?.animaisNovos)}</strong> animal(is) novo(s) serão criados</li>
            <li><strong>{fmtInt(summary?.cadastros)}</strong> cadastro(s), <strong>{fmtInt(summary?.manejos)}</strong> manejo(s) e <strong>{fmtInt(summary?.saidas)}</strong> saída(s)</li>
            <li><strong>{fmtInt((summary?.jaExistem || 0) + (summary?.duplicidades || 0))}</strong> linha(s) já existentes serão ignoradas</li>
            {plan?.rules?.createMissingMasters && summary?.cadastrosMestresAusentes?.length ? (
              <li><strong>{fmtInt(summary.cadastrosMestresAusentes.length)}</strong> cadastro(s) mestre(s) serão criados antes das pesagens</li>
            ) : null}
          </ul>
          <p className="importacao-alert importacao-alert--aviso">
            Antes de importar um arquivo grande, vale fazer um backup. Abra{' '}
            <Link to={createPageUrl('ManutencaoSistema')} className="importacao-link-button">Backup e Manutenção</Link>{' '}
            em outro momento e faça o backup completo; esta tela não faz backup sozinha.
          </p>

          {gravando ? (
            <div className="importacao-progress" role="status" aria-live="polite">
              <div className="importacao-progress__bar"><div className="importacao-progress__fill" style={{ width: `${percentual}%` }} /></div>
              <p>
                {progresso?.animaisTotal
                  ? `Gravando ${fmtInt(progresso.animaisProcessados)} de ${fmtInt(progresso.animaisTotal)} animais (${percentual}%).`
                  : 'Gravando…'}
              </p>
              <p className="importacao-hint">Não feche esta janela.</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="d17b-standard-dialog__footer">
          <Button type="button" variant="outline" disabled={gravando} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save" disabled={gravando} onClick={onConfirmar} data-testid="importacao-confirmar">
            {gravando ? 'Gravando…' : 'Gravar agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
