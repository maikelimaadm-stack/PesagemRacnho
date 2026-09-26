# REPORT — E1C Ajustes finais da 1.4.0 (respostas ao REPORT da E1B) e instalador final

**ETAPA:** E1C (ainda a 1.4.0, não distribuída) · **VERSÃO:** 1.4.0 (esquema Dexie 8 e backup formato 3,
sem mudança) · **BRANCH:** `program/e1-relatorios` (de `180ccb1` a __HEAD__; main continua em `6cccb5f`) ·
**DATA:** 26/09/2026

**STATUS: CONCLUÍDA.** test:quick __TQ__ e test:full __TF__. Tudo foi commitado antes do build
(manifesto com `gitCommit` limpo) e o **instalador FINAL da 1.4.0** foi gerado (seção 3). Falta o seu
teste único no instalador; depois dele vem o fast-forward da main.

---

## 1. O que foi feito

**Respostas 1 a 7 (confirmações).** Colunas vazias somem no relatório inteiro; subtotal em linha
alinhada; unidades no cabeçalho; zero = "—"; faixa do cadastro atual; "com pesagem anterior" sem
Cadastro/Saída; Qtd com cabeças distintas; cabeçalho de Pesagens sempre com a propriedade Padrão. Nada
mudou no código por causa delas.
- **Pendência para a E3 (resposta 5):** *guardar a faixa do lote na pesagem (foto no dia)*. Hoje a
  "Faixa exigida" vem do cadastro atual do lote.

**Resposta 8 — máscara de CPF/CNPJ** (commits `6dc374e` e `edd7a47`). Vale nas fichas de **Parceiros** e
de **Propriedades** (o mesmo campo `documento`):
- **Formatos:** CPF `000.000.000-00` (até 11 dígitos); CNPJ `00.000.000/0000-00` (12 a 14, ou com letra);
  CNPJ alfanumérico em maiúsculas (`12.ABC.345/01DE-35`).
- **Digitar e colar:** funcionam com ou sem pontuação e até com o rótulo na frente ("CNPJ:", "CPF ",
  "CNPJ-"), que é descartado. O limite é de 14 posições.
- **Edição no meio:** o cursor fica onde a pessoa edita, e o Backspace logo depois de um ponto apaga o
  número anterior.
- **O que é gravado não muda:** o serviço continua guardando `normalizeDocument`, sem pontuação. Ao abrir
  a ficha, o documento guardado aparece formatado; documento antigo fora do padrão aparece como está e
  não é alterado ao salvar sem mexer.
- **CNPJ alfanumérico incompleto ou com dígito verificador errado:** o **Salvar** avisa e não grava.
  Antes as letras sumiam caladas e ficava um número que não existe.
- Funções puras em `documentMask.js`, componente `DocumentInput.jsx`. A folha (`formatDocumento`) usa os
  mesmos separadores.

**Resposta 9 — Excel com o bloco TOTAL POR** (commit `82f149f`). No XLSX do Resumido com 3 níveis, no fim
de cada apartação vem o bloco da folha:
- título "TOTAL POR LOTE – ENGORDA";
- uma linha por lote;
- a linha "Total Engorda".

Os números são os mesmos da folha **por construção**: a mesma função (`buildLeafTotalBlock`) calcula os
dois. O gate novo `reports:sheet-xlsx-parity` compara folha × XLSX célula a célula. O CSV e o JSON não
mudaram; com 1 ou 2 níveis, o XLSX também não. **Aberto no Excel 16 da máquina** (instância separada,
somente leitura): abriu sem reparo, e o próprio Excel leu o bloco com os números da folha (evidências).

**Resposta 10 — GESTOR em Configurações › Relatórios** (commits `200a7f1` e `f8dae2c`).
- **Permissão nova `settings.reports`** (ADMIN e GESTOR), usada pela seção Relatórios (divisor da @) e
  pelo serviço.
- **O que o GESTOR vê:** Configurações no menu e, na tela, **só o cartão Relatórios**. Geral, Curral,
  Comercial e Dados pedem `settings.manage`; Segurança pede `settings.auth` (ADMIN). OPERADOR e CONSULTA
  continuam sem Configurações.
- **"O resto continua ADMIN" também por dentro** (achado da revisão final): o serviço passou a recusar o
  GESTOR em Geral, Curral e Comercial. Antes, desde o ADR-042, o serviço aceitava, embora a tela nunca
  mostrasse esses cartões a ele. Só a tela grava esses grupos, então nada muda para quem usa.
