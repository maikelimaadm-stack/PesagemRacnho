import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, HardDriveDownload, RefreshCw } from 'lucide-react';
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
import { parseBrazilianNumber } from '@/modules/weighing/domain/brazilianValues';
import { GMD_DIAS_MINIMOS_OPCOES, GMD_DIAS_MINIMOS_PADRAO, normalizeGmdDiasMinimos } from '@/modules/weighing/domain/gmdQuality';
import { describeVersions } from '@/versioning/versionInfo';
import '@/styles/auxiliary-registries.css';

// Sentinela do select para "nenhum padrão" (o Radix Select não aceita valor vazio).
const NONE = '__nenhuma__';

// Seções e campos da configuração da empresa: cinco chaves versionadas de appSettings
// (operational-defaults, weight-warning-policy, sales-policy, auth-policy, report-settings — doc 11 §8,
// ADR-025/033/045, E1B), lidas/gravadas pela visão mesclada do appConfigService. `kind`: ref (id de
// cadastro), integer, decimal, boolean, choice (lista fixa em `options`, valores numéricos).
// `width` segue os presets do FormCard. `permission`: quem vê (e grava pela tela) a seção.
// E1C 1.4.0: o GESTOR vê só Relatórios (settings.reports); Geral, Curral, Comercial e Dados
// ficam com settings.manage e Segurança com settings.auth (ADMIN).
const SECTIONS = [
  {
    id: 'geral',
    title: 'Geral',
    permission: 'settings.manage',
    description: 'Padrões pré-selecionados no Lançamento (cadastro rápido de animal). Só cadastros ativos aparecem.',
    fields: [
      { id: 'marca_padrao_id', label: 'Marca padrão', kind: 'ref', source: 'marcas', width: 'CAMPO_PRINCIPAL', help: 'Marca já selecionada ao cadastrar um animal no Lançamento.' },
      { id: 'raca_padrao_id', label: 'Raça padrão', kind: 'ref', source: 'racas', width: 'CAMPO_PRINCIPAL', help: 'Raça já selecionada ao cadastrar um animal no Lançamento.' },
      { id: 'propriedade_padrao_id', label: 'Propriedade padrão', kind: 'ref', source: 'propriedades', width: 'CAMPO_PRINCIPAL', help: 'Propriedade já selecionada ao cadastrar um animal no Lançamento.' },
    ],
  },
  {
    id: 'curral',
    title: 'Curral',
    permission: 'settings.manage',
    description: 'Apartação sugerida no Lançamento e limites que geram os avisos de conferência do Lançamento.',
    fields: [
      { id: 'apartacao_padrao_id', label: 'Apartação padrão', kind: 'ref', source: 'apartacoes', width: 'CAMPO_PRINCIPAL', help: 'Apartação já selecionada ao abrir o Lançamento.' },
      { id: 'intervalo_pesagem_dias', label: 'Intervalo de pesagem (dias)', kind: 'integer', width: 'NUMERO', help: 'Reservado para os relatórios de pesagens vencidas (animal sem pesagem há mais dias que isso).' },
      { id: 'faixa_peso_min', label: 'Peso mínimo aceito (kg)', kind: 'decimal', width: 'NUMERO', help: 'Abaixo disso o Lançamento mostra aviso de conferência.' },
      { id: 'faixa_peso_max', label: 'Peso máximo aceito (kg)', kind: 'decimal', width: 'NUMERO', help: 'Acima disso o Lançamento mostra aviso de conferência.' },
      { id: 'limite_gmd_alerta', label: 'Limite de GMD para alerta (kg/dia)', kind: 'decimal', width: 'NUMERO', help: 'Ganho médio diário acima deste valor gera aviso no Lançamento.' },
      { id: 'variacao_max_percent', label: 'Variação máxima de peso (%)', kind: 'decimal', width: 'NUMERO', help: 'Variação acima deste percentual em relação à pesagem anterior gera aviso no Lançamento.' },
    ],
  },
  {
    id: 'comercial',
    title: 'Comercial',
    permission: 'settings.manage',
    description: 'Políticas aplicadas nas saídas por venda e abate (ADR-025, ADR-033).',
    fields: [
      { id: 'exigir_documento_venda', label: 'Exigir documento na venda', kind: 'boolean', width: 'SIM_NAO', help: 'Com "Sim", o Lançamento e o Fechamento só concluem uma venda com documento vinculado.' },
      { id: 'rendimento_padrao', label: 'Rendimento de carcaça padrão (%)', kind: 'decimal', optional: true, width: 'NUMERO', help: 'Usado pelo Lançamento só quando a operação não informa o rendimento; a origem fica registrada como padrão da empresa. Em branco: sem rendimento padrão.' },
    ],
  },
  {
    id: 'seguranca',
    title: 'Segurança',
    permission: 'settings.auth',
    description: 'Política de sessão e de tentativas de login (somente administrador). A tela de bloqueio pede a senha do mesmo usuário.',
    fields: [
      { id: 'inactivity_lock_minutes', label: 'Bloqueio por inatividade (minutos)', kind: 'integer', width: 'NUMERO', help: 'Sem atividade por este tempo a sessão é bloqueada. 0 desliga o bloqueio automático.' },
      { id: 'failed_attempt_limit', label: 'Tentativas incorretas até bloquear', kind: 'integer', width: 'NUMERO', help: 'Ao atingir este número de senhas erradas o login fica bloqueado temporariamente.' },
      { id: 'lock_minutes', label: 'Duração do bloqueio (minutos)', kind: 'decimal', width: 'NUMERO', help: 'Tempo de espera após atingir o limite de tentativas (aceita fração, ex.: 0,5).' },
    ],
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    permission: 'settings.reports',
    // M1 (1.5.0): uma linha para as duas arrobas (que nunca se somam) e uma para o mínimo do GMD, com o N escolhido.
    description: (form) => [
      '@ de peso vivo é o peso do boi dividido por 30 (ou 15). @ de carcaça é o que o frigorífico paga: peso × rendimento ÷ 15.',
      `GMD de intervalo menor que ${normalizeGmdDiasMinimos(form.gmd_dias_minimos)} dias aparece em cinza e não entra na média, porque o enchimento do boi atrapalha a conta.`,
    ],
    fields: [
      {
        id: 'arroba_divisor',
        label: 'Divisor da arroba (kg de peso vivo)',
        kind: 'choice',
        width: 'CAMPO_PRINCIPAL',
        options: [{ value: '30', label: '30 — @ de peso vivo (padrão)' }, { value: '15', label: '15' }],
        help: 'Média (@ vivo ÷30) = peso médio ÷ divisor; o divisor em uso aparece no nome da coluna e no rodapé da folha ("@ = peso vivo ÷ 30"). Não muda a @ de carcaça do Comercial (carcaça ÷ 15, com rendimento).',
      },
      {
        // M1: gmd_dias_minimos (report-settings, mesma permissão settings.reports do divisor). Lista fixa do contrato.
        id: 'gmd_dias_minimos',
        label: 'Intervalo mínimo do GMD',
        kind: 'choice',
        width: 'CAMPO_PRINCIPAL',
        options: GMD_DIAS_MINIMOS_OPCOES.map((dias) => ({ value: String(dias), label: dias === GMD_DIAS_MINIMOS_PADRAO ? `${dias} dias (padrão)` : `${dias} dias` })),
        defaultValue: String(GMD_DIAS_MINIMOS_PADRAO),
        help: 'GMD entre duas pesagens com menos dias que isso aparece em cinza na folha, na ficha e no Lançamento, e fica fora da média e dos totais.',
      },
    ],
  },
];
const ALL_FIELDS = SECTIONS.flatMap((section) => section.fields);

