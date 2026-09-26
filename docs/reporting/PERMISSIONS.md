# Permissões dos relatórios

Fontes: `src/modules/auth/domain/permissionService.js` (`MATRIX`, `can`, `forbiddenError`) e
`src/modules/reporting/domain/reportPermissions.js`. Permissões são **genéricas** (ações nomeadas),
nunca uma por relatório. Nenhum `if (role === …)` fora do `permissionService`.

## 1. Ações da MATRIX usadas pelos relatórios

| Ação | ADMIN | GESTOR | OPERADOR | CONSULTA | Uso nos relatórios |
|---|---|---|---|---|---|
| `reports.read` | ✓ | ✓ | ✓ | ✓ | Menu Relatórios; exigida por toda definição e pelos modelos/favoritos/recentes |
| `reports.export` | ✓ | ✓ | — | ✓ | CSV, XLSX, JSON, **impressão e PDF** |
| `reports.templates.share` | ✓ | ✓ | — | — | Salvar/editar/excluir modelo compartilhado |
| `commercial.values` | ✓ | ✓ | — | — | Colunas `commercial`; relatórios da família Comercial |
| `audit.read` | ✓ | ✓ | — | — | Coluna `audit`; Trilha de auditoria |
| `users.manage` | ✓ | — | — | — | Coluna `personal` (login); relatório Usuários |
| `maintenance.backup` | ✓ | ✓ | — | — | Histórico de backups |
| `session.close` | ✓ | ✓ | — | — | Fechamento do dia (imprimível) |
| `weighing.read`, `animal.read`, `registry.read`, `shipment.read` | ✓ | ✓ | ✓ | ✓ | Relatórios operacionais (pesagens, rebanho, desempenho, movimentação, saídas, embarques, cadastros) |

Ações de manutenção fora dos relatórios, para referência: `maintenance.restore`, `maintenance.clear`,
`maintenance.reset` e `maintenance.migrate` são só ADMIN.

## 2. Sensibilidade de coluna (`reportPermissions.js`)

| `column.sensitive` | Ação exigida (`SENSITIVITY_PERMISSION`) |
|---|---|
| `commercial` | `commercial.values` |
| `audit` | `audit.read` |
| `personal` | `users.manage` |

`canSeeColumn(column, role)`:

1. id que casa com `FORBIDDEN_FIELD_PATTERN`
   (`password|senha|salt|hash_senha|recovery|recuperacao|secret|segredo|token|credential`, sem distinção
   de caixa) → **nunca** visível, para qualquer perfil;
2. sem sensibilidade → visível;
3. com sensibilidade → `can(role, ação)`.

Além do padrão, as fontes não entregam segredos: `registry.usuarios` projeta só `id`, `nome`, `login`,
`role`, `ativo`, `last_login_at`, `created_at`; a auditoria não devolve conteúdo anterior/posterior; os
lookups de eventos guardam só o nome do usuário.

## 3. Executar, exportar, imprimir

| Função | Regra |
|---|---|
| `canRunReport(definition, role)` | não bloqueado **e** todas as ações de `requires` |
| `assertCanRunReport` | `AUTH_FORBIDDEN` na primeira ação faltante; depois `REPORT_BLOCKED` se bloqueado |
| `assertCanExport(definition, role, columnIds)` | `reports.export` → `assertCanRunReport` → nenhuma coluna pedida invisível ao papel (erro cita a ação da sensibilidade) |
| `canShareTemplates(role)` | `reports.templates.share` |

**Exportar = imprimir = PDF**: `reportExportService.prepareEmission` e
`reportPrintService.preparePrint` chamam o mesmo `assertCanExport`. OPERADOR não imprime nem gera PDF.

## 4. Onde a permissão é aplicada (serviço, não só tela)

