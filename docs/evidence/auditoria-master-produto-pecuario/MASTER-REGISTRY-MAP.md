# MASTER-REGISTRY-MAP — Mapa dos cadastros mestres

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Princípio

"Cadastros antes do lançamento; o lançamento seleciona dados existentes." Cadastro mestre é toda informação que (a) é reutilizada em muitos eventos, (b) precisa de unicidade/inativação, ou (c) é referenciada por id em relatório. O resto é enum de código ou configuração.

## 2. Mapa

| Cadastro | Hoje | Alvo | Chave de unicidade | Tem `padrao`? | Inativação | Usado por | Prioridade |
|---|---|---|---|---|---|---|---|
| Marca | texto livre | store `marcas` | `nome_normalizado` por empresa | sim | sim | animal, identificador, faixa, filtros | 1 |
| Raça | texto livre (`Nelore` fixo) | store `racas` | `nome_normalizado` | sim | sim | animal, cadastro rápido, relatórios | 1 |
| Categoria animal | não existe (era livre) | store `categoriasAnimal` | `nome_normalizado` | não (sugerida) | sim | animal, lote objetivo, relatórios | 1 |
| Causa de morte | appSettings | store `causasMorte` | `nome_normalizado` | não | sim | saída por morte | 1 |
| Parceiro | appSettings (3 listas) + perfis legado | store `parceiros` com papéis | `documento` ou `nome_normalizado` | não | sim | compra, venda, abate, embarque, marca (proprietário) | 1 |
| Faixa de identificadores | não existe | store `faixasIdentificadores` | tipo + marca + prefixo + intervalo sem sobreposição | não | `situacao` | cadastro do animal, sequência | 2 |
| Apartação | store, popup | store, tela própria | `nome_apartacao` normalizado | não | `ativo` | lançamento, lotes, fechamento | 2 |
| Lote | store `loteApartacoes`, popup | tela própria | `nome_lote` por apartação | não | `situacao` | lançamento, permanência, fechamento | 2 |
| Propriedade | texto no vendedor | store `propriedades` (opcional) | `nome_normalizado` | sim (própria) | sim | compra (origem), transferência (destino), marca | 3 |
| Embarque | store, popup | tela própria com estados | `nome` + data | não | `CANCELADO` | saída, operação | 3 |
| Sessão | automática | automática + padrões | `data + local` | — | `CANCELADA` | lançamento, fechamento | 3 |

Enums de código (não viram cadastro): sexo (`M/F`), tipo de evento (`CADASTRO/MANEJO/SAIDA`), motivo de saída (`Venda/Abate/Morte/Doação/Transferência/Outros`), tipo de documento (`GTA/NF-e/GTA+NF-e`), tipo de identificador, papéis de parceiro, status de embarque/operação/sessão.

Configurações (não viram cadastro): raça/marca/propriedade padrão (referências), política de avisos, exigir documento em venda, intervalo de pesagem vencida, rendimento padrão da empresa, modelos de importação, resumos personalizados.

## 3. Comportamentos comuns a todos os cadastros mestres

1. Tela Mãe do ModeloBase1 (lista) + registro; ações na barra; sem ícones ocultos.
2. `nome_normalizado` gerado no serviço; duplicidade recusada com mensagem clara.
3. Inativar em vez de excluir quando houver vínculo; excluir só sem vínculo (soft-delete com `deleted_at`).
4. Auditoria CRIAR/ATUALIZAR/CANCELAR (resumo de campos).
5. Importação CSV pelo assistente comum.
6. Contagem de uso visível na lista (animais ativos por marca, animais por raça, operações por parceiro) — calculada por índice, não por varredura das pesagens.
7. `empresa_id` presente, valor `'local'`.

## 4. Ordem de implementação recomendada

1. Marcas, Raças, Categorias, Causas de morte, Parceiros — todos com a mesma página genérica, num único slice de UI.
2. Faixas de identificadores — segundo slice, pois depende de marcas.
3. Apartações/Lotes e Embarques — telas que retiram popups do Lançamento.
4. Propriedades — quando DEC-013 for aceita.
