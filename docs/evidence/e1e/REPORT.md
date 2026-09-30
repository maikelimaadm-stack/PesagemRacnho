# REPORT — E1E Todos os relatórios no estilo do MAKGESTAO, numa tela só com seletor

- **Etapa:** E1E. Pedido direto da responsável em 30/09/2026 (especificação em
  `docs/plano-mestre/E1E-TODOS-RELATORIOS-ESTILO-MAKGESTAO.md`).
- **Versão:** 1.4.0, com esquema Dexie 8 e backup formato 3, sem mudança.
- **Branch:** `program/e1-relatorios`, de `6f12b87` (fim da E1D) até o build em `7c3cea1`, mais o commit deste
  REPORT. A main continua em `6cccb5f`.

**STATUS: CONCLUÍDA.**
- test:quick: **93/93 verdes**.
- O instalador novo foi gerado e copiado para `..\INSTALAR-ESTE-1.4.0\`.

## 1. O que foi feito

**Tela única.** O menu Relatórios abre direto a tela do MAKGESTAO, no último relatório usado (na primeira vez,
Pesagens).
- O primeiro campo do quadro é **Relatório**, com os 10 relatórios do perfil separados por assunto.
- Trocar o relatório abre o outro como você o deixou.
- O catálogo em cartões saiu. Os modelos salvos ficam no menu ⋯ (Abrir modelo, Salvar modelo).
- Links, favoritos e modelos antigos continuam abrindo.
- Relatórios sem período (Rebanho atual, Ocupação de lotes) mostram "Estado atual (hoje)" no lugar das datas.

**Tipos em todos os relatórios**, no lugar do "Agrupar por" genérico.
- São 53 tipos no total, cada relatório com o seu padrão. A lista está no guia (`RELATORIOS.md` §2).
- Os antigos relatórios separados da 1.3.x viraram tipos.
- Tipos que são condição do relatório têm a população fixa, com cadeado: Sem Pesagem Recente, Perdendo Peso,
  as Mortes, Mudanças de Lote e Com Pendências.

**Comercial.** Vendas do período, Abates do período e Compras do período viraram um relatório só, com três tipos:
- **Vendas:** o relatório de venda do MAKGESTAO (PDF da W3), com as mesmas contas da E1D.
- **Abates:** por frigorífico, com as contas de abate gravadas.
- **Compras:** por origem.

Os três usam o mesmo desenho: Métrica/Valor, totais por marca e por grupo, quadros com Mostrar Detalhes e TOTAL
GERAL. Os ids antigos abrem o tipo certo, e modelos, favoritos e recentes foram convertidos com auditoria
(`relatorios-comercial-e1e`).

**Folha no estilo do MAKGESTAO em todos os relatórios.**
- Cabeçalho, título com a linha, unidades nas células, totais em linha de texto e "-" no zero.
- Os números são os do motor.
- Excel, CSV e JSON não mudaram.
- A folha de Pesagens ficou idêntica à da E1D (conferido byte a byte).

**Como foi feito.** Quatro agentes em paralelo (tipos, comercial, folha e tela), sem revisão automática, porque
você pediu pressa. Eu juntei as quatro partes e conferi pelos gates e por prints da tela real.

**Evidências** (`docs/evidence/e1e/`), com dados de TESTE:
- `tela-1-relatorios-abre-direto.png`
- `tela-2-seletor-relatorio.png`
- `tela-3-rebanho-atual-tipos.png`
- `tela-4-comercial-vendas.png`

## 2. Gates

| Comando | Resultado |
|---|---|
| `npm run test:quick` | **93/93 verdes** no commit do build `7c3cea1`, com a árvore limpa |
| `reports:tipos-todos` (novo) | OK: 10 relatórios, 53 tipos rodados no motor; estados antigos abrem |
| `reports:comercial` (novo) | OK: 3 tipos, população, contas conferidas à mão, permissão, conversão dos ids antigos, folha × XLSX |
| `reports:folha-makgestao-todos` (novo) | OK: todos os relatórios no estilo do MAKGESTAO, colunas alinhadas, folha vazia |
| `reports:tela-unica` (novo) | OK: opções do seletor por perfil, relatório inicial, campos do quadro |
| `npm run dist:unsigned` / `release:current-only` / `release:version-contract` | OK |
| `npm run test:full` | Não executado: nada de esquema mudou |

**Instalador novo da 1.4.0:**
- Local: `C:\Users\maike\Desktop\projeto\INSTALAR-ESTE-1.4.0\Pesagens Individuais Setup 1.4.0.exe`.
- Tamanho: 92.196.847 bytes.
- **SHA-256:** `140b65d011fafde481849138698f7eab42411c22396bccc4483f6a11d0f34729`. É o mesmo do `.sha256`, do
  manifesto e da cópia.
- Manifesto: `gitCommit: 7c3cea1`, sem "-dirty".
- Ele substitui o instalador da E1D.

## 3. O que não foi feito

- Push e avanço da main não foram feitos.
- Mudança de esquema: nenhuma.
- A **Manutenção › aba Controle** continua com a tela antiga (pergunta 3).
- A revisão adversarial foi pulada, a seu pedido.
- Teste físico e teste no app instalado: fica para você, com o roteiro da E1D (`docs/evidence/e1d/REPORT.md`
  §7) mais os passos novos:
  1. Abra Relatórios e troque o campo **Relatório**.
  2. Em cada relatório, troque o **Tipo Relatório**.
  3. No **Comercial**, confira Vendas, Abates e Compras.

## 4. Perguntas para a responsável

1. **Favoritos:** a estrela e a aba Favoritos eram do catálogo, que saiu. Quer "Favoritos" no menu ⋯?
2. **Filtrar por colunas que não têm botão** (ex.: Motivo da saída, Comprador): quer um botão "Mais filtros…"?
3. **Manutenção › Controle:** esses relatórios também devem ir para a tela do MAKGESTAO?
4. **Romaneio de embarque:** deve abrir no resumo "Por Embarque/Documento", como hoje, ou direto na lista de
   animais de cada documento?
5. **Sem Pesagem Recente** está fixo em mais de 30 dias. Quer o número de dias como campo no quadro?
6. **Abate sem valor digitado:** hoje fica "-". Deve calcular @ de carcaça × valor da @?
7. **Compras:** só entram os cadastros com valor pago por cabeça, como no relatório antigo. Quer ver também os
   sem valor?
8. **Período padrão:** o Comercial abre em 90 dias e Pesagens em 30. Pode ficar assim?
9. As 8 perguntas do REPORT da E1D continuam abertas (valor de venda × estimativa de carcaça, média ponderada,
   datas em branco = tudo etc.).
