# F1 — Desempenho e confiabilidade: status parcial

**Data:** 08/09/2026  
**Aplicação:** 1.1.17 (Dexie v6)  
**Referência:** [07-ROADMAP-E-CRITERIOS-DE-ACEITE.md](./07-ROADMAP-E-CRITERIOS-DE-ACEITE.md) §4

## Resultado desta iteração

A primeira fatia da F1 removeu o bloqueio no salvamento do fluxo operacional e
consolidou a organização visual do formulário segundo o protótipo
`Lançamento de Pesagens v2.dc.html`. Regras de negócio, identidade do animal e
política cronológica foram preservadas.

## Alterações concluídas

- recálculo de ganho/GMD consulta somente a série indexada por `animal_id`;
- inserção cronológica normal calcula os campos derivados antes da gravação e
  não regrava o histórico inteiro;
- inserção retroativa continua recalculando os lançamentos posteriores;
- atualização após Salvar substitui somente a série do animal no estado da
  tela, sem executar `loadAllData()` sobre toda a base;
- atualizações derivadas usam a chave primária local já conhecida;
- o formulário passou a ter contrato visual canônico do v2: barra de 36 px,
  controles de 28 px, raio de 8 px, grade de nove colunas no Cadastro, grade
  fluida de cinco campos em Manejo/Saída, espaçamento interno de 6 px e margem
  externa de 8/10 px;
- o mesmo contrato foi conferido nos temas claro e escuro.

## Comparação obrigatória de desempenho

Massa de 36 mil pesagens, Node + fake-indexeddb, dez salvamentos:

| Métrica p95 | F0 | F1 atual | Orçamento | Resultado |
|---|---:|---:|---:|---|
| Busca indexada por animal | 1,8 ms | 0,238 ms | < 100 ms | Dentro |
| Identificação → peso | 8 ms | 2,848 ms | < 100 ms | Dentro |
| Salvamento local | 4.980 ms | **76,334 ms** | < 250 ms | Dentro |

Evidência integral:
[docs/evidence/f1-optimized-final/BASELINE.md](../evidence/f1-optimized-final/BASELINE.md).

O ganho medido no salvamento foi de aproximadamente 65 vezes em relação ao
baseline Node da F0. O baseline do navegador da F0 era 3.169 ms; uma nova
rodada volumosa no Chromium ainda será registrada para comparar runtimes
equivalentes.

## Gates executados

- `npm run test:quick`: aprovado integralmente;
- `npm run build`: aprovado;
- recálculo retroativo: aprovado por `enterprise:hardening:verify`;
- histórico, número repetido por marca, formato brasileiro, importação,
  persistência offline e smoke do Electron: aprovados;
- inspeção visual em 1280 × 720, claro/escuro: aprovada para a composição dos
  campos do v2.

## Pendências para concluir a F1

- substituir a reconstrução de `getRegisteredAnimals(pesagens)` por projeção ou
  cache incremental de animais ativos;
- atualizar resumos da tela sem percorrer toda a lista;
- medir e decidir paginação/virtualização com a massa de 250 mil;
- repetir o benchmark de 36 mil e 250 mil no IndexedDB real do Chromium;
- validar escalas Windows adicionais e registrar capturas formais;
- executar o roteiro de aceite humano e o pacote instalado.

Até essas pendências serem comprovadas, a F1 permanece **em andamento**.
