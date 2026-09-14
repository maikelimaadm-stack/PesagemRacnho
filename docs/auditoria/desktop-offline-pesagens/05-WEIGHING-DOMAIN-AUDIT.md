# 05 — Auditoria de Domínio (Pesagens Individuais)

## Modelo atual vs modelo ideal

O sistema **não possui entidades relacionais separadas** para Animal e Sessão de Pesagem. O domínio está **denormalizado** dentro de `PesagemIndividual`.

---

## Entidade: Animal (ideal)

| Campo ideal | Existe hoje? | Onde |
|-------------|--------------|------|
| id | ⚠️ Parcial | Identidade = `numero_animal` + `marca` |
| brinco | ✅ | `numero_animal` |
| identificação visual | ⚠️ | `marca` |
| lote atual | ⚠️ | `lote_id`, `nome_lote` no registro |
| categoria | ❌ | — |
| sexo | ✅ | `sexo` |
| raça | ✅ | `raca` |
| status | ✅ | `status_animal` (Ativo/Inativo) |
| data nascimento | ⚠️ | `era` (string livre) |
| observações | ✅ | `observacao` |

**Diagnóstico:** Animal é **evento de pesagem**, não cadastro master. Cadastro ocorre via `tipo_manejo === 'Cadastro'`.

---

## Entidade: Lote (ideal)

| Campo | Existe? | Entidade |
|-------|---------|----------|
| id | ✅ | `LoteApartacao.id` |
| nome | ✅ | `nome_lote` |
| fazenda/unidade | ⚠️ | `empresa_id` (sempre 'local') |
| curral/pasto | ⚠️ | via `Apartacao` |
| status | ⚠️ | `fechado` boolean |

**Apartação** funciona como agrupador de lotes (`Apartacao` + `LoteApartacao`).

---

## Entidade: Pesagem individual (ideal)

| Campo ideal | Campo atual | Status |
|-------------|-------------|--------|
| id | id | ✅ |
| animal_id | — | ❌ Usa numero_animal+marca |
| data_pesagem | data_pesagem | ✅ |
| peso_kg | peso | ✅ |
| tipo_pesagem | tipo_manejo | ✅ (Cadastro/Manejo/Saída) |
| lote_id | lote_id | ✅ |
| operador | — | ❌ |
| origem | origem_animal / campos compra | ⚠️ Parcial |
| observação | observacao | ✅ |
| created_at | created_date | ✅ |
| updated_at | updated_date | ✅ |
| deleted_at | — | ❌ Hard delete |
| sync_status | — | ❌ |
| device_id | — | ❌ |
| version | — | ❌ |

**Campos extras no registro:** GMD, ganho, dias, dados venda/abate/compra, embarque, sanidade — modelo rico mas flat.

---

## Entidade: Sessão de pesagem (ideal)

| Campo | Existe? |
|-------|---------|
| id | ❌ |
| data | ⚠️ Implícito por `data_pesagem` |
| lote_id | ⚠️ Por registro |
| operador | ❌ |
| status | ❌ |
| total_animais | ⚠️ Calculado na UI |
| peso_medio | ⚠️ Calculado na UI |
| ganho_medio | ⚠️ Calculado na UI |

**Não existe sessão** — cada pesagem é independente.

---

## Entidade: Auditoria local (ideal)

| Campo | Existe? |
|-------|---------|
| audit_log | ❌ Completamente ausente |

Exclusões e edições **não deixam rastro**.

---

## Regras de negócio — matriz de conformidade

| # | Regra | Implementado? | Evidência |
|---|-------|---------------|-----------|
| 1 | Peso obrigatório | ✅ | `handleSalvar` L568 |
| 2 | Data obrigatória | ✅ | L559 |
| 3 | Animal obrigatório | ✅ | L563 (exceto SN) |
| 4 | Peso > 0 | ✅ | L568 |
| 5 | Peso faixa aceitável | ⚠️ | Faixa por lote (peso_min/max) |
| 6 | Data futura bloqueada | ❌ | Não encontrado |
| 7 | Duplicidade mesmo dia | ✅ | L600-604, animalLookup |
| 8 | Edição de pesagem | ✅ | editingId |
| 9 | Exclusão lógica | ❌ | Hard delete |
| 10 | Histórico alteração | ❌ | — |
| 11 | Peso médio | ⚠️ | UI ResumoLotes/Rodape |
| 12 | Ganho de peso / GMD | ✅ | L630-645 |
| 13 | Ordenação por data | ✅ | list('-data_pesagem') |
| 14 | Filtros lote/animal/período | ✅ | PesagensIndividuais |
| 15 | 100% offline | ✅ | Com Electron |
| 16 | Salvamento sem internet | ✅ | IPC local |
| 17 | Recuperação após fechar | ✅ | JSON persiste |
| 18 | Recuperação queda energia | ❌ | Risco corrupção JSON |

---

## Integridade relacional

| Relação | Enforced? |
|---------|-----------|
| Pesagem → Lote | ⚠️ UI only |
| Pesagem → Apartação | ⚠️ UI only |
| Lote → Apartação | ⚠️ UI only |
| Sanidade → Pesagem | ⚠️ UI only |
| Embarque → Documento → Pesagem | ⚠️ UI only |

**Exclusão em cascata:** Manual na UI (ex: GerenciarApartacoesDialog verifica pesagens vinculadas).

---

## Lacunas de domínio prioritárias

1. Entidade Animal master (ou view materializada)
2. Soft delete + audit_log
3. Validação de data futura
4. Operador/dispositivo
5. Sessão de pesagem (opcional, fase 2)
6. Constraints no banco (não na UI)

---

## Arquivos com lógica de domínio (candidatos a extração)

| Arquivo | Linhas ~ | Conteúdo |
|---------|----------|----------|
| LancamentoPesagensIndividuais.jsx | 2200 | Validação, GMD, lote auto, save |
| PesagensIndividuais.jsx | 1700 | Import CSV, filtros, bulk edit |
| animalLookup.jsx | 65 | Identificação animal |
| GerenciarApartacoesDialog.jsx | 230 | Apartação/lote |

**Não alterar UI visual** — extrair para `domain/` e `application/` nos slices futuros.
