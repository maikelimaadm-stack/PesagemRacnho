import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ensureEmpresaId } from '@/api/db';
import { AccessDenied } from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import AplicacoesPanel from '@/components/sanidade/AplicacoesPanel';
import MedicamentoFormDialog from '@/components/sanidade/MedicamentoFormDialog';
import ProgramaFormDialog from '@/components/sanidade/ProgramaFormDialog';
import SanidadeCatalogPanel from '@/components/sanidade/SanidadeCatalogPanel';
import SanidadeTabs from '@/components/sanidade/SanidadeTabs';
import {
  MEDICAMENTO_COLUMNS,
  PROGRAMA_COLUMNS,
  SANIDADE_TABS,
  SANITY_READ_PERMISSION,
  buildAnimalIndex,
  describeSanityError,
  sanityPermissions,
} from '@/components/sanidade/sanidadeModel';
import { loadOperationalCatalog } from '@/modules/operations/application/operationalInsightsService';
import {
  PROGRAMA_TIPOS,
  PROGRAMA_TIPO_LABELS,
  UNIDADES_DOSE,
  VIAS_APLICACAO,
  VIA_LABELS,
  listMedicamentos,
  listProgramas,
  saveMedicamento,
  saveProgram,
  setMedicamentoActive,
  setProgramActive,
  suggestedDose,
} from '@/modules/sanity/application/sanityService';
import '@/styles/auxiliary-registries.css';
import '@/styles/sanidade.css';

// Menu OPERAÇÃO › Sanidade (stores próprias da v8: programasSanidade, medicamentos,
// aplicacoesSanidade — nunca appSettings). Três abas na Tela Mãe do ModeloBase1:
// programas/procedimentos e medicamentos/produtos (gravação com registry.write) e o
// histórico de aplicações (registrar com weighing.write, cancelar com weighing.edit).
// A rota exige weighing.read no Layout; o sanityService valida cada ação de novo.
const TAB_PREF_KEY = 'sanidade:aba';
const EMPTY_INDEX = buildAnimalIndex([]);

function readTabPref() {
  try {
    const saved = localStorage.getItem(TAB_PREF_KEY);
    return SANIDADE_TABS.some((tab) => tab.id === saved) ? saved : SANIDADE_TABS[0].id;
  } catch {
    return SANIDADE_TABS[0].id;
  }
}

