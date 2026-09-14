# DAY-CLOSING-MODEL — Fechamento do dia

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual (`src/pages/FechamentoDia.jsx`)

| Bloco | Como funciona | Avaliação |
|---|---|---|
| Carga | `loadOperationalCatalog()` = **todas** as pesagens + apartações + lotes + animais + sessões | O(N) a cada abertura e após cada ação; inviável em 36 mil+ |
| Filtro | `data_pesagem === date` e apartação opcional | não usa `sessao_id` |
| KPIs | lançamentos, animais únicos, peso médio, GMD médio, lotes movimentados, pendências | corretos para o dia |
| Pendências | GMD negativo (Peso), lançamento sem lote (Lote), Venda sem embarque/documento (Doc) | calculadas na tela; "Justificar" guarda a chave em `Set` local e, ao fechar, em `sessoesPesagem.justificativas` |
| Conferência por lote | contagem de pesagens do dia por lote × capacidade | conta eventos, não animais; ignora `animalLotes` |
| Conferência por marca | agrupamento por `row.marca` texto | ok como painel |
| Ações | Exportar CSV, Backup do dia (JSON das linhas), Fechar/Reabrir | backup do dia é só download no navegador; não passa pelo backup físico validado |
| Fechar | bloqueado se houver pendência não justificada; grava `status='Fechada'` | não gera snapshot; não bloqueia novos lançamentos (ver `WEIGHING-SESSION-MODEL.md`) |
| Reabrir | sem motivo | sem auditoria |
| Navegação | botão "Vincular/Reconferir" leva para `#/PesagensIndividuais` sem filtro | o usuário precisa procurar o registro |
| Visual | `op-screen`/`operational-insights.css` | **não** é ModeloBase1 (ver `MODELOBASE1-PRODUCT-MAP.md`) |

Divergência de regra: o fechamento exige documento para **Venda** (pendência `Doc`, `danger`), mas o Lançamento só obriga documento para **Abate**.

## 2. Modelo alvo

### 2.1 Escopo do fechamento = sessão

Entrada: `sessao_id` (data + local). Consulta: `pesagens.where('sessao_id')` (índice existente) em vez de carregar a base. Animais e lotes carregados apenas para os ids envolvidos.

### 2.2 Pendências (catálogo mínimo, avaliadas no serviço)

| Código | Severidade | Regra | Ação oferecida |
|---|---|---|---|
| `PESO_GMD_NEGATIVO` | atenção | `gmd < 0` | reconferir / justificar |
| `PESO_FORA_FAIXA` | atenção | aviso de conferência aceito com justificativa | ver justificativa |
| `SEM_LOTE` | atenção | Manejo/Cadastro sem `lote_id` | vincular |
| `SAIDA_SEM_OPERACAO` | crítica | Venda/Abate sem `operacao_id` | vincular |
| `ABATE_SEM_EMBARQUE` | crítica | Abate sem `embarque_id` EM_CARREGAMENTO | vincular |
| `VENDA_SEM_DOCUMENTO` | conforme configuração `exigir_documento_venda` | | vincular / justificar |
| `DUPLICIDADE_DIA` | crítica | mesmo animal, dois Manejos | cancelar um |
| `ANIMAL_TEMPORARIO` | atenção | identificador `SN` na sessão | batizar depois |

Crítica bloqueia; atenção pode ser justificada. Justificativa gravada por pendência (`{codigo, pesagem_id, texto, quando}`), não como conjunto de chaves.

### 2.3 Snapshot

Ao fechar: `{versao: 1, contagens por tipo/motivo, animais_unicos, peso_total, gmd_medio_simples, por_lote[], por_marca[], pendencias_justificadas[]}`. Relatório REP-001 lê o snapshot; reabrir invalida (`snapshot_invalido_em`).

### 2.4 Ações

- "Vincular" abre o registro exato (rota com `?editar=<id>` já existe no Lançamento).
- "Backup do dia" passa a ser "Exportar sessão" (CSV/JSON) e o backup fica com a Manutenção.
- Fechar bloqueia novos eventos na sessão (serviço).

### 2.5 UI

Migrar para a Tela Mãe do ModeloBase1: barra de ações (data/sessão, pendências, Fechar), painel de pendências como lista filtrável, conferências como tabelas padrão. KPIs em faixa de resumo (`PesagensResumoRodape` já existe como padrão de rodapé).

## 3. Migração

Nenhuma de dados além de `WEIGHING-SESSION-MODEL.md`. `justificativas[]` antigas (chaves `peso:<id>`) são convertidas em objetos `{codigo, pesagem_id}` quando possível.

## 4. Fora de escopo

Fechamento contábil, conciliação de caixa, aprovação por gerente com assinatura.
