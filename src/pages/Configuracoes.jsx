import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, HardDriveDownload, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModeloBase1ActionBar, ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import RequirePermission from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { brandService, breedService, propertyService } from '@/modules/catalog/application/index';
import { listApartacoes } from '@/modules/auxiliary/application/apartacaoService';
import { DEFAULT_EMPRESA_ID, getAppConfig, updateAppConfig } from '@/modules/settings/application/appConfigService';
import { describeVersions } from '@/versioning/versionInfo';
import '@/styles/auxiliary-registries.css';

// Sentinela do select para "nenhum padrão" (o Radix Select não aceita valor vazio).
const NONE = '__nenhuma__';

// Seções e campos da configuração da empresa (appSettings 'config:<empresa>', doc 11/ADR-025/033/035).
// `kind`: ref (id de cadastro), integer, decimal, boolean. `width` segue os presets do FormCard.
const SECTIONS = [
  {
    id: 'geral',
    title: 'Geral',
    description: 'Padrões pré-selecionados no cadastro rápido e no curral. Só cadastros ativos aparecem.',
    fields: [
      { id: 'marca_padrao_id', label: 'Marca padrão', kind: 'ref', source: 'marcas', width: 'CAMPO_PRINCIPAL' },
      { id: 'raca_padrao_id', label: 'Raça padrão', kind: 'ref', source: 'racas', width: 'CAMPO_PRINCIPAL' },
      { id: 'propriedade_padrao_id', label: 'Propriedade padrão', kind: 'ref', source: 'propriedades', width: 'CAMPO_PRINCIPAL' },
    ],
  },
  {
    id: 'curral',
    title: 'Curral',
    description: 'Apartação sugerida na sessão, faixa de peso aceita e limites que geram alerta de conferência.',
    fields: [
      { id: 'apartacao_padrao_id', label: 'Apartação padrão', kind: 'ref', source: 'apartacoes', width: 'CAMPO_PRINCIPAL' },
      { id: 'intervalo_pesagem_dias', label: 'Intervalo de pesagem (dias)', kind: 'integer', width: 'NUMERO', help: 'Animal sem pesagem há mais dias que isso aparece como pesagem vencida.' },
      { id: 'faixa_peso_min', label: 'Peso mínimo aceito (kg)', kind: 'decimal', width: 'NUMERO', help: 'Abaixo disso o lançamento pede conferência.' },
      { id: 'faixa_peso_max', label: 'Peso máximo aceito (kg)', kind: 'decimal', width: 'NUMERO', help: 'Acima disso o lançamento pede conferência.' },
      { id: 'limite_gmd_alerta', label: 'Limite de GMD para alerta (kg/dia)', kind: 'decimal', width: 'NUMERO', help: 'Ganho médio diário acima deste valor gera alerta.' },
    ],
  },
  {
    id: 'comercial',
    title: 'Comercial',
    description: 'Políticas aplicadas nas operações de venda e abate (ADR-025, ADR-033).',
    fields: [
      { id: 'exigir_documento_venda', label: 'Exigir documento na venda', kind: 'boolean', width: 'SIM_NAO', help: 'Com "Sim", a venda só fecha com documento vinculado.' },
      { id: 'rendimento_padrao', label: 'Rendimento de carcaça padrão (%)', kind: 'decimal', width: 'NUMERO', help: 'Usado só quando a operação não informa o rendimento; a origem fica registrada como padrão da empresa.' },
    ],
  },
  {
    id: 'seguranca',
    title: 'Segurança',
    description: 'Bloqueio automático da sessão. A tela de bloqueio pede a senha do mesmo usuário.',
    fields: [
      { id: 'bloqueio_inatividade_minutos', label: 'Bloqueio por inatividade (minutos)', kind: 'integer', width: 'NUMERO', help: '0 desliga o bloqueio automático.' },
    ],
  },
];
const FIELDS = SECTIONS.flatMap((section) => section.fields);

// Números em pt-BR: vírgula decimal; "1.500,5" → 1500.5; "52.5" (sem vírgula) → 52.5.
function parseDecimal(text) {
  let normalized = String(text ?? '').trim();
  if (!normalized) return Number.NaN;
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');
  return Number(normalized);
}
const formatDecimal = (value) => (value == null ? '' : String(value).replace('.', ','));

