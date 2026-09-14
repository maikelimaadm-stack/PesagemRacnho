# UX-FLOW-AUDIT — Auditoria dos fluxos de uso

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Inventário de telas e rotas

| Rota | Tela | Padrão visual | Estado UX |
|---|---|---|---|
| `PesagensIndividuais` (inicial) | Relação de pesagens | Tela Mãe ModeloBase1 (R34) | conforme |
| `LancamentoPesagensIndividuais` | Lançamento | design v2 (R29–R33) sobre ModeloBase1 | funcional; concentra 6 fluxos |
| `FechamentoDia` | Fechamento do dia | `op-screen` próprio | fora do contrato visual |
| `FichaAnimal` | Ficha do animal | `op-screen` próprio | fora do contrato visual |
| `CadastrosComerciais`, `CausasMorte`, `ConfiguracoesSanidade` | Cadastros auxiliares | Tela Mãe (lista) + FormCard (registro) | conforme na lista; sanidade contradiz ADR-007 |
| `ManutencaoSistema` | Backup e manutenção | cartões | aceitável (tela administrativa) |
| Popups no Lançamento | Apartações/Lotes, Embarques/Documentos, Configurar resumos, Configurar colunas, SN, Selecionar animal, Excluir, Outlier | `d17b-standard-dialog` | os dois primeiros são **cadastros dentro de popup** |

## 2. Fluxo de Manejo (o mais frequente) — como está

```text
1 abrir Lançamento (Tipo já em Manejo)
2 Data (hoje)                         ← já preenchida
3 Sexo/Raça/Era/Marca                ← visíveis e editáveis mesmo em Manejo; valores vêm do Cadastro ao resolver o animal
4 Nº Ident./Nome  → Enter/Tab resolve ← bom: resolução ao concluir
   ├ número em várias marcas → diálogo de escolha
   └ não cadastrado → toast "use Cadastro"
5 Peso → prévia de ganho/GMD/avisos   ← bom
6 Apartação (opcional) → lote automático por faixa
7 Salvar (Enter)                      ← bom; sequência de brincos avança
```

Pontos de atrito:

- quatro campos de cadastro (3) ocupam a linha principal em Manejo, embora sejam somente-leitura na prática;
- a apartação precisa ser reescolhida a cada animal se o operador limpar o formulário; deveria ser "da sessão";
- avisos aparecem em toast e em faixa; três lugares para a mesma mensagem.

## 3. Fluxo de Cadastro — como está

Ver `ANIMAL-REGISTRATION-FLOW.md` §1. Atritos: marca/raça/era digitados; compra escondida no "olhinho"; sequência de brincos escondida em ícone; peso obrigatório.

## 4. Fluxo de Saída — como está

Motivo → (Venda) "Dados da venda" oculto → comprador/valores/documentos por animal; (Abate) embarque + documento obrigatórios → "Dados do abate" oculto → frigorífico/valores. Ver `SALE-FLOW-MODEL.md`, `SLAUGHTER-FLOW-MODEL.md`.

## 5. Ações ocultas ("olhinho") — inventário

| Local | Controle | O que esconde | Recomendação |
|---|---|---|---|
| Lançamento › Cadastro | `Eye/EyeOff` "Dados da compra" | 6 campos de compra | remover; compra vira operação própria |
| Lançamento › Cadastro | ícone `Tag` "Sequência de brincos" | painel de sequência | substituir por seleção de faixa do estoque, sempre visível quando houver faixa ativa |
| Lançamento › Saída/Venda | botão texto "Dados da venda" | 9 campos | remover; venda vira operação |
| Lançamento › Saída/Abate | botão texto "Dados do abate" | 8 campos | remover; abate vira operação |
| Lançamento › Mais opções | `MoreVertical` | gerenciar apartações, embarques, resumos, colunas | manter só colunas e resumos; cadastros saem para telas |
| Popups Apartações/Embarques | `DropdownMenu` por linha | editar/excluir | desaparece com as telas próprias (ações na barra, como na Tela Mãe) |

Regra: toda ação que muda dados fica na barra de ações ou no formulário visível; ícone sem rótulo só para ações de visualização (colunas, filtros).

## 6. Fluxos alvo (resumo)

| Fluxo | Alvo |
|---|---|
| Manejo | Tipo(Manejo) · Nº → resolve · Peso · Salvar. Marca/raça/categoria só exibidos na faixa do animal. Apartação/lote e marca padrão vêm da sessão. |
| Cadastro | tela Animais (ou cadastro rápido no curral com 4 campos). Compra separada. |
| Saída | Motivo · (operação aberta selecionada uma vez) · Nº · Peso · Salvar. |
| Cadastros mestres | telas ModeloBase1 próprias: Marcas, Raças, Categorias, Parceiros, Propriedades, Faixas de identificadores, Apartações/Lotes, Embarques, Causas de morte. |
| Fechamento | Tela Mãe por sessão. |
| Ficha | Tela Mãe modo registro. |

## 7. Critérios de aceite UX (para as fases)

1. Manejo em ≤ 3 campos digitados e 2 teclas de confirmação.
2. Nenhum cadastro em popup dentro do Lançamento.
3. Nenhuma ação de dados escondida atrás de ícone sem rótulo.
4. Todas as telas na Tela Mãe/registro do ModeloBase1, claro e escuro.
5. Uma única mensagem por aviso (faixa), toast só para resultado de salvar.
