// Página genérica dos cadastros mestres (Tela Mãe + registro do ModeloBase1).
// Cada aba recebe { id, definition, persistence }: a definição vem de
// src/modules/catalog/domain/registryDefinitions.js e a porta de persistência é
// o serviço do cadastro (list/get/create/update/deactivate/activate/remove/
// setDefault?/countUsage?). A página não conhece stores nem chaves de configuração.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Columns3, FileText, LayoutDashboard, ListFilter, RefreshCw, Star, TableProperties, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ensureEmpresaId } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MakFilterPill from '@/components/mak/MakFilterPill';
import MakFilterRail from '@/components/mak/MakFilterRail';
import MakTableSelectCheck from '@/components/mak/MakTableSelectCheck';
import MakTh from '@/components/mak/MakTh';
import MakColumnConfigDialog from '@/components/mak/MakColumnConfigDialog';
import MgDesktopSearch from '@/components/mak/MgDesktopSearch';
import MgSpeedDialMenu from '@/components/mak/MgSpeedDialMenu';
import MgTablePanelStrip from '@/components/mak/MgTablePanelStrip';
import { normalizeSearchQuery } from '@/components/mak/mgSearchHighlight';
import { isMakColumnFilterActive, matchesMakColumnFilter } from '@/components/mak/MakColumnMenu';
import { ModeloBase1ActionBar, ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import { AccessDenied } from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { getRegistryService } from '@/modules/catalog/application/index';
import {
  NONE_OPTION,
  OBSERVATION_FIELD_IDS,
  USAGE_IN_LIST_LIMIT,
  USAGE_IN_LIST_STORES,
  USAGE_UNAVAILABLE_TEXT,
  USAGE_UNAVAILABLE_TITLE,
  usageAvailableFor,
  capitalize,
  describeError,
  emptyFor,
  formFromRecord,
  formatCellValue,
  groupFields,
  hasFieldValue,
  multiLabels,
  payloadFromForm,
  referenceOptionsFor,
} from './registryFormModel.js';
import '@/styles/auxiliary-registries.css';
import './cadastro-mestre.css';

export const REGISTRY_READ_PERMISSION = 'registry.read';
export const REGISTRY_WRITE_PERMISSION = 'registry.write';

const TYPE_COLUMN = { id: '_typeLabel', label: 'Tipo de cadastro', default: true };
const USAGE_COLUMN = { id: '_uso', label: 'Em uso', default: true, filterType: 'number' };

const FIELD_WIDTH_PRESETS = {
  CAMPO_PRINCIPAL: { min: 260, grow: 3 },
  CODIGO: { min: 120, grow: 0.5 },
  SIM_NAO: { min: 120, grow: 0.5 },
  TEXTO_CURTO: { min: 140, grow: 1 },
  NUMERO: { min: 120, grow: 1 },
};

function resolveFieldWidthType(campo) {
  if (campo.widthType && FIELD_WIDTH_PRESETS[campo.widthType]) return campo.widthType;
  if (campo.tipo === 'booleano') return 'SIM_NAO';
  if (campo.tipo === 'numero') return 'NUMERO';
  if (campo.compacto) return 'TEXTO_CURTO';
  return 'CAMPO_PRINCIPAL';
}

// Campo por tipo da definição: texto, número (pt-BR), booleano, select (enum ou
// referência a outro cadastro) e multiselect (chips).
function Field({ campo, value, onChange, options, disabled }) {
  const hasValue = hasFieldValue(value);
  const widthType = resolveFieldWidthType(campo);
  const fieldClass = `fg mg-prototype-field aux-model-field${campo.largo ? ' is-wide' : ''}${hasValue ? ' mg-has-value' : ''}`;
  const labelClass = `fg-label${campo.obrigatorio ? ' required' : ''}`;
  if (campo.tipo === 'select' || campo.tipo === 'booleano') {
    const isBoolean = campo.tipo === 'booleano';
    const selectOptions = isBoolean
      ? (campo.id === 'ativo' ? [{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Inativo' }] : [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }])
      : [...(campo.obrigatorio ? [] : [{ value: NONE_OPTION, label: 'Nenhum' }]), ...(options ?? campo.opcoes ?? [])];
    const current = isBoolean ? String(Boolean(value)) : String(value ?? '');
    return (
      <div className={`mg-prototype-composite mg-prototype-field aux-model-field aux-model-field--select${campo.largo ? ' is-wide' : ''}${hasValue || isBoolean ? ' mg-has-value' : ''}`} data-field={campo.id} data-width-type={widthType} title={campo.ajuda || undefined}>
        <div className={`cmd-select aux-model-cmd-select${hasValue || isBoolean ? ' mg-has-value' : ''}`}>
          <span id={`aux-label-${campo.id}`} className={`cmd-label${campo.obrigatorio ? ' req' : ''}`}>{campo.label}</span>
          <Select
            value={current}
            disabled={disabled}
            onValueChange={(next) => onChange(isBoolean ? next === 'true' : (next === NONE_OPTION ? '' : next))}
          >
            <SelectTrigger id={`aux-${campo.id}`} className="cmd-display aux-model-cmd-display" aria-labelledby={`aux-label-${campo.id}`}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent position="popper" className="aux-model-cmd-panel">
              {selectOptions.map((option) => <SelectItem key={String(option.value)} value={String(option.value)}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <ChevronDown className="cmd-chevron" aria-hidden="true" />
        </div>
      </div>
    );
  }
  if (campo.tipo === 'multiselect') {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (option) => onChange(selected.includes(option.value) ? selected.filter((item) => item !== option.value) : [...selected, option.value]);
    return (
      <div className={`${fieldClass} aux-model-field--chips`} data-field={campo.id} data-width-type={widthType} title={campo.ajuda || undefined}>
        <span id={`aux-label-${campo.id}`} className={labelClass}>{campo.label}</span>
        <div className="aux-chip-group" role="group" aria-labelledby={`aux-label-${campo.id}`}>
          {(campo.opcoes ?? []).map((option) => {
            const active = selected.includes(option.value);
            return (
              <button key={String(option.value)} type="button" className={`aux-chip${active ? ' is-selected' : ''}`} aria-pressed={active} disabled={disabled} onClick={() => toggle(option)}>
                {active ? <Check aria-hidden="true" /> : null}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (OBSERVATION_FIELD_IDS.has(campo.id)) {
    return (
      <div className={`${fieldClass} aux-model-field--textarea`} data-field={campo.id} data-width-type={widthType} title={campo.ajuda || undefined}>
        <label className={labelClass} htmlFor={`aux-${campo.id}`}>{campo.label}</label>
        <textarea id={`aux-${campo.id}`} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder=" " rows={4} disabled={disabled} />
      </div>
    );
  }
  const isNumber = campo.tipo === 'numero';
  return (
    <div className={fieldClass} data-field={campo.id} data-width-type={widthType} title={campo.ajuda || undefined}>
      <label className={labelClass} htmlFor={`aux-${campo.id}`}>{campo.label}</label>
      <input
        id={`aux-${campo.id}`}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        type="text"
        inputMode={isNumber ? 'decimal' : undefined}
        disabled={disabled}
        placeholder=" "
      />
    </div>
  );
}

function FormCard({ title, fields, form, setField, options, disabled, full = false }) {
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
                {fields.map((campo) => <Field key={campo.id} campo={campo} value={form[campo.id]} options={options?.[campo.id]} disabled={disabled} onChange={(value) => setField(campo.id, value)} />)}
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

// Normaliza as abas: rótulos derivados da definição quando não informados.
function normalizeTabs(tabs) {
  return tabs.map((tab) => {
    const { definition } = tab;
    return {
      ...tab,
      label: tab.label ?? definition.rotulo,
      singular: definition.singular,
      newLabel: tab.newLabel ?? `${/a$/.test(definition.singular) ? 'Nova' : 'Novo'} ${definition.singular}`,
      editLabel: tab.editLabel ?? `Editar ${definition.singular}`,
      usageInList: tab.usageInList ?? (USAGE_IN_LIST_STORES.has(definition.store) && typeof tab.persistence.countUsage === 'function'),
    };
  });
}

export default function CadastroAuxiliarPage({ title, description, tabs: rawTabs, prefsKey }) {
  const auth = useAuth();
  // Sem AuthGate (desenvolvimento/gates) tudo é permitido; o serviço valida de novo.
  const canRead = auth ? Boolean(auth.can?.(REGISTRY_READ_PERMISSION)) : true;
  const canWrite = auth ? Boolean(auth.can?.(REGISTRY_WRITE_PERMISSION)) : true;
  const actor = auth?.user ?? null;
  const empresaId = ensureEmpresaId();
  const tabs = useMemo(() => normalizeTabs(rawTabs), [rawTabs]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [catalog, setCatalog] = useState({});
  const [references, setReferences] = useState({});
  const [usage, setUsage] = useState({});
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [columnFilters, setColumnFilters] = useState({});
  const [columnMenuOpen, setColumnMenuOpen] = useState(null);
  const [selected, setSelected] = useState([]);
  const [listViewMode, setListViewMode] = useState('tabela');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formPanel, setFormPanel] = useState('principais');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => emptyFor(tabs[0].definition));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState([]);
  // Tela Mãe do ModeloBase1: painel lateral de filtros, pesquisa expansível,
  // "Mais opções" e configuração de colunas (preferência local por página).
  const [searchInput, setSearchInput] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const columnPrefsKey = `aux-colunas:${prefsKey ?? tabs.map((item) => item.definition.store).join('+')}`;
  const readColumnPref = (suffix) => { try { return JSON.parse(localStorage.getItem(`${columnPrefsKey}:${suffix}`)) || null; } catch { return null; } };
  const [columnOrder, setColumnOrder] = useState(() => readColumnPref('ordem'));
  const [visibleColumnIds, setVisibleColumnIds] = useState(() => readColumnPref('visiveis'));
  const tab = tabs.find((item) => item.id === activeTabId) || tabs[0];
  const { definition, persistence } = tab;
  const tabRecords = catalog[tab.id] || [];
  const records = useMemo(() => tabs.flatMap((item) => (catalog[item.id] || []).map((record) => ({
    ...record,
    _tabId: item.id,
    _typeLabel: item.label,
    _key: `${item.definition.store}:${record.id}`,
  }))), [catalog, tabs]);
  // Campos por id (todas as abas) para renderizar colunas e filtros por tipo.
  const fieldsById = useMemo(() => {
    const map = new Map();
    tabs.forEach((item) => item.definition.campos.forEach((campo) => { if (!map.has(campo.id)) map.set(campo.id, campo); }));
    return map;
  }, [tabs]);
  const listColumns = useMemo(() => {
    const available = new Map();
    tabs.forEach((item) => item.definition.colunas.forEach((column) => {
      if (!available.has(column.id)) available.set(column.id, column);
    }));
    return [...available.values()];
  }, [tabs]);
  const usageInList = tabs.length === 1 && tab.usageInList;
  // Acima de USAGE_IN_LIST_LIMIT a coluna existe mas não é calculada (mostra "—", sem pílula).
  const usageAvailable = usageAvailableFor(usageInList, (catalog[tab.id] || []).length);
  const configurableColumns = useMemo(() => [
    { id: 'selecao', label: 'Seleção', default: true, fixo: true },
    ...(tabs.length > 1 ? [TYPE_COLUMN] : []),
    ...listColumns.map((column) => ({ id: column.id, label: column.label, default: true })),
    ...(usageInList ? [USAGE_COLUMN] : []),
  ], [tabs.length, listColumns, usageInList]);
  const tableColumns = useMemo(() => {
    const byId = new Map(configurableColumns.map((column) => [column.id, column]));
    const order = (columnOrder || []).filter((id) => byId.has(id));
    const ordered = [...order, ...configurableColumns.map((column) => column.id).filter((id) => !order.includes(id))];
    const visible = visibleColumnIds ? new Set(visibleColumnIds) : null;
    return ordered
      .filter((id) => id !== 'selecao' && (!visible || visible.has(id)))
      .map((id) => (id === '_typeLabel' ? TYPE_COLUMN : id === '_uso' ? USAGE_COLUMN : listColumns.find((column) => column.id === id)))
      .filter(Boolean);
  }, [configurableColumns, columnOrder, visibleColumnIds, listColumns]);
  const applyColumnConfig = ({ order, visible }) => {
    setColumnOrder(order);
    setVisibleColumnIds(visible);
    localStorage.setItem(`${columnPrefsKey}:ordem`, JSON.stringify(order));
    localStorage.setItem(`${columnPrefsKey}:visiveis`, JSON.stringify(visible));
  };
  const referenceStores = useMemo(() => {
    const stores = new Set();
    tabs.forEach((item) => {
      item.definition.campos.forEach((campo) => { if (campo.referencia?.store) stores.add(campo.referencia.store); });
      item.definition.colunas.forEach((column) => { if (column.referencia?.store) stores.add(column.referencia.store); });
    });
    return [...stores];
  }, [tabs]);
  const referenceName = useCallback((store, id) => {
    if (!id) return '';
    const row = (references[store] || []).find((item) => item.id === id);
    return row ? row.nome : 'Registro não encontrado';
  }, [references]);

  // Texto de célula (tabela, cartões, filtros e pesquisa) a partir da definição.
  const cellText = useCallback((column, record) => formatCellValue(column, record, { campo: fieldsById.get(column.id), referenceName, usage }), [usage, referenceName, fieldsById]);
  const columnListOptions = useCallback((column) => {
    const campo = fieldsById.get(column.id);
    if (campo?.tipo === 'multiselect') return (campo.opcoes ?? []).map((option) => option.label);
    return [...new Set(records.map((record) => cellText(column, record)).filter(Boolean))];
  }, [fieldsById, records, cellText]);
  // Coluna multiselect (papéis): a lista da pílula oferece um papel por vez.
  const matchesColumnFilter = useCallback((column, record, filter) => {
    const campo = fieldsById.get(column.id);
    if (campo?.tipo === 'multiselect' && Array.isArray(filter?.values) && filter.values.length) {
      return multiLabels(campo, record[column.id]).some((label) => filter.values.includes(label));
    }
    return matchesMakColumnFilter(cellText(column, record), filter, column.filterType || 'text');
  }, [fieldsById, cellText]);
  const clearFilters = () => { setTypeFilter(null); setColumnFilters({}); setCurrentPage(1); };

  // Contagem de uso da lista em lotes (só para stores com contagem por índice).
  const loadUsage = useCallback(async (item, rows) => {
    if (!item.usageInList || rows.length > USAGE_IN_LIST_LIMIT) return;
    const chunk = 25;
    for (let index = 0; index < rows.length; index += chunk) {
      const slice = rows.slice(index, index + chunk);
      const counts = await Promise.all(slice.map((row) => item.persistence.countUsage(row.id).catch(() => null)));
      setUsage((current) => ({ ...current, ...Object.fromEntries(slice.map((row, position) => [row.id, counts[position]])) }));
    }
  }, []);
  const loadUsageFor = useCallback(async (item, id) => {
    if (typeof item.persistence.countUsage !== 'function') return;
    try {
      const count = await item.persistence.countUsage(id);
      setUsage((current) => ({ ...current, [id]: count }));
    } catch { /* contagem é informativa; o serviço recusa a exclusão de qualquer forma */ }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await Promise.all(tabs.map(async (item) => [item.id, await item.persistence.list({ empresaId, incluirInativos: true })]));
      const refEntries = await Promise.all(referenceStores.map(async (store) => [store, await getRegistryService(store).list({ empresaId, incluirInativos: true })]));
      setCatalog(Object.fromEntries(entries));
      setReferences(Object.fromEntries(refEntries));
      setUsage({});
      entries.forEach(([id, rows]) => { const item = tabs.find((candidate) => candidate.id === id); if (item) loadUsage(item, rows); });
    } catch (error) { toast.error(error?.message || 'Não foi possível carregar os cadastros.'); }
    finally { setLoading(false); }
  }, [tabs, empresaId, referenceStores, loadUsage]);
  useEffect(() => { refresh(); }, [refresh]);

  const matchesSearch = useCallback((record, term) => {
    const normalized = normalizeSearchQuery(term);
    if (!normalized) return true;
    const haystack = [record._typeLabel, ...listColumns.map((column) => cellText(column, record)), ...definition.campos.filter((campo) => campo.tipo === 'texto').map((campo) => record[campo.id])];
    return haystack.some((value) => normalizeSearchQuery(String(value ?? '')).includes(normalized));
  }, [listColumns, cellText, definition]);
  const filtered = useMemo(() => records.filter((record) => {
    if (isMakColumnFilterActive(typeFilter) && !matchesMakColumnFilter(record._typeLabel, typeFilter, 'text')) return false;
    if ([...listColumns, ...(usageAvailable ? [USAGE_COLUMN] : [])].some((column) => isMakColumnFilterActive(columnFilters[column.id]) && !matchesColumnFilter(column, record, columnFilters[column.id]))) return false;
    return matchesSearch(record, search);
  }), [records, search, typeFilter, listColumns, columnFilters, usageAvailable, matchesColumnFilter, matchesSearch]);
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
  }, [records, searchInput, listColumns, cellText, matchesSearch]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pageKeys = paginated.map((item) => item._key);
  const allPageSelected = pageKeys.length > 0 && pageKeys.every((key) => selected.includes(key));
  const somePageSelected = pageKeys.some((key) => selected.includes(key));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil(filtered.length / itemsPerPage))));
  }, [filtered.length, itemsPerPage]);

  const openNew = (tabId = tabs[0].id) => {
    if (!canWrite) return;
    const next = tabs.find((item) => item.id === tabId) || tabs[0];
    setActiveTabId(next.id);
    setEditingId(null);
    setForm(emptyFor(next.definition));
    setFormPanel('principais');
    setFormOpen(true);
  };
  const changeNewRecordType = (tabId) => {
    const next = tabs.find((item) => item.id === tabId) || tabs[0];
    setActiveTabId(next.id);
    setEditingId(null);
    setForm(emptyFor(next.definition));
    setFormPanel('principais');
  };
  const openEdit = (record) => {
    const next = tabs.find((item) => item.id === record._tabId) || tabs[0];
    setActiveTabId(next.id);
    setEditingId(record.id);
    setForm(formFromRecord(next.definition, record));
    setFormPanel('principais');
    setFormOpen(true);
    if (usage[record.id] == null) loadUsageFor(next, record.id);
  };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };
  const setField = (id, value) => setForm((current) => ({ ...current, [id]: value }));

  const notifyError = (error, fallback) => {
    const { message, description } = describeError(error, fallback);
    toast.error(message, description ? { description } : undefined);
  };

  const save = async (event) => {
    event?.preventDefault?.();
    if (!canWrite || saving) return;
    const payload = payloadFromForm(definition, form);
    const erros = definition.validar(payload);
    if (erros.length) return toast.error(erros.join(' '));
    setSaving(true);
    try {
      if (editingId) await persistence.update(actor, editingId, payload);
      else await persistence.create(actor, { ...payload, empresa_id: empresaId });
      closeForm();
      toast.success(editingId ? `${capitalize(definition.singular)} atualizado(a).` : `${capitalize(definition.singular)} adicionado(a).`);
      await refresh();
    } catch (error) { notifyError(error, 'Não foi possível salvar o cadastro.'); }
    finally { setSaving(false); }
  };

  // Ações em lote da barra: cada registro passa pelo serviço; erros por registro
  // não interrompem os demais.
  const runOnSelection = async (items, action, successLabel) => {
    if (busy) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const record of items) {
        const owner = tabs.find((item) => item.id === record._tabId) || tab;
        try { await action(owner, record); ok += 1; }
        catch (error) { notifyError(error, 'A operação não pôde ser concluída.'); }
      }
      if (ok) toast.success(ok === 1 ? successLabel.one(items[0]) : successLabel.many(ok));
      setSelected([]);
      await refresh();
    } finally { setBusy(false); }
  };

  const remove = async () => {
    const items = deleteRequest;
    setDeleteRequest([]);
    await runOnSelection(items, (owner, record) => owner.persistence.remove(actor, record.id), {
      one: () => 'Cadastro excluído.',
      many: (n) => `${n} cadastros excluídos.`,
    });
  };
  // Inativar um padrão limpa o padrão: o serviço devolve `aviso` e a tela o mostra.
  const toggleActive = async (items, activate) => runOnSelection(items, async (owner, record) => {
    if (activate) return owner.persistence.activate(actor, record.id);
    const result = await owner.persistence.deactivate(actor, record.id);
    if (result?.aviso) toast.warning(result.aviso);
    return result;
  }, {
    one: () => (activate ? 'Cadastro ativado.' : 'Cadastro inativado.'),
    many: (n) => (activate ? `${n} cadastros ativados.` : `${n} cadastros inativados.`),
  });
  const setDefault = async (record) => runOnSelection([record], (owner) => owner.persistence.setDefault(actor, record.id), {
    one: (item) => `“${item.nome}” definido(a) como padrão.`,
    many: () => 'Padrão definido.',
  });

  const selectedRecords = records.filter((record) => selected.includes(record._key));
  const selectedAllActive = selectedRecords.length > 0 && selectedRecords.every((record) => record.ativo !== false);
  const selectedAllInactive = selectedRecords.length > 0 && selectedRecords.every((record) => record.ativo === false);
  const selectedTab = selectedRecords.length === 1 ? (tabs.find((item) => item.id === selectedRecords[0]._tabId) || tab) : tab;
  const canSetDefault = canWrite && selectedRecords.length === 1 && selectedTab.definition.temPadrao && typeof selectedTab.persistence.setDefault === 'function' && selectedRecords[0].ativo !== false && !selectedRecords[0].padrao;
  const { primary: primaryFields, additional: additionalFields, contact: contactFields, observation: observationFields } = groupFields(definition);
  const typeField = {
    id: '__type',
    label: 'Tipo de cadastro',
    tipo: 'select',
    widthType: 'CAMPO_PRINCIPAL',
    obrigatorio: true,
    opcoes: tabs.map((item) => ({ value: item.id, label: capitalize(item.singular) })),
  };
  const formPrimaryFields = !editingId && tabs.length > 1 ? [typeField, ...primaryFields] : primaryFields;
  const formValues = { ...form, __type: activeTabId };
  const requiredFormFields = formPrimaryFields.filter((campo) => campo.obrigatorio);
  const filledRequiredFields = requiredFormFields.filter((campo) => hasFieldValue(formValues[campo.id])).length;
  const updateFormField = (id, value) => id === '__type' ? changeNewRecordType(value) : setField(id, value);
  // Opções dos campos com referência (ativos + o valor já gravado, mesmo inativo).
  const referenceOptions = useMemo(() => Object.fromEntries(definition.campos
    .filter((campo) => campo.referencia)
    .map((campo) => [campo.id, referenceOptionsFor(campo, references[campo.referencia.store], form[campo.id])])), [definition, references, form]);
  const editingRecord = editingId ? tabRecords.find((record) => record.id === editingId) : null;
  const editingIndex = editingId ? tabRecords.findIndex((record) => record.id === editingId) : -1;
  const openRelativeRecord = (index) => {
    const record = tabRecords[index];
    if (record) openEdit({ ...record, _tabId: tab.id });
  };
  const recordCode = editingRecord ? (editingRecord.documento || editingRecord.abreviacao || editingRecord.codigo_oficial || definition.singular) : definition.singular;
  const formatCell = (column, record) => cellText(column, record) || '—';
  const readOnly = !canWrite;
  const editActionLabel = canWrite ? 'Editar' : 'Consultar';

  if (!canRead) return <AccessDenied profile={auth?.user?.perfil} permission={REGISTRY_READ_PERMISSION} />;

  return (
    <ModeloBase1PageContainer variant="table" className={`d17b-page d17b-list-page cadastro-emp-scope mg-empresas-scope aux-registry-page${formOpen ? '' : ' d17b-list-page--mother'} ${formOpen ? 'aux-registry-page--record' : 'aux-registry-page--table'}`}>
      <ModeloBase1PageHeader title={title} description={description} visuallyHidden />
      {!formOpen ? (
        <>
          {/* Barra de ações da Tela Mãe (ModeloBase1): Filtrar, Novo, seleção; pesquisa, modos e "Mais opções". */}
          <div className="mak-mother-page__toolbar mg-subtoolbar-stack" data-mak-region="toolbar">
            <div data-template-id="action-bar" className="mg-action-bar canva-section flex w-full shrink-0 items-center" style={{ background: 'var(--bg-card)' }}>
              <div className="mg-action-bar__actions flex min-w-0 items-center">
                <div className={`mg-action-slot${canWrite ? ' is-visible' : ''}`} style={{ '--slot-width': '64px' }} aria-hidden={!canWrite}>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-green aux-new-button" onClick={() => openNew()} title="Novo" tabIndex={canWrite ? 0 : -1}>Novo</button>
                </div>
                <div className={`mg-action-slot${selected.length === 1 ? ' is-visible' : ''}`} style={{ '--slot-width': canWrite ? '66px' : '90px' }} aria-hidden={selected.length !== 1}>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => openEdit(selectedRecords[0])} title={editActionLabel} tabIndex={selected.length === 1 ? 0 : -1}>{editActionLabel}</button>
                </div>
                <div className={`mg-action-slot${canWrite && selectedAllActive ? ' is-visible' : ''}`} style={{ '--slot-width': '78px' }} aria-hidden={!(canWrite && selectedAllActive)}>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => toggleActive(selectedRecords, false)} title="Inativar" disabled={busy} tabIndex={canWrite && selectedAllActive ? 0 : -1}>Inativar</button>
                </div>
                <div className={`mg-action-slot${canWrite && selectedAllInactive ? ' is-visible' : ''}`} style={{ '--slot-width': '68px' }} aria-hidden={!(canWrite && selectedAllInactive)}>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => toggleActive(selectedRecords, true)} title="Ativar" disabled={busy} tabIndex={canWrite && selectedAllInactive ? 0 : -1}>Ativar</button>
                </div>
                <div className={`mg-action-slot${canSetDefault ? ' is-visible' : ''}`} style={{ '--slot-width': '118px' }} aria-hidden={!canSetDefault}>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => setDefault(selectedRecords[0])} title="Definir como padrão" disabled={busy} tabIndex={canSetDefault ? 0 : -1}>
                    <Star className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Definir padrão
                  </button>
                </div>
                <div className={`mg-action-slot${canWrite && selected.length ? ' is-visible' : ''}`} style={{ '--slot-width': '84px' }} aria-hidden={!(canWrite && selected.length)}>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost tb-btn-danger" onClick={() => setDeleteRequest(selectedRecords)} title="Excluir" disabled={busy} tabIndex={canWrite && selected.length ? 0 : -1}>
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
                  canOpenRecord={filtered.length > 0 || canWrite}
                  onTable={() => setListViewMode('tabela')}
                  onRecord={() => {
                    const record = selected.length === 1 ? selectedRecords[0] : (paginated[0] || filtered[0]);
                    if (record) openEdit(record);
                    else if (canWrite) openNew();
                  }}
                  onCards={() => setListViewMode('cards')}
                />
                <div className="relative">
                  <MgSpeedDialMenu
                    open={moreOpen}
                    onOpenChange={setMoreOpen}
                    items={[
                      { id: 'atualizar', label: 'Atualizar', icon: RefreshCw, onClick: refresh },
                      { id: 'colunas', label: 'Configurar colunas', icon: Columns3, onClick: () => setShowColumnConfig(true) },
                      { id: 'tipos', label: 'Mostrar todos os tipos', icon: ListFilter, onClick: clearFilters },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mak-mother-page__panel-strip" data-mak-region="panel-strip">
            <MgTablePanelStrip onConfigColumns={() => setShowColumnConfig(true)}>
              <MakFilterRail
                hasActiveFilters={isMakColumnFilterActive(typeFilter) || Object.values(columnFilters).some(isMakColumnFilterActive)}
                onClear={clearFilters}
              >
                {/* Uma pílula por coluna visível da tabela, na mesma ordem (ModeloBase1). */}
                {tableColumns.map((column) => {
                  // Acima do limite a contagem não é calculada: sem pílula de "Em uso".
                  if (column.id === '_uso' && !usageAvailable) return null;
                  if (column.id === '_typeLabel') {
                    return (
                      <MakFilterPill
                        key="_typeLabel"
                        label={column.label}
                        value={typeFilter}
                        filterType="text"
                        listOptions={tabs.map((item) => item.label)}
                        onChange={(value) => { setTypeFilter(value); setCurrentPage(1); }}
                      />
                    );
                  }
                  return (
                    <MakFilterPill
                      key={column.id}
                      label={column.label}
                      value={columnFilters[column.id] || null}
                      filterType={column.id === '_uso' ? 'number' : 'text'}
                      listOptions={column.id === '_uso' ? [] : columnListOptions(column)}
                      onChange={(value) => { setColumnFilters((current) => ({ ...current, [column.id]: value })); setCurrentPage(1); }}
                    />
                  );
                })}
              </MakFilterRail>
            </MgTablePanelStrip>
          </div>
        </>
      ) : null}
      {formOpen ? <div className="aux-toolbar-stack is-form-open">
      <ModeloBase1ActionBar className="d17b-page-actionbar d17c-table-toolbar aux-registry-toolbar aux-launch-toolbar" aria-label={`Ações de ${title}`}>
        <div className="d17c-table-toolbar__primary">
          <div className="d17c-table-toolbar__left">
            <div className="aux-form-toolbar-actions">
              <div className="aux-form-toolbar-commands">
                {canWrite ? <Button size="sm" className="emp-toolbar-btn emp-toolbar-btn-save d17c-launch-button aux-form-action" onClick={save} disabled={saving} title="Salvar (Enter)">{saving ? 'Salvando...' : 'Salvar'}</Button> : null}
                <Button size="sm" variant="outline" className="emp-toolbar-btn d17c-launch-button aux-cancel-button aux-form-action" onClick={closeForm} title={canWrite ? 'Cancelar (Esc)' : 'Voltar (Esc)'}>{canWrite ? 'Cancelar' : 'Voltar'}</Button>
              </div>
            </div>
          </div>
          <div className="d17c-table-toolbar__actions aux-form-toolbar-end"><div className="aux-required-status">Campos obrigatórios <strong>{filledRequiredFields}/{requiredFormFields.length}</strong></div><ModeloBase1ViewSeg mode="registro" canOpenRecord onTable={() => { closeForm(); setListViewMode('tabela'); }} onRecord={() => {}} onCards={() => { closeForm(); setListViewMode('cards'); }} /></div>
        </div>
      </ModeloBase1ActionBar>
      <div className="mg-context-panel-wrap is-visible aux-context-panel-wrap">
        <div className="mg-context-panel aux-context-panel" data-template-id="context-panel">
          <div className="mg-context-panel__meta">
            <div className="mg-context-panel__meta-row">
              <div className="mg-context-panel__swap-slot min-w-0 flex-1">
                <span key={`${activeTabId}:${editingId || 'novo'}`} className="mg-context-panel__meta-text mg-motion-swap mg-motion-swap--text aux-record-identity">
                  {editingId ? <><span className="mg-context-panel__code">{recordCode}</span><span className="mg-context-panel__sep"> • </span></> : null}
                  <span className="mg-context-panel__title">{editingId ? (form.nome || tab.editLabel) : tab.newLabel}</span>
                  {editingRecord ? (
                    <span className="aux-context-badges">
                      {editingRecord.padrao ? <span className="aux-context-badge aux-context-badge--default" title="Pré-selecionado no cadastro rápido"><Star aria-hidden="true" />Padrão</span> : null}
                      {editingRecord.ativo === false ? <span className="aux-context-badge aux-context-badge--inactive">Inativo</span> : null}
                      {usage[editingRecord.id] != null ? <span className="aux-context-badge" title="Registros que usam este cadastro">Em uso: {usage[editingRecord.id]}</span> : null}
                    </span>
                  ) : null}
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
      </div>
      </div> : null}

      {formOpen ? (
        <section className="mg-view-panel emp-form-panel aux-launch-panel" aria-label={editingId ? tab.editLabel : tab.newLabel}>
          {/* Enter salva (submit do formulário); Esc cancela, exceto quando a tecla fecha uma lista suspensa aberta. */}
          <form className="aux-modelobase1-form" onSubmit={save} onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented && !event.target.closest?.('[data-radix-select-content], [role="listbox"]')) { event.preventDefault(); closeForm(); } }}>
            <div id="mode-registro" className={`aux-record-mode${readOnly ? ' is-readonly' : ''}`}>
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
                                <FormCard title="Dados principais" fields={formPrimaryFields} form={formValues} setField={updateFormField} options={referenceOptions} disabled={readOnly} full />
                              </div>
                              <div className="emp-form-cards-row">
                                <FormCard title="Informações adicionais" fields={additionalFields} form={form} setField={setField} options={referenceOptions} disabled={readOnly} full={!contactFields.length} />
                                <FormCard title="Contato" fields={contactFields} form={form} setField={setField} options={referenceOptions} disabled={readOnly} full={!additionalFields.length} />
                              </div>
                            </> : <div className="emp-form-cards-row"><FormCard title="Observações" fields={observationFields} form={form} setField={setField} options={referenceOptions} disabled={readOnly} full /></div>}
                          </div>
                        </div>
                      </fieldset>
                    </section>
                  </div>
                </div>
              </div>
            </div>
            <button type="submit" className="sr-only" disabled={readOnly}>Salvar cadastro</button>
          </form>
        </section>
      ) : <div className="d17b-list-body">
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
              {tableColumns.map((column) => <col key={column.id} style={{ width: column.id === 'nome' ? '260px' : column.id === '_typeLabel' ? '160px' : column.id === '_uso' ? '90px' : '180px' }} />)}
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
                  filterType: column.filterType || 'text',
                  listOptions: column.id === '_uso' ? [] : columnListOptions(column),
                  onFiltrar: (value) => { setColumnFilters((current) => ({ ...current, [column.id]: value })); setCurrentPage(1); },
                }}
              />)}
            </TableRow></TableHeader>
            <TableBody>
              {paginated.map((record, index) => <TableRow key={record._key} className={`${index % 2 ? 'emp-row-odd' : 'emp-row-even'} emp-table-data-row${selected.includes(record._key) ? ' emp-row-selected' : ''}`} onClick={() => setSelected((current) => current.includes(record._key) ? current.filter((key) => key !== record._key) : [...current, record._key])} onDoubleClick={() => openEdit(record)}>
                <TableCell className="emp-td-select aux-check-cell" onClick={(event) => event.stopPropagation()}><div className="emp-table-select-wrap"><MakTableSelectCheck checked={selected.includes(record._key)} onChange={(checked) => setSelected((current) => checked ? [...new Set([...current, record._key])] : current.filter((key) => key !== record._key))} ariaLabel={`Selecionar ${record.nome}`} /></div></TableCell>
                {tableColumns.map((column) => column.id === '_typeLabel'
                  ? <TableCell key="_typeLabel">{record._typeLabel}</TableCell>
                  : column.id === '_uso'
                    ? <TableCell key="_uso" className={`aux-usage-cell${usage[record.id] == null ? ' is-pending' : ''}`} title={!usageAvailable ? USAGE_UNAVAILABLE_TITLE : undefined}>{!usageAvailable ? USAGE_UNAVAILABLE_TEXT : usage[record.id] == null ? '…' : usage[record.id]}</TableCell>
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
          <DialogHeader><DialogTitle>Excluir cadastro</DialogTitle><DialogDescription>{deleteRequest.length === 1 ? `O cadastro “${deleteRequest[0]?.nome}” será excluído. Cadastros em uso não são excluídos: inative-os.` : `${deleteRequest.length} cadastros serão excluídos. Cadastros em uso não são excluídos: inative-os.`}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteRequest([])}>Cancelar</Button><Button variant="destructive" onClick={remove} disabled={busy}>Excluir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </ModeloBase1PageContainer>
  );
}