- **Defeito antigo corrigido:** com o "Rendimento de carcaça padrão (%)" em branco (o padrão), o Salvar
  de **qualquer** seção era recusado. Agora branco = sem rendimento padrão.
- A tabela oficial de permissões (doc 11 §4) voltou a bater com o código e ganhou um gate de paridade.

**Resposta 11 — título** (commit `876cfbd`). A folha de Pesagens sai como **"Relatório de Pesagens
Individuais (Sintético)"** / "(Analítico)". O nome do cartão, do arquivo e do manifesto continua
"Pesagens", e os outros relatórios usam o próprio nome. É o campo opcional `sheetTitle` da definição.

**Tarefa 12 — tema escuro** (commits `fd64d71` e `ee13452`).
- **Causa:** a regra comum dos campos do tema claro (`mg-layout.css`) força
  `-webkit-text-fill-color: var(--text-1)` (#111827) com `!important`. No escuro, ela vencia o `color`
  claro. Medido: `color rgb(230,237,243)`, `fill rgb(17,24,39)`, fundo `rgb(33,38,45)`.
- **Correção:** no escuro, o preenchimento segue a cor do campo (`currentColor`), com especificidade
  acima das regras do claro. Vale para todas as fichas do padrão ModeloBase1; o tema claro não muda.
- **Captura antes/depois:** fichas de Propriedade e de Parceiro. Depois da correção,
  `fill = color = rgb(230,237,243)`.
- **Configurações no escuro:** os seletores recebem o fundo de campo escuro, como nas fichas (antes era
  branco, e com o texto claro o valor sumia). Captura com ADMIN e com GESTOR.
- Gate novo `ui:dark-field-text`: estrutura e especificidade calculada, com caso negativo.

**Tarefa 13 — gates antigos do Dexie** (commit `c2f98a9`). `verify-dexie-backup.mjs` e
`verify-dexie-import-restore.mjs` agora leem `CATEGORIAS_SEED.length` em vez do número fixo 7.
`npm run storage:all:verify`: **10/10 verdes**.

**Revisões adversariais.**
- **Implementação** (workflow com 3 agentes em paralelo, cada um revisado por outro agente):
  - não houve defeito de comportamento;
  - os revisores acharam **gates que não pegavam mutações** e os reforçaram, por exemplo a ligação do
    campo com máscara, o contrato de `buildLeafTotalBlock` e a simulação de menu e seções por papel;
  - na integração, eu achei e corrigi um defeito da máscara: colar "CNPJ 12.ABC.345/01DE-35" gravava
    "123450135".
- **Revisão final** (4 lentes): **3 achados confirmados**, todos de gravidade baixa e corrigidos em
  `f8dae2c` e `edd7a47`:
  - rótulo digitado com hífen cortava o documento;
  - `USUARIOS.md` prometia a recusa "por dentro" que o serviço não fazia;
  - CNPJ alfanumérico inválido virava só números calado.

  2 achados foram refutados. A lente de Relatórios não achou nada.
- **Segunda rodada** (a lente de permissões, Configurações e tema escuro tinha travado na primeira, com a
  máquina suspensa, e foi refeita junto com uma conferência das correções da máscara):
  - **1 confirmado (médio), regressão minha, corrigido em `ee13452`:** no tema escuro, os seletores de
    Configurações, inclusive o divisor da @ (o único campo do GESTOR), têm fundo **branco**. Esse fundo
    vem da regra antiga "campo preenchido". Com o texto passando a seguir a cor clara do tema, o valor
    sumia (contraste 1,18). Agora esses seletores têm o fundo de campo escuro, como nas fichas de
    Cadastros. Medido: contraste 12,88 nos 7 seletores, com ADMIN e com GESTOR; no claro, sem mudança
    (17,74). O gate do tema escuro passou a cobrir isso.
  - **3 refutados:**
    - chips de Papéis em Parceiros com pouco contraste no escuro: é anterior à E1C e não é texto de
      campo;
    - pré-visualização do cabeçalho com documento inválido: ela mostra o que seria salvo, e o Salvar
      recusa;
    - rótulo composto "CPF/CNPJ-…" digitado: limite conhecido do rótulo grudado, visível e recusado no
      Salvar.

**Evidências** (`docs/evidence/e1c/`). Foram feitas no harness de desenvolvimento, que monta as telas
reais: sessão simulada sem senha, Electron com perfil isolado e recriado, e dados de **teste**
("PRODUTOR DE TESTE", "FAZENDA BOA VISTA (TESTE)", CNPJ fictício 11.222.333/0001-81).
- **Ficha com a máscara:**
  - `mascara-parceiro-cnpj-alfanumerico-digitado.png`: "12abc34501de35" digitado tecla a tecla vira
    12.ABC.345/01DE-35 (passo a passo em `capture-mascara.json`);
  - `mascara-parceiro-cpf-digitado.png`;
  - `mascara-propriedade-documento-formatado.png`: documento guardado só com dígitos aparece formatado,
    igual à pré-visualização.
- **XLSX aberto no Excel mostrando o bloco TOTAL POR:**
  - `xlsx-excel-total-por.png`: janela do Excel 16 com o arquivo aberto somente leitura, sem reparo;
  - `xlsx-excel-total-por-bloco.png` e `xlsx-excel-total-por.pdf`: a área do bloco, exportada em PDF pelo
    próprio Excel;
  - `excel-leitura-do-bloco.json`: as células lidas pelo Excel;
  - `pesagens-por-apartacao-data.xlsx`: o arquivo.

  A foto direta da janela rolada até o bloco não funcionou, porque o Excel desenha a grade por DirectX e
  a captura da janela voltava o quadro inicial. Não usei foto da tela inteira nem a área de
  transferência, para não pegar outras janelas nem mexer no que você copiou.
- **Tema escuro antes/depois:**
  - `tema-escuro-antes-propriedade.png` e `tema-escuro-antes-parceiro.png` (valores ilegíveis);
  - `tema-escuro-depois-propriedade.png` e `tema-escuro-depois-parceiro.png`;
  - `tema-escuro-depois-configuracoes-admin.png` e `tema-escuro-depois-configuracoes-gestor.png`;
  - medidas em `capture-escuro-*.json` e `tema-escuro-configuracoes-medidas.json`.
- **GESTOR em Configurações:** `gestor-configuracoes-so-relatorios.png`.

## 2. Arquivos criados / alterados (43 arquivos, `180ccb1..HEAD`)

**Novos:**
- `src/modules/catalog/domain/documentMask.js`
- `src/components/cadastros/DocumentInput.jsx`
- `scripts/verify-document-mask.mjs`
- `scripts/verify-reports-sheet-xlsx-parity.mjs`
- `scripts/verify-dark-field-text.mjs`
- `docs/plano-mestre/prompts/PROMPT-01C-AJUSTES-1.4.0.txt`
- `docs/evidence/e1c/*`

**Alterados:**
- **Relatórios:** `reportDocument.js` (`buildLeafTotalBlock`), `xlsxExporter.js`, `summaryLayout.js`,
  `reportDefinition.js` e `reportService.js` (`sheetTitle`), `pesagens.js`.
- **Cadastros:** `CadastroAuxiliarPage.jsx`, `registryFormModel.js`, `propertyHeader.js`,
  `registryDefinitions.js` (dica do campo).
- **Permissões/Configurações:** `permissionService.js`, `appConfigService.js`, `Layout.jsx`,
  `Configuracoes.jsx`.
- **CSS:** `src/styles/modelobase1/mg-layout.css` e `src/styles/auxiliary-registries.css`.
- **Gates:**
  - relatórios: `verify-reports-sheet-data`, `verify-reports-print-contract`,
    `verify-reports-summary-export-parity`;
  - permissões: `verify-auth-permissions`, `verify-access-policy`, `verify-local-auth`,
    `verify-shell-settings-ui`;
  - banco: `verify-dexie-backup`, `verify-dexie-import-restore`.
- **package.json:** 3 gates novos no test:quick e no test:full.
- **Docs:**
  - CHANGELOG `[1.4.0]` (bloco E1C);
  - `docs/user/{RELATORIOS,CADASTROS,USUARIOS}.md`;
  - `docs/reporting/{EXPORT-CONTRACT,PERMISSIONS,REPORT-DEFINITION-CONTRACT}.md`;
  - `docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md`;
  - `docs/release/1.4.0/{RELEASE-NOTES,RELEASE-CHECKLIST,MIGRATION-1.3.0-TO-1.4.0}.md`.

**Commits:**
- `651c1bd` prompt
- `876cfbd` título
- `fd64d71` tema escuro
- `c2f98a9` gates do Dexie
- `6dc374e` máscara
- `82f149f` TOTAL POR no XLSX
- `200a7f1` GESTOR em Configurações
- `ac57beb` gates no test:quick/full
- `6ebb9e5` docs
- `f8dae2c` e `edd7a47` correções da revisão final
- `ee13452` correção da segunda rodada (Configurações no escuro)
- __MAIS__

**Sem push. main em `6cccb5f`.**

## 3. Gates

| Comando | Resultado |
|---|---|
| `npm run test:quick` | __TQ_LINHA__ |
| `npm run test:full` | __TF_LINHA__ |
| `npm run storage:all:verify` | 10/10 verdes (inclui os 2 gates do Dexie corrigidos) |
| `npm run registry:document-mask:verify` (novo) | OK: digitação progressiva, colar (formatado, cru, com rótulo, sobre seleção), cursor, Backspace/Delete em separador, limite de 14, paridade de persistência, rótulo com hífen digitado = colado, CNPJ alfanumérico inválido recusado na ficha, serviço real (unicidade dos Parceiros intacta; reabrir e salvar não regrava; documento antigo não é cortado), estrutura da ligação do campo |
| `npm run reports:sheet-xlsx-parity:verify` (novo) | OK: bloco TOTAL POR folha × XLSX célula a célula (Pesagens por apartação e outros 3 níveis), faixa só no lote, negativos com 1 ou 2 níveis, CSV sem bloco, contrato `null` da função |
| `npm run ui:dark-field-text:verify` (novo) | OK: regra do escuro com `currentColor`, cobre inputs, textareas e o valor dos seletores, vence as 5 regras do claro (especificidade [1,4,2] × [0,6,1]); negativo sem o `:not(#…)` |
| `npm run auth:permissions:verify` / `auth:access:verify` / `auth:local:verify` / `ui:shell-settings:verify` | OK: GESTOR vê só Relatórios; serviço recusa o GESTOR em Geral, Curral e Comercial e aceita o divisor da @; OPERADOR e CONSULTA sem menu e sem página; doc 11 × MATRIX |
| `npm run release:version-contract:verify` / `docs:user:verify` | OK |
| `npm run dist:unsigned` | __DIST__ |

**Instalador FINAL da 1.4.0 (sem assinatura; é o que você vai instalar):**
- `C:\Users\maike\Desktop\projeto\MAKGESTAO-main\release-unsigned\Pesagens Individuais Setup 1.4.0.exe`
- __SIZE__
- **SHA-256 `__SHA__`** (igual ao `.sha256` e ao manifesto)
- manifesto com `gitCommit: __GITCOMMIT__`, limpo (sem "-dirty"). Ele substitui o instalador da E1B
  (`ee7c40b8…`), que não foi distribuído. Depois do build entrou só o commit deste REPORT e das
  evidências.

**Não executado no `test:full`:** nada ficou de fora. O `e2e:installed:verify:dev` valida os artefatos
sem abrir o app. A abertura do app empacotado (`D9_LAUNCH_PACKAGED=1`) é opcional, fica fora do
`test:full` e **não foi rodada**, porque usaria o seu perfil e o seu banco reais.

## 4. Migração

- **Banco:** nenhuma. Esquema Dexie 8 e backup formato 3; nada novo é gravado pela E1C.
  - A máscara é só da tela; o documento continua guardado sem pontuação.
  - A permissão `settings.reports` está no código, não no banco.
  - O bloco do XLSX e o título só mudam o que é emitido.
- **Rollback para a 1.3.2:** igual ao da E1B (`docs/release/1.4.0/MIGRATION-1.3.0-TO-1.4.0.md` §3.2 e §6).

## 5. O que NÃO foi feito e por quê

- **Não fiz:** push, avanço da main, mudança de esquema, nem itens da E2/E3.
- **Faixa do lote "foto no dia":** fica para a **E3** (resposta 5).
- **Teste físico (balança, impressora, curral): NÃO EXECUTADO.** A folha foi conferida em PDF na E1B; a
  impressão numa impressora de verdade é o passo 6 do seu teste.
- **Teste no app instalado: NÃO EXECUTADO por mim**, porque usaria o seu perfil real. É o seu teste
  (seção 7).
- **Grade de Parceiros/Propriedades:** a coluna CPF/CNPJ continua mostrando só os dígitos. A máscara é da
  ficha (item 8); formatar a grade mudaria a pesquisa e os filtros (pergunta 2).
- **Excel:** a contagem zero sai 0 (a folha mostra "—"), e as colunas sem valor continuam no XLSX (na
  folha elas somem). Foi decidido assim para a planilha poder somar e filtrar (pergunta 3).
- **Ctrl+Z no campo CPF/CNPJ:** não desfaz depois que a máscara reformata. É limitação comum de campo
  com máscara (pergunta 1).

## 6. Riscos e pendências

- **Instalador sem assinatura:** o Defender ou o SmartScreen podem avisar ou retirar o arquivo.
- **O GESTOR perdeu a gravação** de Geral, Curral e Comercial pelo serviço. É o que a resposta 10 pede, e
  a tela nunca mostrou esses cartões a ele, mas foi uma permissão que existia desde o ADR-042.
- **Máscara, limite conhecido:** o rótulo **grudado** nos números enquanto se digita ("CPF699…", sem
  espaço, dois-pontos nem hífen) não se distingue de um CNPJ alfanumérico. O campo mostra as letras na
  hora; colado inteiro, o mesmo texto vira CPF.
- **As capturas vêm do harness de dev** (mesmo código); não substituem o seu teste.
- **Durante o trabalho a máquina entrou em suspensão algumas vezes.** Alguns comandos foram retomados,
  mas nenhum resultado desta entrega depende deles: todos os gates foram rodados de novo no fim.

## 7. Como a responsável testa (no app instalado — o teste único de E1 + E1B + E1C)

1. **Antes de instalar:** na 1.3.2, use **Backup e Manutenção › Criar backup completo** e guarde o
   arquivo fora do computador. Depois feche o programa e rode o **Setup 1.4.0** (caminho e SHA-256 na
   seção 3). A barra deve mostrar **v1.4.0**.
2. **Cadastros › Propriedades, propriedade padrão:**
   - preencha **Cabeçalho dos relatórios** e escolha o **logo**;
   - no **CPF/CNPJ**, digite um CNPJ número a número e veja a máscara se formar;
   - apague e cole "CNPJ: " + o número;
   - salve, reabra e confira que aparece formatado e igual na pré-visualização.
3. **Cadastros › Parceiros:** abra um parceiro.
   - Digite um CPF.
   - Depois digite "12abc34501de36" (CNPJ alfanumérico com dígito errado) e clique **Salvar**: deve
     aparecer o aviso de CNPJ alfanumérico inválido, e nada é gravado.
   - Cancele.
4. **Relatórios › Pesagens:** escolha um período com pesagens, **Tipo "Por apartação (resumo por
   data)"** e **Orientação Paisagem**. Confira:
   - o título **"Relatório de Pesagens Individuais (Sintético)"**;
   - o logo;
   - as colunas alinhadas;
   - GMD "—" onde não há pesagem anterior;
   - **TOTAL POR LOTE** e **TOTAL GERAL**.
