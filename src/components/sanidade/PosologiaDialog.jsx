// Posologia de UM medicamento no contexto do Lançamento: a mesma aba Posologias da tela Sanidade (rascunho,
// aprovação por responsável técnico, suspensão, nova versão, testar dose), filtrada pelo produto escolhido na
// aplicação. Sem registry.write abre só para consulta. Fechar devolve ao lançamento com o animal, o peso e as
// aplicações intactos; salvar/aprovar avisa o painel para recalcular a dose sugerida.
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PosologiasPanel from './PosologiasPanel';
import '@/styles/sanidade.css';

export default function PosologiaDialog({ open, medicamento, medicamentos = [], canWrite = false, onOpenChange, onChanged }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog sanidade-dialog sanidade-dialog--posologia" aria-describedby="posologia-dialog-desc">
        <DialogHeader>
          <DialogTitle>{canWrite ? 'Configurar posologia' : 'Consultar posologia'}{medicamento ? ` — ${medicamento.nome}` : ''}</DialogTitle>
          <DialogDescription id="posologia-dialog-desc">
            A dose sugerida só sai de posologia aprovada, completa e vigente na data, com o peso do animal. O operador confirma a dose aplicada.
            {canWrite ? '' : ' Somente leitura para o seu papel.'}
          </DialogDescription>
        </DialogHeader>
        <div className="d17b-standard-dialog__body sanidade-dialog__posologia">
          {open && medicamento ? (
            <PosologiasPanel medicamentos={medicamentos} canWrite={canWrite} medicamentoId={medicamento.id} onChanged={onChanged} />
          ) : null}
        </div>
        <DialogFooter className="d17b-standard-dialog__footer">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Voltar ao lançamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
