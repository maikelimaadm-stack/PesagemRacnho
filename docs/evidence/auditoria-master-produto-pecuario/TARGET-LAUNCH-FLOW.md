# TARGET-LAUNCH-FLOW — Fluxo alvo do Lançamento de Pesagens

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Princípios

1. O curral só **seleciona**: marca, raça, categoria, apartação, lote, operação comercial e embarque já existem.
2. O caminho do Manejo tem três campos: identificação, peso, confirmação.
3. Nada é criado implicitamente (animal, marca, parceiro) durante um Manejo.
4. O contexto da sessão (data, local, marca padrão, apartação padrão, operação aberta) é definido uma vez.

## 2. Estrutura da tela (alvo)

```text
┌ Barra de ações (mg-action-bar) ────────────────────────────────────────────────┐
│ Sessão: 14/09/2026 · Curral 1 [trocar]  Tipo: (Manejo|Cadastro|Saída)  Salvar  │
│ Pesquisa · Colunas · Mais opções (resumos, colunas)                             │
├ Faixa de contexto ──────────────────────────────────────────────────────────────┤
│ Marca padrão: ABC · Apartação: ROTINA (lote automático) · Operação: —           │
├ Formulário ─────────────────────────────────────────────────────────────────────┤
│ MANEJO:   [Nº identificação] [Peso kg] [Obs]          faixa do animal: 4368 · ABC · M · Nelore · Garrote · lote MEIO · última 12/08 206 kg · +14 kg · GMD 0,42
│ CADASTRO: [Nº ou próximo da faixa ▾] [Marca ▾] [Sexo] [Raça ▾] [Categoria ▾] [Peso opcional] [Obs]
│ SAÍDA:    [Motivo ▾] [Operação/Embarque aberto ▾ quando Venda/Abate] [Nº] [Peso] [Causa ▾ se Morte] [Obs]
├ Grade da sessão (eventos de hoje) ──────────────────────────────────────────────┤
└ Rodapé de resumos (existente) ──────────────────────────────────────────────────┘
```

Não existem: "Dados da compra", "Dados da venda", "Dados do abate", popups de cadastro, combobox com "Adicionar".

## 3. Fluxos

### 3.1 Manejo (caminho crítico)

| Passo | Tecla | Regra |
|---|---|---|
| Foco inicial em Nº identificação | — | ao abrir e após salvar |
| Digitar/ler identificador | Enter/Tab | resolve por `animalIdentificadores` (índice); mais de um → diálogo por teclado; nenhum → oferecer cadastro rápido (não cria sozinho) |
| Faixa do animal preenche | — | marca, sexo, raça, categoria, lote atual, última pesagem |
| Peso | Enter | prévia de ganho/GMD e avisos de conferência (faixa, não toast) |
| Lote | automático | apartação padrão da sessão + faixa de peso + ocupação por `animalLotes`; mostra "sugerido: MEIO" e permite trocar (registra decisão) |
| Salvar | Enter | transação: evento + projeções + auditoria; foco volta ao Nº; sequência de faixa avança só em Cadastro |

Bloqueios no serviço (não só na tela): animal inativo, duplicidade no dia, data anterior ao cadastro, sessão fechada.

### 3.2 Cadastro (curral)

Opção A (preferida): cadastrar pela tela Animais antes de pesar. Opção B (rápido): diálogo mínimo com Nº (próximo livre da faixa selecionada ou digitado), Marca (padrão), Sexo, Raça (padrão), Categoria (sugerida); peso opcional. Compra **não** aparece aqui.

### 3.3 Saída

Motivo → se Venda/Abate: selecionar operação aberta (obrigatória para Abate; para Venda conforme configuração) → Nº → Peso → Salvar. Comprador, frigorífico, preço, documentos vêm da operação; nada é digitado por animal. Morte: causa (cadastro) + observação se a causa exigir.

### 3.4 Edição

Continua por `?editar=<id>`; campos de cadastro do animal **não** são editáveis a partir da pesagem (vão para Animais).

## 4. O que sai do arquivo `LancamentoPesagensIndividuais.jsx`

| Bloco atual | Destino |
|---|---|
| estados de compra/venda/abate (≈ 25 `useState`) | operações comerciais |
| `GerenciarApartacoesDialog`, `GerenciarEmbarquesDialog` | telas próprias |
| `marcasExistentes/racasExistentes/erasExistentes` derivados das pesagens | cadastros |
| `numerosUsados` + `SequenciaBrincos` com `window.__sequenciaBrincos` | serviço de faixas |
| `configuracoesPorTipoRef` (lembra valores por tipo) | contexto da sessão persistido |
| `getLoteAutomatico`/`isLoteCheio` na tela | serviço de lote (`HERD-LOT-MODEL.md`) |
| validações duplicadas (peso opcional por motivo, duplicidade do dia) | domínio |

Estimativa qualitativa: a página cai para uma fração do tamanho atual e passa a orquestrar serviços; os componentes de faixa, grade e rodapé permanecem.

## 5. Critérios de aceite

- Manejo: Nº → Enter → Peso → Enter salva, com foco de volta ao Nº, sem mouse.
- Nenhum campo de cadastro editável em Manejo/Saída.
- Nenhum popup de cadastro acessível a partir do Lançamento.
- Salvamento p95 dentro do orçamento na massa de 36 mil no navegador.
- Gates `ui:operational-customization` e `ui:consistency` reescritos para o contrato novo (não "consertados" para o antigo).
