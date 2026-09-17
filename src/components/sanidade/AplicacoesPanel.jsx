// Aba "Aplicações" da Sanidade: histórico por animal/período/programa/medicamento, com
// canceladas opcionais. Registrar aplicação avulsa exige weighing.write (`canApply`);
// cancelar exige weighing.edit (`canCancel`) e nunca apaga o fato. Os filtros vão para
// sanityService.listApplications; pesquisa e pílulas refinam só o que já foi carregado.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Columns3, FileSpreadsheet, ListFilter, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import MakDateControl from '@/components/mak/MakDateControl';
import MakTableSelectCheck from '@/components/mak/MakTableSelectCheck';
import MgDesktopSearch from '@/components/mak/MgDesktopSearch';
import MgSpeedDialMenu from '@/components/mak/MgSpeedDialMenu';
import { Columns3Cog } from '@/components/mak/mgIcons';
import { cancelApplication, listApplications, registerApplication } from '@/modules/sanity/application/sanityService';
import { TEMPLATE_KINDS, buildImportTemplateCsv } from '@/modules/import/domain/spreadsheetTemplate';
import { downloadCsvFile } from '@/modules/weighing/export/csvDownload';
import AnimalSearchField from './AnimalSearchField.jsx';
import AplicacaoFormDialog from './AplicacaoFormDialog.jsx';
import CancelarAplicacaoDialog from './CancelarAplicacaoDialog.jsx';
import SanidadeDataTable, { SanidadeColumnConfig } from './SanidadeDataTable.jsx';
import { SanidadeSelect } from './SanidadeFormFields.jsx';
import {
  APLICACAO_COLUMNS,
  applicationAnimal,
  applicationQueryFromFilters,
  catalogOptions,
  describeSanityError,
  emptyAplicacaoFilters,
  hasActiveAplicacaoFilters,
  isApplicationCancelled,
  sortApplicationsNewestFirst,
} from './sanidadeModel.js';
import { useSanidadeTable } from './useSanidadeTable.js';

