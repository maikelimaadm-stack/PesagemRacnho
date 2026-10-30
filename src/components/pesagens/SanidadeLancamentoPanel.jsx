import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, ChevronUp, Pencil, Plus, Syringe, X } from "lucide-react";
import { toast } from "sonner";
import { fmtDateBR, fmtInt, fmtNum } from "@/components/common/formatNumber";
import {
  PROGRAMA_TIPO_LABELS,
  UNIDADES_DOSE,
  VIAS_APLICACAO,
  VIA_LABELS,
  getDoseSuggestion,
  saveMedicamento,
  suggestedDose,
} from "@/modules/sanity/application/sanityService";
import MedicamentoFormDialog from "@/components/sanidade/MedicamentoFormDialog";
import PosologiaDialog from "@/components/sanidade/PosologiaDialog";
import { applyMedicamentoToDraft, clearPosologyFromDraft, formatDoseInput, newSanityDraft } from "@/modules/weighing/domain/launchContext";
import { createPageUrl } from "@/utils";
import "@/styles/launch-sanity-panel.css";
import "@/styles/launch-visual.css";

// Painel de Sanidade do Lançamento (ModeloBase1, mesmo padrão dos painéis de
// Compra/Venda/Abate). Não é obrigatório: sem aplicação, a pesagem é gravada
// sozinha. As aplicações seguem no payload `aplicacoes_sanidade` do createEntry e
// são gravadas pelo sanityService na mesma transação da pesagem. A dose padrão do
// medicamento só pré-preenche quando é um número; texto vira apenas sugestão.
// F09: com posologia APROVADA e vigente, mostra a dose sugerida pelo peso do animal (na pesagem
// automática, só com o peso ESTÁVEL do portão da Fase A). Usar a sugestão é escolha do operador e a
// dose aplicada exige confirmação; se o peso mudar, a dose calculada é desfeita.
const NENHUM = "__none__";

