// Aba de cadastro da Sanidade (Programas/Procedimentos ou Medicamentos/Produtos) na Tela
// Mãe do ModeloBase1: barra de ações (Novo, Editar/Consultar, Inativar, Reativar),
// pesquisa expansível, "Mais opções", pílulas por coluna e tabela. Novo/editar abrem
// diálogo. Gravação só com registry.write (`canWrite`); o sanityService valida de novo.
import { useState } from 'react';
import { Columns3, ListFilter, RefreshCw } from 'lucide-react';
import MakFilterPill from '@/components/mak/MakFilterPill';
import MakFilterRail from '@/components/mak/MakFilterRail';
import MgDesktopSearch from '@/components/mak/MgDesktopSearch';
import MgSpeedDialMenu from '@/components/mak/MgSpeedDialMenu';
import MgTablePanelStrip from '@/components/mak/MgTablePanelStrip';
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
            <div className={`mg-action-slot${canWrite ? ' is-visible' : ''}`} style={{ '--slot-width': '64px' }} aria-hidden={!canWrite}>
              <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-green aux-new-button" onClick={onNew} title="Novo" tabIndex={canWrite ? 0 : -1} disabled={!canWrite}>Novo</button>
            </div>
            <div className={`mg-action-slot${selected.length === 1 ? ' is-visible' : ''}`} style={{ '--slot-width': canWrite ? '66px' : '90px' }} aria-hidden={selected.length !== 1}>
              <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => onOpen(selectedRows[0])} title={openLabel} tabIndex={selected.length === 1 ? 0 : -1}>{openLabel}</button>
            </div>
            <div className={`mg-action-slot${canInactivate ? ' is-visible' : ''}`} style={{ '--slot-width': '78px' }} aria-hidden={!canInactivate}>
              <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => runSetActive(false)} title="Inativar" disabled={busy || !canInactivate} tabIndex={canInactivate ? 0 : -1}>Inativar</button>
            </div>
            <div className={`mg-action-slot${canReactivate ? ' is-visible' : ''}`} style={{ '--slot-width': '82px' }} aria-hidden={!canReactivate}>
              <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => runSetActive(true)} title="Reativar" disabled={busy || !canReactivate} tabIndex={canReactivate ? 0 : -1}>Reativar</button>
            </div>
          </div>
          <div className="mg-action-bar__end">
            <div className="mg-action-bar__tools mg-action-bar__tools--visible">
              <MgDesktopSearch
                value={table.searchInput}
                onValueChange={table.setSearchInput}
                hasFilter={Boolean(table.search)}
                onClear={table.clearSearch}
                results={table.searchResults.items}
                resultsTotal={table.searchResults.total}
                titleField="titulo"
                detailFields={columns.slice(1, 5).map((column) => ({ key: column.id, label: column.label }))}
                getFieldValue={(item, key) => item?.[key]}
                onSelectResult={(item) => { table.clearSearch(); onOpen(item._row); }}
                onApplyAll={table.applySearch}
              />
            </div>
            <div className="relative">
              <MgSpeedDialMenu
                open={moreOpen}
                onOpenChange={setMoreOpen}
                triggerId={`sanidade-${kind}-more`}
                menuId={`sanidade-${kind}-more-menu`}
                items={[
                  { id: 'atualizar', label: 'Atualizar', icon: RefreshCw, onClick: onRefresh },
                  { id: 'colunas', label: 'Configurar colunas', icon: Columns3, onClick: () => table.setShowColumnConfig(true) },
                  { id: 'limpar', label: 'Limpar filtros', icon: ListFilter, onClick: table.clearFilters },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mak-mother-page__panel-strip" data-mak-region="panel-strip">
        <MgTablePanelStrip onConfigColumns={() => table.setShowColumnConfig(true)}>
          <MakFilterRail hasActiveFilters={table.hasActiveColumnFilters} onClear={table.clearFilters}>
            {/* Uma pílula por coluna visível, na mesma ordem da tabela (ModeloBase1). */}
            {table.tableColumns.map((column) => (
              <MakFilterPill
                key={column.id}
                label={column.label}
                value={table.columnFilters[column.id] || null}
                filterType="text"
                listOptions={() => table.columnListOptions(column)}
                onChange={(value) => table.setColumnFilter(column.id, value)}
              />
            ))}
          </MakFilterRail>
        </MgTablePanelStrip>
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