// Config (tipada) → valores de formulário (texto); e o caminho inverso, só com o que mudou.
function toForm(config) {
  const form = {};
  for (const field of FIELDS) {
    const value = config[field.id];
    if (field.kind === 'ref') form[field.id] = value || NONE;
    else if (field.kind === 'boolean') form[field.id] = value ? 'true' : 'false';
    else form[field.id] = formatDecimal(value);
  }
  return form;
}

function invalid(field, message) {
  const error = new Error(message);
  error.code = 'CONFIG_INVALID';
  error.field = field.id;
  return error;
}

function toPatch(form, config) {
  const patch = {};
  for (const field of FIELDS) {
    const raw = form[field.id];
    let value;
    if (field.kind === 'ref') value = raw === NONE || !raw ? null : raw;
    else if (field.kind === 'boolean') value = raw === 'true';
    else {
      value = parseDecimal(raw);
      if (!Number.isFinite(value)) throw invalid(field, `Informe um número válido em "${field.label}".`);
      if (field.kind === 'integer' && !Number.isInteger(value)) throw invalid(field, `"${field.label}" deve ser um número inteiro.`);
    }
    if (value !== config[field.id]) patch[field.id] = value;
  }
  return patch;
}

const labelOf = (fieldId) => FIELDS.find((field) => field.id === fieldId)?.label || fieldId;

function focusField(fieldId) {
  window.setTimeout(() => document.getElementById(`config-${fieldId}`)?.focus(), 0);
}

// Campo de texto com rótulo flutuante do ModeloBase1 (mesma estrutura dos cadastros).
function TextField({ field, value, onChange, error }) {
  const hasValue = String(value ?? '').trim() !== '';
  return (
    <div className={`fg mg-prototype-field aux-model-field${hasValue ? ' mg-has-value' : ''}`} data-field={field.id} data-width-type={field.width}>
      <label className="fg-label" htmlFor={`config-${field.id}`}>{field.label}</label>
      <input
        id={`config-${field.id}`}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        type="text"
        inputMode={field.kind === 'integer' ? 'numeric' : 'decimal'}
        autoComplete="off"
        placeholder=" "
        title={field.help || field.label}
        aria-invalid={error || undefined}
      />
    </div>
  );
}