export default function Sanidade() {
  const auth = useAuth();
  const { canRead, canWriteRegistry, canApply, canCancel } = sanityPermissions(auth);
  const empresaId = ensureEmpresaId();
  const [activeTab, setActiveTab] = useState(readTabPref);
  const [programas, setProgramas] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [programaDialog, setProgramaDialog] = useState(null); // { record } — record null = novo
  const [medicamentoDialog, setMedicamentoDialog] = useState(null);
  const [animalIndex, setAnimalIndex] = useState(EMPTY_INDEX);
  const [animalsState, setAnimalsState] = useState('idle'); // idle | loading | ready

  const changeTab = (tabId) => {
    setActiveTab(tabId);
    try { localStorage.setItem(TAB_PREF_KEY, tabId); } catch { /* preferência é opcional */ }
  };

  const refreshCatalogs = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [nextProgramas, nextMedicamentos] = await Promise.all([
        listProgramas({ includeInactive: true, empresaId }),
        listMedicamentos({ includeInactive: true, empresaId }),
      ]);
      setProgramas(nextProgramas || []);
      setMedicamentos(nextMedicamentos || []);
    } catch (error) {
      toast.error(describeSanityError(error, 'Não foi possível carregar os cadastros de sanidade.'));
    } finally {
      setCatalogLoading(false);
    }
  }, [empresaId]);
  useEffect(() => { if (canRead) refreshCatalogs(); }, [canRead, refreshCatalogs]);

  // Animais para o filtro e a coluna Animal: carregados uma vez, ao abrir a aba Aplicações.
  useEffect(() => {
    if (!canRead || activeTab !== 'aplicacoes' || animalsState !== 'idle') return;
    setAnimalsState('loading');
    loadOperationalCatalog()
      .then((catalog) => setAnimalIndex(buildAnimalIndex(catalog?.animais || [])))
      .catch((error) => toast.error(describeSanityError(error, 'Não foi possível carregar os animais.')))
      .finally(() => setAnimalsState('ready'));
  }, [canRead, activeTab, animalsState]);

  const catalogCtx = useMemo(() => ({ tipoLabels: PROGRAMA_TIPO_LABELS, viaLabels: VIA_LABELS }), []);

  const runSave = async (save, input, { closeDialog, created, updated }) => {
    if (!canWriteRegistry || busy) return;
    setBusy(true);
    try {
      await save(input);
      toast.success(input.id ? updated : created);
      closeDialog();
      await refreshCatalogs();
    } catch (error) {
      toast.error(describeSanityError(error, 'Não foi possível salvar o cadastro.'));
    } finally {
      setBusy(false);
    }
  };

  // Inativar/reativar em lote: erro de um registro não interrompe os demais.
  const runSetActive = async (setActive, records, ativo) => {
    if (!canWriteRegistry || busy || !records.length) return false;
    setBusy(true);
    let ok = 0;
    try {
      for (const record of records) {
        try {
          await setActive(record.id, ativo);
          ok += 1;
        } catch (error) {
          toast.error(describeSanityError(error, `Não foi possível ${ativo ? 'reativar' : 'inativar'} “${record.nome}”.`));
        }
      }
      if (ok) toast.success(ok === 1 ? `Cadastro ${ativo ? 'reativado' : 'inativado'}.` : `${ok} cadastros ${ativo ? 'reativados' : 'inativados'}.`);
      await refreshCatalogs();
      return ok > 0;
    } finally {
      setBusy(false);
    }
  };

  if (!canRead) return <AccessDenied role={auth?.user?.role} permission={SANITY_READ_PERMISSION} />;

  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page d17b-list-page d17b-list-page--mother cadastro-emp-scope mg-empresas-scope aux-registry-page aux-registry-page--table sanidade-page">
      <ModeloBase1PageHeader title="Sanidade" description="Programas, medicamentos e histórico de aplicações por animal." visuallyHidden />
      <SanidadeTabs tabs={SANIDADE_TABS} activeTab={activeTab} onChange={changeTab} />

      {activeTab === 'programas' ? (
        <SanidadeCatalogPanel
          key="programas"
          kind="programas"
          columns={PROGRAMA_COLUMNS}
          records={programas}
          ctx={catalogCtx}
          loading={catalogLoading}
          busy={busy}
          canWrite={canWriteRegistry}
          loadingText="Carregando programas..."
          emptyText={canWriteRegistry ? 'Nenhum programa cadastrado. Use “Novo” para cadastrar, por exemplo, Vermifugação.' : 'Nenhum programa cadastrado. Peça a um gestor para cadastrar os programas.'}
          onNew={() => { if (canWriteRegistry) setProgramaDialog({ record: null }); }}
          onOpen={(record) => { if (record) setProgramaDialog({ record }); }}
          onSetActive={(records, ativo) => runSetActive(setProgramActive, records, ativo)}
          onRefresh={refreshCatalogs}
        />
      ) : null}

      {activeTab === 'medicamentos' ? (
        <SanidadeCatalogPanel
          key="medicamentos"
          kind="medicamentos"
          columns={MEDICAMENTO_COLUMNS}
          records={medicamentos}
          ctx={catalogCtx}
          loading={catalogLoading}
          busy={busy}
          canWrite={canWriteRegistry}
          loadingText="Carregando medicamentos..."
          emptyText={canWriteRegistry ? 'Nenhum medicamento cadastrado. Use “Novo” para cadastrar o produto com unidade, dose e via padrão.' : 'Nenhum medicamento cadastrado. Peça a um gestor para cadastrar os produtos.'}
          onNew={() => { if (canWriteRegistry) setMedicamentoDialog({ record: null }); }}
          onOpen={(record) => { if (record) setMedicamentoDialog({ record }); }}
          onSetActive={(records, ativo) => runSetActive(setMedicamentoActive, records, ativo)}
          onRefresh={refreshCatalogs}
        />
      ) : null}

      {activeTab === 'aplicacoes' ? (
        <AplicacoesPanel
          empresaId={empresaId}
          canApply={canApply}
          canCancel={canCancel}
          programas={programas}
          medicamentos={medicamentos}
          animalIndex={animalIndex}
          animalsLoading={animalsState !== 'ready'}
          unidades={UNIDADES_DOSE}
          vias={VIAS_APLICACAO}
          viaLabels={VIA_LABELS}
          suggestDose={suggestedDose}
        />
      ) : null}

      <ProgramaFormDialog
        open={Boolean(programaDialog)}
        record={programaDialog?.record ?? null}
        readOnly={!canWriteRegistry}
        busy={busy}
        tipos={PROGRAMA_TIPOS}
        tipoLabels={PROGRAMA_TIPO_LABELS}
        empresaId={empresaId}
        onOpenChange={(open) => { if (!open) setProgramaDialog(null); }}
        onSubmit={(input) => runSave(saveProgram, input, { closeDialog: () => setProgramaDialog(null), created: 'Programa cadastrado.', updated: 'Programa atualizado.' })}
      />
      <MedicamentoFormDialog
        open={Boolean(medicamentoDialog)}
        record={medicamentoDialog?.record ?? null}
        readOnly={!canWriteRegistry}
        busy={busy}
        unidades={UNIDADES_DOSE}
        vias={VIAS_APLICACAO}
        viaLabels={VIA_LABELS}
        empresaId={empresaId}
        onOpenChange={(open) => { if (!open) setMedicamentoDialog(null); }}
        onSubmit={(input) => runSave(saveMedicamento, input, { closeDialog: () => setMedicamentoDialog(null), created: 'Medicamento cadastrado.', updated: 'Medicamento atualizado.' })}
      />
    </ModeloBase1PageContainer>
  );
}