function PosologiaHint({ draft, numero, pesoBase, dataAplicacao, animalChave, versaoRegras, onChange }) {
  const [sug, setSug] = useState(null);
  const [erro, setErro] = useState(null);
  const kg = pesoBase?.kg;
  const pronto = Boolean(draft.medicamento_id) && kg > 0 && pesoBase?.estavel !== false;
  useEffect(() => {
    let ativo = true;
    setErro(null);
    if (!draft.medicamento_id) { setSug(null); return undefined; }
    // Sem peso pronto ainda se consulta a SITUAÇÃO da regra (sem posologia, rascunho…), sem calcular dose.
    getDoseSuggestion({ medicamentoId: draft.medicamento_id, peso: { kg: pronto ? kg : null, data: dataAplicacao, origem: pesoBase?.origem }, dataAplicacao })
      .then((r) => { if (ativo) setSug(r); })
      .catch((e) => { if (ativo) { setSug(null); setErro(e?.message || 'falha ao consultar a posologia'); } });
    return () => { ativo = false; };
  }, [pronto, draft.medicamento_id, kg, pesoBase?.origem, dataAplicacao, versaoRegras]);
  // A dose da regra vale para ESTE animal com ESTE peso estável: peso diferente, balança instável/desconectada ou
  // outro animal desfazem a sugestão usada e a confirmação (o operador recalcula e confirma de novo).
  useEffect(() => {
    if (!draft.posologia_id) return;
    const pesoMudou = String(draft.peso_base_kg) !== String(kg ?? '');
    const animalMudou = (draft.peso_base_animal || '') !== (animalChave || '');
    if (pesoMudou || animalMudou || !pronto) onChange((atual) => ({ ...clearPosologyFromDraft(atual), dose: '' }));
  }, [draft.posologia_id, draft.peso_base_kg, draft.peso_base_animal, kg, animalChave, pronto, onChange]);
  if (!draft.medicamento_id) return null;
  const situacao = sug?.situacaoLabel ? <span className="d17d-sanity-table__status" data-posologia-situacao={sug.situacao}>Posologia: {sug.situacaoLabel}. </span> : null;
  if (erro) return <tr className="d17d-sanity-table__hint is-error"><td colSpan={7}>Não foi possível consultar a posologia: {erro}</td></tr>;
  if (sug && sug.situacao && sug.situacao !== 'APROVADA') {
    return <tr className="d17d-sanity-table__hint"><td colSpan={7}>{situacao}{sug.bloqueios[0]} Dose manual (sem cálculo por peso).</td></tr>;
  }
  if (!pronto) {
    return <tr className="d17d-sanity-table__hint"><td colSpan={7}>{situacao}{pesoBase?.estavel === false ? 'Dose pela posologia: aguardando peso estável da balança.' : 'Dose pela posologia: informe o peso do animal.'}</td></tr>;
  }
  if (!sug) return null;
  if (!sug.ok) {
    return <tr className="d17d-sanity-table__hint"><td colSpan={7}>{situacao}{sug.bloqueios[0]} Dose manual.</td></tr>;
  }
  const usar = () => onChange((atual) => ({
    ...atual,
    dose: formatDoseInput(sug.dose),
    unidade: sug.unidade || atual.unidade,
    via_aplicacao: sug.via || atual.via_aplicacao,
    posologia_id: sug.posologia.id,
    dose_sugerida: String(sug.dose),
    peso_base_kg: String(kg),
    peso_base_data: dataAplicacao,
    peso_base_origem: pesoBase.origem,
    peso_base_animal: animalChave || '',
    dose_confirmada: '',
  }));
  return (
    <tr className="d17d-sanity-table__hint" data-dose-sugerida={sug.dose}>
      <td colSpan={7}>
        {situacao}
        <span>Dose sugerida: <strong>{fmtNum(sug.dose)} {sug.unidade}</strong> ({sug.regra}; peso {fmtInt(kg)} kg {pesoBase.origem === 'BALANCA' ? 'estável da balança' : 'digitado'}).</span>
        {sug.avisos.length ? <span> {sug.avisos.join(' ')}</span> : null}
        {!draft.posologia_id ? (
          <Button type="button" variant="outline" size="sm" className="ml-2" onClick={usar} aria-label={`Usar dose sugerida na aplicação ${numero}`}>Usar dose sugerida</Button>
        ) : (
          <Label className="ml-2 inline-flex items-center gap-1">
            <Checkbox checked={draft.dose_confirmada === 'true'} onCheckedChange={(checked) => onChange((atual) => ({ ...atual, dose_confirmada: checked === true ? 'true' : '' }))} aria-label={`Confirmo a dose aplicada na aplicação ${numero}`} />
            <span>Confirmo a dose aplicada{draft.dose ? ` (${draft.dose} ${draft.unidade || ''})` : ''}</span>
          </Label>
        )}
      </td>
    </tr>
  );
}

