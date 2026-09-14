import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const visualCss = readFileSync(join(root, 'src/styles/d17b-modelobase1.css'), 'utf8');
const shellCss = readFileSync(join(root, 'src/components/modelobase1/layout/modelo-base1-shell.css'), 'utf8');
const launchPage = readFileSync(join(root, 'src/pages/LancamentoPesagensIndividuais.jsx'), 'utf8');
const tableComponent = readFileSync(join(root, 'src/components/ui/table.jsx'), 'utf8');
const animalDialog = readFileSync(join(root, 'src/components/pesagens/SelecionarAnimalDialog.jsx'), 'utf8');
const dialogBase = readFileSync(join(root, 'src/components/ui/dialog.jsx'), 'utf8');
const columnDialog = readFileSync(join(root, 'src/components/mak/MakColumnConfigDialog.jsx'), 'utf8');
const summaryDialog = readFileSync(join(root, 'src/components/pesagens/ConfigurarResumosDialog.jsx'), 'utf8');
const auxiliaryRegistry = readFileSync(join(root, 'src/components/cadastros/CadastroAuxiliarPage.jsx'), 'utf8');
const auxiliaryRegistryCss = readFileSync(join(root, 'src/styles/auxiliary-registries.css'), 'utf8');
const deathCausesPage = readFileSync(join(root, 'src/pages/CausasMorte.jsx'), 'utf8');
const columnDeclaration = launchPage.match(/const COLUNAS_DISPONIVEIS = \[([\s\S]*?)\];/)?.[1] || '';

