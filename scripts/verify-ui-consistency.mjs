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

// ADR-049 (substitui ADR-007/ADR-022 no ponto "sanidade fora do produto"): a proibição de
// sanidade no Lançamento deixou de valer. O que continua valendo: as aplicações vão pelo
// contrato próprio (payload.aplicacoes_sanidade → store aplicacoesSanidade, via
// sanityService/weighingService) e nunca pelas chaves legadas do legacy_payload nem por appSettings.
const launchLocalImports = [...launchPage.matchAll(/from\s+['"]@\/(components\/[^'"]+)['"]/g)]
  .map(([, rel]) => ['.jsx', '.js', '/index.js'].map((ext) => join(root, 'src', `${rel}${ext}`)).find((file) => existsSync(file)))
  .filter(Boolean)
  .map((file) => readFileSync(file, 'utf8'));
assert.match(launchPage, /aplicacoes_sanidade/, 'Lançamento envia as aplicações de sanidade em payload.aplicacoes_sanidade (ADR-049)');
assert([launchPage, ...launchLocalImports].some((source) => /sanityService/.test(source)), 'Lançamento (ou componente importado por ele) usa o sanityService para programas/medicamentos (ADR-049)');
assert(!/sanidade_ids|\bsanidades\b/.test(launchPage), 'Lançamento não usa as chaves legadas sanidade_ids/sanidades (ADR-027)');
assert(!/cadastros-auxiliares:sanidade|appSettings/.test(launchPage), 'Lançamento não lê sanidade de appSettings (ADR-049)');
assert(!/\.d17b-icon-button:hover\s*\{\s*background:\s*#fff/i.test(visualCss), 'hover do botão do shell não pode ficar branco');
assert(!/\.mb1-shell-icon-button:hover\s*\{\s*background:\s*#fff/i.test(shellCss), 'hover do botão do ModeloBase1 não pode ficar branco');
assert.match(visualCss, /\.d17d-icon-action:hover:not\(:disabled\)[\s\S]{0,220}background:\s*#e8edf1/i, 'ações de ícone usam hover neutro padronizado');
assert.match(visualCss, /\.d17b-standard-dialog/, 'diálogos usam o shell visual padronizado');
assert(!/needsImmediateAnimalChoice\(pesagens, valor\)/.test(launchPage), 'campo de identificação não interrompe a digitação com seleção de marca');
assert.match(launchPage, /onBlur=\{\(\) => \{[\s\S]{0,360}if \(numeroAnimal\.trim\(\)\) resolverAnimalDigitado\(numeroAnimal\);[\s\S]{0,40}\}\}/, 'seleção de marca é resolvida ao concluir e sair do campo de identificação');
assert.match(launchPage, /onKeyDown=\{\(e\) => \{[\s\S]{0,600}if \(e\.key !== 'Enter'\) return;[\s\S]{0,180}resolverAnimalDigitado\(numeroAnimal\)/, 'Enter também conclui a identificação e resolve a marca');
assert.match(launchPage, /ignorarProximoBlurIdentificacaoRef\.current = true[\s\S]{0,180}resolverAnimalDigitado\(numeroAnimal\)/, 'Enter não duplica a notificação ao provocar blur para abrir o pop-up');
assert.match(visualCss, /D\.17D\.2R20[\s\S]*?background:\s*var\(--d17b-accent-hover[\s\S]*?color:\s*#111827/i, 'hover de botões primários preserva o verde da marca e o texto escuro');
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
assert.match(launchPage, /d17d-transfer-field[\s\S]{0,4200}d17d-auto-lot-feedback[\s\S]{0,1800}d17d-embarque-field/, 'indicação automática do lote aparece imediatamente após Transferência de Lote');
assert.match(launchPage, /d17d-auto-lot-field[\s\S]{0,220}>Lote destino<[/\s\S]{0,400}d17d-auto-lot-feedback/, 'indicação automática possui o rótulo Lote destino fora da área recortada');
assert.match(launchPage, /d17d-weight-control[\s\S]{0,2400}d17d-weight-capture/, 'peso usa o controle composto com área de captura da balança');
assert.match(launchPage, /d17d-launch-save__shortcut">Enter/, 'botão Salvar comunica o atalho Enter');
assert.match(launchPage, /d17d-last-launch[\s\S]{0,700}>Desfazer</, 'linha inferior oferece desfazer para o último lançamento');
assert.equal((columnDeclaration.match(/default: true/g) || []).length, 14, 'visualização inicial usa as 14 colunas definidas no HTML oficial');
assert.match(launchPage, /COLUMN_MODEL_VERSION = 'd17d2r31'/, 'configurações legadas recebem uma única migração para o novo modelo de colunas');
// 1.5.4: o seletor de marca virou lista de opções com atalho numérico (1–9), sem tabela nem botão Selecionar.
assert.match(animalDialog, /role="option"[\s\S]{0,80}className="d17d-animal-choice-option"/, 'seletor de animal lista cada marca como opção clicável');
assert.match(animalDialog, /if \(!\/\^\[1-9\]\$\/\.test\(key\)\) return;[\s\S]{0,300}escolher\(animais\[index\]\)/, 'teclas 1–9 escolhem a marca no seletor de animal');
assert.match(visualCss, /\.d17d-animal-choice-option \{[\s\S]{0,200}height:\s*auto\s*!important/i, 'opções do seletor não aumentam artificialmente de altura');
assert.match(visualCss, /d17d-summary-panel table td[\s\S]{0,360}height:\s*28px\s*!important[\s\S]{0,180}font-size:\s*10px\s*!important/i, 'valores dos resumos usam a escala de 10px do design');
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
assert(!/aria-controls="filter-panel"/.test(relationPage), 'Relação não tem mais o botão do painel lateral de filtros (decisão de 15/09/2026)');
assert.match(relationPage, /tb-btn tb-btn-icon tb-btn-green"[^>]*title="Lançar pesagem"/, 'ação principal usa tb-btn-icon tb-btn-green (círculo cinza na Tela Mãe)');
assert.match(relationPage, /title="Lançar pesagem"[\s\S]{0,200}<Plus/, 'ação principal tem ícone + como a referência Marcas');
assert.match(relationPage, /title="Editar"[\s\S]{0,1200}title="Duplicar"[\s\S]{0,1200}title="Excluir"/, 'Editar/Duplicar/Excluir ficam sempre na barra (como a referência Marcas)');
assert.doesNotMatch(relationPage, /<MgDesktopSearch/, 'Relação não mostra o campo de pesquisa da barra');
assert.match(relationPage, /<MgViewSeg /, 'Relação expõe o view-seg (Registro/Tabela/Cards) como a referência');
// F24: a exportação técnica (JSON) entra no mesmo "Mais opções", entre as exportações e a importação.
assert.match(relationPage, /<MgSpeedDialMenu[\s\S]{0,700}Atualizar[\s\S]{0,200}Exportar relatório \(CSV\)[\s\S]{0,200}Exportar para reimportação \(CSV\)[\s\S]{0,600}Importar CSV[\s\S]{0,200}Baixar modelo CSV/, 'Atualizar, exportar (relatório e reimportação), importar e modelo ficam em "Mais opções"');
assert.match(relationPage, /aria-label="Configurar colunas da tabela"[\s\S]{0,700}<MgSpeedDialMenu/, 'Configurar colunas fica ao lado de Mais opções');
assert.match(visualCss, /Referência Marcas[\s\S]{0,1200}background:\s*#f1f3f4\s*!important/i, 'Tela Mãe trava a ação principal em pílula cinza #f1f3f4 (não fill verde)');
assert.match(visualCss, /\.mg-action-bar \.view-mode-btn\.active\s*\{[\s\S]{0,120}color:\s*#40de63\s*!important/i, 'view ativo da Tela Mãe usa lima #40de63');
assert.doesNotMatch(relationPage, /<MakFilterRail|<MakFilterPill|<MgTablePanelStrip/, 'Relação não mostra a faixa de filtros personalizados');
assert(!/MgFilterPanel/.test(relationPage), 'Relação filtra só pelas pílulas e menus de coluna (painel lateral removido)');
assert(!/d17b-filter-card/.test(relationPage), 'cartão antigo de filtros foi removido da Relação');
assert(!/d17c-quick-search/.test(relationPage), 'campo de pesquisa antigo foi removido da Relação');
for (const file of ['MgDesktopSearch.jsx', 'MgSearchResultsDropdown.jsx', 'MgSpeedDialMenu.jsx', 'MgTablePanelStrip.jsx', 'MgCmdSelect.jsx']) {
  assert.ok(existsSync(join(root, 'src/components/mak', file)), `componente do modelo portado: ${file}`);
}
assert.match(visualCss, /D\.17D\.2R34[\s\S]{0,600}\.d17b-list-page\.d17b-list-page--mother\s*\{[\s\S]{0,120}display:\s*flex\s*!important/i, 'Relação empilha barra, faixa e corpo como a Tela Mãe');

// R34 — os cadastros auxiliares (Parceiros, Mortalidade…) usam a mesma Tela Mãe no modo de listagem.
const auxiliaryList = readFileSync(join(root, 'src/components/cadastros/CadastroAuxiliarPage.jsx'), 'utf8');
assert.match(auxiliaryList, /data-mak-region="toolbar"[\s\S]{0,500}className=\{`mg-action-bar /, 'listagem dos cadastros usa a barra de ações mg-action-bar');
assert.match(auxiliaryList, /d17b-list-page--mother/, 'cadastros mantêm a classe da Tela Mãe também no Registro');
assert.match(auxiliaryList, /tb-btn tb-btn-icon tb-btn-green aux-new-button/, 'Novo dos cadastros usa tb-btn-icon tb-btn-green (círculo cinza na Tela Mãe)');
assert.match(auxiliaryList, /aux-new-button[\s\S]{0,220}<Plus/, 'Novo dos cadastros tem ícone + como a referência Marcas');
assert.match(auxiliaryList, /title="Duplicar"[\s\S]{0,1200}title="Excluir"/, 'cadastros expõem Duplicar/Excluir na barra mãe');
assert.doesNotMatch(auxiliaryList, /aux-launch-toolbar|d17b-page-actionbar aux-registry-toolbar/, 'Registro não troca a barra mãe por aux-launch-toolbar / ModeloBase1ActionBar');
assert.doesNotMatch(auxiliaryList, /<MgDesktopSearch/, 'cadastros não mostram o campo de pesquisa da barra');
assert.match(auxiliaryList, /aria-label="Configurar colunas da tabela"[\s\S]{0,700}<MgSpeedDialMenu/, 'cadastros: Configurar colunas fica ao lado de Mais opções');
assert.match(auxiliaryList, /<MgSpeedDialMenu[\s\S]{0,600}Atualizar[\s\S]{0,200}Mostrar todos os tipos/, 'cadastros concentram Atualizar e tipos em "Mais opções"');
assert.doesNotMatch(auxiliaryList, /<MakFilterRail|<MakFilterPill|<MgTablePanelStrip/, 'cadastros não mostram a faixa de filtros personalizados');
assert(!/MgFilterPanel/.test(auxiliaryList), 'cadastros filtram pelos menus de coluna (painel lateral removido)');
assert.match(auxiliaryList, /<MakColumnConfigDialog[\s\S]{0,400}onApply=\{applyColumnConfig\}/, 'cadastros permitem configurar colunas como o modelo');
assert.match(auxiliaryList, /\{tableColumns\.map\(\(column\) => column\.id === '_typeLabel'/, 'tabela dos cadastros respeita ordem e visibilidade configuradas');
assert(!/d17c-quick-search--actions aux-search/.test(auxiliaryList), 'campo de pesquisa antigo não fica na barra dos cadastros');
assert.match(auxiliaryList, /const viewMode = formOpen \? 'registro' : listViewMode/, 'Tabela/Cards/Registro compartilham a mesma barra; só o modo do view-seg muda');
assert.match(auxiliaryList, /mg-action-slot\$\{!formOpen && canWrite \? ' is-visible' : ''\}[\s\S]{0,200}aux-new-button/, 'lista: slot Novo; Registro esconde CRUD');
assert.match(auxiliaryList, /mg-action-slot\$\{formOpen && canWrite \? ' is-visible' : ''\}[\s\S]{0,400}title="Salvar \(Enter\)"/, 'Registro: slot Salvar no lugar do CRUD');
assert.match(auxiliaryList, /mg-action-slot\$\{formOpen \? ' is-visible' : ''\}[\s\S]{0,400}aux-cancel-button/, 'Registro: slot Cancelar no lugar do CRUD');
assert.doesNotMatch(auxiliaryList, /mg-action-slot is-visible[\s\S]{0,80}title="Excluir"[\s\S]{0,400}formOpen \? \([\s\S]{0,200}Salvar/, 'NEGATIVO: não empilhar CRUD+Salvar todos always-visible na mesma linha');
assert.match(auxiliaryList, /aux-action-bar--form/, 'Novo/Editar: action-bar marca estado de formulário unificado');
assert.match(auxiliaryList, /aux-context-inline[\s\S]{0,80}data-template-id="context-panel"/, 'Novo/Editar: identidade do registro inline na mesma faixa branca');
assert.doesNotMatch(auxiliaryList, /aria-label="Navegação entre registros"|aux-context-panel-wrap/, 'Novo/Editar: sem segunda faixa nem pager de registros');
assert.match(auxiliaryList, /!formOpen \? \([\s\S]{0,120}mg-action-bar__end[\s\S]{0,500}ModeloBase1ViewSeg/, 'lista: view-seg + colunas + mais opções; registro esconde o fim da barra');

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
assert.match(launchPage, /if \(matches\.length > 1\) \{\s*setOpcoesAnimal\(matches\);\s*setSeletorAnimalOpen\(true\);/, 'ambiguidade de marca abre o seletor de animal (1.5.4: sem notificação extra)');
assert.match(launchPage, /toast\.error\(`Animal \$\{numero\} não cadastrado/, 'animal sem cadastro aparece na notificação superior');
assert.match(launchPage, /toast\.warning\(`Animal \$\{numero\} entrou sem peso/, 'animal que entrou sem peso: aviso na notificação superior (1.6.2)');
assert.match(dialogBase, /onPointerDownOutside=\{\(event\) => \{[\s\S]{0,120}event\.preventDefault\(\)/, 'diálogos não fecham ao clicar fora');
assert.match(dialogBase, /onEscapeKeyDown=\{\(event\) => \{[\s\S]{0,120}event\.preventDefault\(\)/, 'diálogos não fecham pela tecla Escape');
assert.match(visualCss, /R27[\s\S]*?d17b-standard-dialog table th[\s\S]{0,260}text-transform:\s*none\s*!important/i, 'cabeçalhos de todos os pop-ups preservam capitalização normal');
assert.match(visualCss, /d17b-dialog-content\.d17b-standard-dialog--large[\s\S]{0,160}max-width:\s*960px\s*!important/i, 'pop-ups grandes seguem a largura máxima padronizada');
assert(!/variant="secondary" onClick=\{\(\) => onOpenChange\(false\)\}>Cancelar/.test(columnDialog), 'configuração de colunas usa o X para descartar alterações');
assert(!/variant="outline" onClick=\{\(\) => onOpenChange\(false\)\}>Cancelar/.test(summaryDialog), 'configuração de resumos usa o X para descartar alterações');
assert.match(visualCss, /d17c-column-dialog \.d17c-column-dialog__reset\s*\{[\s\S]{0,120}top:\s*1px\s*!important[\s\S]{0,220}height:\s*25px\s*!important/i, 'Restaurar padrões fica alinhado verticalmente ao X');
assert.match(visualCss, /\.d17b-standard-dialog :is\([\s\S]{0,180}\.d17d-management-form,[\s\S]{0,180}\.d17c-column-dialog__footer[\s\S]{0,80}\) button:not\(\[aria-label\]\)[\s\S]{0,280}min-width:\s*78px\s*!important[\s\S]{0,200}height:\s*25px\s*!important/i, 'Adicionar, Salvar e confirmar usam a altura padrão dos botões');
assert.match(visualCss, /R23[\s\S]*?\.emp-table-pro[\s\S]*?font-size:\s*11px\s*!important/i, 'cabeçalho e corpo das tabelas seguem a escala tipográfica de 11px');
assert.match(r30, /\.d17d-animal-performance\s*\{[\s\S]{0,220}display:\s*flex\s*!important[\s\S]{0,220}height:\s*auto\s*!important/i, 'faixa informativa flui sem altura rígida ou conteúdo cortado');
assert.match(r30, /\.d17d-animal-performance__group strong\s*\{[\s\S]{0,180}font-size:\s*12px\s*!important/i, 'valores do painel informativo têm ênfase tipográfica uniforme');
const r31 = visualCss.slice(visualCss.indexOf('D.17D.2R31'));
assert.match(r31, /d17d-field--weight[\s\S]{0,120}d17d-weight-control > input[\s\S]{0,260}color:\s*#f59e0b\s*!important/i, 'peso mantém o amarelo do modelo dentro do controle composto');
assert.match(r31, /d17d-animal-performance__group > \.d17d-animal-performance__metric[\s\S]{0,120}color:\s*#111827\s*!important/i, 'métricas de ganho usam tinta #111827 (sem verde de letra)');
const r32 = visualCss.slice(visualCss.indexOf('D.17D.2R32'));
assert.match(r32, /d17d-field--date \.mak-date-control > :is\(input, button\)[\s\S]{0,180}border:\s*0\s*!important[\s\S]{0,160}background:\s*transparent\s*!important/i, 'data e calendário usam uma única superfície sem divisor');
assert.match(r32, /d17d-field\.d17d-field--date \.mak-date-control > input\[type="text"\][\s\S]{0,240}border-radius:\s*0\s*!important[\s\S]{0,160}box-shadow:\s*none\s*!important/i, 'input da data não pode desenhar contorno arredondado ou sombra dentro do controle');
const r33 = visualCss.slice(visualCss.indexOf('D.17D.2R33'));
assert.match(r33, /emp-table-pro\.d17c-data-table :is\(th, th\.emp-th\)[\s\S]{0,260}color:\s*#334155\s*!important[\s\S]{0,80}font-size:\s*12px\s*!important[\s\S]{0,80}font-weight:\s*600\s*!important/i, 'cabeçalho do lançamento segue a tipografia da relação de pesagens (ModeloBase1)');
assert.match(r33, /emp-table-pro\.d17c-data-table :is\(td, td\.emp-td\)[\s\S]{0,420}color:\s*#6b7280\s*!important[\s\S]{0,80}font-size:\s*12px\s*!important/i, 'linhas do lançamento seguem altura, cor e tipografia da relação de pesagens (ModeloBase1)');
assert.match(auxiliaryRegistry, /className="mg-panel-tabs-rail"[\s\S]{0,300}className="seg-control"[\s\S]{0,220}className="seg-tab-slider"/, 'lançamentos auxiliares reutilizam a estrutura oficial de abas do ModeloBase1');
assert.match(auxiliaryRegistry, /className=\{`cmd-select aux-model-cmd-select[\s\S]{0,520}className="cmd-display aux-model-cmd-display"/, 'seleções dos lançamentos auxiliares usam a estrutura cmd-select do ModeloBase1');
assert(!/emp-form-card emp-form-card--collapsible mg-emp-card aux-model-card/.test(auxiliaryRegistry), 'cards desktop dos lançamentos auxiliares não podem herdar o modo recolhível');
assert.match(auxiliaryRegistry, /<div className="emp-form-cards-row">\s*<FormCard title="Dados principais"/, 'card principal usa a mesma linha estrutural do renderizador oficial');
assert.match(auxiliaryRegistryCss, /\.aux-record-tabs \.seg-tab-slider[\s\S]{0,260}background:\s*var\(--mg-panel-tab-indicator-color,\s*#000\)/i, 'abas auxiliares preservam o indicador móvel do ModeloBase1');
assert.match(auxiliaryRegistry, /className="aux-form-toolbar-actions"[\s\S]{0,260}className="aux-form-toolbar-commands"/, 'ações textuais do lançamento auxiliar ficam agrupadas como no action bar oficial');
assert.match(auxiliaryRegistryCss, /\.aux-record-mode\s*\{\s*--aux-card-gap:\s*12px;\s*\}/i, 'lançamentos auxiliares definem um respiro próprio para os cards');
assert.match(auxiliaryRegistryCss, /html body \.d17b-shell\.cadastro-emp-scope \.d17b-page \.aux-record-mode \.mg-prototype-cards-layout\s*\{[\s\S]{0,180}gap:\s*var\(--aux-card-gap\)\s*!important/i, 'respiro dos cards prevalece sobre o reset global de três pixels');
assert.match(auxiliaryRegistryCss, /\.aux-form-toolbar-actions\s*\{\s*gap:\s*6px/i, 'grupos de botões textuais (Configurações) mantêm gap 6px');
assert.match(auxiliaryRegistryCss, /\.mak-mother-page__toolbar \.aux-form-toolbar-commands\s*\{\s*gap:\s*0/i, 'Salvar/Descartar do cadastro usam só o gap dos slots');
assert.match(auxiliaryRegistryCss, /\.aux-model-cmd-select > \.cmd-chevron[\s\S]{0,200}width:\s*12px\s*!important/i, 'chevron dos selects do formulário auxiliar é 12px');
assert.match(auxiliaryRegistryCss, /aux-action-bar--form[\s\S]{0,200}border-radius:\s*12px\s*!important/i, 'barra única do registro tem cantos fechados');
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
assert.match(auxiliaryRegistry, /aux-context-inline/, 'identidade do registro é inline na barra (sem segundo cartão)');
assert.doesNotMatch(auxiliaryRegistry, /mg-context-panel__swap-slot--counter|aria-label="Navegação entre registros"/, 'Novo/Editar não mostra contador nem pager de registros');
assert.match(auxiliaryRegistryCss, /\.mg-action-bar button\.aux-cancel-button\.aux-form-action\.d17c-launch-button\s*\{[\s\S]{0,240}border-radius:\s*50%\s*!important/i, 'Cancelar no Registro usa o mesmo círculo 25px da barra mãe');
assert.match(auxiliaryRegistryCss, /html:is\(\.dark, \.tema-escuro, \.escuro\)[\s\S]{0,360}\.aux-model-card\s*\{[\s\S]{0,180}background:\s*var\(--mb1-bg-card\)\s*!important/i, 'cards auxiliares obedecem às superfícies oficiais do tema escuro');
assert.match(auxiliaryRegistryCss, /input\[id\^="aux-"\]:not\(\[type="hidden"\]\)[\s\S]{0,1200}background-color:\s*var\(--mb1-bg-field\)\s*!important/i, 'campos auxiliares permanecem legíveis no tema escuro mesmo sob regras legadas');
assert.match(auxiliaryRegistryCss, /body #root[\s\S]{0,300}button\.aux-cancel-button[\s\S]{0,120}color:\s*var\(--mb1-text-1\)\s*!important/i, 'Cancelar mantém contraste no tema escuro');
assert.match(auxiliaryRegistryCss, /\.mg-filter-pill__trigger span\s*\{[\s\S]{0,80}color:\s*currentColor\s*!important/i, 'rótulos dos filtros permanecem legíveis no tema escuro');
assert.match(auxiliaryRegistryCss, /div\.mg-view-panel\.emp-table-root\.emp-table-shell\.d17c-table-scroll\s*\{[\s\S]{0,160}scrollbar-color:\s*#5c6a7d #232a33\s*!important/i, 'rolagem das tabelas auxiliares segue o tema escuro do ModeloBase1');
assert.doesNotMatch(auxiliaryRegistry, /filledRequiredFields|aux-required-status/, 'Novo/Editar: barra limpa sem contador de campos obrigatórios');
assert.match(auxiliaryRegistry, /checked=\{allPageSelected\}[\s\S]{0,300}pageKeys/, 'seleção geral atua somente sobre os registros listados na página atual');
assert.match(deathCausesPage, /newLabel:\s*'Nova causa de morte'/, 'novo cadastro de causa usa concordância correta no painel de contexto');

// Programa 2.0 — Fase 1 (TARGET-SCREEN-MAP §5): telas novas na Tela Mãe/registro do ModeloBase1.
for (const page of ['Marcas', 'Racas', 'Categorias', 'Parceiros', 'Propriedades', 'CausasMorte']) {
  const source = readFileSync(join(root, `src/pages/${page}.jsx`), 'utf8');
  assert.match(source, /<CadastroAuxiliarPage /, `${page} usa a página genérica de cadastro do ModeloBase1`);
}
assert.doesNotMatch(auxiliaryRegistry, /registryService/, 'cadastros não dependem mais do registry em appSettings (ADR-018)');
// ADR-049: a sanidade voltou em stores próprias; a tela legada que gravava em
// appSettings (`cadastros-auxiliares:sanidade:*`, ADR-022) continua fora do produto.
assert.ok(!existsSync(join(root, 'src/pages/ConfiguracoesSanidade.jsx')), 'tela legada de sanidade em appSettings não volta (ADR-022/ADR-049)');
assert.ok(!existsSync(join(root, 'src/pages/CadastrosComerciais.jsx')), 'cadastros comerciais migraram para Parceiros (ADR-024)');
const settingsPage = readFileSync(join(root, 'src/pages/Configuracoes.jsx'), 'utf8');
assert.match(settingsPage, /<RequirePermission permission="settings\.(manage|operational)">/, 'Configurações exige permissão de configurações (settings.operational/manage)');
assert.match(settingsPage, /FormCard/, 'Configurações usa o padrão registro (FormCard)');
const usersPage = readFileSync(join(root, 'src/pages/Usuarios.jsx'), 'utf8');
assert.match(usersPage, /users\.manage/, 'Usuários exige users.manage');
assert.match(usersPage, /mg-action-bar/, 'Usuários usa a barra de ações do ModeloBase1');
const layoutSource = readFileSync(join(root, 'src/Layout.jsx'), 'utf8');
assert.match(layoutSource, /permission: "registry\.read"/, 'menu de cadastros declara permissão');
assert.match(layoutSource, /RequirePermission/, 'Layout protege a página pela permissão do item');
const shellSource = readFileSync(join(root, 'src/components/modelobase1/layout/ModeloBase1AppShell.jsx'), 'utf8');
assert.match(shellSource, /<UserMenu/, 'topbar monta o menu do usuário');
assert.match(shellSource, /navGroups/, 'grupos do menu são declarados pelo Layout');

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
  sanityLaunchUsesOwnStores: true,
  auxiliaryLaunchUsesModeloBase1Tabs: true,
  auxiliaryLaunchUsesModeloBase1Selects: true,
  auxiliaryLaunchUsesModeloBase1Cards: true,
  auxiliaryLaunchCardSpacing: true,
  auxiliaryLaunchActionGrouping: true,
  auxiliaryTableAndRecordViews: true,
  auxiliaryCircularIconActions: true,
  auxiliaryPillTextActions: true,
}, null, 2));
