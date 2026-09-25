# Pesagens Individuais 1.3.2 — notas da versão

Data: 24/09/2026 · Esquema Dexie 8 · Backup formato 3 · Instalador não assinado.

## Versão visível
- A barra superior mostra permanentemente **v1.3.2** ao lado do selo PI.
- No layout móvel, a barra mostra **Local · v1.3.2**.
- O título nativo da janela passa a ser **Pesagens Individuais 1.3.2**.
- Autenticação, menu do usuário, Configurações e Manutenção continuam usando a mesma fonte única de
  versão do `package.json`.

## Atualização
- Feche todas as janelas da versão anterior antes de executar o Setup 1.3.2.
- A instalação é por usuário e substitui a versão anterior no mesmo diretório.
- O banco permanece no esquema 8; os dados locais não são removidos pela atualização.

## Conteúdo acumulado
- Inclui as ações coletivas de identificação, movimentação, compra, venda e abate publicadas no
  candidato 1.3.1.
- Quando há seleção, o cabeçalho da coluna Ações usa o mesmo botão de três pontos das linhas.

## Problema conhecido do instalador 1.3.2 (registrado em 25/09/2026)
- Na Relação de Pesagens, o diálogo **Ações em lote › Data, apartação e lote** fecha a tela com erro
  ao abrir (o ícone do título não estava importado; o build não acusa, só a execução).
- A correção entrou no código-fonte depois do build de `release-unsigned/` (E0 do Plano Mestre 2) e
  o gate `weighing:bulk-actions:verify` passou a barrar componente JSX sem import. O instalador 1.3.2
  já gerado **não** tem a correção; ela sai no próximo build.

## Assinatura
- O pacote permanece não assinado e pode gerar aviso do SmartScreen/Defender. A correção definitiva
  para reputação do instalador continua sendo uma assinatura Authenticode confiável.