export default function SanidadeLancamentoPanel({
  aplicacoes = [],
  onAplicacoesChange,
  sequencia = false,
  onSequenciaChange,
  programas = [],
  medicamentos = [],
  catalogoCarregado = false,
  erroCatalogo = false,
  modoEdicao = false,
  aplicacoesRegistradas = [],
  onRecolher,
  pesoBase = null,
  dataAplicacao = null,
  animalChave = "",
  podeCadastrar = false,
  empresaId = null,
  onCatalogoAtualizado,
}) {
  const semCadastros = catalogoCarregado && !erroCatalogo && programas.length === 0 && medicamentos.length === 0;
  const medicamentoPorId = (id) => medicamentos.find((item) => item.id === id) || null;
  // Cadastro no contexto do curral (registry.write): medicamento e posologia em diálogo, sem sair do lançamento.
  const [dialogMedicamento, setDialogMedicamento] = useState(null); // { record, linhaKey }
  const [dialogPosologia, setDialogPosologia] = useState(null); // medicamento
  const [salvandoMedicamento, setSalvandoMedicamento] = useState(false);
  const [versaoRegras, setVersaoRegras] = useState(0);
  const salvarMedicamento = async (input) => {
    setSalvandoMedicamento(true);
    try {
      const salvo = await saveMedicamento(input);
      toast.success(dialogMedicamento?.record ? 'Medicamento atualizado.' : 'Medicamento cadastrado.');
      await onCatalogoAtualizado?.();
      // Novo a partir de uma linha: já fica escolhido nela (unidade/via do cadastro; dose continua do operador).
      const linha = dialogMedicamento?.linhaKey;
      if (!dialogMedicamento?.record && salvo?.id) {
        if (linha) atualizar(linha, (atual) => applyMedicamentoToDraft(atual, salvo, suggestedDose(salvo)));
        else onAplicacoesChange?.([...aplicacoes, applyMedicamentoToDraft(newSanityDraft(), salvo, suggestedDose(salvo))]);
      }
      setVersaoRegras((v) => v + 1);
      setDialogMedicamento(null);
    } catch (error) {
      toast.error(error?.message || 'Não foi possível salvar o medicamento.');
    } finally {
      setSalvandoMedicamento(false);
    }
  };

  const atualizar = (key, alterar) => {
    onAplicacoesChange?.(aplicacoes.map((draft) => (draft.key === key ? alterar(draft) : draft)));
  };
  const adicionar = () => onAplicacoesChange?.([...aplicacoes, newSanityDraft()]);
  const remover = (key) => onAplicacoesChange?.(aplicacoes.filter((draft) => draft.key !== key));
  const escolherMedicamento = (draft, id) => {
    const medicamento = id === NENHUM ? null : medicamentoPorId(id);
    atualizar(draft.key, (atual) => applyMedicamentoToDraft(atual, medicamento, medicamento ? suggestedDose(medicamento) : null));
  };

  return (
    <div className="d17d-detail-panel d17d-sanity-panel" data-launch-panel="sanidade">
      <div className="d17d-sanity-panel__head">
        <Syringe className="w-4 h-4" aria-hidden="true" />
        <strong>Sanidade</strong>
        {!modoEdicao && aplicacoes.length > 0 && (
          <span className="d17d-sanity-panel__count">· {fmtInt(aplicacoes.length)} {aplicacoes.length === 1 ? 'aplicação' : 'aplicações'}</span>
        )}
        <span className="d17d-sanity-panel__actions">
          {!modoEdicao && (
            <Label htmlFor="sanidade-sequencia-lancamento" className="d17d-sanity-panel__sequence">
              <Checkbox
                id="sanidade-sequencia-lancamento"
                checked={sequencia}
                onCheckedChange={(checked) => onSequenciaChange?.(checked === true)}
                aria-label="Aplicar esta configuração aos próximos animais"
              />
              <span>Aplicar esta configuração aos próximos animais</span>
            </Label>
          )}
          {!modoEdicao && podeCadastrar && (
            <Button type="button" variant="outline" size="sm" className="d17d-sanity-panel__add" onClick={() => setDialogMedicamento({ record: null, linhaKey: null })}>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Novo medicamento
            </Button>
          )}
          {!modoEdicao && (
            <Button type="button" variant="outline" size="sm" className="d17d-sanity-panel__add" onClick={adicionar} disabled={semCadastros}>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Adicionar aplicação
            </Button>
          )}
          <Button type="button" variant="outline" size="icon" className="d17d-icon-action d17d-sanity-panel__icon" onClick={onRecolher} aria-label="Recolher painel de Sanidade" title="Recolher painel de Sanidade">
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </Button>
        </span>
      </div>

      {modoEdicao ? (
        <div className="d17d-sanity-panel__readonly">
          <p>
            Aplicações registradas com esta pesagem (somente leitura). Atualizar a pesagem não altera as aplicações; para cancelar uma aplicação, use a tela Sanidade.
          </p>
          {aplicacoesRegistradas.length === 0 ? (
            <p className="text-slate-500">Nenhuma aplicação registrada com esta pesagem.</p>
          ) : (
            <ul>
              {aplicacoesRegistradas.map((aplicacao) => (
                <li key={aplicacao.id} className={aplicacao.cancelled_at ? 'text-slate-400 line-through' : 'text-slate-700'}>
                  {fmtDateBR(aplicacao.data)} · {aplicacao.programa_nome || '-'} · {aplicacao.medicamento_nome || '-'}
                  {aplicacao.dose != null ? ` · ${fmtNum(aplicacao.dose)} ${aplicacao.unidade || ''}` : ''}
                  {aplicacao.via_aplicacao ? ` · ${VIA_LABELS[aplicacao.via_aplicacao] || aplicacao.via_aplicacao}` : ''}
                  {aplicacao.cancelled_at ? ' · Cancelada' : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="d17d-sanity-panel__body">
          {erroCatalogo && (
            <p className="d17d-sanity-panel__message is-error">Não foi possível carregar os programas e medicamentos de sanidade.</p>
          )}
          {semCadastros && (
            <p className="d17d-sanity-panel__message">
              Nenhum programa ou medicamento ativo. {podeCadastrar
                ? <>Use <strong>Novo medicamento</strong> aqui mesmo (ou a <Link to={createPageUrl("Sanidade")} className="font-medium text-emerald-800 underline">tela Sanidade</Link>, para programas).</>
                : <>Peça a um gestor para cadastrar na <Link to={createPageUrl("Sanidade")} className="font-medium text-emerald-800 underline">tela Sanidade</Link>.</>}
            </p>
          )}
          {!semCadastros && (
            <table className="d17d-sanity-table">
              <colgroup>
                <col className="is-program" /><col className="is-product" /><col className="is-dose" /><col className="is-unit" /><col className="is-via" /><col /><col className="is-action" />
              </colgroup>
              <thead>
                <tr>
                  <th>Programa/Procedimento</th>
                  <th>Medicamento/Produto</th>
                  <th>Dose aplicada</th>
                  <th>Unidade</th>
                  <th>Via</th>
                  <th>Observação</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {aplicacoes.length === 0 && (
                  <tr><td colSpan={7} className="d17d-sanity-table__empty">Nenhuma aplicação para este animal. O registro de sanidade é opcional.</td></tr>
                )}
                {aplicacoes.map((draft, index) => {
                  const medicamento = draft.medicamento_id ? medicamentoPorId(draft.medicamento_id) : null;
                  const sugestaoTexto = medicamento?.dose_padrao && suggestedDose(medicamento) == null ? medicamento.dose_padrao : '';
                  const alterarDraft = (alterar) => atualizar(draft.key, alterar);
                  const numero = index + 1;
                  return (
                    <React.Fragment key={draft.key}>
                      <tr className="d17d-sanity-row" aria-label={`Aplicação de sanidade ${numero}`}>
                        <td>
                          <Select value={draft.programa_sanidade_id || NENHUM} onValueChange={(value) => atualizar(draft.key, (atual) => ({ ...atual, programa_sanidade_id: value === NENHUM ? '' : value }))}>
                            <SelectTrigger aria-label={`Programa da aplicação ${numero}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NENHUM}>Nenhum</SelectItem>
                              {programas.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}{PROGRAMA_TIPO_LABELS[item.tipo] ? ` · ${PROGRAMA_TIPO_LABELS[item.tipo]}` : ''}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td>
                          <Select value={draft.medicamento_id || NENHUM} onValueChange={(value) => escolherMedicamento(draft, value)}>
                            <SelectTrigger aria-label={`Medicamento da aplicação ${numero}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NENHUM}>Nenhum</SelectItem>
                              {medicamentos.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <span className="d17d-sanity-row__tools">
                            <button type="button" className="d17d-sanity-table__tool" disabled={!medicamento} onClick={() => setDialogMedicamento({ record: medicamento, linhaKey: draft.key })} aria-label={`${podeCadastrar ? 'Editar' : 'Consultar'} medicamento da aplicação ${numero}`} title={podeCadastrar ? 'Editar medicamento' : 'Consultar medicamento'}>
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button type="button" className="d17d-sanity-table__tool" disabled={!medicamento} onClick={() => setDialogPosologia(medicamento)} aria-label={`${podeCadastrar ? 'Configurar' : 'Consultar'} posologia da aplicação ${numero}`} title={podeCadastrar ? 'Configurar posologia' : 'Consultar posologia'}>
                              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </span>
                        </td>
                        <td>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={draft.dose}
                            onChange={(e) => { const dose = e.target.value; atualizar(draft.key, (atual) => ({ ...atual, dose, ...(atual.posologia_id ? { dose_confirmada: '' } : {}) })); }}
                            placeholder="Ex: 5"
                            aria-label={`Dose da aplicação ${numero}`}
                            title={sugestaoTexto ? `Sugestão: ${sugestaoTexto}` : undefined}
                          />
                        </td>
                        <td>
                          <Select value={draft.unidade || NENHUM} onValueChange={(value) => atualizar(draft.key, (atual) => ({ ...atual, unidade: value === NENHUM ? '' : value }))}>
                            <SelectTrigger aria-label={`Unidade da aplicação ${numero}`}><SelectValue placeholder="-" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NENHUM}>-</SelectItem>
                              {UNIDADES_DOSE.map((unidade) => <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td>
                          <Select value={draft.via_aplicacao || NENHUM} onValueChange={(value) => atualizar(draft.key, (atual) => ({ ...atual, via_aplicacao: value === NENHUM ? '' : value }))}>
                            <SelectTrigger aria-label={`Via da aplicação ${numero}`}><SelectValue placeholder="-" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NENHUM}>-</SelectItem>
                              {VIAS_APLICACAO.map((via) => <SelectItem key={via} value={via}>{VIA_LABELS[via] || via}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td>
                          <Input
                            value={draft.observacao}
                            onChange={(e) => { const observacao = e.target.value; atualizar(draft.key, (atual) => ({ ...atual, observacao })); }}
                            placeholder="Obs. da aplicação..."
                            aria-label={`Observação da aplicação ${numero}`}
                          />
                        </td>
                        <td className="d17d-sanity-table__action">
                          <button type="button" className="d17d-sanity-table__remove" onClick={() => remover(draft.key)} aria-label={`Remover aplicação ${numero}`} title="Remover aplicação">
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                      {sugestaoTexto && (
                        <tr className="d17d-sanity-table__hint"><td colSpan={7}>Referência do cadastro (texto, não calcula pelo peso): {sugestaoTexto}</td></tr>
                      )}
                      <PosologiaHint draft={draft} numero={numero} pesoBase={pesoBase} dataAplicacao={dataAplicacao} animalChave={animalChave} versaoRegras={versaoRegras} onChange={alterarDraft} />
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      <MedicamentoFormDialog
        open={Boolean(dialogMedicamento)}
        record={dialogMedicamento?.record || null}
        readOnly={!podeCadastrar}
        busy={salvandoMedicamento}
        unidades={UNIDADES_DOSE}
        vias={VIAS_APLICACAO}
        viaLabels={VIA_LABELS}
        empresaId={empresaId}
        onOpenChange={(open) => { if (!open) setDialogMedicamento(null); }}
        onSubmit={salvarMedicamento}
      />
      <PosologiaDialog
        open={Boolean(dialogPosologia)}
        medicamento={dialogPosologia}
        medicamentos={medicamentos}
        canWrite={podeCadastrar}
        onOpenChange={(open) => { if (!open) setDialogPosologia(null); }}
        onChanged={() => setVersaoRegras((v) => v + 1)}
      />
    </div>
  );
}
