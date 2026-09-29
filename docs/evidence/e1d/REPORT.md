# REPORT — E1D "Relatório de Pesagens Individuais" igual ao MAKGESTAO

**ETAPA:** E1D (ainda a 1.4.0, não distribuída). O visual (E1E) também entrou aqui, por decisão da
responsável ("Junto, agora").
**VERSÃO:** 1.4.0, com esquema Dexie 8 e backup formato 3, sem mudança de esquema.
**BRANCH:** `program/e1-relatorios`, de `2d51951` até o build em `d428d4a`, mais o commit deste REPORT. A main
continua em `6cccb5f`.
**DATA:** 29/09/2026

**STATUS: CONCLUÍDA.**
- test:quick: **89/89 verdes**. O test:full não foi rodado, como pede o PROMPT-01D, porque nada de esquema mudou.
- Tudo foi commitado antes do build, e o **instalador novo** foi gerado. A cópia está em `..\INSTALAR-ESTE-1.4.0\`
  (seção 3).
- Falta o seu teste no instalador. Depois dele vem o fast-forward da main.

---

## 1. O que foi feito

**Os 5 tipos do MAKGESTAO** vêm com os nomes e a ordem do antigo:
1. Analítico (Detalhado)
2. Sintético (Matriz)
3. Por Apartação/Lote
4. **Por Apartação (Resumo por Data)** — é o tipo com que Pesagens abre.
5. Vendas (Detalhado)

Os tipos da E1B saíram: "Resumo por Sessão", "Por lote", "Por data" e "Analítico por animal".
- Um modelo salvo ou o último estado que usava um deles abre no tipo novo mais próximo:
  - Por lote → Por Apartação/Lote;
  - Por data e Sessão → Resumo por Data;
  - Analítico por animal → Analítico.
- A troca fica gravada na auditoria (origem `relatorios-tipos-e1d`) e é feita uma vez só.
- Links e favoritos de relatórios antigos da E1 abrem a seleção deles como "Personalizado".

**Sintético (Matriz).**
- **Linhas (Eixo Y) × Colunas (Eixo X)**, cada um entre Lote, Apartação, Sexo, Raça e Mês. O padrão do
  antigo é Sexo × Lote.
- Cada célula tem **Qtd** (animais distintos), **Peso médio** e **GMD médio** ponderado.
- A linha e a coluna **TOTAL** são recalculadas sobre todos os animais, nunca somando médias.
- O mês sai como "set/2026", em ordem de data. O antigo ordenava os meses por texto.
- Escolher o mesmo eixo nos dois lados troca os eixos de lugar.
- Clicar numa célula abre o detalhe dela.
- No Excel, a matriz sai numa planilha.

**Vendas (Detalhado), igual ao PDF que você mandou** (`referencia-makgestao/print-responsavel-vendas-w3.pdf`):
- Blocos, na ordem do antigo:
  - Métrica/Valor;
  - TOTAIS POR MARCA;
  - TOTAIS POR COMPRADOR;
  - VENDAS POR COMPRADOR, com o quadro de cada comprador e o botão **Mostrar Detalhes** (começa desligado,
    como no antigo);
  - TOTAL GERAL.
- A população é só de saídas por venda. É uma condição fixa do tipo, com cadeado: nenhum controle da tela
  a amplia.
- **Valor total** = o valor digitado; sem ele, **peso ÷ divisor da @ × valor da @**, como no antigo. Com os
  números do seu PDF a conta dá R$ 523.024,80, e o gate confere isso.
- **Média valor da arroba** = média ponderada pelas arrobas. Com um preço só, dá o mesmo R$ 383,00 do antigo.
- O Excel sai com os mesmos blocos.
- Quem não tem valores comerciais (OPERADOR, CONSULTA) vê o relatório sem nenhum valor, sem erro.

**Analítico (Detalhado).**
- Botões **Agrupar Por**: Lote, Apartação, Sexo e Raça, na ordem de clique, até 3 níveis.
- Colunas do antigo: Data, Animal, Sexo, Raça, Peso, Lote, Apartação, Dias, Ganho e GMD. Data anterior,
  Peso anterior e Observação ficam no seletor.
- Subtotal por grupo com animais, peso médio e GMD médio, e o total geral.

**Colunas por tipo e por usuário.**
- Os resumidos abrem com Lote, Qtd, Faixa Exigida, Menor, Maior, Peso Médio, Média (@), Peso Total,
  GMD Médio, Machos e Fêmeas. Os outros 6 totais ficam em "Colunas Painel".
- A escolha fica guardada para cada tipo e para cada usuário (preferência nova, sem esquema).

**Ordenar Por** tem as 8 opções do antigo, com os mesmos rótulos: Data (Mais Recente/Mais Antiga),
Peso (Maior/Menor), GMD (Maior/Menor), Animal (A-Z) e Lote (A-Z). Cada opção é traduzida para cada tipo:
- **Analítico e Vendas:** ordena as linhas dentro de cada grupo.
- **Resumidos:** as datas seguem a direção escolhida, e os lotes seguem a métrica equivalente dentro de
  cada seção.
- **Matriz:** ordena as linhas pelo total da linha.

**Tela e folha como as do MAKGESTAO** (sua decisão: "igual no visual, contas certas").
- **Tela:**
  - no alto, "Relatório de Pesagens Individuais", "Análise e impressão" e o botão verde **Imprimir**, com
    Excel, PDF e o menu ⋯ ao lado;
  - no cartão de filtros, Data Início, Data Fim, Orientação (Retrato/Paisagem), Tipo Relatório,
    Ordenar Por e Pesagem Anterior;
  - os botões Lotes, Apartações, Sexo, Raças, Era, Marcas, Status e Limpar Filtros;
  - embaixo, sempre a folha.
- **Folha:**
  - cabeçalho centralizado e título com a linha grossa;
  - "APARTAÇÃO: …" e "DATA: …";
  - **"kg" em cada peso**, **subtotal em linha de texto** e **"-" no zero**;
  - TOTAL POR LOTE e TOTAL GERAL.
- As contas continuam as do motor atual: animal contado uma vez só, GMD ponderado, meses em ordem.
- Só Pesagens mudou de cara. Os outros relatórios ficaram iguais (conferido byte a byte), e Excel e CSV
  continuam com números de verdade.

**Folha mais enxuta em todos os relatórios** (item 8 da especificação):
- abaixo do título, só o período;
- sem "Emitido em" no cabeçalho e sem notas longas;
- no rodapé: filtros numa linha, "@ = peso vivo ÷ N", quem emitiu e quando, e "Página X de Y";
- o telefone só aparece no cabeçalho com "Mostrar CPF/CNPJ, IE e telefone no cabeçalho" marcado. O padrão é
  desmarcado.

**Respostas ao REPORT da E1C.**
1. Ctrl+Z: fica como está.
2. **Grade de Parceiros e Propriedades:**
   - o CPF/CNPJ aparece com máscara (a de Propriedades ganhou a coluna);
   - a pesquisa e o filtro acham o documento com ou sem pontuação;
   - o que é gravado não muda.
3. Excel: confirmado, nada muda.
4. **USUARIOS.md** descreve os 4 perfis: ADMIN, GESTOR, OPERADOR e CONSULTA.

**Como foi feito.**
1. **Parte funcional:** 4 agentes em paralelo, cada um no seu worktree: A (Matriz), B (Vendas),
   C (Analítico, colunas e ordenação) e D (tipos, folha e respostas).
   - Antes deles, eu escrevi e commitei os contratos (`docs/evidence/e1d/CONTRATOS-AGENTES.md`).
   - Cada parte passou por uma **revisão adversarial**. Todos os defeitos confirmados foram corrigidos, entre
     eles:
     - "Resumido" e "Agrupar por" soltavam a condição de Vendas;
     - lotes de mesmo nome em apartações diferentes ficavam iguais na Matriz;
     - um defeito meu na estrutura comum, que fazia os outros relatórios abrirem com erro.
   - A junção foi feita na ordem D → C → A → B.
2. **Parte visual:** mais 3 agentes, para a folha, a tela e Vendas.
   - Aqui pulei a revisão automática para acelerar, como você pediu.
   - No lugar dela, conferi com os gates e com capturas da tela real.

## 2. Arquivos (62 de código e docs + evidências, `2d51951..d428d4a`)

- **Novos, domínio:** `domain/sortChoices.js`, `groupChoices.js`, `typeColumns.js`, `matrixLayout.js`,
  `vendasLayout.js`, `reportScreenState.js`; `definitions/legacyViews.js`; `application/reportInitialState.js`.
- **Novos, exportação:** `infrastructure/exporters/vendasHtml.js` e `vendasXlsx.js`.
- **Novos, tela:** `components/reports/MakgestaoScreen.jsx`, `AnalyticGroupButtons.jsx` e `MatrixAxisControls.jsx`.
- **Alterados:**
  - relatórios: `reportDefinition.js`, `reportViews.js`, `reportService.js`, `reportTemplateService.js`,
    `reportDocument.js`, `summaryLayout.js`, `reportFormatting.js`, `reportPermissions.js`, `pesagens.js`,
    `eventColumns.js` (colunas "Mês" e "Valor total" de venda), `sheetHtml.js`, `sheetStyles.js`,
    `xlsxExporter.js`, `reportLayout.js`, `printDocument.js`, `ReportView.jsx`, `ReportFilterBar.jsx`,
    `ReportSheetView.jsx`, `reports.css`, `Relatorios.jsx`;
  - cadastros: `CadastroAuxiliarPage.jsx`, `registryFormModel.js`, `registryDefinitions.js`,
    `propertyHeader.js`, `PropertyHeaderPreview.jsx`.
- **Gates novos:** `reports:pesagens-tipos`, `reports:columns-per-type`, `reports:matrix` e
  `reports:vendas-por-comprador`, ligados no test:quick e no test:full.
- **Gates atualizados** (a intenção de cada um foi mantida): sheet-data, document-layout, sheet-xlsx-parity,
  templates, print-contract, pdf-contract, property-header, document-mask e user-docs.
- **Docs:**
  - `CHANGELOG.md` e `docs/release/1.4.0/{RELEASE-NOTES,RELEASE-CHECKLIST}.md`;
  - `docs/user/{RELATORIOS,USUARIOS,CADASTROS}.md`;
  - `docs/reporting/EXPORT-CONTRACT.md`.
- **Evidências** (`docs/evidence/e1d/`):
  - **um PDF de cada tipo** com a massa de TESTE: `pesagens-1-analitico-detalhado.pdf`,
    `pesagens-2-sintetico-matriz.pdf`, `pesagens-3-por-apartacao-lote.pdf`,
    `pesagens-4-por-apartacao-resumo-por-data.pdf`, `pesagens-5-vendas-detalhado.pdf` e, com "Mostrar
    Detalhes", `pesagens-5b-…pdf`, cada um com a 1ª página em PNG;
  - prints da tela: `tela-pesagens-resumo-por-data.png`, `tela-pesagens-vendas.png` e
    `tela-pesagens-vendas-mostrar-detalhes.png`;
  - a referência do antigo.

**Commits** (primeiro pai):
- `8658e93` especificação
- `f4fff85` contratos
- `0b747cd`, `ff7bb3b`, `a7d38f3`, `9664927` junção D, C, A, B
- `c391e04` gates
- `96f5828`, `e7f9e0a`, `c8b0eaf` tela
- `6868fec` folha
- `b99012c` Vendas
- `c0cd62e` Mostrar Detalhes
- `d428d4a` docs e evidências
- mais o commit deste REPORT

**Sem push. A main continua em `6cccb5f`.**

## 3. Gates

| Comando | Resultado |
|---|---|
| `npm run test:quick` | **89/89 verdes** no commit do build `d428d4a`, com a árvore limpa |
| `npm run test:full` | **Não executado** (PROMPT-01D: "não rode o test:full nesta etapa; nada de esquema mudou") |
| `reports:pesagens-tipos` (novo) | OK: 5 tipos, nomes, ordem e padrão; estado inicial; conversão auditada e idempotente; título Analítico/Sintético; todo relatório do catálogo abre |
| `reports:columns-per-type` (novo) | OK: colunas padrão de cada tipo; a escolha fica por tipo e por usuário; as 8 ordenações em cada tipo ("2" antes de "10", ausentes por último) |
| `reports:matrix` (novo) | OK: casos 2×2 e 3×4 conferidos à mão; totais recalculados; GMD ponderado; eixos iguais recusados; mês em ordem de data; folha × XLSX; filtros |
| `reports:vendas-por-comprador` (novo) | OK: o caso do seu PDF (R$ 523.024,80); o valor digitado prevalece; divisor 15; média ponderada × simples; por marca e por comprador; Mostrar Detalhes; permissão; folha × XLSX; população |
| `npm run dist:unsigned` | OK: build, electron-builder sem assinatura, checksum, manifesto e os 3 diagnósticos do pacote |
| `release:current-only` / `release:version-contract` | OK |

**Instalador novo da 1.4.0 (sem assinatura):**
- **Arquivo:** `C:\Users\maike\Desktop\projeto\INSTALAR-ESTE-1.4.0\Pesagens Individuais Setup 1.4.0.exe`. É a
  mesma cópia de `MAKGESTAO-main\release-unsigned\`.
- **Tamanho:** 92.192.258 bytes (87,9 MB), gerado em 29/09/2026 às 08:35.
- **SHA-256:** `32754ed23fb5ddde6a5b54ba47764267ae21a30b67a568c39247a5d05b4f8811`. É o mesmo do `.sha256`,
  do manifesto e da cópia.
- **Manifesto:** `gitCommit: d428d4a`, sem "-dirty"; versão 1.4.0; esquema 8; backup formato 3;
  `signed: false`.
- **Substitui** o instalador da E1C (`e584a7fa…`).

## 4. Migração

- **Banco:** nenhuma migração. Esquema Dexie 8 e backup formato 3.
- **O que é gravado de novo** (em `appSettings`, que é chave-valor, e sem esquema):
  - a escolha de colunas por tipo (`report-type-columns:<empresa>:<usuário>`);
  - o tipo, os eixos e a ordenação nos modelos e no último estado.
- **Conversão dos tipos da E1B:** acontece ao abrir Relatórios, fica na auditoria e é feita uma vez só.
- **Rollback para a 1.3.2:** igual ao da E1B/E1C (`MIGRATION-1.3.0-TO-1.4.0.md`). As chaves novas ficam sem uso.

## 5. O que NÃO foi feito e por quê

- **Não fiz:** push, avanço da main, mudança de esquema, nem itens da E2 em diante.
- **Menu Relatórios abrir direto nesta tela:** a especificação (item 9) deixou isso para a E1E. Continua
  abrindo o catálogo; Pesagens abre no tipo padrão.
- **"Mostrar Detalhes" do Por Apartação/Lote** (os animais de cada lote, no antigo): não estava pedido e
  não entrou (pergunta 6).
- **Revisão adversarial da parte visual:** pulada para ganhar tempo, a seu pedido. No lugar dela, conferi
  com os gates, com capturas da tela real e com os PDFs.
- **Teste físico e teste no app instalado:** NÃO EXECUTADOS por mim. É o seu teste (seção 7).

## 6. Riscos e pendências

- **Instalador sem assinatura:** o SmartScreen avisa; use "Mais informações › Executar assim mesmo".
- **Valor de Vendas × Lançamento:** o relatório usa peso ÷ 30 × valor da @, como o antigo. A "Estimativa
  comercial" do Lançamento usa a @ de carcaça (rendimento ÷ 15), então os dois podem dar valores diferentes
  para a mesma venda sem valor digitado (pergunta 1).
- **Período padrão:** continua sendo os últimos 30 dias. O antigo, com as datas em branco, mostrava tudo
  (pergunta 3).
- **Aviso de CSS no build:** "css-syntax-error" já existia na E1C e não vem desta etapa.
- **A 1.4.0 da E1C está instalada nesta máquina:** o Windows mostra a 1.4.0, apesar de o prompt dizer que
  não foi instalada. O instalador novo instala por cima. A cópia dos seus dados antes da 1.4.0 continua em
  `Documentos\Pesagens-copia-dos-dados-antes-da-1.4.0-2026-09-28_07-07`.

## 7. Como a responsável testa (no app instalado — o teste único de E1 + E1B + E1C + E1D)

1. **Instalar:**
   - faça **Backup e Manutenção › Criar backup completo**;
   - rode o **Setup 1.4.0** da pasta `INSTALAR-ESTE-1.4.0` (SHA-256 na seção 3);
   - a barra deve mostrar **v1.4.0**.
2. **Cadastros › Propriedades:**
   - preencha o Cabeçalho dos relatórios e o logo;
   - digite e cole um CNPJ (máscara);
   - na **lista**, o CPF/CNPJ aparece formatado;
   - pesquise o documento sem pontuação e depois com pontuação: acha dos dois jeitos.
3. **Relatórios › Pesagens:**
   - abre em **Por Apartação (Resumo por Data)**, com a tela do MAKGESTAO;
   - confira o título, o quadro de filtros, "kg" em cada peso, o subtotal em linha, TOTAL POR LOTE e
     TOTAL GERAL;
   - use **Colunas Painel**: tire e ponha colunas, saia e volte, e a escolha continua.
4. **Tipo Relatório** — troque entre os 5:
   - **Analítico:** clique Lote e depois Sexo em Agrupar Por;
   - **Sintético (Matriz):** troque Linhas e Colunas e ponha Mês;
   - **Por Apartação/Lote;**
   - **Vendas:** compare com o seu PDF da W3 e clique **Mostrar Detalhes**.
5. **Ordenar Por:** experimente Peso (Maior) e Data (Mais Antiga).
6. **Imprimir, PDF e Excel** de um tipo resumido e de Vendas. Imprima numa impressora de verdade (teste físico).
7. **Configurações › Relatórios:** troque o divisor da @ para 15 e veja o rodapé e o Valor total de Vendas.
   Volte para 30.
8. **Tema escuro:** abra uma ficha de Cadastros; os campos devem estar legíveis.
9. **Itens da E1:**
   - Relação de Pesagens › Ações em lote abre sem erro;
   - Backup e Manutenção › aba Controle;
   - **Verificar integridade** diz "Banco íntegro.".

## 8. Perguntas para a responsável

1. **Valor da venda sem valor digitado:** o relatório segue o antigo (peso ÷ 30 × valor da @). A "Estimativa
   comercial" do Lançamento usa a @ de carcaça e pode dar outro número. Qual das duas contas vale?
2. **Média do valor da @:** ficou ponderada pelas arrobas. Com preços diferentes, por exemplo R$ 300 e R$ 290,
   dá R$ 298,29; o antigo fazia média simples, R$ 298,00. Pode ficar a ponderada?
3. **Datas em branco = todo o período,** como no antigo? Hoje o relatório abre nos últimos 30 dias ou como
   você deixou.
4. **Matriz com Mês e "Data (Mais Recente)":** os meses saem do mais novo para o mais antigo. Prefere
   sempre em ordem de data?
5. **Menu Relatórios** (item 9 da especificação, ficou para a E1E): quer que ele abra direto no Relatório
   de Pesagens Individuais?
6. **"Mostrar Detalhes" no Por Apartação/Lote** (os animais de cada lote, como no antigo): quer?
7. **Rodapé:** a versão do programa e o código da emissão saíram do papel (continuam no manifesto do
   arquivo). Quer o código de volta?
8. **Telefone no cabeçalho** agora só aparece com a opção marcada. Confirma?
