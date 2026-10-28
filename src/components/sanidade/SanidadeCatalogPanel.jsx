// Aba de cadastro da Sanidade (Programas/Procedimentos ou Medicamentos/Produtos) na Tela
// Mãe do ModeloBase1: barra de ações (Novo, Editar/Consultar, Inativar, Reativar),
// pesquisa expansível, "Mais opções", configurar colunas e tabela. Novo/editar abrem
// diálogo. Gravação só com registry.write (`canWrite`); o sanityService valida de novo.
import { useState } from 'react';
import { ListFilter, Pencil, Plus, Power, RefreshCw, RotateCcw } from 'lucide-react';
import MgSpeedDialMenu from '@/components/mak/MgSpeedDialMenu';
import { Columns3Cog } from '@/components/mak/mgIcons';
import SanidadeDataTable, { SanidadeColumnConfig } from './SanidadeDataTable.jsx';
import { useSanidadeTable } from './useSanidadeTable.js';

export default function SanidadeCatalogPanel({
  kind,
  columns,
  records,
  ctx,
  loading,
  busy,
  canWrite,
  emptyText,
  loadingText,
  onNew,
  onOpen,
  onSetActive,
  onRefresh,
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const table = useSanidadeTable({ rows: records, columns, ctx, prefsKey: `sanidade-colunas:${kind}` });
  const { selected, selectedRows } = table;
  const selectedAllActive = selectedRows.length > 0 && selectedRows.every((record) => record.ativo !== false);
  const selectedAllInactive = selectedRows.length > 0 && selectedRows.every((record) => record.ativo === false);
  const canInactivate = canWrite && selectedAllActive;
  const canReactivate = canWrite && selectedAllInactive;
  const openLabel = canWrite ? 'Editar' : 'Consultar';
  const runSetActive = async (ativo) => {
    const done = await onSetActive(selectedRows, ativo);
    if (done) table.setSelected([]);
  };

  return (
    <>
      <div className="mak-mother-page__toolbar mg-subtoolbar-stack" data-mak-region="toolbar">
        <div data-template-id="action-bar" className="mg-action-bar canva-section flex w-full shrink-0 items-center" style={{ background: 'var(--bg-card)' }}>
          <div className="mg-action-bar__actions flex min-w-0 items-center">
            <div className={`mg-action-slot${canWrite ? ' is-visible' : ''}`} style={{ '--slot-width': '25px' }} aria-hidden={!canWrite}>
              <button type="button" className="ios-btn tb-btn tb-btn-icon tb-btn-green aux-new-button" onClick={onNew} title="Novo" aria-label="Novo" tabIndex={canWrite ? 0 : -1} disabled={!canWrite}>
                <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" strokeWidth={2.5} />
              </button>
            </div>
            <div className={`mg-action-slot${selected.length === 1 ? ' is-visible' : ''}`} style={{ '--slot-width': '25px' }} aria-hidden={selected.length !== 1}>
              <button type="button" className="ios-btn tb-btn tb-btn-icon tb-btn-ghost" onClick={() => onOpen(selectedRows[0])} title={openLabel} aria-label={openLabel} tabIndex={selected.length === 1 ? 0 : -1}>
                <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
            <div className={`mg-action-slot${canInactivate ? ' is-visible' : ''}`} style={{ '--slot-width': '25px' }} aria-hidden={!canInactivate}>
              <button type="button" className="ios-btn tb-btn tb-btn-icon tb-btn-ghost" onClick={() => runSetActive(false)} title="Inativar" aria-label="Inativar" disabled={busy || !canInactivate} tabIndex={canInactivate ? 0 : -1}>
                <Power className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
            <div className={`mg-action-slot${canReactivate ? ' is-visible' : ''}`} style={{ '--slot-width': '25px' }} aria-hidden={!canReactivate}>
              <button type="button" className="ios-btn tb-btn tb-btn-icon tb-btn-ghost" onClick={() => runSetActive(true)} title="Reativar" aria-label="Reativar" disabled={busy || !canReactivate} tabIndex={canReactivate ? 0 : -1}>
                <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="mg-action-bar__end">
            <button
              type="button"
              className="mg-nav-btn ios-btn tb-btn tb-btn-icon mg-table-panel-strip__config-btn"
              onClick={() => table.setShowColumnConfig(true)}
              title="Configurar colunas da tabela"
              aria-label="Configurar colunas da tabela"
            >
              <Columns3Cog className="mg-table-panel-strip__config-icon" strokeWidth={2.1} aria-hidden="true" />
            </button>
            <div className="relative">
              <MgSpeedDialMenu
                open={moreOpen}
                onOpenChange={setMoreOpen}
                triggerId={`sanidade-${kind}-more`}
                menuId={`sanidade-${kind}-more-menu`}
                items={[
                  { id: 'atualizar', label: 'Atualizar', icon: RefreshCw, onClick: onRefresh },
                  { id: 'limpar', label: 'Limpar filtros', icon: ListFilter, onClick: table.clearFilters },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="d17b-list-body" id={`sanidade-panel-${kind}`} role="tabpanel" aria-labelledby={`sanidade-tab-${kind}`}>
        <section className="d17b-table-card aux-table-card">
          <SanidadeDataTable
            table={table}
            totalCount={records.length}
            loading={loading}
            loadingText={loadingText}
            emptyText={emptyText}
            filteredEmptyText="Nenhum cadastro atende à pesquisa ou aos filtros."
            ariaLabel={`Tabela de ${kind === 'programas' ? 'programas e procedimentos' : 'medicamentos e produtos'}`}
            onOpenRow={onOpen}
            rowClassName={(record) => (record.ativo === false ? 'sanidade-row--inactive' : '')}
          />
        </section>
      </div>
      <SanidadeColumnConfig table={table} />
    </>
  );
}
