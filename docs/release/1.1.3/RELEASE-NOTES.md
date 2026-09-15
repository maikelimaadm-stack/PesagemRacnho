# Pesagens Individuais 1.1.3

Checkpoint de empacotamento da migração visual ModeloBase1.

## Inclui

- fundação visual ModeloBase1;
- novo shell;
- nova sidebar flutuante;
- nova topbar;
- novos containers e cabeçalhos;
- barras de ação migradas até o estado atual;
- marcador técnico de interface `d17d2r6-form-actions-dark-installer-2026-08-05`;
- faixa de filtros personalizados recolhível e navegável, conforme ModeloBase1;
- menus de opções e filtros de cabeçalho separados, conforme Cadastro de Empresas;
- seleção de dados dos filtros com pesquisa, múltipla seleção, Cancelar e OK;
- tabela com larguras preservadas e rolagem horizontal;
- tema escuro persistente com alternância na topbar;
- filtros personalizados e filtros de cabeçalho usando o mesmo editor, as mesmas
  condições e a mesma confirmação por `OK`;
- configuração de filtros alimentada por todos os campos de dados da tabela;
- campos numéricos com operadores completos e `Entre` como condição inicial,
  inclusive um único filtro `Peso` no lugar de mínimo/máximo separados;
- filtros de data sem botão de calendário aparente, mantendo o calendário ao
  clicar no campo;
- checkboxes circulares, botão `Lançar pesagem` e campos do lançamento em 28 px;
- painéis Apartação/Venda/Abate no fluxo correto, sem sobreposição, e tabelas
  com rolagem horizontal efetiva;
- dialogs de apartações, embarques e sanidades com dimensões, rodapés e tema
  escuro padronizados;
- campos de preenchimento com raio de 8 px, ações `Editar`/`Excluir` ao clicar
  na linha e dialogs sem botão `Fechar` redundante no rodapé;
- tema escuro completo na área útil das tabelas, nos resumos e na distribuição;
- gate automático contra instalador visual desatualizado.

## Ainda não representa

- igualdade visual final;
- tabela final;
- filtros finais;
- formulários finais;
- dialogs finais;
- responsividade final.

## Validação

Na tela de Manutenção, o botão **Copiar diagnóstico** deve incluir:

```text
Versão: 1.1.3
Interface: D.17D.2R6 · ModeloBase1 · d17d2r6-form-actions-dark-installer-2026-08-05
Armazenamento: IndexedDB local (Dexie)
```
