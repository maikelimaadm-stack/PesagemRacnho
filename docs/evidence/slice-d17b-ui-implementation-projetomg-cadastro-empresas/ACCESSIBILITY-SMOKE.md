# Smoke de acessibilidade

Resultado: **APROVADO COM ESCOPO DE SMOKE**.

## Validações executadas no navegador

- snapshots semânticos confirmaram `banner`, navegação principal, `main`, headings, tabelas, botões, comboboxes, dialogs e região de notificações;
- navegação atual expõe `aria-current`; recolhimento do menu e filtros expõem estado expandido/pressionado;
- botões somente com ícone receberam nome acessível e `title`, inclusive configurações, opções de combobox e ações por linha;
- dialogs possuem título/descrição, botão `Fechar` visível e fechamento por `Escape`;
- após fechar o dialog de Apartação por `Escape`, o foco retornou ao botão `Gerenciar Apartações` tanto em desenvolvimento quanto na build de produção;
- foco visível foi preservado nos controles interativos;
- o drawer mobile e a navegação inferior usam alvos maiores que os controles densos do desktop;
- nenhum overflow horizontal indevido foi observado em 390 × 844, 1366 × 768 ou 1440 × 900.

## Limite da validação

Não foi executada auditoria WCAG completa nem varredura automatizada com axe. A verificação foi um smoke por semântica exposta, teclado, foco, responsividade e inspeção visual.
