import React, { useState } from "react";
import { ArrowLeft, ChevronLeft, FileJson, FileSpreadsheet, FileText, FolderOpen, ListFilter, MoreHorizontal, RefreshCw, Save, Settings, Trash2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { describeFilter, isFilterActive } from "@/modules/reporting/domain/filterEngine";
import { BarSelect, PREVIOUS_OPTIONS } from "./ReportFilterBar";

// Tela "como o MAKGESTAO" (E1D visual, decisão da responsável: "igual ao MAKGESTAO no visual, com as contas
// certas"). E1E: vale para TODOS os relatórios de Relatórios (tela única, com o campo "Relatório"); só a aba
// Controle da Manutenção continua com a tela da 1.4.0. Copiado do antigo pelas classes
// (RelatorioPesagensIndividuais, L509–757): título + "Análise e impressão" com o Imprimir verde; cartão de
// filtros com a grade de campos (rótulo em cima), os controles do tipo e a linha de botões de contorno;
// embaixo, sempre a folha. Só SELEÇÃO — contas, filtros e ordem continuam no serviço. Quais campos e botões
// cada relatório tem: application/reportScreenModel.js (o mesmo que o gate reports:tela-unica confere).

// O antigo só tinha Retrato e Paisagem (padrão Paisagem, L141): "Automática" da 1.4.0 aparece como Paisagem.
export const MAK_ORIENTATION_OPTIONS = Object.freeze([
  { value: "portrait", label: "Retrato" },
  { value: "landscape", label: "Paisagem" },
]);
export const makOrientation = (orientation) => (orientation === "portrait" ? "portrait" : "landscape");

const NO_OPTIONS = [];
const ISO_DATE = /^(\d{4})-\d{2}-\d{2}$/;
const NEGATIVE_LIST = new Set(["not_in", "not_equals", "not_contains"]);

/** Data com o rótulo em cima, como o Input type="date" do antigo (h-8 text-xs). */
function MakDateField({ id, label, value, onChange }) {
  return (
    <div className="rpt-bar-field rpt-mak-field" data-field={id}>
      <label className="rpt-bar-field__label" htmlFor={`rpt-mak-${id}`}>{label}</label>
      <input
        id={`rpt-mak-${id}`}
        type="date"
        className="rpt-mak-input"
        value={value ?? ""}
        // Ano incompleto enquanto digita (0002-…) não vira período.
        onChange={(event) => { const match = ISO_DATE.exec(event.target.value); if (match && Number(match[1]) >= 1900) onChange(event.target.value); }}
      />
    </div>
  );
}

// Lista marcada simples ("em E1, E2"): é o que os botões do antigo gravam. Outra condição (ex.: "contém x" ou
// "fora de", vinda de um modelo ou da 1.4.0) aparece escrita na lista e continua até a pessoa marcar ou limpar.
const checkedValues = (value) => (isFilterActive(value) && Array.isArray(value?.values) && value.values.length && !NEGATIVE_LIST.has(value.operator) ? value.values.map(String) : []);

// E1F: condição de número/data do "Mais filtros…" (entre, a partir de, até, igual) — os operadores do motor.
const CONDITIONS = Object.freeze({
  number: Object.freeze([["between", "Entre"], ["greater_equal", "A partir de (≥)"], ["less_equal", "Até (≤)"], ["equals", "Igual a"]]),
  date: Object.freeze([["between", "Entre"], ["on_or_after", "A partir de"], ["on_or_before", "Até"], ["equals", "No dia"]]),
});
// Lista longa (Animal, Comprador…): caixa de busca em cima.
const SEARCH_FROM = 12;

/** Quantos filtros o botão mostra: marcados; outra condição conta como 1. */
export const filterCount = (value) => (isFilterActive(value) ? checkedValues(value).length || 1 : 0);

function MakConditionEditor({ filterType, value, onChange }) {
  const options = CONDITIONS[filterType];
  const current = isFilterActive(value) && options.some(([id]) => id === value.operator) ? value : null;
  const [operator, setOperator] = useState(current?.operator ?? "between");
  const [from, setFrom] = useState(current ? String(current.value ?? "") : "");
  const [to, setTo] = useState(current ? String(current.valueTo ?? "") : "");
  const type = filterType === "date" ? "date" : "text";
  const ready = String(from).trim() !== "" && (operator !== "between" || String(to).trim() !== "");
  return (
    <form className="rpt-mak-pop__cond" onSubmit={(event) => { event.preventDefault(); if (ready) onChange({ operator, value: from.trim(), valueTo: operator === "between" ? to.trim() : "", values: [] }); }}>
      <select className="rpt-mak-pop__field" aria-label="Condição" value={operator} onChange={(event) => setOperator(event.target.value)}>
        {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
      </select>
      <div className="rpt-mak-pop__cond-values">
        <input className="rpt-mak-pop__field" type={type} inputMode={filterType === "number" ? "decimal" : undefined} aria-label={operator === "between" ? "De" : "Valor"} placeholder={operator === "between" ? "De" : "Valor"} value={from} onChange={(event) => setFrom(event.target.value)} />
        {operator === "between" ? <input className="rpt-mak-pop__field" type={type} inputMode={filterType === "number" ? "decimal" : undefined} aria-label="Até" placeholder="Até" value={to} onChange={(event) => setTo(event.target.value)} /> : null}
      </div>
      <div className="rpt-mak-pop__cond-actions">
        {isFilterActive(value) ? <button type="button" className="rpt-mak-pop__link" onClick={() => onChange(null)}>Limpar</button> : <span />}
        <button type="submit" className="rpt-mak-pop__apply" disabled={!ready}>Aplicar</button>
      </div>
    </form>
  );
}

/**
 * Conteúdo do filtro de uma coluna (E1D; E1F: o mesmo nos botões e no "Mais filtros…"): texto/lista = caixas
 * de marcar (marcar já filtra — lista "em"); número/data = condição (entre, a partir de, até, igual). Opções
 * podem vir como { value, label } (Sim/Não da coluna sim/não). Tudo pelo MESMO caminho (uiFilters → motor).
 */
export function MakgestaoFilterList({ label, value, filterType = "text", listOptions = NO_OPTIONS, onChange, open = true }) {
  const [term, setTerm] = useState("");
  const checked = checkedValues(value);
  const otherCondition = isFilterActive(value) && !checked.length;
  if (filterType === "number" || filterType === "date") {
    return (
      <div className="space-y-2">
        <h4 className="mb-2 text-sm font-semibold">{label}</h4>
        {otherCondition && !CONDITIONS[filterType].some(([id]) => id === value.operator) ? (
          <div className="rpt-mak-pop__condition"><span>{describeFilter(value)}</span><button type="button" onClick={() => onChange(null)}>Limpar</button></div>
        ) : null}
        <MakConditionEditor filterType={filterType} value={value} onChange={onChange} />
      </div>
    );
  }
  // Só com a lista aberta (as opções vêm da população da execução, em cache por execução). Valor marcado que
  // não existe mais no período continua visível (e desmarcável).
  const raw = open ? (typeof listOptions === "function" ? listOptions() : listOptions) : NO_OPTIONS;
  const list = raw.map((item) => (item && typeof item === "object" ? { value: String(item.value), label: String(item.label ?? item.value) } : { value: String(item), label: String(item) }));
  const all = open ? [...list, ...checked.filter((item) => !list.some((option) => option.value === item)).map((item) => ({ value: item, label: item }))] : NO_OPTIONS;
  const needle = term.trim().toLocaleLowerCase("pt-BR");
  const options = needle ? all.filter((option) => option.label.toLocaleLowerCase("pt-BR").includes(needle)) : all;
  const toggle = (option) => {
    const next = checked.includes(option) ? checked.filter((item) => item !== option) : [...checked, option];
    onChange(next.length ? { operator: "in", value: "", valueTo: "", values: next } : null);
  };
  return (
    <div className="space-y-2">
      <h4 className="mb-2 text-sm font-semibold">{label}</h4>
      {otherCondition ? (
        <div className="rpt-mak-pop__condition">
          <span>{describeFilter(value)}</span>
          <button type="button" onClick={() => onChange(null)}>Limpar</button>
        </div>
      ) : null}
      {all.length > SEARCH_FROM ? <input type="search" className="rpt-mak-pop__field rpt-mak-pop__search" aria-label={`Procurar em ${label}`} placeholder="Procurar…" value={term} onChange={(event) => setTerm(event.target.value)} /> : null}
      {options.map((option) => (
        <label key={option.value} className="rpt-mak-pop__item flex items-center space-x-2">
          <Checkbox checked={checked.includes(option.value)} onCheckedChange={() => toggle(option.value)} />
          <span className="cursor-pointer text-sm">{option.label}</span>
        </label>
      ))}
      {!all.length ? <p className="text-xs text-slate-500">Nenhum valor no período.</p> : null}
    </div>
  );
}

/**
 * Botão de contorno da linha de filtros ("Lotes (2)") com a lista de marcar do antigo (Popover w-64: título
 * em negrito e uma caixa por valor; marcar já filtra). O filtro vai pelo MESMO caminho das pílulas
 * (uiFilters → motor de filtros, lista "em"): só a aparência é do antigo. E1F: número/data com a condição.
 */
export function MakgestaoFilterButton({ label, value, filterType = "text", listOptions = NO_OPTIONS, onChange, narrow = false }) {
  const [open, setOpen] = useState(false);
  const count = filterCount(value);
  const text = count ? `${label} (${count})` : label;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Nome acessível com o texto visível (e o contador). */}
        <button type="button" className="rpt-mak-btn" aria-label={`Filtrar ${text}`}>{text}</button>
      </PopoverTrigger>
      {/* Classes do antigo (PopoverContent w-64/w-48 max-h-96, space-y-2, h4 font-semibold text-sm, linhas
          flex items-center space-x-2 com Checkbox e label text-sm). */}
      <PopoverContent className={`rpt-mak-pop ${narrow ? "w-48" : "w-64"} max-h-96 overflow-auto border-[#e5e5e5] text-[#0a0a0a]`} aria-label={`Filtro ${label}`}>
        {open ? <MakgestaoFilterList label={label} value={value} filterType={filterType} listOptions={listOptions} onChange={onChange} open={open} /> : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * E1F (item 3): "Mais filtros…" — todas as colunas filtráveis do relatório sem botão próprio
 * (reportScreenModel.moreFilterColumnsOf). Escolher uma abre a MESMA lista de marcar/condição dos botões;
 * filtrada, ela aparece também como botão com contador na linha (ReportView → extras).
 * @param columns [{ id, label, filterType, listOptions, value }]; onChange(columnId, filtro|null)
 */
export function MakgestaoMoreFilters({ columns, onChange }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [term, setTerm] = useState("");
  const active = columns.filter((column) => isFilterActive(column.value)).length;
  const current = selected ? columns.find((column) => column.id === selected) ?? null : null;
  const needle = term.trim().toLocaleLowerCase("pt-BR");
  const shown = needle ? columns.filter((column) => column.label.toLocaleLowerCase("pt-BR").includes(needle)) : columns;
  if (!columns.length) return null;
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setSelected(null); setTerm(""); } }}>
      <PopoverTrigger asChild>
        <button type="button" className="rpt-mak-btn rpt-mak-btn--icon" aria-label={active ? `Mais filtros (${active} ligados)` : "Mais filtros"} title="Filtrar por outras colunas do relatório">
          <ListFilter aria-hidden="true" />Mais filtros…{active ? ` (${active})` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="rpt-mak-pop rpt-mak-more w-72 max-h-96 overflow-auto border-[#e5e5e5] text-[#0a0a0a]" aria-label="Mais filtros">
        {current ? (
          <div className="space-y-2">
            <button type="button" className="rpt-mak-pop__link rpt-mak-more__back" onClick={() => setSelected(null)}><ChevronLeft aria-hidden="true" />Colunas</button>
            <MakgestaoFilterList label={current.label} value={current.value} filterType={current.filterType} listOptions={current.listOptions} onChange={(value) => onChange(current.id, value)} />
          </div>
        ) : (
          <div className="space-y-2">
            <h4 className="mb-2 text-sm font-semibold">Mais filtros</h4>
            {columns.length > SEARCH_FROM ? <input type="search" className="rpt-mak-pop__field rpt-mak-pop__search" aria-label="Procurar coluna" placeholder="Procurar coluna…" value={term} onChange={(event) => setTerm(event.target.value)} /> : null}
            <ul className="rpt-mak-more__list" role="list">
              {shown.map((column) => {
                const count = filterCount(column.value);
                return (
                  <li key={column.id}>
                    <button type="button" className={`rpt-mak-more__item${count ? " is-on" : ""}`} data-column={column.id} onClick={() => setSelected(column.id)}>
                      <span>{column.label}</span>
                      {count ? <span className="rpt-mak-more__count">{count}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!shown.length ? <p className="text-xs text-slate-500">Nenhuma coluna com esse nome.</p> : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Topo do antigo (L509–518): título grande + "Análise e impressão" à esquerda; à direita o Imprimir verde.
 * Discretos ao lado dele: Excel, PDF e o menu "⋯" (CSV, JSON, Abrir/Salvar modelo, Atualizar, colunas vazias).
 * @param templates E1E: modelos deste relatório para "Abrir modelo" (null = sem modelos nesta tela, ex.
 *   fora de Relatórios); onOpenTemplate(modelo). onDeleteTemplate: só com o modelo aberto e permissão.
 */
export function MakgestaoTopBar({
  title, templateName = null, loading = false, backLabel = "Relatórios", onBack = null,
  canExport, disabled, onPrint, onExcel, onPdf, onCsv, onJson, menuLabel,
  templates = null, currentTemplateId = null, onOpenTemplate = null, onSaveTemplate = null, onDeleteTemplate = null,
  onRefresh, showEmptyColumns, onToggleEmptyColumns,
}) {
  return (
    <header className="rpt-mak__top">
      <div className="rpt-mak__heading">
        <h1 className="rpt-mak__title">{title}</h1>
        <p className="rpt-mak__subtitle">
          Análise e impressão
          {templateName ? <em> · modelo “{templateName}”</em> : null}
          {loading ? <span className="rpt-mak__busy" aria-live="polite"> · Calculando…</span> : null}
        </p>
      </div>
      <div className="rpt-mak__actions" role="group" aria-label="Imprimir e exportar">
        {onBack ? (
          <button type="button" className="rpt-mak-link" onClick={onBack} title={`Voltar para ${backLabel}`}>
            <ArrowLeft aria-hidden="true" />{backLabel}
          </button>
        ) : null}
        {canExport ? (
          <>
            <button type="button" className="rpt-mak-ghost" disabled={disabled} onClick={onExcel} title="Planilha Excel (XLSX) com a mesma tabela da folha">
              <FileSpreadsheet aria-hidden="true" />Excel
            </button>
            <button type="button" className="rpt-mak-ghost" disabled={disabled} onClick={onPdf} title="PDF A4 da folha">
              <FileText aria-hidden="true" />PDF
            </button>
          </>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="rpt-mak-ghost rpt-mak-ghost--icon" aria-label="Mais opções" title="Mais opções (CSV, JSON, modelo, atualizar)">
              <MoreHorizontal aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rpt-mak-menu">
            {canExport ? (
              <>
                <DropdownMenuLabel className="text-xs">{menuLabel}</DropdownMenuLabel>
                <DropdownMenuItem className="text-xs" disabled={disabled} onClick={onCsv}><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />CSV (Excel pt-BR)</DropdownMenuItem>
                <DropdownMenuItem className="text-xs" disabled={disabled} onClick={onJson}><FileJson className="h-3.5 w-3.5" aria-hidden="true" />JSON com manifesto</DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            {templates && onOpenTemplate ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs"><FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />Abrir modelo</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rpt-mak-menu rpt-mak-menu--templates">
                  {templates.length ? templates.map((template) => (
                    <DropdownMenuItem key={template.id} className="text-xs" disabled={template.id === currentTemplateId} onClick={() => onOpenTemplate(template)}>
                      {template.scope === "SHARED" ? <Users className="h-3.5 w-3.5" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}
                      {template.name}
                    </DropdownMenuItem>
                  )) : <DropdownMenuItem className="text-xs" disabled>Nenhum modelo salvo deste relatório</DropdownMenuItem>}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
            {onSaveTemplate ? <DropdownMenuItem className="text-xs" onClick={onSaveTemplate}><Save className="h-3.5 w-3.5" aria-hidden="true" />Salvar modelo…</DropdownMenuItem> : null}
            {onDeleteTemplate ? <DropdownMenuItem className="text-xs" onClick={onDeleteTemplate}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Excluir modelo “{templateName}”…</DropdownMenuItem> : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onClick={onRefresh}><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Atualizar (reler os dados)</DropdownMenuItem>
            <DropdownMenuCheckboxItem className="text-xs" checked={showEmptyColumns} onCheckedChange={onToggleEmptyColumns}>Mostrar colunas vazias</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {canExport ? (
          <button type="button" className="rpt-mak-print text-white" disabled={disabled} onClick={onPrint} title="Imprimir a folha (A4)">Imprimir</button>
        ) : null}
      </div>
    </header>
  );
}

/** Botão "Colunas…" do antigo (outline h-8 text-xs gap-1 com a engrenagem w-3.5). */
export function MakgestaoColumnsButton({ label, title, onClick }) {
  return (
    <button type="button" className="rpt-mak-btn rpt-mak-btn--icon" onClick={onClick} title={title ?? label}>
      <Settings aria-hidden="true" />{label}
    </button>
  );
}

/**
 * E1E: campo "Relatório" (primeiro do cartão) — o catálogo do perfil agrupado por família, como a lista em
 * cartões da 1.4.0. Trocar abre o outro relatório (ReportView → Relatorios.jsx, ?r=<id>).
 */
function ReportSelect({ value, options, onChange }) {
  const groups = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.family === option.family && !option.extra) last.items.push(option);
    else groups.push({ family: option.family, label: option.extra ? "Aberto por link" : option.familyLabel, items: [option] });
  }
  return (
    <div className="rpt-bar-field rpt-mak-field--report" data-field="relatorio">
      <span className="rpt-bar-field__label" id="rpt-bar-label-relatorio">Relatório</span>
      <Select value={value} onValueChange={(next) => next !== value && onChange(next)}>
        <SelectTrigger id="rpt-bar-relatorio" className="rpt-bar-field__control" aria-label="Relatório" aria-labelledby="rpt-bar-label-relatorio" title="Relatório">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rpt-mak-report-list">
          {groups.map((group) => (
            <SelectGroup key={`${group.family}-${group.items[0].value}`}>
              <SelectLabel className="rpt-mak-report-list__family">{group.label}</SelectLabel>
              {group.items.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Parâmetro inteiro do relatório (ex.: dias), com o rótulo em cima como as datas. */
function MakNumberField({ id, label, value, min, onChange }) {
  return (
    <div className="rpt-bar-field rpt-mak-field" data-field={`param-${id}`}>
      <label className="rpt-bar-field__label" htmlFor={`rpt-mak-param-${id}`}>{label}</label>
      <input id={`rpt-mak-param-${id}`} type="number" className="rpt-mak-input" min={min ?? undefined} value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} />
    </div>
  );
}

/**
 * Cartão de filtros do antigo (L519–757). Linha 1: grade de campos (Relatório | Data Início | Data Fim — ou
 * "Estado atual (hoje)" sem período | Orientação | Tipo Relatório | [Linhas | Colunas no Sintético] | Ordenar
 * Por | Pesagem Anterior | parâmetros). Depois os controles do tipo que ficam embaixo (Agrupar Por do
 * Analítico) e a linha de botões (filtros, filtros rápidos, Colunas, Limpar Filtros).
 * @param report E1E: { value, options, onChange } do campo "Relatório" ou null (fora de Relatórios).
 * @param params E1E: parâmetros inteiros [{ id, label, min, value, onChange }].
 * @param typeControls controles do tipo (ReportView): na grade (eixos da matriz) ou embaixo (Agrupar Por).
 * @param columnsButton { label, onClick } | null — só o "Colunas" do Analítico fica nesta linha (L733–755);
 *   os "Colunas Painel/Detalhes" do antigo ficavam na área da folha (L1146–1176, L1445–1466).
 */
export function MakgestaoFilterCard({
  report = null,
  period = null, resolvedPeriod = null, onPeriod,
  orientation, onOrientation,
  views, viewId, onView,
  typeControls = null, typeControlsInGrid = false,
  sortOptions, sortValue, onSort,
  previous = null, params = [],
  filterButtons = null, columnsButton = null, onClear, extras = null,
}) {
  const from = period?.preset === "personalizado" ? period.from : resolvedPeriod?.from;
  const to = period?.preset === "personalizado" ? period.to : resolvedPeriod?.to;
  // Trocar uma data vira período "Personalizado" com as duas datas (como a barra da 1.4.0).
  const setDate = (edge, value) => onPeriod({ preset: "personalizado", from: from ?? value, to: to ?? value, [edge]: value });
  const viewOptions = [...views.map((view) => ({ value: view.id, label: view.label })), ...(viewId === "custom" ? [{ value: "custom", label: "Personalizado" }] : [])];
  const sortChoices = sortValue === "custom" ? [...sortOptions, { value: "custom", label: "Personalizado" }] : sortOptions;
  return (
    <section className="rpt-mak__card" aria-label="Filtros do relatório">
      <div className="rpt-mak__grid" role="group" aria-label="Relatório, período, tipo e ordem">
        {report ? <ReportSelect {...report} /> : null}
        {onPeriod ? (
          <>
            <MakDateField id="inicio" label="Data Início" value={from} onChange={(value) => setDate("from", value)} />
            <MakDateField id="fim" label="Data Fim" value={to} onChange={(value) => setDate("to", value)} />
          </>
        ) : (
          <div className="rpt-bar-field rpt-mak-field" data-field="periodo">
            <span className="rpt-bar-field__label">Período</span>
            <span className="rpt-mak-input rpt-mak-static" title="Relatório do rebanho como está hoje (sem período)">Estado atual (hoje)</span>
          </div>
        )}
        <BarSelect id="orientacao" label="Orientação" value={makOrientation(orientation)} options={MAK_ORIENTATION_OPTIONS} onChange={onOrientation} title="Orientação da folha na impressão e no PDF" />
        <BarSelect id="tipo" label="Tipo Relatório" value={viewId} options={viewOptions} onChange={(value) => value !== "custom" && onView(value)} />
        {typeControlsInGrid ? typeControls : null}
        <BarSelect id="ordenar" label="Ordenar Por" value={sortValue} options={sortChoices} onChange={(value) => value !== "custom" && onSort(value)} />
        {previous ? <BarSelect id="anterior" label="Pesagem Anterior" value={previous.value} options={PREVIOUS_OPTIONS} onChange={previous.onChange} /> : null}
        {params.map((param) => <MakNumberField key={param.id} {...param} />)}
      </div>
      {!typeControlsInGrid && typeControls ? <div className="rpt-mak__type">{typeControls}</div> : null}
      <div className="rpt-mak__buttons" role="group" aria-label="Filtros">
        {filterButtons}
        {columnsButton ? <MakgestaoColumnsButton {...columnsButton} /> : null}
        <button type="button" className="rpt-mak-btn" onClick={onClear}>Limpar Filtros</button>
        {extras}
      </div>
    </section>
  );
}
