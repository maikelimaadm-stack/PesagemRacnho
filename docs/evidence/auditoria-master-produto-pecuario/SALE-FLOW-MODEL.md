# SALE-FLOW-MODEL — Fluxo de venda

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

```text
Lançamento › Tipo "Saída" › Motivo "Venda"
  [botão] "Dados da venda" (oculto por padrão)
     Comprador (registry por nome) · Destino (texto) · Valor da arroba · Valor total
     Rendimento de carcaça (%) · Estimativa comercial (carcaça, @, valor)
     GTA · NF-e · Frete · Observações
  Embarque · Documento (GTA/NF-e) — opcionais na venda (obrigatórios só no abate)
  Salvar → pesagens(Saída) + movimentosAnimais('Venda') + animalLotes.fim + animais.situacao='Inativo'
```

Dois cadastros para a mesma informação:

- `GerenciarSaidasDialog.jsx` (perfis `perfis-saida:<empresa>` em `appSettings`, com abas Compradores/Vendas/Abates e botão "Usar no lançamento") — **legado**; ainda é sincronizado por `registryService.saveRegistryGroup`.
- `CadastrosComerciais.jsx` (registry `cadastros-auxiliares:comerciais`) — atual.

Cálculo (`commercialCalculations.calculateCarcassTrade`) está correto e separa peso vivo, carcaça, arrobas e valor (ADR-012). O problema é onde o resultado é gravado: dentro de cada pesagem, sem operação agregadora.

Problemas objetivos:

1. Venda de 30 animais = 30 lançamentos com comprador, valor da arroba, GTA e frete repetidos.
2. `comprador` é o **nome**; renomear o comprador no cadastro não atualiza o histórico nem permite filtro por id.
3. `valor_venda_total` por animal não tem relação garantida com `quantidade_arrobas × valor_arroba`; não há indicação de "informado × calculado".
4. `FechamentoDia` cobra embarque e documento para venda (pendência "Doc"), mas a tela de lançamento só obriga no abate: regras divergentes.

## 2. Modelo alvo

### 2.1 `operacoesComerciais` (tipo `VENDA`)

| Campo | Regra |
|---|---|
| `tipo` | `VENDA` |
| `data` | data civil |
| `parceiro_id` | comprador (`parceiros`, papel COMPRADOR) |
| `destino` | texto curto ou `propriedade_destino_id` |
| `preco_arroba` | informado |
| `rendimento_percentual` | informado; origem `informado`/`padrao` gravada (resolve D4) |
| `valor_total_informado` | opcional |
| `valor_total_calculado` | Σ (arrobas do animal × preço) — derivado, recalculável |
| `valor_frete`, `descontos` | opcionais |
| `embarque_id` | opcional; obrigatório para fechar se a política exigir |
| `documentos` | `{tipo, numero, data}` |
| `status` | `RASCUNHO` → `CONFERIDA` → `FECHADA` / `CANCELADA` |

### 2.2 Vínculo animal ↔ venda

Evento `SAÍDA` do animal grava `operacao_id`, `peso_kg` (peso vivo na saída), `carcaca_kg`, `arrobas`, `valor_animal` (derivado). Regra: um animal só entra em **uma** operação de venda aberta.

### 2.3 Fluxo

```text
Comercial › Nova venda (RASCUNHO): comprador, data, preço/@, rendimento, embarque (opcional)
  └─ Adicionar animais: seleção por lote/apartação/lista (somente ATIVOS)
       └─ peso de saída: última pesagem ou pesagem no curral (Lançamento com "operação ativa")
Conferir: quantidade, peso vivo total, arrobas, valor calculado × informado → CONFERIDA
Fechar: gera SAÍDA para cada animal na mesma transação; situação → VENDIDO → FECHADA
Cancelar (após fechada): reverte saídas com auditoria; animais voltam a ATIVO
```

No curral, o Lançamento em modo Saída pergunta só: motivo = Venda → "operação de venda aberta: [selecionar]" → pesa e salva. Sem digitar comprador, arroba, GTA por animal.

### 2.4 Regra de documentação

Uma única política, aplicada no serviço e no Fechamento: venda pode fechar sem documento se a empresa marcar `exigir_documento_venda=false` (configuração real); do contrário a operação fica `CONFERIDA` até o documento ser vinculado.

## 3. Migração

Agrupar Saídas com `motivo_saida='Venda'` por `(data_pesagem, comprador, valor_arroba, embarque_id)` → uma operação FECHADA por grupo, `origem='migracao'`; gravar `operacao_id` nas saídas; resolver `comprador` por nome normalizado em `parceiros` (criar parceiro quando não existir, com `origem='migracao'`). Relatório de dry-run obrigatório.

`perfis-saida` (venda/abate) viram operações-modelo? **Não.** São descartados após confirmar que compradores foram migrados; "modelo de venda" reaparece só como "repetir última operação".

## 4. Fora de escopo

Emissão de NF-e, boleto, comissão de corretor, contrato, adiantamento.