export default function AplicacoesPanel({
  empresaId,
  canApply,
  canCancel,
  programas,
  medicamentos,
  animalIndex,
  animalsLoading,
  unidades,
  vias,
  viaLabels,
  suggestDose,
}) {
  const [filters, setFilters] = useState(emptyAplicacaoFilters);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState('');
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const requestRef = useRef(0);
  const navigate = useNavigate();

  // Importar aplicações em massa: o assistente de Importação já abre no tipo "Aplicações de
  // sanidade" (motor no módulo de importação). Exige weighing.write, a mesma permissão de
  // registrar uma aplicação — o serviço confere de novo.
  const abrirImportacao = () => navigate(createPageUrl('Importacao?tipo=SANIDADE'));
  const baixarModeloImportacao = () => {
    const { content, fileName } = buildImportTemplateCsv(TEMPLATE_KINDS.SANIDADE);
    downloadCsvFile({ content, fileName });
    toast.success('Modelo de importação de aplicações baixado.');
  };

  const ctx = useMemo(() => ({ viaLabels, animalsById: animalIndex.byId, animalsLoading }), [viaLabels, animalIndex, animalsLoading]);
  const table = useSanidadeTable({ rows, columns: APLICACAO_COLUMNS, ctx, prefsKey: 'sanidade-colunas:aplicacoes' });
  const selectedApplication = table.selectedRows.length === 1 ? table.selectedRows[0] : null;
  const canCancelSelected = canCancel && Boolean(selectedApplication) && !isApplicationCancelled(selectedApplication);
  const filtersActive = hasActiveAplicacaoFilters(filters);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    const { query, error } = applicationQueryFromFilters(filters, empresaId);
    if (error) {
      setQueryError(error);
      setRows([]);
      setLoading(false);
      return;
    }
    setQueryError('');
    setLoading(true);
    try {
      const result = await listApplications(query);
      // Resposta de um filtro antigo não sobrescreve a do filtro atual.
      if (request === requestRef.current) setRows(sortApplicationsNewestFirst(result || []));
    } catch (error_) {
      if (request === requestRef.current) {
        setRows([]);
        toast.error(describeSanityError(error_, 'Não foi possível carregar as aplicações.'));
      }
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [filters, empresaId]);
  useEffect(() => { load(); }, [load]);

  const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }));
  const clearAll = () => { setFilters(emptyAplicacaoFilters()); table.clearFilters(); };

  const register = async (input) => {
    if (!canApply || busy) return;
    setBusy(true);
    try {
      await registerApplication({ ...input, empresa_id: empresaId });
      toast.success('Aplicação registrada.');
      setRegisterOpen(false);
      await load();
    } catch (error) {
      toast.error(describeSanityError(error, 'Não foi possível registrar a aplicação.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async (motivo) => {
    if (!canCancel || !cancelTarget || busy) return;
    setBusy(true);
    try {
      await cancelApplication(cancelTarget.id, { motivo });
      toast.success('Aplicação cancelada. O registro continua no histórico.');
      setCancelTarget(null);
      table.setSelected([]);
      await load();
    } catch (error) {
      toast.error(describeSanityError(error, 'Não foi possível cancelar a aplicação.'));
    } finally {
      setBusy(false);
    }
  };

  const emptyText = queryError
    || (filtersActive
      ? 'Nenhuma aplicação encontrada para os filtros escolhidos.'
      : 'Nenhuma aplicação registrada. Registre uma aplicação avulsa, aplique durante o Lançamento ou importe as aplicações de uma planilha.');

  return (
    <>
      <div className="mak-mother-page__toolbar mg-subtoolbar-stack" data-mak-region="toolbar">
        <div data-template-id="action-bar" className="mg-action-bar canva-section flex w-full shrink-0 items-center" style={{ background: 'var(--bg-card)' }}>
          <div className="mg-action-bar__actions flex min-w-0 items-center">
            <div className={`mg-action-slot${canApply ? ' is-visible' : ''}`} style={{ '--slot-width': '142px' }} aria-hidden={!canApply}>
              <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-green" onClick={() => setRegisterOpen(true)} title="Registrar aplicação avulsa" tabIndex={canApply ? 0 : -1} disabled={!canApply}>Registrar aplicação</button>
            </div>
            <div className={`mg-action-slot${canApply ? ' is-visible' : ''}`} style={{ '--slot-width': '150px' }} aria-hidden={!canApply}>
              <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" data-testid="sanidade-importar-aplicacoes" onClick={abrirImportacao} title="Importar aplicações de uma planilha" tabIndex={canApply ? 0 : -1} disabled={!canApply}>
                <Upload className="w-4 h-4 mr-1" aria-hidden="true" />
                Importar aplicações
              </button>
            </div>
            <div className={`mg-action-slot${canCancelSelected ? ' is-visible' : ''}`} style={{ '--slot-width': '136px' }} aria-hidden={!canCancelSelected}>
              <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost tb-btn-danger" onClick={() => setCancelTarget(selectedApplication)} title="Cancelar a aplicação selecionada" tabIndex={canCancelSelected ? 0 : -1} disabled={busy || !canCancelSelected}>Cancelar aplicação</button>
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
                detailFields={[{ key: 'animal', label: 'Animal' }, { key: 'programa', label: 'Programa' }, { key: 'medicamento', label: 'Medicamento' }, { key: 'situacao', label: 'Situação' }]}
                getFieldValue={(item, key) => item?.[key]}
                onSelectResult={(item) => { table.clearSearch(); table.setSelected([table.getKey(item._row)]); }}
                onApplyAll={table.applySearch}
              />
            </div>
            <div className="relative">
              <MgSpeedDialMenu
                open={moreOpen}
                onOpenChange={setMoreOpen}
                triggerId="sanidade-aplicacoes-more"
                menuId="sanidade-aplicacoes-more-menu"
                items={[
                  { id: 'atualizar', label: 'Atualizar', icon: RefreshCw, onClick: load },
                  { id: 'colunas', label: 'Configurar colunas', icon: Columns3, onClick: () => table.setShowColumnConfig(true) },
                  { id: 'limpar', label: 'Limpar filtros', icon: ListFilter, onClick: clearAll },
                  { id: 'modelo-importacao', label: 'Baixar modelo de importação', icon: FileSpreadsheet, onClick: baixarModeloImportacao },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mak-mother-page__panel-strip" data-mak-region="panel-strip">
        {/* Filtros do histórico (consulta ao serviço): animal, período, programa, medicamento e canceladas. */}
        <div className="sanidade-filter-strip" role="group" aria-label="Filtros das aplicações">
          <div className="sanidade-filter-bar">
            <AnimalSearchField id="sanidade-filtro-animal" compact index={animalIndex} loading={animalsLoading} value={filters.animal} onChange={setFilter('animal')} placeholder="Animal (número ou marca)" />
            <div className={`sanidade-filter-period${filters.from || filters.to ? ' is-active' : ''}`}>
              <span className="sanidade-filter-period__label">Período</span>
              <MakDateControl className="d17c-filter-date sanidade-filter-date" value={filters.from} onChange={(event) => setFilter('from')(event.target.value)} ariaLabel="Data inicial do período" />
              <span className="sanidade-filter-period__sep">a</span>
              <MakDateControl className="d17c-filter-date sanidade-filter-date" value={filters.to} onChange={(event) => setFilter('to')(event.target.value)} ariaLabel="Data final do período" />
            </div>
            <SanidadeSelect id="sanidade-filtro-programa" className={`sanidade-filter-select${filters.programaId ? ' is-active' : ''}`} value={filters.programaId} onChange={setFilter('programaId')} noneLabel="Todos os programas" ariaLabel="Filtrar por programa" options={catalogOptions(programas, filters.programaId)} />
            <SanidadeSelect id="sanidade-filtro-medicamento" className={`sanidade-filter-select${filters.medicamentoId ? ' is-active' : ''}`} value={filters.medicamentoId} onChange={setFilter('medicamentoId')} noneLabel="Todos os medicamentos" ariaLabel="Filtrar por medicamento" options={catalogOptions(medicamentos, filters.medicamentoId)} />
            <label className={`sanidade-filter-check${filters.includeCancelled ? ' is-active' : ''}`}>
              <MakTableSelectCheck checked={filters.includeCancelled} onChange={(checked) => setFilter('includeCancelled')(checked)} ariaLabel="Incluir aplicações canceladas" />
              <span>Incluir canceladas</span>
            </label>
            {filtersActive || table.hasActiveColumnFilters ? (
              <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost mg-filter-pill__trigger mg-filter-pill__trigger--clear" onClick={clearAll}>Limpar filtros</button>
            ) : null}
          </div>
          <button type="button" className="mg-nav-btn ios-btn mg-table-panel-strip__config-btn sanidade-filter-strip__config" onClick={() => table.setShowColumnConfig(true)} title="Configurar colunas da tabela" aria-label="Configurar colunas da tabela">
            <Columns3Cog className="mg-table-panel-strip__config-icon" strokeWidth={2.1} />
          </button>
        </div>
      </div>
      <div className="d17b-list-body" id="sanidade-panel-aplicacoes" role="tabpanel" aria-labelledby="sanidade-tab-aplicacoes">
        <section className="d17b-table-card aux-table-card">
          <SanidadeDataTable
            table={table}
            totalLabel="Carregadas"
            totalCount={rows.length}
            loading={loading}
            loadingText="Carregando aplicações..."
            emptyText={emptyText}
            filteredEmptyText="Nenhuma aplicação atende à pesquisa ou aos filtros de coluna."
            ariaLabel="Histórico de aplicações de sanidade"
            rowClassName={(row) => (isApplicationCancelled(row) ? 'sanidade-row--cancelled' : '')}
          />
        </section>
      </div>
      <SanidadeColumnConfig table={table} />
      <AplicacaoFormDialog
        open={registerOpen && canApply}
        busy={busy}
        animalIndex={animalIndex}
        animalsLoading={animalsLoading}
        initialAnimal={filters.animal}
        programas={programas}
        medicamentos={medicamentos}
        unidades={unidades}
        vias={vias}
        viaLabels={viaLabels}
        suggestDose={suggestDose}
        onOpenChange={setRegisterOpen}
        onSubmit={register}
      />
      <CancelarAplicacaoDialog
        application={canCancel ? cancelTarget : null}
        animal={cancelTarget ? applicationAnimal(cancelTarget, animalIndex.byId) : null}
        busy={busy}
        onOpenChange={(open) => { if (!open) setCancelTarget(null); }}
        onConfirm={confirmCancel}
      />
    </>
  );
}
