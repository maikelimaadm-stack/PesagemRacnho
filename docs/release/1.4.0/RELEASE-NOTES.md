# Pesagens Individuais 1.4.0 — notas da versão

Data: 25/09/2026 · Esquema Dexie 8 (sem mudança) · Backup formato 3 · Instalador não assinado.

## O que muda para quem usa

### Relatórios mais curtos e diretos
- Os relatórios agrupados abrem **resumidos**: uma linha por lote (ou categoria, raça, marca…) com
  **Cabeças, Peso médio, Peso total, GMD** em colunas. Acabou a lista de 300 animais para saber
  quantos tem em cada lote.
- O botão **Resumido | Detalhado** troca a visão. **Clique no nome do lote** para ver só os animais
  dele; o **x** do selo "Detalhe" volta ao resumo.
- **Agrupar por** fica na barra: escolha Lote, Categoria, Raça… e a tabela muda na hora.
- **Filtros rápidos** de um clique: "Somente mortes", "Somente perdendo peso", "Sem pesagem há mais
  de 30 dias", "Somente entradas e saídas", "Somente mudanças de lote no período".
- O que aparece na tela é o que sai na impressão A4, no Excel (CSV e XLSX) e no JSON.

### Menos relatórios na lista
- A lista caiu de **51 para 12** relatórios: Rebanho atual, Ocupação de lotes, Pesagens, Fechamento do
  dia, Desempenho, Movimentação de lotes, Saídas, Vendas, Abates e Compras do período, Romaneio de
  embarque e Embarques previsto × realizado.
- **Nada se perdeu.** "Rebanho por raça", "Mortes por causa", "Desempenho por lote" e os outros
  viraram jeitos de ver os 12. Favoritos, recentes, modelos salvos e links antigos continuam abrindo o
  que abriam, já agrupados e filtrados como antes. A busca do catálogo acha pelo nome antigo.
- Auditoria, Qualidade dos dados, Histórico de backups e Pendências de pesagem foram para **Backup e
  Manutenção › aba Controle**.
- Os relatórios de cadastros saíram da lista: as telas de Cadastros já listam e exportam.

### Correções
- **Relação de Pesagens:** o diálogo coletivo **"Data, apartação e lote"** fechava a tela com erro no
  instalador 1.3.2. Corrigido.
- **Importação:** dois cliques seguidos em **Aplicar** com o mesmo arquivo agora gravam uma vez só.
- **Backup e Manutenção:** em telas de 1440×900 os cartões ficavam uns por cima dos outros. Corrigido.

## Atualização
- Feche todas as janelas da versão anterior antes de executar o **Setup 1.4.0**.
- O banco continua no esquema 8: **não há migração de banco** nem backup pré-migração nesta versão.
- Na primeira vez que alguém abrir **Relatórios**, os favoritos, recentes e modelos salvos dessa
  pessoa são convertidos para os relatórios novos. É automático, não apaga nada e fica registrado na
  auditoria como "Relatório consolidado". Detalhes em `MIGRATION-1.3.0-TO-1.4.0.md`.

## Assinatura
- O pacote continua **não assinado** e pode gerar aviso do SmartScreen/Defender (ou ser retirado da
  pasta pelo antivírus). Não desative a proteção; a correção definitiva continua sendo uma assinatura
  Authenticode confiável.

## Teste físico
- Balança, impressora e curral: **não executados** nesta versão (nenhuma mudança nessas partes). A
  impressão A4 do Resumido foi conferida só em PDF gerado pelo próprio aplicativo.
