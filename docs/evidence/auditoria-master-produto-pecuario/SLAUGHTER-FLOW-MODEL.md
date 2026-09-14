# SLAUGHTER-FLOW-MODEL — Fluxo de abate

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

```text
Lançamento › Saída › Motivo "Abate"
  Embarque (obrigatório) · Documento GTA/NF-e (obrigatório)   ← única saída que exige documento
  [botão] "Dados do abate": Frigorífico (registry por nome) · Valor/@ · Valor total · Rendimento · GTA · NF-e · Frete · Obs
  Painel lateral "Abate": contagem por documento (previsto M/F × embarcados)
```

Persistência: `frigorifico` (nome), `valor_arroba_abate`, `valor_total_abate`, `rendimento_carcaca`, `peso_carcaca_estimado`, `quantidade_arrobas`, `embarque_id`, `documento_embarque_id`, `documento_tipo`, `documento_numero`, `motorista_nome`, `placa_carreta` — tudo copiado para o payload de **cada** pesagem.

O embarque já tem `frigorifico` próprio; o abate repete o frigorífico por animal. `documentosEmbarque` já guarda GTA/NF-e/motorista/placa; o abate copia tudo de novo.

O que funciona bem e deve continuar: exigir embarque e documento antes de salvar; estimativa de carcaça/arrobas separada do peso vivo; previsão M/F por documento.

## 2. Modelo alvo

Abate é uma `operacoesComerciais` com `tipo='ABATE'` e a mesma estrutura da venda (`SALE-FLOW-MODEL.md` §2), com diferenças:

| Campo | Abate |
|---|---|
| `parceiro_id` | frigorífico (`parceiros`, papel FRIGORIFICO) |
| `embarque_id` | **obrigatório** para fechar |
| `retorno_frigorifico` | opcional, preenchido depois: `{peso_carcaca_real_kg, rendimento_real, arrobas_reais, valor_real, data_retorno}` (REP-303) |

Regras:

1. Todo animal abatido pertence a um embarque (`EMBARQUE-FLOW`), e o embarque referencia o frigorífico uma vez.
2. Frigorífico, motorista, placa e documentos **não** são copiados para a pesagem; a pesagem aponta `operacao_id` e `embarque_id`; a grade lê por junção.
3. Estimado × realizado: `valor_total_calculado` (estimativa) versus `retorno_frigorifico.valor_real`; ambos exibidos com rótulo.

### Fluxo

```text
Cadastros › Parceiros (frigorífico)          ─ antes
Embarques › Novo embarque (PLANEJADO): frigorífico, data, documentos, previsão M/F
Comercial › Novo abate (RASCUNHO) ligado ao embarque: preço/@, rendimento
Curral › Lançamento em modo Saída/Abate com "abate aberto" selecionado: pesa, salva, próximo
Embarque › conferir contagem previsto × embarcado → EM_ANDAMENTO → CONCLUÍDO
Comercial › fechar abate (gera SAÍDAs) → depois registrar retorno do frigorífico
```

## 3. Migração

Saídas com `motivo_saida='Abate'` agrupadas por `(embarque_id, documento_embarque_id, frigorifico, valor_arroba_abate)` → uma operação ABATE FECHADA por grupo; `frigorifico` resolvido por nome em `parceiros`. Os campos duplicados do payload (`motorista_nome`, `placa_carreta`, `documento_numero`…) permanecem só como legado somente-leitura.

## 4. Fora de escopo

Tipificação de carcaça, bonificação por programa, romaneio do frigorífico importado automaticamente, cálculo de ICMS. O retorno do frigorífico é digitado, não integrado.
