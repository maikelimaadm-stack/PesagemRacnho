# ANIMAL-REGISTRATION-FLOW — Fluxo de cadastro do animal

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Fluxo atual (Lançamento → Tipo "Cadastro")

```text
Lançamento de Pesagens
  Tipo de Movimentação = "Cadastro (Novo Animal)"
  Data · Sexo(M/F) · Raça(combobox livre) · Era(combobox livre) · Marca(combobox livre)
  Nº Ident./Nome · Peso · Observação
  [olhinho] Dados da compra: valor/cabeça, vendedor(registry), GTA, NF-e, frete, obs
  [ícone]   Sequência de brincos
  Apartação · Transferência de lote (automático por faixa de peso)
  Salvar
    ├─ SN? → ConfirmarAnimalSnDialog (herda último SN)
    ├─ número existe em outra marca → SelecionarAnimalDialog / erro "já cadastrado"
    └─ createEntry → pesagens + animais + animalIdentificadores + animalLotes + movimentosAnimais('Entrada') + sessoesPesagem + auditoria
```

Observações:

- O cadastro é um **evento de pesagem** (`tipo_manejo='Cadastro'`) com peso obrigatório. Um animal comprado sem pesagem de entrada não pode ser cadastrado.
- A compra é gravada dentro do evento (`valor_pago_cabeca`, `origem_animal`, `documentacao` como **string JSON**).
- Sexo/raça/era/marca são digitados por animal; a "configuração por tipo" (`configuracoesPorTipoRef`) lembra os últimos valores só enquanto a tela está aberta.
- Duplicidade e existência são avaliadas na tela contra a lista completa de pesagens (`animalLookup.avaliarIdentificacaoAnimal`).
- Erro de marca gera um animal "novo" silenciosamente na importação (chave `NÚMERO::MARCA` diferente).

## 2. Informações que hoje são pré-digitadas e deveriam ser cadastro

| Informação | Hoje | Deve virar cadastro? | Cadastro sugerido | Motivo |
|---|---|---|---|---|
| Marca | texto livre por animal | Sim | `marcas` | compõe identidade; precisa de unicidade e inativação |
| Raça | texto livre, padrão `Nelore` no código | Sim | `racas` | agrupamento de relatórios; padrão por empresa |
| Era | texto livre | Sim (transformada) | `categoriasAnimal` + nascimento estimado | idade calculável e categoria comparável |
| Número do brinco | digitado ou sequência de tela | Sim (origem) | `faixasIdentificadores` | próximo livre real, rastreabilidade |
| Vendedor/origem | registry em `appSettings` | Sim | `parceiros` (papel VENDEDOR) | histórico e vínculo com compra |
| Propriedade de origem | texto `propriedade` no vendedor | Sim (mínimo) | `propriedades` | GTA e transferências referem propriedade |
| Apartação/lote inicial | popup dentro do lançamento | Já é store; mover a manutenção para tela própria | `apartacoes`/`loteApartacoes` | popup no curral atrasa |
| Documentos de compra (GTA/NF-e/frete) | string JSON no evento | Sim | `operacoesComerciais` (compra) + documentos | conferência e relatório REP-301 |
| Operador | `'LOCAL'` fixo | Depois (F2/F7) | operador | não bloqueia cadastros |

## 3. Fluxo alvo

### 3.1 Tela "Animais" (cadastro completo, ModeloBase1)

Lista de animais (projeção `animais`, não pesagens): Nº, Marca, Sexo, Raça, Categoria, Situação, Lote atual, Última pesagem, Último peso. Ficha com identificadores (histórico), origem (compra/nascimento/transferência), observações.

Criar animal aqui **não exige peso**. A entrada por compra gera o evento `CADASTRO` com `origem='compra'` e, opcionalmente, a pesagem de entrada.

### 3.2 Cadastro rápido no curral (dentro do Lançamento)

Quando o número digitado não existe: diálogo mínimo com Marca (padrão pré-selecionada), Sexo, Raça (padrão), Categoria (sugerida) e o peso já digitado. Nada de compra, GTA ou frete no curral; isso vai para a operação de compra depois.

### 3.3 Importação

CSV de cadastro resolve marca/raça/categoria por nome normalizado; linhas com valor desconhecido param no dry-run com a opção "criar cadastro para os valores novos" (`IMPORT-TARGET-MODEL.md`).

## 4. Regras do fluxo alvo

1. Não existe animal sem `marca_id` (exceto `TEMPORARIO`/`SN`, que exige marca padrão).
2. Cadastro cria `animais` + identificador VISUAL (+ consumo de faixa quando houver) + evento `CADASTRO` na mesma transação; **sem** pesagem obrigatória.
3. Compra é operação separada; o Cadastro pode apontar `operacao_compra_id`.
4. O lançamento de Manejo nunca cria animal por conta própria.

## 5. Impacto no código (para o plano, não para agora)

- `weighingDataAdapter.createEntry`: separar "criar animal" de "criar pesagem"; hoje estão na mesma função.
- `validateUiPayload`: peso obrigatório passa a depender do tipo de evento, não do motivo de saída.
- `LancamentoPesagensIndividuais.jsx`: remover blocos de compra e sequência; substituir comboboxes livres por seleção de cadastro.