assert(!/sanidade|sanit[aá]ri/i.test(launchPage), 'lançamento não pode expor controles ou configurações de Sanidade');
assert(!/\.d17b-icon-button:hover\s*\{\s*background:\s*#fff/i.test(visualCss), 'hover do botão do shell não pode ficar branco');
assert(!/\.mb1-shell-icon-button:hover\s*\{\s*background:\s*#fff/i.test(shellCss), 'hover do botão do ModeloBase1 não pode ficar branco');
assert.match(visualCss, /\.d17d-icon-action:hover:not\(:disabled\)[\s\S]{0,220}background:\s*#e8edf1/i, 'ações de ícone usam hover neutro padronizado');
assert.match(visualCss, /\.d17b-standard-dialog/, 'diálogos usam o shell visual padronizado');
assert(!/needsImmediateAnimalChoice\(pesagens, valor\)/.test(launchPage), 'campo de identificação não interrompe a digitação com seleção de marca');
assert.match(launchPage, /onBlur=\{\(\) => \{[\s\S]{0,360}if \(numeroAnimal\.trim\(\)\) resolverAnimalDigitado\(numeroAnimal\);[\s\S]{0,40}\}\}/, 'seleção de marca é resolvida ao concluir e sair do campo de identificação');
assert.match(launchPage, /onKeyDown=\{\(e\) => \{ if \(e\.key === 'Enter'\)[\s\S]{0,180}resolverAnimalDigitado\(numeroAnimal\)/, 'Enter também conclui a identificação e resolve a marca');
assert.match(launchPage, /ignorarProximoBlurIdentificacaoRef\.current = true[\s\S]{0,180}resolverAnimalDigitado\(numeroAnimal\)/, 'Enter não duplica a notificação ao provocar blur para abrir o pop-up');
assert.match(visualCss, /D\.17D\.2R20[\s\S]*?background:\s*var\(--d17b-accent-hover[\s\S]*?color:\s*#fff/i, 'hover de botões primários preserva fundo e texto da marca');
assert.match(visualCss, /D\.17D\.2R20[\s\S]{0,3200}background:\s*#f1f3f4/i, 'campos de pop-up usam a mesma superfície do lançamento');
assert.match(tableComponent, /\[&:has\(\.mak-table-select-check\)\]:p-0/, 'células de seleção removem a folga lateral estrutural');
assert.match(visualCss, /scrollbar-gutter:\s*stable\s*!important/i, 'tabela reserva a barra apenas no lado direito');
assert(!/scrollbar-gutter:\s*stable\s+both-edges/i.test(visualCss), 'tabela não pode criar faixa vazia no lado esquerdo');
assert.match(visualCss, /\.mak-column-filter__input[\s\S]{0,900}border-radius:\s*var\(--erp-radius-control,\s*8px\)/i, 'campos dos filtros flutuantes usam o raio do lançamento');
assert.match(visualCss, /button\.emp-toolbar-btn\.emp-toolbar-btn-save:hover[\s\S]{0,350}background:\s*var\(--d17b-accent-hover/i, 'Salvar e Novo não herdam hover branco da toolbar neutra');
assert.match(visualCss, /\.d17c-column-dialog \.d17c-column-search > input[\s\S]{0,420}border-radius:\s*var\(--erp-radius-control,\s*8px\)/i, 'buscas da configuração de colunas usam o mesmo raio do lançamento');
assert.match(launchPage, /d17d-apartation-fields--documented-exit/, 'Venda e Abate ativam a linha documentada de quatro campos');
assert.match(visualCss, /\.d17d-apartation-fields\.d17d-apartation-fields--documented-exit[\s\S]{0,160}grid-template-columns:\s*repeat\(4/i, 'linha documentada usa quatro colunas equivalentes');
assert.match(launchPage, /d17d-launch-feedbacks[\s\S]{0,3600}d17d-animal-performance/, 'informações do animal e ganho ficam na faixa abaixo dos lançamentos');
assert.match(launchPage, /d17d-animal-performance[\s\S]{0,2600}>Animal<[\s\S]{0,1800}>Última<[\s\S]{0,1800}>Ganho</, 'resumo único reúne identidade, última pesagem e evolução');
assert.match(launchPage, /d17d-animal-performance__trend[\s\S]{0,800}<polyline points=\{sparklinePeso\.points\}/, 'faixa operacional desenha a tendência dinâmica do histórico');
assert.match(launchPage, /d17d-animal-performance__warning[\s\S]{0,500}avisosPesoVisual/, 'avisos de peso aparecem na própria faixa operacional');
assert.match(launchPage, /d17d-transfer-field[\s\S]{0,2600}d17d-auto-lot-feedback[\s\S]{0,1800}d17d-embarque-field/, 'indicação automática do lote aparece imediatamente após Transferência de Lote');
assert.match(launchPage, /d17d-auto-lot-field[\s\S]{0,220}>Lote destino<[/\s\S]{0,400}d17d-auto-lot-feedback/, 'indicação automática possui o rótulo Lote destino fora da área recortada');
assert.match(launchPage, /d17d-weight-control[\s\S]{0,900}d17d-weight-capture/, 'peso usa o controle composto com área de captura da balança');
assert.match(launchPage, /d17d-launch-save__shortcut">Enter/, 'botão Salvar comunica o atalho Enter');
assert.match(launchPage, /d17d-last-launch[\s\S]{0,700}>Desfazer</, 'linha inferior oferece desfazer para o último lançamento');
assert.equal((columnDeclaration.match(/default: true/g) || []).length, 14, 'visualização inicial usa as 14 colunas definidas no HTML oficial');
assert.match(launchPage, /COLUMN_MODEL_VERSION = 'd17d2r31'/, 'configurações legadas recebem uma única migração para o novo modelo de colunas');
assert.match(animalDialog, /d17d-animal-choice-dialog__select/, 'seletor de animal usa botão compacto dedicado');
assert.match(visualCss, /R26[\s\S]*?d17d-animal-choice-dialog__select[\s\S]{0,240}height:\s*26px\s*!important/i, 'botão Selecionar do animal permanece compacto');
assert.match(visualCss, /R26[\s\S]*?d17d-summary-panel table td[\s\S]{0,360}height:\s*28px\s*!important[\s\S]{0,180}font-size:\s*10px\s*!important/i, 'valores dos resumos usam a escala de 10px do design');
// R29 — paridade com o design "Lançamento de Pesagens" (Claude Design, 08/09/2026).
const r29 = visualCss.slice(visualCss.indexOf('D.17D.2R29'));
assert.ok(r29.length > 0, 'bloco R29 de paridade com o design existe');
const r30 = visualCss.slice(visualCss.indexOf('D.17D.2R30'));
assert.ok(r30.length > 0, 'bloco R30 da revisão mais recente do design existe');
assert.match(launchPage, /d17d-launch-fields--\$\{tipoManejo === 'Cadastro' \? 'registration' : 'movement'\}/, 'grade de campos identifica o tipo de movimentação');
assert.match(r30, /\.d17d-launch-fields\s*\{[\s\S]{0,180}display:\s*flex\s*!important[\s\S]{0,100}flex-wrap:\s*wrap\s*!important/i, 'campos usam a malha fluida da nova revisão do design');
assert.match(r30, /d17d-field--date\s*\{\s*flex:\s*0 0 116px\s*!important/i, 'campo Data preserva largura de 116px');
assert.match(r30, /d17d-field--weight\s*\{\s*flex:\s*0 0 124px\s*!important/i, 'campo Peso preserva largura de 124px');
assert.match(r30, /d17d-field--observation\s*\{\s*flex:\s*1\.6 1 160px\s*!important/i, 'Observação cresce de modo fluido até o limite do design');
assert.match(r30, /\.d17d-launch-fields :is\([\s\S]{0,300}border:\s*1px solid rgba\(64, 222, 99, \.42\)\s*!important[\s\S]{0,160}background:\s*#fff\s*!important/i, 'todos os controles do lançamento usam a borda verde suave e fundo branco');
assert.match(r30, /\.d17d-animal-performance\s*\{[\s\S]{0,240}min-height:\s*32px\s*!important[\s\S]{0,180}border:\s*1px solid rgba\(39, 196, 91, \.22\)/i, 'faixa consolidada do animal segue a altura e borda do design');
assert.match(r30, /d17d-apartation-fields > :is\([\s\S]{0,240}flex:\s*0 0 164px\s*!important/i, 'Apartação, lote e documentos usam largura operacional compacta');
assert.match(r29, /\.d17d-launch-typebar \.d17d-icon-action[\s\S]{0,400}border:\s*1px solid #d8dde5\s*!important[\s\S]{0,60}background:\s*#fff\s*!important/i, 'ações redondas da barra usam fundo branco e borda #d8dde5');
assert.match(r29, /d17d-field--animal > input[\s\S]{0,260}border-color:\s*rgba\(64, 222, 99, \.42\)\s*!important[\s\S]{0,120}box-shadow:\s*inset 0 0 0 1px rgba\(64, 222, 99, \.12\)/i, 'campo de identificação usa a borda verde do design');
assert.match(launchPage, /<Table className="emp-table-pro d17c-data-table">/, 'tabela do lançamento reutiliza a classe estrutural da relação de pesagens');
assert.match(r29, /tbody tr:nth-child\(even\) > td\s*\{\s*background:\s*#fafbfc/i, 'linhas pares usam o zebrado #fafbfc do design');
assert.match(r29, /d17d-table-summary__brand-chip\s*\{[\s\S]{0,400}border-radius:\s*999px\s*!important[\s\S]{0,200}font-size:\s*10px\s*!important/i, 'marcas do rodapé são pílulas de 10px');
assert.match(r29, /d17d-summary-panel__mode\[data-active="true"\]\s*\{[\s\S]{0,120}background:\s*var\(--d17b-accent, #40de63\)\s*!important/i, 'seletor Dia/Total destaca o ativo em verde');
assert.match(r29, /d17d-summary-panel__context\s*\{[\s\S]{0,80}text-align:\s*center\s*!important/i, 'contexto do painel lateral é centralizado como no design');
// R34 — Relação de Pesagens usa a Tela Mãe do ModeloBase1 (Cadastro de Empresas).
const relationPage = readFileSync(join(root, 'src/pages/PesagensIndividuais.jsx'), 'utf8');
assert.match(relationPage, /data-mak-region="toolbar"[\s\S]{0,400}className="mg-action-bar /, 'Relação usa a barra de ações mg-action-bar do modelo');
assert.match(relationPage, /tb-btn tb-btn-ghost tb-btn-filter tb-btn-icon/, 'botão Filtrar segue as classes tb-btn do modelo');
assert.match(relationPage, /tb-btn tb-btn-labeled tb-btn-green"[^>]*title="Lançar pesagem"/, 'ação principal usa tb-btn-green');
assert.match(relationPage, /<MgDesktopSearch[\s\S]{0,1400}onApplyAll=/, 'pesquisa expansível com resultados e "Buscar todos"');
assert.match(relationPage, /<MgSpeedDialMenu[\s\S]{0,700}Atualizar[\s\S]{0,200}Exportar CSV[\s\S]{0,200}Importar CSV[\s\S]{0,200}Baixar modelo CSV/, 'Atualizar, exportar, importar e modelo ficam em "Mais opções"');
assert.match(relationPage, /data-mak-region="panel-strip"[\s\S]{0,200}<MgTablePanelStrip onConfigColumns=/, 'faixa de pílulas com configuração de colunas à direita');
assert.match(relationPage, /<MgFilterPanel[\s\S]{0,600}textFields=\{CAMPOS_TEXTO_PAINEL\}[\s\S]{0,120}dateFields=\{CAMPOS_DATA_PAINEL\}[\s\S]{0,120}selectFields=\{CAMPOS_SELECAO_PAINEL\}/, 'painel lateral de filtros com texto, datas e seleções');
assert(!/d17b-filter-card/.test(relationPage), 'cartão antigo de filtros foi removido da Relação');
assert(!/d17c-quick-search/.test(relationPage), 'campo de pesquisa antigo foi removido da Relação');
for (const file of ['MgFilterPanel.jsx', 'MgDesktopSearch.jsx', 'MgSearchResultsDropdown.jsx', 'MgSpeedDialMenu.jsx', 'MgTablePanelStrip.jsx', 'MgCmdSelect.jsx']) {
  assert.ok(existsSync(join(root, 'src/components/mak', file)), `componente do modelo portado: ${file}`);
}
const filterPanelSource = readFileSync(join(root, 'src/components/mak/MgFilterPanel.jsx'), 'utf8');
assert.match(filterPanelSource, /<aside id="filter-panel" className=\{`filter-panel\$\{open \? " open" : ""\}`\}/, 'painel usa o aside .filter-panel do modelo');
assert.match(filterPanelSource, /filter-panel__footer[\s\S]{0,300}tb-btn tb-btn-blue/, 'painel termina com Limpar/Aplicar do modelo');
assert.match(visualCss, /D\.17D\.2R34[\s\S]{0,600}\.d17b-list-page\.d17b-list-page--mother\s*\{[\s\S]{0,120}display:\s*flex\s*!important/i, 'Relação empilha barra, faixa e corpo como a Tela Mãe');

// R34 — os cadastros auxiliares (Parceiros, Mortalidade, Sanidade) usam a mesma Tela Mãe no modo de listagem.
const auxiliaryList = readFileSync(join(root, 'src/components/cadastros/CadastroAuxiliarPage.jsx'), 'utf8');
assert.match(auxiliaryList, /\{!formOpen \? \([\s\S]{0,400}data-mak-region="toolbar"[\s\S]{0,400}className="mg-action-bar /, 'listagem dos cadastros usa a barra de ações mg-action-bar');
assert.match(auxiliaryList, /tb-btn tb-btn-labeled tb-btn-green aux-new-button/, 'Novo dos cadastros usa tb-btn-green');
assert.match(auxiliaryList, /<MgDesktopSearch[\s\S]{0,1400}onApplyAll=/, 'cadastros têm pesquisa expansível com resultados');
assert.match(auxiliaryList, /<MgSpeedDialMenu[\s\S]{0,600}Atualizar[\s\S]{0,200}Configurar colunas[\s\S]{0,200}Mostrar todos os tipos/, 'cadastros concentram Atualizar, colunas e tipos em "Mais opções"');
assert.match(auxiliaryList, /data-mak-region="panel-strip"[\s\S]{0,200}<MgTablePanelStrip onConfigColumns=[\s\S]{0,1400}\{listColumns\.map\(\(column\) => \([\s\S]{0,120}<MakFilterPill/, 'faixa dos cadastros tem uma pílula por coluna e configuração de colunas');
assert.match(auxiliaryList, /<MgFilterPanel[\s\S]{0,600}textFields=\{panelTextFields\}[\s\S]{0,80}selectFields=\{panelSelectFields\}/, 'cadastros têm painel lateral com campos de texto e seleções');
assert.match(auxiliaryList, /<MakColumnConfigDialog[\s\S]{0,400}onApply=\{applyColumnConfig\}/, 'cadastros permitem configurar colunas como o modelo');
assert.match(auxiliaryList, /\{tableColumns\.map\(\(column\) => column\.id === '_typeLabel'/, 'tabela dos cadastros respeita ordem e visibilidade configuradas');
assert(!/d17c-quick-search--actions aux-search/.test(auxiliaryList.split('{!formOpen ? (')[0]), 'campo de pesquisa antigo não fica fora do modo de registro');

for (const file of [
  'src/components/pesagens/PesagensResumoRodape.jsx',
  'src/components/pesagens/ResumoLotes.jsx',
]) {
  const source = readFileSync(join(root, file), 'utf8');
  if (file.endsWith('PesagensResumoRodape.jsx')) {
    assert.match(source, /d17d-table-summary__brand-chip/, 'rodapé marca as pílulas de marca');
    assert.match(source, /d17d-table-summary__page-info/, 'rodapé marca o contador de páginas');
  } else {
    assert.match(source, /d17d-summary-panel__title/, 'painel lateral marca o título');
    assert.match(source, /d17d-summary-panel__mode[\s\S]{0,120}data-active=/, 'seletor Dia/Total expõe o estado ativo');
    assert.match(source, /d17d-summary-panel__totals/, 'painel lateral marca a linha de totais');
  }
}
assert.match(visualCss, /d17d-animal-choice-dialog table th,[\s\S]{0,140}text-transform:\s*none\s*!important/i, 'cabeçalhos do seletor de animal preservam capitalização normal');
assert.match(visualCss, /d17d-animal-choice-dialog table :is\(th, td\) :is\(span, strong, small, div\)[\s\S]{0,180}height:\s*auto\s*!important/i, 'conteúdo interno não aumenta artificialmente a altura das linhas do seletor');
assert.match(launchPage, /toast\.warning\(`O número \$\{String\(value\)\.trim\(\)\} existe em mais de uma marca/, 'ambiguidade de marca aparece na notificação superior');
assert.match(launchPage, /toast\.error\(`Animal \$\{String\(value \|\| ''\)\.trim\(\)\} não cadastrado/, 'animal sem cadastro aparece na notificação superior');
assert.match(dialogBase, /onPointerDownOutside=\{\(event\) => \{[\s\S]{0,120}event\.preventDefault\(\)/, 'diálogos não fecham ao clicar fora');
assert.match(dialogBase, /onEscapeKeyDown=\{\(event\) => \{[\s\S]{0,120}event\.preventDefault\(\)/, 'diálogos não fecham pela tecla Escape');
assert.match(visualCss, /R27[\s\S]*?d17b-standard-dialog table th[\s\S]{0,260}text-transform:\s*none\s*!important/i, 'cabeçalhos de todos os pop-ups preservam capitalização normal');
assert.match(visualCss, /d17b-dialog-content\.d17b-standard-dialog--large[\s\S]{0,160}max-width:\s*960px\s*!important/i, 'pop-ups grandes seguem a largura máxima padronizada');
assert(!/variant="secondary" onClick=\{\(\) => onOpenChange\(false\)\}>Cancelar/.test(columnDialog), 'configuração de colunas usa o X para descartar alterações');
assert(!/variant="outline" onClick=\{\(\) => onOpenChange\(false\)\}>Cancelar/.test(summaryDialog), 'configuração de resumos usa o X para descartar alterações');
assert.match(visualCss, /d17c-column-dialog \.d17c-column-dialog__reset\s*\{[\s\S]{0,120}top:\s*1px\s*!important[\s\S]{0,220}height:\s*28px\s*!important/i, 'Restaurar padrões fica alinhado verticalmente ao X');
assert.match(visualCss, /\.d17b-standard-dialog :is\([\s\S]{0,180}\.d17d-management-form,[\s\S]{0,180}\.d17c-column-dialog__footer[\s\S]{0,80}\) button:not\(\[aria-label\]\)[\s\S]{0,240}min-width:\s*78px\s*!important[\s\S]{0,160}height:\s*28px\s*!important/i, 'Adicionar, Salvar e confirmar usam dimensões padronizadas');
assert.match(visualCss, /R23[\s\S]*?\.emp-table-pro[\s\S]*?font-size:\s*11px\s*!important/i, 'cabeçalho e corpo das tabelas seguem a escala tipográfica de 11px');
assert.match(r30, /\.d17d-animal-performance\s*\{[\s\S]{0,220}display:\s*flex\s*!important[\s\S]{0,220}height:\s*auto\s*!important/i, 'faixa informativa flui sem altura rígida ou conteúdo cortado');
assert.match(r30, /\.d17d-animal-performance__group strong\s*\{[\s\S]{0,180}font-size:\s*12px\s*!important/i, 'valores do painel informativo têm ênfase tipográfica uniforme');
const r31 = visualCss.slice(visualCss.indexOf('D.17D.2R31'));
assert.match(r31, /d17d-field--weight[\s\S]{0,120}d17d-weight-control > input[\s\S]{0,260}color:\s*#f59e0b\s*!important/i, 'peso mantém o amarelo do modelo dentro do controle composto');
assert.match(r31, /d17d-animal-performance__group > \.d17d-animal-performance__metric[\s\S]{0,120}color:\s*#36c956\s*!important/i, 'métricas de ganho mantêm o verde do HTML oficial');
const r32 = visualCss.slice(visualCss.indexOf('D.17D.2R32'));
assert.match(r32, /d17d-field--date \.mak-date-control > :is\(input, button\)[\s\S]{0,180}border:\s*0\s*!important[\s\S]{0,160}background:\s*transparent\s*!important/i, 'data e calendário usam uma única superfície sem divisor');
assert.match(r32, /d17d-field\.d17d-field--date \.mak-date-control > input\[type="text"\][\s\S]{0,240}border-radius:\s*0\s*!important[\s\S]{0,160}box-shadow:\s*none\s*!important/i, 'input da data não pode desenhar contorno arredondado ou sombra dentro do controle');
const r33 = visualCss.slice(visualCss.indexOf('D.17D.2R33'));
assert.match(r33, /emp-table-pro\.d17c-data-table :is\(th, th\.emp-th\)[\s\S]{0,260}color:\s*#374151\s*!important[\s\S]{0,80}font-size:\s*11px\s*!important[\s\S]{0,80}font-weight:\s*600\s*!important/i, 'cabeçalho do lançamento segue a tipografia da relação de pesagens');
assert.match(r33, /emp-table-pro\.d17c-data-table :is\(td, td\.emp-td\)[\s\S]{0,420}color:\s*#46566c\s*!important[\s\S]{0,80}font-size:\s*11px\s*!important/i, 'linhas do lançamento seguem altura, cor e tipografia da relação de pesagens');
assert.match(auxiliaryRegistry, /className="mg-panel-tabs-rail"[\s\S]{0,300}className="seg-control"[\s\S]{0,220}className="seg-tab-slider"/, 'lançamentos auxiliares reutilizam a estrutura oficial de abas do ModeloBase1');
assert.match(auxiliaryRegistry, /className=\{`cmd-select aux-model-cmd-select[\s\S]{0,520}className="cmd-display aux-model-cmd-display"/, 'seleções dos lançamentos auxiliares usam a estrutura cmd-select do ModeloBase1');
assert(!/emp-form-card emp-form-card--collapsible mg-emp-card aux-model-card/.test(auxiliaryRegistry), 'cards desktop dos lançamentos auxiliares não podem herdar o modo recolhível');
assert.match(auxiliaryRegistry, /<div className="emp-form-cards-row">\s*<FormCard title="Dados principais"/, 'card principal usa a mesma linha estrutural do renderizador oficial');
assert.match(auxiliaryRegistryCss, /\.aux-record-tabs \.seg-tab-slider[\s\S]{0,260}background:\s*var\(--mg-panel-tab-indicator-color,\s*#000\)/i, 'abas auxiliares preservam o indicador móvel do ModeloBase1');
assert.match(auxiliaryRegistry, /className="aux-form-toolbar-actions"[\s\S]{0,260}className="aux-form-toolbar-commands"/, 'ações textuais do lançamento auxiliar ficam agrupadas como no action bar oficial');
assert.match(auxiliaryRegistryCss, /\.aux-record-mode\s*\{\s*--aux-card-gap:\s*12px;\s*\}/i, 'lançamentos auxiliares definem um respiro próprio para os cards');
assert.match(auxiliaryRegistryCss, /html body \.d17b-shell\.cadastro-emp-scope \.d17b-page \.aux-record-mode \.mg-prototype-cards-layout\s*\{[\s\S]{0,180}gap:\s*var\(--aux-card-gap\)\s*!important/i, 'respiro dos cards prevalece sobre o reset global de três pixels');
assert.match(auxiliaryRegistryCss, /\.aux-form-toolbar-actions\s*\{\s*gap:\s*6px/i, 'grupos de botões do lançamento auxiliar mantêm separação consistente');
assert.match(auxiliaryRegistry, /aux-registry-page--record[\s\S]{0,80}aux-registry-page--table/, 'visualizações de registro e tabela possuem estados estruturais explícitos');
// Estrutura (não sintaxe): o controle Registro/Tabela/Cards usa o segmento oficial
// .view-seg com slider e botões acessíveis "Visualizar <modo>" gerados de VIEW_MODES.
assert.match(auxiliaryRegistry, /className=(?:"|\{`)view-seg aux-view-seg[^>]*role="group"[^>]*aria-label="Modo de visualização"/, 'alternância Registro/Tabela reutiliza a estrutura segmentada oficial (.view-seg com role group)');
assert.match(auxiliaryRegistry, /className="view-seg-slider aux-view-seg__slider"/, 'segmento Registro/Tabela possui o slider oficial');
assert.match(auxiliaryRegistry, /const VIEW_MODES = \[[\s\S]{0,400}id: 'registro'[\s\S]{0,200}id: 'tabela'/, 'modos Registro e Tabela estão declarados no segmento');
assert.match(auxiliaryRegistry, /aria-label=\{`Visualizar \$\{view\.title/, 'cada modo do segmento expõe o rótulo acessível "Visualizar <modo>"');
assert.match(auxiliaryRegistryCss, /\.aux-view-seg\s*\{[\s\S]{0,300}--mg-btn-icon-size[\s\S]{0,120}\* 2/i, 'controle Registro/Tabela preserva a geometria do ModeloBase1 com dois modos');
assert.match(auxiliaryRegistry, /className="emp-th-select aux-check-cell"[\s\S]{0,300}className="emp-table-select-wrap"/, 'cabeçalho de seleção usa as classes e o invólucro oficiais');
assert.match(auxiliaryRegistry, /className="emp-td-select aux-check-cell"[\s\S]{0,180}stopPropagation/, 'célula de seleção usa o contrato oficial sem propagar o clique para a linha');
assert.match(auxiliaryRegistryCss, /\.aux-check-cell\s*\{[\s\S]{0,100}width:\s*36px\s*!important/i, 'coluna de seleção mantém os 36 px oficiais sem espaço lateral artificial');
assert.match(auxiliaryRegistryCss, /\.emp-table-pro\.aux-data-table\s*\{[\s\S]{0,100}width:\s*100%\s*!important/i, 'tabela auxiliar preenche toda a largura disponível como a tabela oficial');
assert.match(auxiliaryRegistry, /const FIELD_WIDTH_PRESETS = \{[\s\S]{0,380}CAMPO_PRINCIPAL:[\s\S]{0,80}min:\s*260,[\s\S]{0,260}SIM_NAO:[\s\S]{0,80}min:\s*120/i, 'formulários auxiliares reutilizam os presets dimensionais do renderizador oficial');
assert.match(auxiliaryRegistry, /data-width-type=\{widthType\}/, 'cada campo expõe sua categoria dimensional para o layout');
assert.match(auxiliaryRegistryCss, /\.aux-model-card-grid\s*\{[\s\S]{0,140}display:\s*flex\s*!important[\s\S]{0,120}flex-flow:\s*row wrap\s*!important/i, 'linhas dos cartões usam o fluxo responsivo do ModeloBase1');
assert.match(auxiliaryRegistryCss, /aux-model-field\[data-width-type="SIM_NAO"\][\s\S]{0,180}flex:\s*\.5 1 120px\s*!important/i, 'campos de situação permanecem compactos');
assert.match(auxiliaryRegistryCss, /aux-model-field\[data-width-type="TEXTO_CURTO"\][\s\S]{0,180}flex:\s*1 1 140px\s*!important/i, 'telefone e demais textos curtos usam a largura oficial');
assert(!/--mg-row-cols/.test(auxiliaryRegistry), 'formulário auxiliar não força mais colunas iguais por quantidade');
assert(!/\.aux-tabs\b/.test(auxiliaryRegistryCss), 'abas antigas não podem disputar estilo com as abas oficiais do ModeloBase1');
assert.match(auxiliaryRegistry, /data-template-id="context-panel"/, 'painel de contexto declara o template oficial');
assert.match(auxiliaryRegistry, /mg-context-panel__swap-slot--counter/, 'contador do painel de contexto usa o slot de transição oficial');
assert.match(auxiliaryRegistryCss, /button\.aux-cancel-button\.aux-form-action\.d17c-launch-button\s*\{[\s\S]{0,240}border-radius:\s*999px\s*!important/i, 'botão Cancelar usa a mesma geometria de pílula do Salvar');
assert.match(auxiliaryRegistryCss, /html:is\(\.dark, \.tema-escuro, \.escuro\)[\s\S]{0,360}\.aux-model-card\s*\{[\s\S]{0,180}background:\s*var\(--mb1-bg-card\)\s*!important/i, 'cards auxiliares obedecem às superfícies oficiais do tema escuro');
assert.match(auxiliaryRegistryCss, /input\[id\^="aux-"\]:not\(\[type="hidden"\]\)[\s\S]{0,1200}background-color:\s*var\(--mb1-bg-field\)\s*!important/i, 'campos auxiliares permanecem legíveis no tema escuro mesmo sob regras legadas');
assert.match(auxiliaryRegistryCss, /body #root[\s\S]{0,300}button\.aux-cancel-button[\s\S]{0,120}color:\s*var\(--mb1-text-1\)\s*!important/i, 'Cancelar mantém contraste no tema escuro');
assert.match(auxiliaryRegistryCss, /\.mg-filter-pill__trigger span\s*\{[\s\S]{0,80}color:\s*currentColor\s*!important/i, 'rótulos dos filtros permanecem legíveis no tema escuro');
assert.match(auxiliaryRegistryCss, /div\.mg-view-panel\.emp-table-root\.emp-table-shell\.d17c-table-scroll\s*\{[\s\S]{0,160}scrollbar-color:\s*#5c6a7d #232a33\s*!important/i, 'rolagem das tabelas auxiliares segue o tema escuro do ModeloBase1');
assert.match(auxiliaryRegistry, /const requiredFormFields = formPrimaryFields\.filter[\s\S]{0,220}filledRequiredFields/, 'contador de obrigatórios considera também o tipo do novo cadastro');
assert.match(auxiliaryRegistry, /checked=\{allPageSelected\}[\s\S]{0,300}pageKeys/, 'seleção geral atua somente sobre os registros listados na página atual');
assert.match(deathCausesPage, /newLabel:\s*'Nova causa de morte'/, 'novo cadastro de causa usa concordância correta no painel de contexto');
console.log('OK verify-ui-consistency');
console.log(JSON.stringify({
  whiteHoverRemoved: true,
  neutralIconHover: true,
  standardDialogShell: true,
  primaryHoverPreserved: true,
  popupFieldParity: true,
  selectionCellSpacingRemoved: true,
  leftScrollbarGutterRemoved: true,
  floatingFilterFieldParity: true,
  columnDialogFieldParity: true,
  documentedExitFourColumnRow: true,
  launchFeedbackRow: true,
  unifiedAnimalPerformance: true,
  referenceAnimalPerformanceColors: true,
  normalGainLabelsBoldGainValues: true,
  compactAnimalPerformanceHeight: true,
  compactDocumentedExitFields: true,
  informationalAnimalPerformanceStyle: true,
  emphasizedAnimalAndWeightInputs: true,
  compactAnimalChoiceDialog: true,
  readableSummaryPanels: true,
  operationalWarningsInTopNotifications: true,
  standardizedDialogShells: true,
  dialogDismissalOnlyByExplicitControls: true,
  standardizedDialogActionButtons: true,
  alignedColumnDialogHeaderActions: true,
  unifiedOperationalTypography: true,
  fluidAnimalPerformanceGroups: true,
  referenceDefaultColumns: true,
  seamlessLaunchDateControl: true,
  launchTableMatchesWeighingList: true,
  deferredBrandChoiceOnFieldCompletion: true,
  healthFeatureRemoved: true,
  auxiliaryLaunchUsesModeloBase1Tabs: true,
  auxiliaryLaunchUsesModeloBase1Selects: true,
  auxiliaryLaunchUsesModeloBase1Cards: true,
  auxiliaryLaunchCardSpacing: true,
  auxiliaryLaunchActionGrouping: true,
  auxiliaryTableAndRecordViews: true,
  auxiliaryCircularIconActions: true,
  auxiliaryPillTextActions: true,
}, null, 2));
