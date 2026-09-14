import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Columns3, FileText, Filter, LayoutDashboard, ListFilter, MoreVertical, RefreshCw, Search, TableProperties, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ensureEmpresaId } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MakFilterPill from '@/components/mak/MakFilterPill';
import MakFilterRail from '@/components/mak/MakFilterRail';
import MakTableSelectCheck from '@/components/mak/MakTableSelectCheck';
import MakTh from '@/components/mak/MakTh';
import MakColumnConfigDialog from '@/components/mak/MakColumnConfigDialog';
import MgFilterPanel from '@/components/mak/MgFilterPanel';
import MgDesktopSearch from '@/components/mak/MgDesktopSearch';
import MgSpeedDialMenu from '@/components/mak/MgSpeedDialMenu';
import MgTablePanelStrip from '@/components/mak/MgTablePanelStrip';
import { normalizeSearchQuery } from '@/components/mak/mgSearchHighlight';
import { isMakColumnFilterActive, matchesMakColumnFilter } from '@/components/mak/MakColumnMenu';
import { ModeloBase1ActionBar, ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import { loadRegistryGroup, saveRegistryGroup } from '@/modules/auxiliary/application/registryService';
import '@/styles/auxiliary-registries.css';

const emptyFor = (tab) => Object.fromEntries(tab.fields.map((field) => [field.id, field.defaultValue ?? (field.type === 'boolean' ? true : '')]));

const FIELD_WIDTH_PRESETS = {
  CAMPO_PRINCIPAL: { min: 260, grow: 3 },
  CODIGO: { min: 120, grow: 0.5 },
  SIM_NAO: { min: 120, grow: 0.5 },
  TEXTO_CURTO: { min: 140, grow: 1 },
  NUMERO: { min: 120, grow: 1 },
};

function resolveFieldWidthType(definition) {
  if (definition.widthType && FIELD_WIDTH_PRESETS[definition.widthType]) return definition.widthType;
  if (definition.type === 'boolean') return 'SIM_NAO';
  if (definition.type === 'number') return 'NUMERO';
  if (definition.type === 'code') return 'CODIGO';
  if (definition.compact || ['telefone', 'unidade'].includes(definition.id)) return 'TEXTO_CURTO';
  return 'CAMPO_PRINCIPAL';
}

function Field({ definition, value, onChange }) {
  const hasValue = String(value ?? '').trim() !== '';
  const widthType = resolveFieldWidthType(definition);
  const fieldClass = `fg mg-prototype-field aux-model-field${definition.wide ? ' is-wide' : ''}${hasValue ? ' mg-has-value' : ''}`;
  if (definition.type === 'select' || definition.type === 'boolean') {
    const options = definition.type === 'boolean'
      ? [{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Inativo' }]
      : definition.options;
    return (
      <div className={`mg-prototype-composite mg-prototype-field aux-model-field aux-model-field--select${definition.wide ? ' is-wide' : ''}${hasValue ? ' mg-has-value' : ''}`} data-field={definition.id} data-width-type={widthType}>
        <div className={`cmd-select aux-model-cmd-select${hasValue ? ' mg-has-value' : ''}`}>
          <span id={`aux-label-${definition.id}`} className={`cmd-label${definition.required ? ' req' : ''}`}>{definition.label}</span>
          <Select
            value={String(value ?? '') || undefined}
            onValueChange={(nextValue) => onChange(definition.type === 'boolean' ? nextValue === 'true' : nextValue)}
          >
            <SelectTrigger id={`aux-${definition.id}`} className="cmd-display aux-model-cmd-display" aria-labelledby={`aux-label-${definition.id}`}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent position="popper" className="aux-model-cmd-panel">
              {options.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <ChevronDown className="cmd-chevron" aria-hidden="true" />
        </div>
      </div>
    );
  }
  if (definition.type === 'textarea' || ['observacoes', 'orientacao', 'descricao'].includes(definition.id)) {
    return (
      <div className={`${fieldClass} aux-model-field--textarea`} data-field={definition.id} data-width-type={widthType}>
        <label className={`fg-label${definition.required ? ' required' : ''}`} htmlFor={`aux-${definition.id}`}>{definition.label}</label>
        <textarea id={`aux-${definition.id}`} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder=" " rows={4} />
      </div>
    );
  }
  return (
    <div className={fieldClass} data-field={definition.id} data-width-type={widthType}>
      <label className={`fg-label${definition.required ? ' required' : ''}`} htmlFor={`aux-${definition.id}`}>{definition.label}</label>
      <input
        id={`aux-${definition.id}`}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        type={definition.type === 'number' ? 'number' : 'text'}
        inputMode={definition.type === 'number' ? 'decimal' : undefined}
        maxLength={definition.maxLength}
        placeholder=" "
      />
    </div>
  );
}

const OBSERVATION_FIELD_IDS = new Set(['observacoes', 'orientacao', 'descricao']);
const CONTACT_FIELD_IDS = new Set(['telefone', 'email']);
const ADDITIONAL_FIELD_IDS = new Set(['cidade', 'propriedade', 'sif', 'principioAtivo', 'fabricante', 'unidade', 'dosePadrao', 'carenciaDias', 'viaAplicacao']);

function FormCard({ title, fields, form, setField, full = false }) {
  if (!fields.length) return null;
  const rowDensityClass = fields.length === 1 ? 'emp-form-card-row-grid--single' : 'emp-form-card-row-grid--pair';
  return (
    <div className={`emp-form-card-slot${full ? ' emp-form-card-slot--full' : ' emp-form-card-slot--half'}`}>
      <section className="emp-form-card mg-emp-card p-4 aux-model-card">
        <h3 className="emp-form-card-title mb-3 text-sm font-semibold">{title}</h3>
        <div className="emp-form-card-body grid grid-cols-1 gap-3">
          <div className="emp-form-card-rows">
            <div className="emp-form-card-row">
              <div className={`emp-form-card-row-grid emp-form-card-row-grid--flex ${rowDensityClass} aux-model-card-grid`}>
                {fields.map((field) => <Field key={field.id} definition={field} value={form[field.id]} onChange={(value) => setField(field.id, value)} />)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ModeloBase1PanelTabs({ activePanel, hasObservations, onChange }) {
  const controlRef = useRef(null);
  const sliderRef = useRef(null);
  const panels = hasObservations
    ? [{ id: 'principais', label: 'Principais' }, { id: 'observacoes', label: 'Observações' }]
    : [{ id: 'principais', label: 'Principais' }];

  useLayoutEffect(() => {
    const control = controlRef.current;
    const slider = sliderRef.current;
    const active = control?.querySelector('.seg-tab.active');
    if (!control || !slider || !active) return;
    slider.style.width = `${active.offsetWidth}px`;
    slider.style.transform = `translateX(${active.offsetLeft}px)`;
  }, [activePanel, hasObservations]);

  return (
    <div className="mg-panel-tabs-rail">
      <div className="mg-panel-tabs-rail__viewport">
        <div className="seg-control" role="tablist" aria-label="Seções do cadastro" ref={controlRef}>
          <div className="seg-tab-slider" ref={sliderRef} aria-hidden="true" />
          {panels.map((panel) => (
            <button key={panel.id} type="button" role="tab" aria-selected={activePanel === panel.id} className={`seg-tab${activePanel === panel.id ? ' active' : ''}`} onClick={() => onChange(panel.id)}>
              {panel.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const VIEW_MODES = [
  { id: 'registro', icon: FileText, title: 'Registro' },
  { id: 'tabela', icon: TableProperties, title: 'Tabela' },
  { id: 'cards', icon: LayoutDashboard, title: 'Cards' },
];

function ModeloBase1ViewSeg({ mode, canOpenRecord, onTable, onRecord, onCards }) {
  const controlRef = useRef(null);
  const sliderRef = useRef(null);

  useLayoutEffect(() => {
    const control = controlRef.current;
    const slider = sliderRef.current;
    const active = control?.querySelector('.view-mode-btn.active');
    if (!control || !slider || !active) return;
    slider.style.width = `${active.offsetWidth}px`;
    slider.style.transform = `translateX(${active.offsetLeft}px)`;
  }, [mode]);

  const actions = { registro: onRecord, tabela: onTable, cards: onCards };
  return (
    <div className="view-seg aux-view-seg" role="group" aria-label="Modo de visualização" ref={controlRef}>
      <div className="view-seg-slider aux-view-seg__slider" aria-hidden="true" ref={sliderRef} />
      {VIEW_MODES.map((view) => {
        const Icon = view.icon;
        const active = mode === view.id;
        return (
          <button
            key={view.id}
            type="button"
            className={`view-mode-btn${active ? ' active' : ''}`}
            data-view={view.id}
            title={view.title}
            aria-label={`Visualizar ${view.title.toLocaleLowerCase('pt-BR')}`}
            aria-pressed={active}
            disabled={view.id === 'registro' && !canOpenRecord && !active}
            onClick={actions[view.id]}
          >
            <Icon className="view-mode-btn__icon" strokeWidth={1.75} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

const CARD_AVATAR_COLORS = ['#2899f5', '#40b85e', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5a4'];

function getRecordInitials(record) {
  const source = String(record.nome || record._typeLabel || '').trim();
  if (!source) return '—';
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('pt-BR');
}

export default function CadastroAuxiliarPage({ title, description, group, tabs }) {
  const empresaId = ensureEmpresaId();
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [catalog, setCatalog] = useState({});
  const [search, setSearch] = useState('');
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [typeFilter, setTypeFilter] = useState(null);
  const [filterOpenRequest, setFilterOpenRequest] = useState(0);
  const [columnFilters, setColumnFilters] = useState({});
  const [columnMenuOpen, setColumnMenuOpen] = useState(null);
  const [selected, setSelected] = useState([]);
  const [listViewMode, setListViewMode] = useState('tabela');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formPanel, setFormPanel] = useState('principais');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => emptyFor(tabs[0]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState([]);
  // Tela Mãe do ModeloBase1: painel lateral de filtros, pesquisa expansível,
  // "Mais opções" e configuração de colunas (preferência local por grupo).
  const [showFilters, setShowFilters] = useState(false);
  const [filterDraft, setFilterDraft] = useState({});
  const [panelFilters, setPanelFilters] = useState({});
  const [searchInput, setSearchInput] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const columnPrefsKey = `aux-colunas:${group}`;
  const readColumnPref = (suffix) => { try { return JSON.parse(localStorage.getItem(`${columnPrefsKey}:${suffix}`)) || null; } catch { return null; } };
  const [columnOrder, setColumnOrder] = useState(() => readColumnPref('ordem'));
  const [visibleColumnIds, setVisibleColumnIds] = useState(() => readColumnPref('visiveis'));
  const tab = tabs.find((item) => item.id === activeTabId) || tabs[0];
  const tabRecords = catalog[tab.bucket] || [];
  const records = useMemo(() => tabs.flatMap((item) => (catalog[item.bucket] || []).map((record) => ({
    ...record,
    _bucket: item.bucket,
    _tabId: item.id,
    _typeLabel: item.label,
    _key: `${item.bucket}:${record.id}`,
  }))), [catalog, tabs]);
  const listColumns = useMemo(() => {
    const available = new Map();
    tabs.forEach((item) => item.columns.forEach((column) => {
      if (!available.has(column.id)) available.set(column.id, column);
    }));
    const nameColumn = available.get('nome');
    const statusColumn = available.get('ativo');
    const middleColumns = [...available.values()].filter((column) => !['nome', 'ativo'].includes(column.id)).slice(0, 3);
    return [nameColumn, ...middleColumns, statusColumn].filter(Boolean);
  }, [tabs]);
  const TYPE_COLUMN = useMemo(() => ({ id: '_typeLabel', label: 'Tipo de cadastro', default: true }), []);
  const configurableColumns = useMemo(() => [
    { id: 'selecao', label: 'Seleção', default: true, fixo: true },
    TYPE_COLUMN,
    ...listColumns.map((column) => ({ id: column.id, label: column.label, default: true })),
  ], [TYPE_COLUMN, listColumns]);
  const tableColumns = useMemo(() => {
    const byId = new Map(configurableColumns.map((column) => [column.id, column]));
    const order = (columnOrder || []).filter((id) => byId.has(id));
    const ordered = [...order, ...configurableColumns.map((column) => column.id).filter((id) => !order.includes(id))];
    const visible = visibleColumnIds ? new Set(visibleColumnIds) : null;
    return ordered
      .filter((id) => id !== 'selecao' && (!visible || visible.has(id)))
      .map((id) => (id === '_typeLabel' ? TYPE_COLUMN : listColumns.find((column) => column.id === id)))
      .filter(Boolean);
  }, [configurableColumns, columnOrder, visibleColumnIds, listColumns, TYPE_COLUMN]);
  const applyColumnConfig = ({ order, visible }) => {
    setColumnOrder(order);
    setVisibleColumnIds(visible);
    localStorage.setItem(`${columnPrefsKey}:ordem`, JSON.stringify(order));
    localStorage.setItem(`${columnPrefsKey}:visiveis`, JSON.stringify(visible));
  };
  const panelTextFields = useMemo(() => listColumns.filter((column) => column.id !== 'ativo').map((column) => ({ key: column.id, label: column.label })), [listColumns]);
  const panelSelectFields = useMemo(() => [
    ...(tabs.length > 1 ? [{ key: '_typeLabel', label: 'Tipo de cadastro', options: [{ value: 'Todos', label: 'Todos' }, ...tabs.map((item) => ({ value: item.label, label: item.label }))] }] : []),
    ...(listColumns.some((column) => column.id === 'ativo') ? [{ key: 'ativo', label: 'Situação', options: [{ value: 'Todos', label: 'Todos' }, { value: 'Ativo', label: 'Ativo' }, { value: 'Inativo', label: 'Inativo' }] }] : []),
  ], [tabs, listColumns]);
  const panelFiltersActive = Object.values(panelFilters).some((value) => Array.isArray(value) && value.length > 0);
  const applyPanelFilters = () => { setPanelFilters({ ...filterDraft }); setCurrentPage(1); };
  const clearPanelFilters = () => { setFilterDraft({}); setPanelFilters({}); setCurrentPage(1); };

  const refresh = async () => {
    setLoading(true);
    try { setCatalog(await loadRegistryGroup(group, empresaId)); }
    catch (error) { toast.error(error.message || 'Não foi possível carregar os cadastros.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [group, empresaId]);

  const cellText = (column, record) => {
    const value = record[column.id];
    if (column.render) return String(column.render(value, record) ?? '');
    if (value === true) return 'Ativo';
    if (value === false) return 'Inativo';
    return String(value ?? '');
  };
  const matchesSearch = (record, term) => {
    const normalized = normalizeSearchQuery(term);
    if (!normalized) return true;
    return Object.entries(record).some(([key, value]) => (!key.startsWith('_') || key === '_typeLabel') && normalizeSearchQuery(String(value ?? '')).includes(normalized));
  };
  const filtered = useMemo(() => records.filter((record) => {
    if (isMakColumnFilterActive(typeFilter) && !matchesMakColumnFilter(record._typeLabel, typeFilter, 'text')) return false;
    if (listColumns.some((column) => isMakColumnFilterActive(columnFilters[column.id]) && !matchesMakColumnFilter(cellText(column, record), columnFilters[column.id], 'text'))) return false;
    for (const [key, values] of Object.entries(panelFilters)) {
      if (!Array.isArray(values) || !values.length) continue;
      const wanted = values[0];
      if (key === '_typeLabel') { if (record._typeLabel !== wanted) return false; continue; }
      if (key === 'ativo') { if ((record.ativo === false ? 'Inativo' : 'Ativo') !== wanted) return false; continue; }
      const column = listColumns.find((item) => item.id === key);
      const text = column ? cellText(column, record) : String(record[key] ?? '');
      if (!normalizeSearchQuery(text).includes(normalizeSearchQuery(wanted))) return false;
    }
    return matchesSearch(record, search);
  }), [records, search, typeFilter, listColumns, columnFilters, panelFilters]);
  const searchResults = useMemo(() => {
    const term = searchInput.trim();
    if (!term) return { items: [], total: 0 };
    const matches = records.filter((record) => matchesSearch(record, term));
    const items = matches.slice(0, 30).map((record) => ({
      id: record._key,
      _record: record,
      codigo: record._typeLabel,
      titulo: record.nome || 'Sem nome',
      ...Object.fromEntries(listColumns.filter((column) => column.id !== 'nome').map((column) => [column.id, cellText(column, record) || '—'])),
    }));
    return { items, total: matches.length };
  }, [records, searchInput, listColumns]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pageKeys = paginated.map((item) => item._key);
  const allPageSelected = pageKeys.length > 0 && pageKeys.every((key) => selected.includes(key));
  const somePageSelected = pageKeys.some((key) => selected.includes(key));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil(filtered.length / itemsPerPage))));
  }, [filtered.length, itemsPerPage]);

  const openNew = (tabId = tabs[0].id) => {
    const next = tabs.find((item) => item.id === tabId) || tabs[0];
    setActiveTabId(next.id);
    setEditingId(null);
    setForm(emptyFor(next));
    setFormPanel('principais');
    setFormOpen(true);
  };
  const changeNewRecordType = (tabId) => {
    const next = tabs.find((item) => item.id === tabId) || tabs[0];
    setActiveTabId(next.id);
    setEditingId(null);
    setForm(emptyFor(next));
    setFormPanel('principais');
  };
  const openEdit = (record) => {
    const next = tabs.find((item) => item.id === record._tabId) || tabs[0];
    setActiveTabId(next.id);
    setEditingId(record.id);
    setForm({ ...emptyFor(next), ...record });
    setFormPanel('principais');
    setFormOpen(true);
  };
  const setField = (id, value) => setForm((current) => ({ ...current, [id]: value }));

  const save = async (event) => {
    event?.preventDefault?.();
    const missing = tab.fields.find((field) => field.required && !String(form[field.id] ?? '').trim());
    if (missing) return toast.error(`Informe ${missing.label.toLocaleLowerCase('pt-BR')}.`);
    setSaving(true);
    try {
      const record = { ...form, id: editingId || globalThis.crypto.randomUUID(), nome: String(form.nome || '').trim(), updatedAt: new Date().toISOString() };
      if (!editingId) record.createdAt = record.updatedAt;
      const nextRecords = editingId ? tabRecords.map((item) => item.id === editingId ? { ...item, ...record } : item) : [...tabRecords, record];
      const next = await saveRegistryGroup(group, { ...catalog, [tab.bucket]: nextRecords }, empresaId);
      setCatalog(next);
      setFormOpen(false);
      setEditingId(null);
      toast.success(editingId ? 'Cadastro atualizado.' : 'Cadastro adicionado.');
    } catch (error) { toast.error(error.message || 'Não foi possível salvar o cadastro.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    const keys = new Set(deleteRequest.map((item) => item._key || `${item._bucket}:${item.id}`));
    try {
      const changedCatalog = { ...catalog };
      tabs.forEach((item) => {
        changedCatalog[item.bucket] = (catalog[item.bucket] || []).filter((record) => !keys.has(`${item.bucket}:${record.id}`));
      });
      const next = await saveRegistryGroup(group, changedCatalog, empresaId);
      setCatalog(next);
      setSelected([]);
      setDeleteRequest([]);
      toast.success(keys.size === 1 ? 'Cadastro excluído.' : `${keys.size} cadastros excluídos.`);
    } catch (error) { toast.error(error.message || 'Não foi possível excluir o cadastro.'); }
  };

  const selectedRecords = records.filter((record) => selected.includes(record._key));
  const observationFields = tab.fields.filter((field) => OBSERVATION_FIELD_IDS.has(field.id));
  const contactFields = tab.fields.filter((field) => CONTACT_FIELD_IDS.has(field.id));
  const additionalFields = tab.fields.filter((field) => ADDITIONAL_FIELD_IDS.has(field.id));
  const classifiedIds = new Set([...observationFields, ...contactFields, ...additionalFields].map((field) => field.id));
  const primaryFields = tab.fields.filter((field) => !classifiedIds.has(field.id));
  const typeField = {
    id: '__type',
    label: 'Tipo de cadastro',
    type: 'select',
    widthType: 'CAMPO_PRINCIPAL',
    required: true,
    options: tabs.map((item) => ({ value: item.id, label: item.singular.charAt(0).toLocaleUpperCase('pt-BR') + item.singular.slice(1) })),
  };
  const formPrimaryFields = !editingId && tabs.length > 1 ? [typeField, ...primaryFields] : primaryFields;
  const formValues = { ...form, __type: activeTabId };
  const requiredFormFields = formPrimaryFields.filter((field) => field.required);
  const filledRequiredFields = requiredFormFields.filter((field) => String(formValues[field.id] ?? '').trim()).length;
  const updateFormField = (id, value) => id === '__type' ? changeNewRecordType(value) : setField(id, value);
  const newRecordLabel = tab.newLabel || `Novo ${tab.singular}`;
  const editRecordLabel = tab.editLabel || `Editar ${tab.singular}`;
  const editingIndex = editingId ? tabRecords.findIndex((record) => record.id === editingId) : -1;
  const openRelativeRecord = (index) => {
    const record = tabRecords[index];
    if (record) openEdit({ ...record, _tabId: tab.id });
  };
  const formatCell = (column, record) => {
    const value = record[column.id];
    if (column.render) return column.render(value, record);
    if (value === true) return 'Ativo';
    if (value === false) return 'Inativo';
    return value || '—';
  };
  return (
    <ModeloBase1PageContainer variant="table" className={`d17b-page d17b-list-page cadastro-emp-scope mg-empresas-scope aux-registry-page${formOpen ? '' : ' d17b-list-page--mother'} ${formOpen ? 'aux-registry-page--record' : 'aux-registry-page--table'}`}>
      <ModeloBase1PageHeader title={title} description={description} visuallyHidden />
      {!formOpen ? (
        <>
          {/* Barra de ações da Tela Mãe (ModeloBase1): Filtrar, Novo, seleção; pesquisa, modos e "Mais opções". */}
          <div className="mak-mother-page__toolbar mg-subtoolbar-stack" data-mak-region="toolbar">
            <div data-template-id="action-bar" className="mg-action-bar canva-section flex w-full shrink-0 items-center" style={{ background: 'var(--bg-card)' }}>
              <div className="mg-action-bar__actions flex min-w-0 items-center">
                <div className="mg-action-slot is-visible" style={{ '--slot-width': '28px' }}>
                  <div className="mg-action-bar__filter-slot">
                    <button
                      type="button"
                      className={`ios-btn tb-btn tb-btn-ghost tb-btn-filter tb-btn-icon${panelFiltersActive ? ' tb-btn-filter-active' : ''}`}
                      onClick={() => setShowFilters((visible) => !visible)}
                      title="Filtrar"
                      aria-label="Filtrar"
                      aria-pressed={showFilters}
                      aria-controls="filter-panel"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      {panelFiltersActive ? <span className="tb-filter-active-dot" aria-hidden="true" /> : null}
                    </button>
                  </div>
                </div>
                <div className="mg-action-slot is-visible" style={{ '--slot-width': '64px' }}>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-green aux-new-button" onClick={() => openNew()} title="Novo">Novo</button>
                </div>
                <div className={`mg-action-slot${selected.length === 1 ? ' is-visible' : ''}`} style={{ '--slot-width': '66px' }} aria-hidden={selected.length !== 1}>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => openEdit(selectedRecords[0])} title="Editar" tabIndex={selected.length === 1 ? 0 : -1}>Editar</button>
                </div>
                <div className={`mg-action-slot${selected.length ? ' is-visible' : ''}`} style={{ '--slot-width': '84px' }} aria-hidden={selected.length === 0}>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost tb-btn-danger" onClick={() => setDeleteRequest(selectedRecords)} title="Excluir" tabIndex={selected.length ? 0 : -1}>
                    <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Excluir
                  </button>
                </div>
              </div>
              <div className="mg-action-bar__end">
                <div className="mg-action-bar__tools mg-action-bar__tools--visible">
                  <MgDesktopSearch
                    value={searchInput}
                    onValueChange={setSearchInput}
                    hasFilter={Boolean(search)}
                    onClear={() => { setSearchInput(''); setSearch(''); setCurrentPage(1); }}
                    results={searchResults.items}
                    resultsTotal={searchResults.total}
                    titleField="titulo"
                    codeField="codigo"
                    detailFields={listColumns.filter((column) => column.id !== 'nome').slice(0, 4).map((column) => ({ key: column.id, label: column.label }))}
                    getFieldValue={(record, key) => record?.[key]}
                    onSelectResult={(item) => { setSearchInput(''); setSearch(''); openEdit(item._record); }}
                    onApplyAll={() => { setSearch(searchInput.trim()); setCurrentPage(1); }}
                  />
                </div>
                <ModeloBase1ViewSeg
                  mode={listViewMode}
                  canOpenRecord={selected.length === 1}
                  onTable={() => setListViewMode('tabela')}
                  onRecord={() => selected.length === 1 && openEdit(selectedRecords[0])}
                  onCards={() => setListViewMode('cards')}
                />
                <div className="relative">
                  <MgSpeedDialMenu
                    open={moreOpen}
                    onOpenChange={setMoreOpen}
                    items={[
                      { id: 'atualizar', label: 'Atualizar', icon: RefreshCw, onClick: refresh },
                      { id: 'colunas', label: 'Configurar colunas', icon: Columns3, onClick: () => setShowColumnConfig(true) },
                      { id: 'tipos', label: 'Mostrar todos os tipos', icon: ListFilter, onClick: () => { setTypeFilter(null); clearPanelFilters(); } },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mak-mother-page__panel-strip" data-mak-region="panel-strip">
            <MgTablePanelStrip onConfigColumns={() => setShowColumnConfig(true)}>
              <MakFilterRail
                hasActiveFilters={isMakColumnFilterActive(typeFilter) || Object.values(columnFilters).some(isMakColumnFilterActive) || panelFiltersActive}
                onClear={() => { setTypeFilter(null); setColumnFilters({}); clearPanelFilters(); }}
                onConfigureFilters={() => setFilterOpenRequest((request) => request + 1)}
              >
                {tabs.length > 1 ? (
                  <MakFilterPill
                    label="Tipo de cadastro"
                    value={typeFilter}
                    filterType="text"
                    listOptions={tabs.map((item) => item.label)}
                    openRequest={filterOpenRequest}
                    onChange={(value) => { setTypeFilter(value); setCurrentPage(1); }}
                  />
                ) : null}
                {listColumns.map((column) => (
                  <MakFilterPill
                    key={column.id}
                    label={column.label}
                    value={columnFilters[column.id] || null}
                    filterType="text"
                    listOptions={[...new Set(records.map((record) => cellText(column, record)).filter(Boolean))]}
                    onChange={(value) => { setColumnFilters((current) => ({ ...current, [column.id]: value })); setCurrentPage(1); }}
                  />
                ))}
              </MakFilterRail>
            </MgTablePanelStrip>
          </div>
        </>
      ) : null}
      {formOpen ? <div className={`aux-toolbar-stack${formOpen ? ' is-form-open' : ''}`}>
      <ModeloBase1ActionBar className={`d17b-page-actionbar d17c-table-toolbar aux-registry-toolbar${formOpen ? ' aux-launch-toolbar' : ''}`} aria-label={`Ações de ${title}`}>
        <div className="d17c-table-toolbar__primary">
          <div className="d17c-table-toolbar__left">
            {formOpen ? (
              <div className="aux-form-toolbar-actions">
                <div className="aux-form-toolbar-commands">
                  <Button size="sm" className="emp-toolbar-btn emp-toolbar-btn-save d17c-launch-button aux-form-action" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
                  <Button size="sm" variant="outline" className="emp-toolbar-btn d17c-launch-button aux-cancel-button aux-form-action" onClick={() => setFormOpen(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="d17c-round-action"
                  onClick={() => setFilterOpenRequest((request) => request + 1)}
                  aria-label="Filtros dos cadastros"
                  title="Filtros dos cadastros"
                  aria-pressed={isMakColumnFilterActive(typeFilter)}
                >
                  <Filter aria-hidden="true" />
                </Button>
                <Button size="sm" className="emp-toolbar-btn emp-toolbar-btn-save d17c-launch-button aux-new-button" onClick={() => openNew()}>Novo</Button>
                <div className={`d17e-selection-actions${selected.length ? ' is-visible' : ''}`}>
                  {selected.length === 1 ? <Button size="sm" className="emp-toolbar-btn d17e-selection-action d17e-selection-action--edit" onClick={() => openEdit(selectedRecords[0])}>Editar</Button> : null}
                  {selected.length ? <Button size="sm" className="emp-toolbar-btn emp-toolbar-btn-delete d17e-selection-action" onClick={() => setDeleteRequest(selectedRecords)}>Excluir</Button> : null}
                </div>
              </>
            )}
          </div>
          {!formOpen ? <div className="d17c-table-toolbar__actions">
            {showQuickSearch ? <label className="d17c-quick-search d17c-quick-search--actions aux-search"><Search aria-hidden="true" /><input autoFocus value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Nome, documento ou contato" /></label> : null}
            <Button type="button" variant="ghost" size="icon" className="d17c-round-action" onClick={() => setShowQuickSearch((visible) => !visible)} aria-pressed={showQuickSearch || Boolean(search)} aria-label="Pesquisar" title="Pesquisar"><Search aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" className="d17c-round-action" onClick={refresh} aria-label="Atualizar" title="Atualizar"><RefreshCw aria-hidden="true" /></Button>
            <ModeloBase1ViewSeg
              mode={listViewMode}
              canOpenRecord={selected.length === 1}
              onTable={() => setListViewMode('tabela')}
              onRecord={() => selected.length === 1 && openEdit(selectedRecords[0])}
              onCards={() => setListViewMode('cards')}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="d17c-round-action" aria-label="Mais ações" title="Mais ações"><MoreVertical aria-hidden="true" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setTypeFilter(null)}>Mostrar todos os tipos</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </div> : <div className="d17c-table-toolbar__actions aux-form-toolbar-end"><div className="aux-required-status">Campos obrigatórios <strong>{filledRequiredFields}/{requiredFormFields.length}</strong></div><ModeloBase1ViewSeg mode="registro" canOpenRecord onTable={() => { setFormOpen(false); setListViewMode('tabela'); }} onRecord={() => {}} onCards={() => { setFormOpen(false); setListViewMode('cards'); }} /></div>}
        </div>
        {!formOpen ? <div className="d17c-table-toolbar__filters">
          <MakFilterRail hasActiveFilters={isMakColumnFilterActive(typeFilter)} onClear={() => { setTypeFilter(null); setCurrentPage(1); }} onConfigureFilters={() => setFilterOpenRequest((request) => request + 1)}>
            <MakFilterPill
              label="Tipo de cadastro"
              value={typeFilter}
              filterType="text"
              listOptions={tabs.map((item) => item.label)}
              openRequest={filterOpenRequest}
              onChange={(value) => { setTypeFilter(value); setCurrentPage(1); }}
            />
          </MakFilterRail>
        </div> : null}
      </ModeloBase1ActionBar>
      {formOpen ? <div className="mg-context-panel-wrap is-visible aux-context-panel-wrap">
        <div className="mg-context-panel aux-context-panel" data-template-id="context-panel">
          <div className="mg-context-panel__meta">
            <div className="mg-context-panel__meta-row">
              <div className="mg-context-panel__swap-slot min-w-0 flex-1">
                <span key={`${activeTabId}:${editingId || 'novo'}`} className="mg-context-panel__meta-text mg-motion-swap mg-motion-swap--text aux-record-identity">
                  {editingId ? <><span className="mg-context-panel__code">{form.codigo || form.documento || tab.singular}</span><span className="mg-context-panel__sep"> • </span></> : null}
                  <span className="mg-context-panel__title">{editingId ? (form.nome || editRecordLabel) : newRecordLabel}</span>
                </span>
              </div>
            </div>
          </div>
          <div className={`mg-context-panel__nav is-visible${editingId ? '' : ' aux-context-panel__nav--new'}`} aria-label="Navegação entre registros">
            <button type="button" className="mg-nav-btn ios-btn" onClick={() => openRelativeRecord(0)} disabled={editingIndex <= 0} title="Primeiro"><ChevronFirst aria-hidden="true" /></button>
            <button type="button" className="mg-nav-btn ios-btn" onClick={() => openRelativeRecord(editingIndex - 1)} disabled={editingIndex <= 0} title="Anterior"><ChevronLeft aria-hidden="true" /></button>
            <span className="mg-context-panel__swap-slot mg-context-panel__swap-slot--counter"><span key={`${activeTabId}:${editingIndex}`} className="mg-context-panel__counter mg-motion-swap mg-motion-swap--text">{editingIndex >= 0 ? `${editingIndex + 1} de ${tabRecords.length}` : 'Novo registro'}</span></span>
            <button type="button" className="mg-nav-btn ios-btn" onClick={() => openRelativeRecord(editingIndex + 1)} disabled={editingIndex < 0 || editingIndex >= tabRecords.length - 1} title="Próximo"><ChevronRight aria-hidden="true" /></button>
            <button type="button" className="mg-nav-btn ios-btn" onClick={() => openRelativeRecord(tabRecords.length - 1)} disabled={editingIndex < 0 || editingIndex >= tabRecords.length - 1} title="Último"><ChevronLast aria-hidden="true" /></button>
          </div>
        </div>
      </div> : null}
      </div> : null}

      {formOpen ? (
        <section className="mg-view-panel emp-form-panel aux-launch-panel" aria-label={editingId ? editRecordLabel : newRecordLabel}>
          <form className="aux-modelobase1-form" onSubmit={save}>
            <div id="mode-registro" className="aux-record-mode">
              <div className="mg-panel-tabs-strip mg-panel-tabs-strip--no-bg aux-record-tabs">
                <ModeloBase1PanelTabs activePanel={formPanel} hasObservations={observationFields.length > 0} onChange={setFormPanel} />
              </div>
              <div className="mg-form-scroll mg-prototype-form mg-prototype-form--edit">
                <div className="emp-form-body">
                  <div className="emp-form-panels-zone">
                    <section className="emp-form-section emp-form-section-panel emp-form-section-panel--corp">
                      <fieldset className="emp-form-fieldset">
                        <div className="emp-form-fields emp-form-fields-corp cad-form-fields cad-form-fields-corp">
                          <div className="emp-form-cards-layout cad-form-cards-layout mg-prototype-cards-layout">
                            {formPanel === 'principais' ? <>
                              <div className="emp-form-cards-row">
                                <FormCard title="Dados principais" fields={formPrimaryFields} form={formValues} setField={updateFormField} full />
                              </div>
                              <div className="emp-form-cards-row">
                                <FormCard title="Informações adicionais" fields={additionalFields} form={form} setField={setField} full={!contactFields.length} />
                                <FormCard title="Contato" fields={contactFields} form={form} setField={setField} full={!additionalFields.length} />
                              </div>
                            </> : <div className="emp-form-cards-row"><FormCard title="Observações" fields={observationFields} form={form} setField={setField} full /></div>}
                          </div>
                        </div>
                      </fieldset>
                    </section>
                  </div>
                </div>
              </div>
            </div>
            <button type="submit" className="sr-only">Salvar cadastro</button>
          </form>
        </section>
      ) : <div className="d17b-list-body">
        <MgFilterPanel
          open={showFilters}
          values={filterDraft}
          onChange={(key, next) => setFilterDraft((current) => ({ ...current, [key]: next }))}
          onClose={() => setShowFilters(false)}
          onClear={clearPanelFilters}
          onApply={applyPanelFilters}
          textFields={panelTextFields}
          selectFields={panelSelectFields}
        />
        <section className={`d17b-table-card aux-table-card${listViewMode === 'cards' ? ' aux-cards-card' : ''}`}>
        {listViewMode === 'cards' ? (
          <div className="mg-view-panel d17c-table-scroll aux-table-scroll aux-cards-scroll" aria-label="Cadastros em cartões">
            {paginated.length ? (
              <div className="mg-cards-grid mg-cards-grid--cards-3 aux-cards-grid">
                {paginated.map((record, index) => {
                  const isSelected = selected.includes(record._key);
                  return (
                    <article
                      key={record._key}
                      className={`erp-card mg-emp-card mg-emp-card--virtual relative aux-record-card${isSelected ? ' mg-emp-card--selected' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${record._typeLabel}: ${record.nome || 'Sem nome'}`}
                      onClick={() => setSelected((current) => current.includes(record._key) ? current.filter((key) => key !== record._key) : [...current, record._key])}
                      onDoubleClick={() => openEdit(record)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelected((current) => current.includes(record._key) ? current.filter((key) => key !== record._key) : [...current, record._key]);
                        }
                      }}
                    >
                      {isSelected ? <span className="mg-emp-card__select-badge" aria-hidden="true"><Check /></span> : null}
                      <div className="mg-emp-card__header aux-record-card__header">
                        <div className="mg-emp-card__avatar aux-record-card__avatar" style={{ background: CARD_AVATAR_COLORS[index % CARD_AVATAR_COLORS.length] }}>{getRecordInitials(record)}</div>
                        <div className="mg-emp-card__meta-text">
                          <span className="mg-emp-card__code">{record._typeLabel}</span>
                          <span className="mg-emp-card__sep"> • </span>
                          <span className="mg-emp-card__name">{record.nome || 'Sem nome'}</span>
                        </div>
                      </div>
                      <div className="mg-emp-card__fields mg-emp-card__fields--per-row-2">
                        {listColumns.filter((column) => column.id !== 'nome').slice(0, 4).map((column) => (
                          <div key={column.id} className="mg-emp-card__field">
                            <div className="mg-emp-card__field-line">
                              <span className="mg-emp-card__field-label">{column.label}:</span>
                              <span className="mg-emp-card__field-value" title={String(formatCell(column, record))}>{formatCell(column, record)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <div className="d17d-empty-row aux-cards-empty">{loading ? 'Carregando cadastros...' : 'Nenhum cadastro encontrado.'}</div>}
          </div>
        ) : <div className="mg-view-panel emp-table-root emp-table-shell emp-table-body-scroll d17c-table-scroll aux-table-scroll">
          <Table className="emp-table-pro d17c-data-table aux-data-table">
            <colgroup>
              <col style={{ width: '36px' }} />
              {tableColumns.map((column) => <col key={column.id} style={{ width: column.id === 'nome' ? '260px' : column.id === '_typeLabel' ? '160px' : '180px' }} />)}
            </colgroup>
            <TableHeader><TableRow>
              <TableHead className="emp-th-select aux-check-cell"><div className="emp-table-select-wrap"><MakTableSelectCheck checked={allPageSelected} indeterminate={somePageSelected && !allPageSelected} onChange={(checked) => setSelected((current) => checked ? [...new Set([...current, ...pageKeys])] : current.filter((key) => !pageKeys.includes(key)))} ariaLabel="Selecionar todos os registros listados" /></div></TableHead>
              {tableColumns.map((column) => column.id === '_typeLabel' ? <MakTh
                key="_typeLabel"
                label="Tipo de cadastro"
                menuOpen={columnMenuOpen === '_typeLabel'}
                onOpenMenu={() => setColumnMenuOpen(columnMenuOpen === '_typeLabel' ? null : '_typeLabel')}
                menu={{
                  onFechar: () => setColumnMenuOpen(null),
                  valorFiltro: typeFilter,
                  filterType: 'text',
                  listOptions: tabs.map((item) => item.label),
                  onFiltrar: (value) => { setTypeFilter(value); setCurrentPage(1); },
                }}
              /> : <MakTh
                key={column.id}
                label={column.label}
                menuOpen={columnMenuOpen === column.id}
                onOpenMenu={() => setColumnMenuOpen(columnMenuOpen === column.id ? null : column.id)}
                menu={{
                  onFechar: () => setColumnMenuOpen(null),
                  valorFiltro: columnFilters[column.id],
                  filterType: 'text',
                  listOptions: [...new Set(records.map((record) => formatCell(column, record)).filter((value) => value !== '—'))],
                  onFiltrar: (value) => { setColumnFilters((current) => ({ ...current, [column.id]: value })); setCurrentPage(1); },
                }}
              />)}
            </TableRow></TableHeader>
            <TableBody>
              {paginated.map((record, index) => <TableRow key={record._key} className={`${index % 2 ? 'emp-row-odd' : 'emp-row-even'} emp-table-data-row${selected.includes(record._key) ? ' emp-row-selected' : ''}`} onClick={() => setSelected((current) => current.includes(record._key) ? current.filter((key) => key !== record._key) : [...current, record._key])}>
                <TableCell className="emp-td-select aux-check-cell" onClick={(event) => event.stopPropagation()}><div className="emp-table-select-wrap"><MakTableSelectCheck checked={selected.includes(record._key)} onChange={(checked) => setSelected((current) => checked ? [...new Set([...current, record._key])] : current.filter((key) => key !== record._key))} ariaLabel={`Selecionar ${record.nome}`} /></div></TableCell>
                {tableColumns.map((column) => column.id === '_typeLabel'
                  ? <TableCell key="_typeLabel">{record._typeLabel}</TableCell>
                  : <TableCell key={column.id} className={column.id === 'nome' ? 'font-semibold' : ''}>{formatCell(column, record)}</TableCell>)}
              </TableRow>)}
              {!loading && !filtered.length ? <TableRow><TableCell colSpan={tableColumns.length + 1} className="d17d-empty-row">Nenhum cadastro encontrado.</TableCell></TableRow> : null}
              {loading ? <TableRow><TableCell colSpan={tableColumns.length + 1} className="d17d-empty-row">Carregando cadastros...</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </div>}
        <footer className="d17c-table-footer aux-table-footer">
          <span><strong>Selecionados:</strong> {selected.length}</span>
          <span><strong>Listados:</strong> {paginated.length}</span>
          <span><strong>Filtrados:</strong> {filtered.length}</span>
          <span><strong>Totais:</strong> {records.length}</span>
          <div className="d17c-table-footer__pagination">
            <Select value={String(itemsPerPage)} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}>
              <SelectTrigger aria-label="Itens por página"><SelectValue /></SelectTrigger>
              <SelectContent>{[25, 50, 100, 200].map((amount) => <SelectItem key={amount} value={String(amount)}>{amount}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} aria-label="Página anterior"><ChevronLeft aria-hidden="true" /></Button>
            <span>{currentPage}/{totalPages}</span>
            <Button type="button" variant="ghost" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)} aria-label="Próxima página"><ChevronRight aria-hidden="true" /></Button>
          </div>
        </footer>
      </section>
      </div>}

      <MakColumnConfigDialog
        open={showColumnConfig}
        onOpenChange={setShowColumnConfig}
        columns={configurableColumns}
        order={columnOrder || configurableColumns.map((column) => column.id)}
        visible={visibleColumnIds || configurableColumns.map((column) => column.id)}
        onApply={applyColumnConfig}
      />

      <Dialog open={deleteRequest.length > 0} onOpenChange={(open) => { if (!open) setDeleteRequest([]); }}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact">
          <DialogHeader><DialogTitle>Excluir cadastro</DialogTitle><DialogDescription>{deleteRequest.length === 1 ? `O cadastro “${deleteRequest[0]?.nome}” será excluído.` : `${deleteRequest.length} cadastros serão excluídos.`}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteRequest([])}>Cancelar</Button><Button variant="destructive" onClick={remove}>Excluir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </ModeloBase1PageContainer>
  );
}
