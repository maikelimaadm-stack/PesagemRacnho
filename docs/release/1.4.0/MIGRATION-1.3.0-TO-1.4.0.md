# Migração 1.3.x → 1.4.0

Vale para quem vem da 1.3.0, 1.3.1 ou 1.3.2.

| | De (1.3.x) | Para (1.4.0) |
|---|---|---|
| Esquema Dexie | 8 | **8** (sem mudança) |
| Formato de backup | 3 | **3** (sem mudança) |
| Tabelas novas ou removidas | — | nenhuma |
| Preferências de relatório | 51 relatórios | 12 relatórios + 33 visões antigas |

**Não há migração de banco.** O banco abre direto na 1.4.0, sem backup pré-migração e sem backfill:
nenhum passo B1…B12 roda (eles só existem na passagem 1.1.17 → 1.2.0). A única conversão é das
**preferências de relatório**, descrita na seção 3.

## 1. Pré-requisitos

- [ ] Backup completo criado **na versão atual** (Backup e Manutenção › Criar backup completo) e cópia
      guardada fora do computador. A atualização não mexe no banco, mas o backup continua sendo a
      regra antes de qualquer instalação.
- [ ] Programa fechado durante a instalação do Setup 1.4.0.
- [ ] Nenhum espaço extra em disco além do próprio instalador.

## 2. Backup

- Nenhum backup pré-migração é gerado nesta versão, porque o esquema não muda.
- Backups criados na 1.3.x (formato 3) restauram na 1.4.0 sem conversão.
- Backups criados na 1.4.0 restauram na 1.3.x (mesmo esquema e formato; a restauração não recusa
  backup de versão mais nova). Os favoritos, recentes e modelos já convertidos ficam escondidos na
  1.3.x; ver seção 6.

## 3. O que muda: preferências de relatório

Na primeira vez que cada pessoa abre **Relatórios** na 1.4.0, o programa lê três chaves da tabela de
configuração (`appSettings`) daquela pessoa e da empresa:

| Chave | O que guarda | Conversão |
|---|---|---|
| Favoritos | ids de relatório | id antigo vira `relatório-novo#id-antigo` (a visão antiga continua aparecendo com o nome de antes) |
| Recentes | id + modelo | id antigo vira o relatório novo + `presetId` com o id antigo |
| Modelos salvos | colunas, filtros, agrupamento, totais | passam a apontar para o relatório novo; condições fixas do relatório antigo viram filtros; ganham o modo (Resumido se agrupado, Detalhado se não) e `migratedFrom` |

Regras de segurança:

- **Nada é apagado.** O modelo convertido guarda o id antigo em `migratedFrom`.
- **Repetível (idempotente):** abrir Relatórios de novo não converte nem audita duas vezes.
- **Auditoria:** cada conversão grava `entidade = appSettings`, `acao = ATUALIZAR`,
  `origem = relatorios-consolidacao-1.4.0` e o resumo "Relatório consolidado: *antigo* → *novo*".
- **Falha de gravação:** se a configuração não puder ser gravada (banco somente leitura, por exemplo),
  a tela usa a conversão em memória e tenta de novo na próxima abertura. Nenhum favorito some.
- Links antigos (`?r=rebanho.dimensao.raca`) não dependem da conversão: o id antigo é resolvido na hora.

## 4. Relatório esperado

Em **Backup e Manutenção › aba Controle › Trilha de auditoria**, filtrar Origem =
`relatorios-consolidacao-1.4.0`. Uma linha por preferência convertida, por exemplo:

- "Relatório consolidado: rebanho.dimensao.raca → rebanho.atual (favorito)."
- "Relatório consolidado: saidas.mortes.causa → saidas (modelo)."

Quem não tinha favoritos, recentes nem modelos não terá nenhuma linha. O gate
`reports:catalog-consolidation:verify` confere essa conversão com 8 preferências antigas.

## 5. Verificação após a atualização

- [ ] Barra superior mostra **v1.4.0**.
- [ ] Backup e Manutenção › Status: banco 8, backup formato 3.
- [ ] **Verificar integridade**: "Banco íntegro."
- [ ] Contagens de animais e pesagens iguais às de antes.
- [ ] Relatórios: favoritos e modelos antigos abrem e mostram os mesmos números de antes.

## 6. Rollback

**Voltar para a 1.3.2:** desinstale a 1.4.0 (os dados não são apagados na desinstalação) e instale a
1.3.2. O banco abre normalmente (mesmo esquema 8) e animais, pesagens e demais dados ficam como
estavam. Depois disso:

- Os modelos salvos, favoritos e recentes **já convertidos** apontam para relatórios que a 1.3.2 não
  conhece (`rebanho.atual`, `desempenho`, `movimentacao.lotes`…). A 1.3.2 **esconde** esses itens (não
  apaga e não dá erro); reinstalando a 1.4.0 eles voltam.
- Para ter na 1.3.2 os modelos e favoritos de antes, restaure o backup criado no passo 1 da seção 1.
  Atenção: a restauração volta **todo** o banco para aquele momento; o que foi lançado depois
  precisa ser lançado de novo. Por isso, se a volta for necessária, prefira fazê-la logo.

Nunca edite o JSON do backup manualmente.

## 7. Tempo

- Instalação: a mesma de qualquer Setup da 1.3.x.
- Migração de banco: **nenhuma** (0 s).
- Conversão das preferências: só lê e grava 3 chaves de configuração. O gate
  `reports:catalog-consolidation:verify` inteiro (12 relatórios, 33 visões, 8 conversões auditadas,
  segunda passada idempotente e os casos de aceite) roda em cerca de **0,5 s** no Node; a conversão em
  si é parte disso. Tempo no aplicativo instalado: a medir no teste da responsável.

Critério de parada (Plano Mestre 2, regras comuns): perda de dados, migração irreversível, backup
inválido, integridade vermelha, duplicação de animal/identificador ou falha de restore interrompem a
release.
