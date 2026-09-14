# TARGET-SCREEN-MAP — Mapa de telas alvo

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Menu alvo (ordem de uso)

```text
Operação
  Lançamento de pesagens        (existe; enxugar)
  Relação de pesagens           (existe; Tela Mãe)
  Fechamento da sessão          (existe como "do dia"; refazer na Tela Mãe)
Rebanho
  Animais                       (novo; lista + ficha; absorve "Ficha do Animal")
  Apartações e lotes            (novo; sai do popup)
  Faixas de identificadores     (novo)
Comercial
  Operações (compra/venda/abate) (novo; v8)
  Embarques                     (novo; sai do popup)
Cadastros
  Marcas · Raças · Categorias · Parceiros · Propriedades · Causas de morte   (novos/migrados)
Sistema
  Backup e manutenção           (existe)
  Configurações                 (novo, simples: padrões da empresa, políticas de aviso, documento em venda)
```

Removidos: "Configurações de Sanidade" (ADR-007), popup "Compradores, Vendas e Abates", popups de Apartações e Embarques dentro do Lançamento.

## 2. Telas

| Tela | Rota (proposta) | Padrão | Fonte de dados | Ações principais | Existe? |
|---|---|---|---|---|---|
| Lançamento | `LancamentoPesagensIndividuais` | v2 sobre ModeloBase1 | eventos da sessão, animal resolvido por identificador | Salvar, Próximo, Editar, Excluir; seleção de sessão/operação | sim (2 182 linhas → reduzir) |
| Relação | `PesagensIndividuais` | Tela Mãe | `pesagens` paginado + mapas de cadastro | filtros, pesquisa, colunas, exportar, importar | sim |
| Fechamento da sessão | `FechamentoSessao` | Tela Mãe + painel de pendências | `sessoesPesagem` + eventos por `sessao_id` | fechar, reabrir (motivo), justificar, exportar | parcial |
| Animais | `Animais` | Tela Mãe + registro | `animais`, identificadores, marcas/raças/categorias | novo, editar, inativar, trocar identificador, lançar pesagem | não (Ficha existe) |
| Ficha do animal | `Animais?id=` (modo registro) | registro | ver `ANIMAL-PROFILE-MODEL.md` | exportar histórico | parcial |
| Apartações e lotes | `ApartacoesLotes` | Tela Mãe (2 abas) | `apartacoes`, `loteApartacoes`, ocupação por `animalLotes` | novo, editar, fechar lote | popup |
| Faixas de identificadores | `FaixasIdentificadores` | Tela Mãe + registro com saldo | `faixasIdentificadores`, exceções | nova faixa, marcar perdido, ver uso | não |
| Operações comerciais | `OperacoesComerciais` | Tela Mãe + registro com animais | `operacoesComerciais`, eventos por `operacao_id` | nova compra/venda/abate, adicionar animais, conferir, fechar, cancelar, retorno de frigorífico | não |
| Embarques | `Embarques` | Tela Mãe + registro | `embarques`, documentos, eventos por `embarque_id` | novo, documentos, transições de estado | popup |
| Marcas | `Marcas` | Tela Mãe + registro | `marcas` | novo, editar, inativar, definir padrão | não |
| Raças | `Racas` | idem | `racas` | idem | não |
| Categorias | `Categorias` | idem | `categoriasAnimal` | idem, faixas de idade | não |
| Parceiros | `Parceiros` | Tela Mãe (filtro por papel) + registro | `parceiros` | novo, editar, papéis, inativar | sim (comerciais em appSettings) |
| Propriedades | `Propriedades` | idem | `propriedades` | | não |
| Causas de morte | `CausasMorte` | idem | `causasMorte` | | sim (appSettings) |
| Backup e manutenção | `ManutencaoSistema` | cartões → Tela Mãe quando houver fatia | backup, integridade, importação JSON, restore, **migração/backfill v7** | | sim |
| Configurações | `Configuracoes` | registro simples | `appSettings` | padrões, políticas | não |

## 3. Diálogos que permanecem

Selecionar animal (mesmo número em marcas), Cadastro rápido de animal (curral), Confirmar SN, Aviso de conferência (outlier), Excluir/Cancelar com motivo, Configurar colunas, Configurar resumos, Importação (assistente).

## 4. Ordem de construção (alinhada ao roadmap)

1. Marcas, Raças, Categorias, Causas de morte, Parceiros (Tela Mãe genérica com porta de store).
2. Faixas de identificadores.
3. Animais (lista + ficha).
4. Lançamento enxuto (seleção de cadastros; sem popups; sem olhinho).
5. Apartações e lotes; Embarques.
6. Operações comerciais.
7. Fechamento da sessão.
8. Configurações; Manutenção com migração.

## 5. Critério por tela

Cada tela nova entra com: asserção em `verify-ui-consistency.mjs`, captura claro/escuro em `docs/evidence`, atalhos de teclado do padrão (Enter salva, Esc fecha, F-keys da Tela Mãe se existirem), e registro na documentação do usuário.
