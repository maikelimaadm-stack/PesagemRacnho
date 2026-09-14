# CORRAL-USABILITY-AUDIT — Usabilidade no curral

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Contexto de uso

Ruído, poeira, animais em movimento, operador com uma mão livre, teclado numérico, tela possivelmente com brilho baixo (00 §1). Tudo que exige mouse, leitura de texto longo ou decisão fora do fluxo custa segundos por animal.

## 2. Medição qualitativa do fluxo atual (Manejo)

| Ação | Hoje | Custo |
|---|---|---|
| Abrir a tela | carrega **todas** as pesagens, apartações, lotes, embarques, documentos; reconstrói índice de animais | segundos em base grande (R-01) |
| Campos visíveis antes do Nº | Data, Sexo, Raça, Era, Marca | 4 campos irrelevantes para Manejo no caminho do Tab |
| Digitar Nº + Enter | resolve; abre diálogo se houver marcas duplicadas | bom |
| Faixa do animal | mostra última pesagem, ganho, avisos | bom |
| Peso + Enter | salva? Não: Enter no peso salva se `handleSalvar` estiver ligado; confirmar contrato | verificar no plano |
| Apartação/lote | `Select` com lote automático | bom, mas reescolhido ao limpar |
| Avisos | toast + faixa + diálogo de outlier com justificativa | três canais |
| Após salvar | foco volta ao Nº; sequência avança em Cadastro | bom |
| Erro de identificação | toast vermelho com texto longo e emoji | difícil de ler à distância |

## 3. Problemas por severidade

| Sev. | Problema | Evidência |
|---|---|---|
| Alta | Cadastro no curral exige digitar marca/raça/era e abre compra por ícone | `ANIMAL-REGISTRATION-FLOW.md` |
| Alta | Venda/abate exigem dados comerciais por animal | `SALE-FLOW-MODEL.md` |
| Alta | Abertura da tela lenta em base grande | F0/F1 baseline |
| Média | Campos de cadastro visíveis em Manejo | tela |
| Média | Cadastro de apartação/lote/embarque em popup do Lançamento | popups |
| Média | Mensagens em toast com emoji e frases longas | `animalLookup.jsx`, `handleSalvar` |
| Média | Sem indicação visual grande de "salvo" / "erro" (só toast) | tela |
| Baixa | Sequência de brincos escondida em ícone | `UX-FLOW-AUDIT.md` §5 |
| Baixa | Sem som/feedback configurável | 03 §7 (planejado) |

## 4. Regras de usabilidade para o alvo

1. **Três campos no Manejo** (Nº, Peso, Obs opcional); Tab/Enter percorrem só eles.
2. **Contexto da sessão** (marca padrão, apartação, operação) definido uma vez, visível numa faixa, editável por atalho.
3. **Mensagens curtas e padronizadas** em faixa fixa: `ANIMAL NÃO CADASTRADO`, `JÁ PESADO HOJE`, `INATIVO (VENDIDO 12/08)`, `SALVO 4368 · 312 kg`. Toast só para erro de sistema.
4. **Confirmação visual grande** após salvar (faixa verde por 1 s com número e peso) — sem bloquear o foco.
5. **Teclado numérico**: Enter confirma, `+`/`-` ou F-keys para trocar tipo, Esc limpa; nada exige mouse.
6. **Diálogos por teclado**: seleção de animal com setas/Enter; cadastro rápido com Tab; nunca abrir diálogo enquanto o usuário ainda digita (já é regra: resolver ao concluir).
7. **Nada de valor monetário, documento ou frete** na tela do curral.
8. **Abertura rápida**: carregar apenas a sessão do dia e os índices de cadastro; o histórico do animal é lido sob demanda por `animal_id`.
9. **Fonte e contraste**: faixa do animal e resultado com tipografia maior que a grade (mantendo tokens do ModeloBase1); testar no tema escuro.
10. **Recuperação**: fechar e reabrir o app volta à mesma sessão e ao mesmo contexto (F2, mas o contexto da sessão persistido já ajuda).

## 5. Critérios mensuráveis

- Manejo: ≤ 2 Enter + digitação de Nº e peso; zero cliques.
- Abrir Lançamento: < 1 s na massa de 36 mil (navegador).
- Salvar: p95 < 250 ms (navegador, 36 mil).
- Identificação → peso: < 100 ms.
- Zero popups de cadastro no Lançamento.
- Teste de aceite humano: 50 animais em sequência sem tocar no mouse, gravado em `docs/evidence`.

## 6. O que não fazer

Não adicionar modo "tela cheia especial", gestos, voz ou hardware antes de P-001/P-002; não criar atalho para tudo — só os do caminho crítico.
