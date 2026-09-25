// Cartão "Assim vai sair nos relatórios" (E1B 1.4.0): pré-visualização do cabeçalho da
// propriedade na própria ficha, ao vivo com o formulário. Usa o MESMO renderizador e o
// MESMO CSS da folha do relatório (renderSheetHeaderHtml + SHEET_CSS), então o que aparece
// aqui é o que sai na tela do relatório, na impressão e no PDF.
import { useMemo } from 'react';
import { renderSheetHeaderHtml } from '@/modules/reporting/infrastructure/exporters/sheetHtml';
import { SHEET_CSS } from '@/modules/reporting/infrastructure/exporters/sheetStyles';
import { headerPreviewFromForm } from './registryFormModel.js';

const dataBr = (date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Exemplo de período/emissão à direita do cabeçalho: do dia 1º do mês até hoje.
function exampleMeta() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { periodText: `Período: ${dataBr(inicio)} – ${dataBr(hoje)}`, emittedText: `Emitido em ${dataBr(hoje)}` };
}

export default function PropertyHeaderPreview({ definition, form, recordId = null, full = false }) {
  const meta = useMemo(() => exampleMeta(), []);
  const html = useMemo(
    () => renderSheetHeaderHtml(headerPreviewFromForm(definition, form, { id: recordId }), meta),
    [definition, form, recordId, meta],
  );
  return (
    <div className={`emp-form-card-slot${full ? ' emp-form-card-slot--full' : ' emp-form-card-slot--half'}`}>
      <section className="emp-form-card mg-emp-card p-4 aux-model-card aux-header-preview-card" aria-label="Assim vai sair nos relatórios">
        <h3 className="emp-form-card-title mb-3 text-sm font-semibold">Assim vai sair nos relatórios</h3>
        <style>{SHEET_CSS}</style>
        <div className="rpt-sheet rpt-sheet--preview" dangerouslySetInnerHTML={{ __html: html }} />
        <p className="aux-header-preview__note">Vale para a propriedade marcada como Padrão e para o relatório filtrado por esta propriedade. O período e a emissão são só exemplo.</p>
      </section>
    </div>
  );
}