| Ponto | Aplicação |
|---|---|
| `reportService.listReports(actor, { visibility })` | por área da interface (1.4.0): `catalog` (padrão, Relatórios), `maintenance` (aba Controle) ou `hidden`; só relatórios executáveis pelo papel, mais os bloqueados como indisponíveis (que desde a 1.4.0 ficam só em `hidden`). Estar oculto não libera nada: `runReport` de um oculto (link ou modelo) passa pelas mesmas regras — `cadastros.usuarios` continua só ADMIN. A aba Controle fica dentro de Backup e Manutenção, que exige `maintenance.backup`. **E1B:** para quem **não** tem `maintenance.backup` (OPERADOR, CONSULTA), `listReports(actor, { visibility: 'catalog' })` acrescenta os relatórios da área `maintenance` que o papel executa (Pendências de pesagem e Qualidade dos dados) na família **Controle** (`controlInCatalog: true`); ADMIN/GESTOR continuam com os 12 + aba Controle |
| `selection.fixedFilters` (modelo convertido) | condição do relatório antigo; nunca removida por perfil (coluna sem permissão → `AUTH_FORBIDDEN`, pois tirar a condição ampliaria a população) |
| `reportService.runReport` | ator com papel obrigatório; `assertCanRunReport` |
| `reportService.resolveSelection` | remove colunas invisíveis (aviso `COLUMNS_HIDDEN_BY_PERMISSION`, lista em `hiddenByPermission`), remove filtros nelas (`FILTER_REMOVED_BY_PERMISSION`), ignora ordenação e totais nelas, restringe as colunas de pesquisa; agrupar por coluna invisível → `AUTH_FORBIDDEN` |
| `viewModel.availableColumns` | só colunas visíveis ao papel (diálogos de Colunas, Agrupar e Totais) |
| `reportExportService.prepareEmission` / `reportPrintService.preparePrint` | papel obrigatório; mesma sessão que gerou o view model; `assertCanExport` |
| `reportTemplateService` | ver §5 |
| Cabeçalho da propriedade / divisor da @ (E1B) | editados no cadastro de Propriedades (`registry.write`) e em Configurações › Relatórios (`settings.reports` = ADMIN e GESTOR, E1C; o serviço autoriza o grupo `report-settings` por ela). O menu Configurações e a página pedem `settings.operational` (ADMIN e GESTOR); dentro, o GESTOR vê só a seção Relatórios — Geral, Curral, Comercial e Dados pedem `settings.manage` e Segurança `settings.auth` (ADMIN). No serviço, os grupos operacionais pedem `settings.manage` (ADMIN), como na tela. O cabeçalho vai na folha de quem pode abrir o relatório. O estado por usuário (`report-view-state:*`) só guarda a seleção do próprio usuário |
| UI (conforto) | item de menu com `reports.read`; botões **Imprimir**, **Excel**, **PDF** e **Outros formatos** só com `reports.export`; opção "Compartilhado" desabilitada sem `reports.templates.share`; excluir modelo só para dono (pessoal) ou quem compartilha |

Mensagens de recusa na tela: "Seu perfil não pode abrir este relatório.", "Seu perfil não pode exportar
este relatório.", "Seu perfil não pode imprimir ou exportar este relatório.", "Seu perfil não pode salvar
este modelo."

## 5. Modelos nunca ampliam permissão

`reportTemplateService.js` (modelos em `appSettings`, só configuração, nunca dados):

- toda operação exige ator com `id`, `role` e `reports.read`;
- **listar**: só modelos de relatórios que o papel pode executar; pessoais do próprio usuário + todos os
  compartilhados;
- **salvar**: relatório base executável pelo papel; escopo `SHARED` exige `reports.templates.share`;
  colunas, filtros ou grupos em colunas que o **autor** não vê → `AUTH_FORBIDDEN`; editar modelo
  existente exige ser dono do pessoal ou ter `reports.templates.share` para o compartilhado; nome
  obrigatório (≤ 80) e único por relatório/escopo;
- **excluir**: mesma regra da edição;
- **abrir** (`templateToRequest`): revalida contra a definição **atual** e o papel de **quem abre**:
  colunas, filtros, grupos, ordenação e totais inexistentes ou invisíveis são descartados com aviso
  `TEMPLATE_COLUMNS_REMOVED`; depois `runReport` aplica todas as regras de novo.

Consequência: um modelo compartilhado por um GESTOR com colunas de valores, aberto por CONSULTA, abre
sem essas colunas; aberto por OPERADOR, não aparece se o relatório base exigir `commercial.values`.

## 6. Decisões por perfil

| Perfil | Relatórios | Exportar / imprimir / PDF | Valores comerciais | Auditoria | Modelos |
|---|---|---|---|---|---|
| **ADMIN** | todos os disponíveis | sim | sim | sim | pessoal e compartilhado |
| **GESTOR** | todos os disponíveis, **exceto "Usuários"** (`users.manage` é só ADMIN) | sim | sim | sim | pessoal e compartilhado |
| **OPERADOR** | operacionais (pesagens, rebanho, desempenho, movimentação, saídas sem valores, embarques, qualidade dos dados, cadastros exceto usuários) | **não** | não (colunas ocultas; família Comercial indisponível) | não | só pessoal |
| **CONSULTA** | os mesmos operacionais, sem dados sensíveis | **sim** (só o que vê; colunas sensíveis já saem ocultas) | não | não | só pessoal |

Restrições de manutenção não mudam com relatórios: GESTOR não tem `maintenance.restore`,
`maintenance.clear` nem `maintenance.reset`. CONSULTA não tem nenhuma ação `*.write`; no módulo de
relatórios, CONSULTA (como todo perfil com `reports.read`) grava apenas configuração própria em
`appSettings` — modelo pessoal, favoritos e recentes — nunca dados operacionais.

Fechamento do dia (`session.close`), Histórico de backups (`maintenance.backup`) e Trilha de auditoria
(`audit.read`) ficam restritos a ADMIN e GESTOR.

## 7. Gates

`reports:permissions:verify` e `reports:sensitive-data:verify`; `reports:print-contract:verify` e
`reports:pdf-contract:verify` cobrem "OPERADOR não imprime" e "CONSULTA imprime sem valores".