5. **Excel** da mesma folha: abra o arquivo. No fim de cada apartação, o bloco **TOTAL POR LOTE –
   <apartação>** deve ter os mesmos números da folha.
6. **PDF** em Retrato (rodapé "Página X de Y") e **Imprimir** numa impressora de verdade (teste físico).
   Clique numa apartação da folha: abre o Detalhado só dela; experimente **Ver como folha**.
7. **Configurações › Relatórios:** troque o divisor da @ para 15 e veja o rodapé "@ = peso vivo ÷ 15";
   volte para 30. Se tiver um usuário **GESTOR**, entre com ele: Configurações aparece no menu e mostra
   só o cartão Relatórios.
8. **Tema escuro** (botão da lua no alto): abra qualquer ficha de Cadastros. O texto dos campos e dos
   seletores deve estar legível.
9. **Rebanho atual:** o botão **Status (1)** vem com "Ativo" marcado. Troque o **Tipo de relatório**,
   saia e volte: o relatório reabre como você deixou.
10. **Itens da E1:**
    - Relação de Pesagens › Ações em lote › **Data, apartação e lote** abre sem erro;
    - Backup e Manutenção › aba **Controle** mostra os 4 relatórios;
    - **Verificar integridade** diz "Banco íntegro.", com as contagens iguais às de antes.

## 8. Perguntas para a responsável

1. **Ctrl+Z no CPF/CNPJ:** depois que a máscara reformata o texto, o Ctrl+Z do campo não desfaz. É comum
   em campos com máscara. Aceita assim, ou prefere que eu faça um desfazer próprio?
2. **Grade de Parceiros/Propriedades:** a coluna CPF/CNPJ mostra só os dígitos. Quer a máscara também na
   grade? Nesse caso, a pesquisa e o filtro dessa coluna passam a aceitar os dois jeitos.
3. **Excel:** a contagem zero de Machos/Fêmeas sai **0** (na folha, "—"), e as colunas sem valor
   continuam na planilha (na folha, somem). Confirma?
4. **USUARIOS.md** fala em "três perfis fixos", mas o programa tem quatro (ADMIN, GESTOR, OPERADOR e
   **CONSULTA**). Atualizo o guia com o CONSULTA na próxima etapa?