// Seleção com a estrutura cmd-select do ModeloBase1 (rótulo sempre elevado: há valor visível).
function SelectField({ field, value, options, onChange, error }) {
  const labelId = `config-label-${field.id}`;
  return (
    <div className="mg-prototype-composite mg-prototype-field aux-model-field aux-model-field--select mg-has-value" data-field={field.id} data-width-type={field.width}>
      <div className="cmd-select aux-model-cmd-select mg-has-value">
        <span id={labelId} className="cmd-label">{field.label}</span>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={`config-${field.id}`} className="cmd-display aux-model-cmd-display" aria-labelledby={labelId} aria-invalid={error || undefined} title={field.help || field.label}>
            <SelectValue placeholder="" />
          </SelectTrigger>
          <SelectContent position="popper" className="aux-model-cmd-panel">
            {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <ChevronDown className="cmd-chevron" aria-hidden="true" />
      </div>
    </div>
  );
}

function FormCard({ title, description, children, full = false }) {
  return (
    <div className={`emp-form-card-slot${full ? ' emp-form-card-slot--full' : ' emp-form-card-slot--half'}`}>
      <section className="emp-form-card mg-emp-card p-4 aux-model-card">
        <h3 className="emp-form-card-title mb-1 text-sm font-semibold">{title}</h3>
        {description ? <p className="app-config__description mb-3 text-[11px] leading-snug" style={{ color: 'var(--mb1-text-2)' }}>{description}</p> : null}
        <div className="emp-form-card-body grid grid-cols-1 gap-3">
          <div className="emp-form-card-rows">
            <div className="emp-form-card-row">
              <div className="emp-form-card-row-grid emp-form-card-row-grid--flex emp-form-card-row-grid--pair aux-model-card-grid">{children}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Opções de cada select de referência: ativos + o valor atual, mesmo que inativo (não some da tela).
function refOptions(rows, currentId, none) {
  const visible = rows.filter((row) => !row.deleted_at && (row.ativo !== false || row.id === currentId));
  return [
    { value: NONE, label: none },
    ...visible.map((row) => ({ value: row.id, label: `${row.nome || row.id}${row.ativo === false ? ' (inativa)' : ''}` })),
  ];
}

function ConfiguracoesContent() {
  const { user: actor } = useAuth();
  const navigate = useNavigate();
  const empresaId = DEFAULT_EMPRESA_ID;
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({});
  const [baseline, setBaseline] = useState({});
  const [refs, setRefs] = useState({ marcas: [], racas: [], propriedades: [], apartacoes: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorField, setErrorField] = useState(null);
  const versions = useMemo(() => describeVersions(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [current, marcas, racas, propriedades, apartacoes] = await Promise.all([
        getAppConfig(empresaId),
        brandService.list({ empresaId, incluirInativos: true }),
        breedService.list({ empresaId, incluirInativos: true }),
        propertyService.list({ empresaId, incluirInativos: true }),
        listApartacoes({ empresaId }),
      ]);
      const values = toForm(current);
      setConfig(current);
      setForm(values);
      setBaseline(values);
      setRefs({ marcas, racas, propriedades, apartacoes });
      setErrorField(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível carregar as configurações.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => FIELDS.some((field) => form[field.id] !== baseline[field.id]), [form, baseline]);
  const setField = (id) => (value) => {
    setForm((current) => ({ ...current, [id]: value }));
    if (errorField === id) setErrorField(null);
  };

  const options = useMemo(() => ({
    marcas: refOptions(refs.marcas, config?.marca_padrao_id, 'Nenhuma'),
    racas: refOptions(refs.racas, config?.raca_padrao_id, 'Nenhuma'),
    propriedades: refOptions(refs.propriedades, config?.propriedade_padrao_id, 'Nenhuma'),
    apartacoes: refOptions(refs.apartacoes, config?.apartacao_padrao_id, 'Nenhuma'),
  }), [refs, config]);
  const booleanOptions = [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }];

  const cancel = () => {
    setForm(baseline);
    setErrorField(null);
  };

  // Enter em qualquer campo envia o formulário; só as chaves alteradas vão ao serviço.
  const save = async (event) => {
    event?.preventDefault?.();
    if (saving || loading || !config) return;
    let patch;
    try {
      patch = toPatch(form, config);
    } catch (err) {
      setErrorField(err.field);
      focusField(err.field);
      toast.error(err.message);
      return;
    }
    if (!Object.keys(patch).length) {
      toast.info('Nenhuma alteração para salvar.');
      return;
    }
    setSaving(true);
    try {
      const saved = await updateAppConfig(actor, patch, empresaId);
      const values = toForm(saved);
      setConfig(saved);
      setForm(values);
      setBaseline(values);
      setErrorField(null);
      toast.success('Configurações salvas.');
    } catch (err) {
      if (err?.code === 'CONFIG_INVALID' && err.field) {
        setErrorField(err.field);
        focusField(err.field);
        toast.error(`${labelOf(err.field)}: ${err.message}`);
      } else {
        toast.error(err?.message || 'Não foi possível salvar as configurações.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Esc descarta as alterações; ignora o Esc que fecha uma lista de seleção aberta.
  const onKeyDown = (event) => {
    if (event.key !== 'Escape' || !dirty || saving) return;
    if (event.defaultPrevented || event.target?.closest?.('[data-radix-select-content]')) return;
    event.preventDefault();
    cancel();
  };

  const goToMaintenance = (secao) => navigate(createPageUrl(`ManutencaoSistema?secao=${secao}`));

  const renderField = (field) => {
    const error = errorField === field.id;
    if (field.kind === 'ref') {
      return <SelectField key={field.id} field={field} value={form[field.id] || NONE} options={options[field.source]} onChange={setField(field.id)} error={error} />;
    }
    if (field.kind === 'boolean') {
      return <SelectField key={field.id} field={field} value={form[field.id] || 'false'} options={booleanOptions} onChange={setField(field.id)} error={error} />;
    }
    return <TextField key={field.id} field={field} value={form[field.id]} onChange={setField(field.id)} error={error} />;
  };
  const sectionById = (id) => SECTIONS.find((section) => section.id === id);
  const renderSection = (id) => {
    const section = sectionById(id);
    return (
      <FormCard title={section.title} description={section.description}>
        {section.fields.map(renderField)}
      </FormCard>
    );
  };

  return (
    <ModeloBase1PageContainer
      variant="record"
      className="d17b-page d17b-list-page cadastro-emp-scope mg-empresas-scope aux-registry-page aux-registry-page--record app-config-page"
    >
      <ModeloBase1PageHeader title="Configurações" description="Padrões da empresa, políticas do curral e do comercial, segurança e dados." visuallyHidden />

      {/* Barra de ações do modo registro (ModeloBase1): Salvar/Cancelar à esquerda, estado à direita. */}
      <div className="aux-toolbar-stack is-form-open">
        <ModeloBase1ActionBar className="d17b-page-actionbar d17c-table-toolbar aux-registry-toolbar aux-launch-toolbar" aria-label="Ações das configurações">
          <div className="d17c-table-toolbar__primary">
            <div className="d17c-table-toolbar__left">
              <div className="aux-form-toolbar-actions">
                <div className="aux-form-toolbar-commands">
                  <Button size="sm" className="emp-toolbar-btn emp-toolbar-btn-save d17c-launch-button aux-form-action" onClick={save} disabled={saving || loading || !dirty} title="Salvar (Enter)">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button size="sm" variant="outline" className="emp-toolbar-btn d17c-launch-button aux-cancel-button aux-form-action" onClick={cancel} disabled={saving || !dirty} title="Descartar alterações (Esc)">
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
            <div className="d17c-table-toolbar__actions aux-form-toolbar-end">
              <div className="aux-required-status" aria-live="polite">
                {loading ? 'Carregando…' : dirty ? <strong>Alterações não salvas</strong> : 'Tudo salvo'}
              </div>
              <Button type="button" variant="ghost" size="icon" className="d17c-round-action" onClick={load} disabled={loading || saving} aria-label="Recarregar" title="Recarregar">
                <RefreshCw aria-hidden="true" />
              </Button>
            </div>
          </div>
        </ModeloBase1ActionBar>
        <div className="mg-context-panel-wrap is-visible aux-context-panel-wrap">
          <div className="mg-context-panel aux-context-panel" data-template-id="context-panel">
            <div className="mg-context-panel__meta">
              <div className="mg-context-panel__meta-row">
                <div className="mg-context-panel__swap-slot min-w-0 flex-1">
                  <span className="mg-context-panel__meta-text aux-record-identity">
                    <span className="mg-context-panel__code">Empresa</span>
                    <span className="mg-context-panel__sep"> • </span>
                    <span className="mg-context-panel__title">Configurações gerais</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mg-view-panel emp-form-panel aux-launch-panel" aria-label="Configurações da empresa">
        <form className="aux-modelobase1-form" onSubmit={save} onKeyDown={onKeyDown}>
          <div id="mode-registro" className="aux-record-mode">
            <div className="mg-form-scroll mg-prototype-form mg-prototype-form--edit">
              <div className="emp-form-body">
                <div className="emp-form-panels-zone">
                  <section className="emp-form-section emp-form-section-panel emp-form-section-panel--corp">
                    <fieldset className="emp-form-fieldset" disabled={loading}>
                      <div className="emp-form-fields emp-form-fields-corp cad-form-fields cad-form-fields-corp">
                        <div className="emp-form-cards-layout cad-form-cards-layout mg-prototype-cards-layout">
                          <div className="emp-form-cards-row">
                            {renderSection('geral')}
                            {renderSection('curral')}
                          </div>
                          <div className="emp-form-cards-row">
                            {renderSection('comercial')}
                            {renderSection('seguranca')}
                          </div>
                          <div className="emp-form-cards-row">
                            <FormCard title="Dados" description="Backup, restauração, importação e verificação de integridade ficam em Backup e Manutenção." full>
                              <div className="app-config__actions flex flex-wrap items-center gap-2" data-width-type="CAMPO_PRINCIPAL" style={{ flex: '1 1 100%' }}>
                                <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => goToMaintenance('backup')} title="Abrir Backup e Manutenção na área de backup">
                                  <HardDriveDownload className="h-3.5 w-3.5" aria-hidden="true" />Backup e restauração
                                </button>
                                <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => goToMaintenance('integridade')} title="Abrir Backup e Manutenção na verificação de integridade">
                                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Verificar integridade
                                </button>
                                <span className="app-config__meta ml-auto text-[10px]" style={{ color: 'var(--mb1-text-3)' }}>
                                  Aplicativo {versions.app} · Banco v{versions.dbSchema} · Backup formato {versions.backupFormat}
                                </span>
                              </div>
                            </FormCard>
                          </div>
                        </div>
                      </div>
                    </fieldset>
                  </section>
                </div>
              </div>
            </div>
          </div>
          <button type="submit" className="sr-only">Salvar configurações</button>
        </form>
      </section>
    </ModeloBase1PageContainer>
  );
}

// Somente ADMIN (settings.manage). O serviço valida de novo ao gravar.
export default function Configuracoes() {
  return (
    <RequirePermission permission="settings.manage">
      <ConfiguracoesContent />
    </RequirePermission>
  );
}