// Números em pt-BR pelo mesmo parser do Lançamento: vírgula decimal; "1.500" = 1500; "52,5" = 52.5.
const parseDecimal = (text) => parseBrazilianNumber(text);
const decimalFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const formatDecimal = (value) => (value == null || value === '' ? '' : decimalFormatter.format(Number(value)));

// Config (tipada) → valores de formulário (texto); e o caminho inverso, só com o que mudou.
function toForm(config, fields) {
  const form = {};
  for (const field of fields) {
    const value = config[field.id];
    if (field.kind === 'ref') form[field.id] = value || NONE;
    else if (field.kind === 'boolean') form[field.id] = value ? 'true' : 'false';
    else if (field.kind === 'choice') form[field.id] = value == null ? '' : String(value);
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

function toPatch(form, config, fields) {
  const patch = {};
  for (const field of fields) {
    const raw = form[field.id];
    let value;
    if (field.kind === 'ref') value = raw === NONE || !raw ? null : raw;
    else if (field.kind === 'boolean') value = raw === 'true';
    else if (field.kind === 'choice') {
      if (!field.options.some((option) => option.value === raw)) throw invalid(field, `Escolha uma opção em "${field.label}".`);
      value = Number(raw);
    } else if (field.optional && String(raw ?? '').trim() === '') {
      // Campo opcional em branco = sem valor (o serviço aceita null; ex.: rendimento padrão não
      // informado). Antes da E1C o branco era recusado e travava o Salvar de qualquer seção.
      value = null;
    } else {
      value = parseDecimal(raw);
      if (value === null || !Number.isFinite(value)) throw invalid(field, `Informe um número válido em "${field.label}".`);
      if (field.kind === 'integer' && !Number.isInteger(value)) throw invalid(field, `"${field.label}" deve ser um número inteiro.`);
    }
    if (value !== config[field.id]) patch[field.id] = value;
  }
  return patch;
}

const labelOf = (fieldId) => ALL_FIELDS.find((field) => field.id === fieldId)?.label || fieldId;

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

// `description`: texto ou lista de linhas (M1: Relatórios tem uma linha para as arrobas e uma para o GMD), no mesmo
// parágrafo de ajuda do cartão.
function FormCard({ title, description, children, full = false }) {
  const lines = Array.isArray(description) ? description : [description].filter(Boolean);
  return (
    <div className={`emp-form-card-slot${full ? ' emp-form-card-slot--full' : ' emp-form-card-slot--half'}`}>
      <section className="emp-form-card mg-emp-card p-4 aux-model-card">
        <h3 className="emp-form-card-title mb-1 text-sm font-semibold">{title}</h3>
        {lines.length ? <p className="app-config__description mb-3 text-[11px] leading-snug" style={{ color: 'var(--mb1-text-2)' }}>{lines.map((line, index) => <Fragment key={index}>{index ? <br /> : null}{line}</Fragment>)}</p> : null}
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
  const auth = useAuth();
  const actor = auth?.user;
  const navigate = useNavigate();
  const empresaId = DEFAULT_EMPRESA_ID;
  // Seções visíveis/editáveis conforme a permissão do papel (settings.manage, settings.auth ou
  // settings.reports). O cartão Dados segue settings.manage (ADMIN).
  const sections = useMemo(() => SECTIONS.filter((section) => auth?.can?.(section.permission)), [auth]);
  const fields = useMemo(() => sections.flatMap((section) => section.fields), [sections]);
  const canSeeData = Boolean(auth?.can?.('settings.manage'));
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
      // Cadastros de referência só quando alguma seção visível tem select de cadastro (o GESTOR não tem).
      const withRefs = fields.some((field) => field.kind === 'ref');
      const [current, marcas, racas, propriedades, apartacoes] = await Promise.all([
        getAppConfig(empresaId),
        withRefs ? brandService.list({ empresaId, incluirInativos: true }) : [],
        withRefs ? breedService.list({ empresaId, incluirInativos: true }) : [],
        withRefs ? propertyService.list({ empresaId, incluirInativos: true }) : [],
        withRefs ? listApartacoes({ empresaId }) : [],
      ]);
      const values = toForm(current, fields);
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
  }, [empresaId, fields]);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => fields.some((field) => form[field.id] !== baseline[field.id]), [fields, form, baseline]);
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
      patch = toPatch(form, config, fields);
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
      const values = toForm(saved, fields);
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

  // Deep link por seção (?secao=) é responsabilidade da tela de Backup e Manutenção.
  const goToMaintenance = () => navigate(createPageUrl('ManutencaoSistema'));

  const renderField = (field) => {
    const error = errorField === field.id;
    if (field.kind === 'ref') {
      return <SelectField key={field.id} field={field} value={form[field.id] || NONE} options={options[field.source]} onChange={setField(field.id)} error={error} />;
    }
    if (field.kind === 'boolean') {
      return <SelectField key={field.id} field={field} value={form[field.id] || 'false'} options={booleanOptions} onChange={setField(field.id)} error={error} />;
    }
    if (field.kind === 'choice') {
      return <SelectField key={field.id} field={field} value={form[field.id] || field.defaultValue || field.options[0].value} options={field.options} onChange={setField(field.id)} error={error} />;
    }
    return <TextField key={field.id} field={field} value={form[field.id]} onChange={setField(field.id)} error={error} />;
  };
  const sectionById = (id) => sections.find((section) => section.id === id);
  // Linha de cartões só existe se alguma das suas seções estiver visível (sem linha vazia no GESTOR).
  const hasSection = (...ids) => ids.some((id) => sectionById(id));
  const renderSection = (id) => {
    const section = sectionById(id);
    if (!section) return null;
    return (
      <FormCard title={section.title} description={typeof section.description === 'function' ? section.description(form) : section.description}>
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
                          {hasSection('geral', 'curral') ? (
                            <div className="emp-form-cards-row">
                              {renderSection('geral')}
                              {renderSection('curral')}
                            </div>
                          ) : null}
                          {hasSection('comercial', 'seguranca') ? (
                            <div className="emp-form-cards-row">
                              {renderSection('comercial')}
                              {renderSection('seguranca')}
                            </div>
                          ) : null}
                          {hasSection('relatorios') ? (
                            <div className="emp-form-cards-row">
                              {renderSection('relatorios')}
                            </div>
                          ) : null}
                          {canSeeData ? (
                            <div className="emp-form-cards-row">
                              <FormCard title="Dados" description="Backup, restauração, importação, migração e verificação de integridade ficam em Backup e Manutenção." full>
                                <div className="app-config__actions flex flex-wrap items-center gap-2" data-width-type="CAMPO_PRINCIPAL" style={{ flex: '1 1 100%' }}>
                                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={goToMaintenance} title="Abrir Backup e Manutenção">
                                    <HardDriveDownload className="h-3.5 w-3.5" aria-hidden="true" />Abrir Backup e Manutenção
                                  </button>
                                  <span className="app-config__meta ml-auto text-[10px]" style={{ color: 'var(--mb1-text-3)' }}>
                                    Aplicativo {versions.app} · Banco v{versions.dbSchema} · Backup formato {versions.backupFormat}
                                  </span>
                                </div>
                              </FormCard>
                            </div>
                          ) : null}
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

// ADMIN e GESTOR (settings.operational, a mesma do item de menu). Dentro, cada seção pede a sua
// permissão: o GESTOR vê só Relatórios (settings.reports, E1C); Segurança só com settings.auth.
// O serviço valida de novo, por grupo, ao gravar.
export default function Configuracoes() {
  return (
    <RequirePermission permission="settings.operational">
      <ConfiguracoesContent />
    </RequirePermission>
  );
}
