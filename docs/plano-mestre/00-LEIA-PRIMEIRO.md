# Plano Mestre 2 — Pesagens Individuais (pacote de execução)

Criado em 24/09/2026 a partir da versão 1.3.2 (Dexie v8), branch `program/sanity-launch-import`.
Documento de visão para leitura humana: "Plano Mestre — Pesagens Individuais" (Claude Docs).
Este pacote é o que o Claude Code executa. Onde houver conflito com `docs/arquitetura-produto/00–15`,
**este pacote prevalece** para escopo e ordem; os contratos técnicos antigos (auth, migrações, backup,
versionamento em eixos, ModeloBase1) continuam valendo.

## 1. Objetivo

Ser o melhor sistema de curral do Brasil: pesar, identificar, tratar e vender rápido, offline, sem erro,
com dono claro de cada cabeça e relatórios que abrem resumidos.

## 2. Decisões já tomadas pela responsável (24/09/2026)

| Tema | Decisão |
|---|---|
| Proprietário | O animal PODE ter dono diferente do dono da marca. A marca só sugere. |
| Preço de venda à vista | Os três modos: por kg vivo, por @ e por cabeça (escolhido por operação). |
| Atualização do app | Via Supabase Storage + electron-updater (doc 15 da arquitetura). |
| Ordem | Executar todo o programa, etapa por etapa, na ordem abaixo. |
| Sanidade | Continua no produto (v8) e será completada. Não é rastreabilidade oficial (SISBOV fora). |
| Balança | Tru-Test S3 é o primeiro equipamento. |

## 3. Etapas e dependências

| Etapa | Arquivo | Versão alvo | Esquema Dexie | Depende de | Paralelo com |
|---|---|---|---|---|---|
| E1 Relatórios resumidos + catálogo enxuto | E1-RELATORIOS.md | 1.4.0 | v8 (sem mudança) | E0 | E2, E4 |
| E2 Atualizador Supabase + canais | E2-ATUALIZADOR-SUPABASE.md | 1.5.0 | v8 | E0 | E1, E4 |
| E3 Cadastros + proprietário + metas | E3-CADASTROS.md | 1.6.0 | v9 | E1 | E4 |
| E4 Balança S3 fase A (arquivo, captura, simulador) | E4-BALANCA-S3.md | próxima MINOR | sem mudança | E0 | E1, E2, E3 |
| E5 Comercial: operações, venda à vista, acerto | E5-COMERCIAL.md | 1.7.0 | v10 | E3 | E6 |
| E6 Estoque de brincos e medicamentos | E6-ESTOQUE.md | 1.8.0 | v11 | E3 | E5 |
| E7 Evolução de peso + farol de metas | E7-EVOLUCAO-PESO.md | 1.8.x | sem mudança | E1, E3 | E5, E6 |
| E8 Sanidade completa | E8-SANIDADE.md | 1.9.0 | v12 | E5, E6 | E9 |
| E9 Balança ao vivo + bastão EID | E9-BALANCA-AO-VIVO.md | próxima MINOR | sem mudança | E4 | E8 |

E0 = fechar o trabalho em andamento (ver `prompts/PROMPT-00-FECHAR-TRABALHO-ATUAL.txt`).
Versões são alvo: se duas etapas integrarem juntas, o orquestrador ajusta, sem pular números.

## 4. Regras que valem para TODAS as etapas

1. Nunca apagar dado do usuário. Exclusão lógica, cancelamento com motivo e auditoria.
2. Toda mudança de esquema: nova constante `STORES_Vn` (nunca editar a anterior), backfill idempotente,
   backup pré-migração validado, gate `migration:vN:verify`, restore de backup v(n-1) testado.
3. Offline sempre: nenhuma tela depende de internet. Supabase só para atualização do binário (E2).
4. ModeloBase1 é o contrato visual. Não inventar componente novo se existir equivalente em
   `src/components/modelobase1` ou `src/components/mak`.
5. Formato brasileiro (vírgula decimal, dd/mm/aaaa, R$). Gate `verify-brazilian-format-contract`.
6. Performance: telas de lançamento abrem < 1 s com 36 mil animais (gate `perf:contract`).
7. Cada etapa entrega: código, gates novos em `scripts/verify-*.mjs` registrados em `test:quick`,
   docs do usuário em `docs/user/`, CHANGELOG, `docs/release/<versão>/`, evidência em
   `docs/evidence/<etapa>/REPORT.md` (formato na seção 6).
8. Condições de parada (parar e reportar, não contornar): perda de dados, migração irreversível, backup
   inválido, integridade vermelha, duplicação de animal/identificador, restore falhando.
9. Git: Cada etapa cria sua branch program/e<N>-<nome> a partir de main. Ao concluir com gates verdes,
   main só avança (fast-forward) para a branch da etapa com autorização da responsável, dada na resposta
   ao REPORT. Nunca push sem autorização. Commits pequenos e temáticos.
10. Linguagem da interface: simples, de curral. Nada de "entidade", "grão", "agregação" na tela.

## 5. Canais de versão (depois da E2)

- **Teste** (`windows/beta`): só o PC da responsável.
- **Estável** (`windows/stable`): PCs de uso. Promoção após ≥ 7 dias no Teste sem erro grave.
- PATCH = só correção. MINOR = funcionalidade ou esquema. Esquema só muda em MINOR.

## 6. Formato do REPORT de cada etapa (`docs/evidence/<etapa>/REPORT.md`)

```
ETAPA: E<n> — <nome>          VERSÃO: x.y.z          BRANCH: program/e<n>-...
STATUS: CONCLUÍDA | PARCIAL | BLOQUEADA
1. O que foi feito (lista curta, linguagem simples)
2. Arquivos criados / alterados (caminhos)
3. Gates: comando → resultado (verde/vermelho) — incluir test:quick completo
4. Migração (se houver): versão de/para, backup, contagens antes/depois
5. O que NÃO foi feito e por quê
6. Riscos e pendências
7. Como a responsável testa (passo a passo de 5–10 itens, no app instalado)
8. Perguntas para a responsável (se houver)
```

## 7. Fontes de mercado usadas

- JetBov: https://blog.jetbov.com/2020/01/27/por-que-escolher-o-jetbov-e-nao-outro-sistema-de-gestao-para-fazendas-de-gado-de-corte/
- JetBov GMD: https://blog.jetbov.com/2023/03/16/gmd-ideal-para-gado-de-corte/
- iRancho: https://www.irancho.com.br/software-gestao-pecuaria/
- iRancho indicadores: https://www.irancho.com.br/10-indicadores-na-pecuaria-de-corte-que-revelam-os-prejuizos-da-producao/
- Datamars (perdendo peso / ADG por grupo): https://support.livestock.datamars.com/en/articles/10595094-viewing-animals-that-are-losing-weight-using-datamars-livestock-with-weigh-scale-indicators
- Datamars S2/S3 no Windows: https://support.livestock.datamars.com/en/articles/9949505-recording-weights-from-the-s2-or-s3-indicator-using-your-windows-computer
- Tru-Test ficha indicadores: https://www.agproud.com/ext/resources/directories/files/Datamars/Tru-Test_WeighIndicators_InfoSheet.pdf?t=1719372944
- Multsoft 10 indicadores: https://multsoft.agr.br/sistema-para-pecuaria-de-corte-10-indicadores-que-todo-produtor-deve-acompanhar
- Electron Builder auto update: https://www.electron.build/docs/features/auto-update/
- Supabase Storage: https://supabase.com/docs/guides/storage/serving/downloads
