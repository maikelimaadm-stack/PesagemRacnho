# D.17D.2R6 — Relatório de execução

Data: 2026-08-05

## Resultado

- Campos de lançamento e campos internos dos dialogs usam 28 px de altura e
  raio de 8 px, igual ao token `--mg-radius-control` do Cadastro de Empresas.
- Dialogs de apartações, embarques e sanidades não exibem mais `Fechar` no
  rodapé quando o `X` do cabeçalho já realiza a mesma ação.
- Um clique na linha seleciona o registro e revela `Editar` e `Excluir` na
  barra principal, com transição curta e estado visual selecionado.
- A exclusão usa confirmação visual do sistema em vez de `window.confirm` na
  relação de Pesagens Individuais.
- O modo escuro cobre a área vazia das tabelas, linhas, campos, resumo do dia,
  seletor de visão, quadro de distribuição e dialogs de gestão.

## Verificações no navegador

- seleção pela própria linha e pelo checkbox;
- aparecimento das ações `Editar` e `Excluir`;
- cancelamento seguro da confirmação de exclusão;
- ausência de botão `Fechar` redundante no dialog de apartações;
- tema escuro na relação e no lançamento;
- formulário e dialog de apartações visualmente inspecionados.

## Testes e empacotamento

- `npm run test:full`: aprovado;
- `npm run e2e:installed:verify`: aprovado em modo estrito;
- `npm run packaged:ui-build:verify`: aprovado com marcadores no bundle e no
  `app.asar`;
- instalador: `Pesagens Individuais Setup 1.1.3.exe`;
- tamanho: 91.463.077 bytes;
- SHA-256: `62115f0d4f1f9ca9280206ce3a839b9a936916e0c90ae156ed96ac9313355cdb`.

A abertura automatizada adicional do executável empacotado foi impedida pela
política de Controle de Aplicativo do Windows por o binário não possuir
assinatura digital. A integridade do pacote, o manifesto e o conteúdo do
`app.asar` foram validados sem contornar essa política.

## Marcador

`D.17D.2R6 · ModeloBase1 · d17d2r6-form-actions-dark-installer-2026-08-05`
