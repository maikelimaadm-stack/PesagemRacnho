# IMPORT-TARGET-MODEL — Importação (CSV/JSON) no modelo alvo

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Importação hoje

| Aspecto | Implementação |
|---|---|
| Entrada | CSV (`;`, tab ou `,` detectado; aspas; BOM) via Relação › Mais opções › Importar CSV; JSON de pesagens via Manutenção |
| Cabeçalhos | `ID`, `ID_Externo`, `Data`, `NumeroAnimal`/`Animal`, `Sexo`, `Raça`, `Era`, `Marca`, `Peso`, `Lote`, `Apartação`, `Observação`, `DataAnterior`, `PesoAnterior`, `Dias`, `Ganho`, `GMD` (derivados ignorados e recalculados) |
| Tipo de evento | **um só para o arquivo inteiro** (`tipoManejoImport`: Cadastro/Manejo/Saída + motivo + destino) |
| Identidade | `NÚMERO::MARCA` → animal existente ou **criado** (`animais`, `animalIdentificadores`) com `origem='importacao'` |
| Lote | vinculado por nome (`nome_lote|nome_apartacao`) com diálogo de seleção (`applyImportLotSelection`) |
| Idempotência | SHA-256 do arquivo em `importacoes.arquivo_hash` (único) |
| Transação | uma só; cronologia validada por animal; sessão `IMPORTACAO` por data |
| Erros | lista `erros[]` por linha na tela; sem exportação do relatório |

Limitações: marca/raça/era criadas como texto; um CSV com Cadastro e Manejo misturados precisa de dois arquivos; nomes de lote com grafia diferente não casam; não há importação de cadastros (marcas, parceiros) nem de identificadores.

## 2. Modelo alvo

### 2.1 Tipos de importação

| Tipo | Arquivo | Resolve | Cria |
|---|---|---|---|
| Cadastros mestres | CSV por cadastro (marcas, raças, categorias, parceiros, causas) | nome normalizado | registros novos; atualiza `ativo`/campos se `id` informado |
| Animais | CSV: número, marca, sexo, raça, categoria/era, nascimento, propriedade, lote inicial, `id_externo` | marca/raça/categoria por nome; lote por nome dentro da apartação | animal + identificador VISUAL + evento CADASTRO (sem peso) |
| Pesagens (Manejo) | CSV atual sem colunas de cadastro obrigatórias | animal por identificador ativo (número+marca, RFID) | apenas eventos; **não cria animal** (linha vai para pendência) |
| Saídas | CSV com motivo, data, operação (opcional) | animal, operação/embarque por código | eventos SAÍDA |
| Faixas de identificadores | CSV: tipo, marca, prefixo, início, fim, dígitos | marca | faixas |
| Legado completo (compatibilidade) | CSV atual com `Cadastro` selecionado | como hoje, mas resolvendo marca/raça por cadastro | animal + eventos; valores desconhecidos exigem confirmação |

### 2.2 Assistente (dry-run obrigatório)

1. Detectar delimitador e mapear colunas (mapeamento editável e salvável como modelo em `appSettings['modelo-importacao:<nome>']` — configuração real).
2. Validar por linha: obrigatórios, formato brasileiro, data civil, cronologia.
3. Resolver referências: marca, raça, categoria, parceiro, lote, embarque. Para cada valor não encontrado: opção "criar cadastro" (lista os valores novos) ou "rejeitar linhas".
4. Mostrar resumo: inserir / atualizar / ignorar (hash já importado) / rejeitar, por motivo.
5. Aplicar em transação única (≤ 20 mil linhas) ou em blocos com `importacoes.status='PARCIAL'` e checkpoint (`linhas_processadas`).
6. Gravar relatório da importação (JSON) em `exports/` via ponte de arquivo, com o hash.

### 2.3 Regras

- Identificador é obrigatório; marca obrigatória para VISUAL (padrão da empresa quando a coluna faltar, com aviso).
- Derivados do arquivo continuam ignorados e recalculados.
- Uma linha de Manejo para animal inexistente **não** cria animal (diferente de hoje) — vira pendência exportável; o usuário importa o cadastro antes.
- Sessões criadas por importação nascem `FECHADA` (`WEIGHING-SESSION-MODEL.md`).

## 3. Modelo CSV (novo) — colunas mínimas

`Data;NumeroAnimal;Marca;Peso;Lote;Apartacao;Observacao;IdExterno` para Manejo. `Marca;Raça;Categoria;Sexo;Nascimento;Propriedade` só no arquivo de animais. O modelo atual continua aceito.

## 4. Migração dos dados (reaproveita o mesmo motor)

O backfill v7 e a migração de valores livres (`BRAND-REGISTRY-MODEL.md` §3 etc.) usam o **mesmo** resolvedor por nome normalizado e o mesmo relatório de dry-run. Um único módulo `catalogResolver` evita duas implementações.

## 5. Fora de escopo

XLSX, importação de arquivos de balança (F5), importação de NF-e/GTA oficiais (F8), atualização em massa de pesagens existentes por CSV.
