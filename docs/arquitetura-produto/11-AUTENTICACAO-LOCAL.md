# 11 — Autenticação local, papéis e sessão (contrato de implementação)

**Programa 1.1.17 → 1.6.0 · ADR-041…ADR-046 (DEC-023…DEC-029) · revisão 2 (14/09/2026).**
Substitui a revisão 1 (três perfis, store `usuariosLocais`). Nada desta revisão depende de rede.

## 1. Princípios

- 100 % offline: sem servidor, Supabase, Firebase, OAuth, e-mail, SMS; a autenticação nunca impede o trabalho sem rede.
- Sem módulo nativo: Web Crypto (`crypto.subtle`), disponível no renderer e no Node dos gates.
- Senha, hash, salt, recovery key e tokens nunca vão para log, auditoria, CSV, diagnóstico ou `localStorage`.
- A UI esconde o que o papel não pode; o **serviço** autoriza (`authorize(action)`) antes de gravar.
- Threat model (docs/engineering/AUTH-THREAT-MODEL.md): controle e auditoria dentro do app; não protege contra quem tem acesso total ao perfil do SO e aos arquivos; sem criptografia total do banco.

## 2. Store `usuarios` (esquema v7)

Índices: `++localId, &id, empresa_id, &login_normalizado, role, ativo, created_at, updated_at, deleted_at` (hash e salt nunca indexados).

| Campo | Regra |
|---|---|
| `id`, `empresa_id='local'` | padrão |
| `nome`, `login`, `login_normalizado` | login normalizado = `trim` + minúsculas; único por empresa |
| `role` | `ADMIN` · `GESTOR` · `OPERADOR` · `CONSULTA` |
| `ativo` | inativo não entra; nunca apagar usuário referenciado em auditoria |
| `password_hash`, `password_salt` | base64; salt aleatório de 16 bytes por usuário |
| `password_algorithm` | `PBKDF2-SHA256` |
| `password_iterations` | valor persistido (padrão 310 000; centralizado em `passwordPolicy.js` e testado) |
| `password_version` | inteiro; permite recalibrar custo/algoritmo com rehash no próximo login |
| `must_change_password` | `true` após criação por ADMIN ou reset |
| `recovery_hash`, `recovery_salt` | só no ADMIN de bootstrap; verificador da Recovery Key |
| `failed_login_count`, `locked_until` | bloqueio temporário persistido (limite e duração em `auth-policy`) |
| `last_login_at` | atualizado no login |
| `created_at`, `updated_at`, `deleted_at` | padrão |

## 3. Módulo

```text
src/modules/auth/
  domain/passwordHasher.js      hashPassword(senha, { iterations?, salt? }) → { algorithm, salt, iterations, hash, version }; verifyPassword(senha, record); constantTimeEqual
  domain/passwordPolicy.js      PBKDF2_ITERATIONS, PASSWORD_VERSION, MIN_PASSWORD_LENGTH=6, TRIVIAL_PASSWORDS, validatePassword(senha, login)
  domain/recoveryKey.js         generateRecoveryKey() → texto legível (ex.: 5 grupos de 5), hashRecoveryKey, verifyRecoveryKey
  domain/permissionService.js   ROLES, ACTIONS, MATRIX, can(role, action), authorize(role, action) → lança AUTH_FORBIDDEN, listActions(role)
  application/authService.js    countActiveUsers, bootstrapFirstAdmin, authenticate, findActiveUser, createUser, updateUser, setActive, resetPassword, forcePasswordChange, changeOwnPassword, recoverAdminPassword, listUsers
  application/sessionService.js sessão em memória (+ sessionStorage para recarga técnica), inatividade, lock/unlock/logout/switchUser, subscribe; registra o provedor de ator
  application/auditContext.js   getActor() → { usuario_id, usuario_nome_snapshot } | nulos
  application/authAudit.js      registra LOGIN_SUCESSO, LOGOUT, BLOQUEIO, RESET_SENHA, ALTERACAO_USUARIO (resumidos, sem segredos)
src/components/auth/            AuthGate, FirstRunAdminSetupScreen (com exibição única da Recovery Key), LoginScreen, LockScreen, TrocarSenhaScreen, RecuperarSenhaScreen, RequirePermission, UserMenu, useAuth
src/pages/Usuarios.jsx          ação users.manage (ADMIN)
```

## 4. Matriz de permissões (`permissionService`)

| Ação | ADMIN | GESTOR | OPERADOR | CONSULTA |
|---|---|---|---|---|
| `launch.use` | ✔ | ✔ | ✔ | ✘ |
| `weighing.read` | ✔ | ✔ | ✔ | ✔ |
| `weighing.write` / `weighing.edit` | ✔ | ✔ | ✔ | ✘ |
| `animal.read` | ✔ | ✔ | ✔ | ✔ |
| `animal.write` (cadastro rápido) | ✔ | ✔ | ✔ | ✘ |
| `registry.read` | ✔ | ✔ | ✔ | ✔ |
| `registry.write` | ✔ | ✔ | ✘ | ✘ |
| `commercial.read` | ✔ | ✔ | ✘ | ✔ (sem valores) |
| `commercial.write` | ✔ | ✔ | ✘ | ✘ |
| `commercial.values` (ver preços) | ✔ | ✔ | ✘ | ✘ |
| `shipment.read` / `shipment.write` | ✔ / ✔ | ✔ / ✔ | ✔ / ✘ | ✔ / ✘ |
| `session.close` / `session.reopen` | ✔ | ✔ | ✘ | ✘ |
| `reports.read` | ✔ | ✔ | ✔ | ✔ |
| `reports.export` | ✔ | ✔ | ✘ | ✔ (só relatórios não sensíveis) |
| `reports.templates.share` | ✔ | ✔ | ✘ | ✘ |
| `maintenance.backup` | ✔ | ✔ | ✘ | ✘ |
| `maintenance.restore` / `maintenance.clear` / `maintenance.reset` / `maintenance.migrate` | ✔ | ✘ | ✘ | ✘ |
| `users.manage` | ✔ | ✘ | ✘ | ✘ |
| `settings.operational` | ✔ | ✔ | ✘ | ✘ |
| `settings.reports` (Configurações › Relatórios, divisor da @ — E1C 1.4.0) | ✔ | ✔ | ✘ | ✘ |
| `settings.auth` / `settings.manage` | ✔ | ✘ | ✘ | ✘ |
| `audit.read` | ✔ | ✔ | ✘ | ✘ |

Regra: ações destrutivas/administrativas chamam `authorize` no serviço; `RequirePermission` na UI é conveniência.
Relatórios (1.3.0): `reports.*` e `audit.read` seguem `docs/reporting/PERMISSIONS.md`. Esta tabela é
conferida contra a `MATRIX` pelo gate `auth:permissions:verify` (revisão E1C).

Configurações (E1C, 1.4.0): o item de menu e a página pedem `settings.operational` (ADMIN e GESTOR);
dentro, cada seção pede a sua permissão — Relatórios (divisor da @) `settings.reports`; Geral, Curral,
Comercial e o cartão Dados `settings.manage`; Segurança `settings.auth`. Na prática o GESTOR vê só
Relatórios. No serviço (`appConfigService`), `report-settings` exige `settings.reports`,
`auth-policy` exige `settings.auth` e os grupos operacionais (`operational-defaults`, `sales-policy`,
`weight-warning-policy`) exigem `settings.manage` (ADMIN) — a mesma regra da tela, também por dentro
(antes da E1C esses três aceitavam o GESTOR por `settings.operational`, mas só a tela os grava e ela
nunca os mostrou ao GESTOR). `settings.operational` ficou só para abrir o menu e a página.

## 5. Fluxo

```text
Splash/preflight de storage → (migração: backup físico → v7 → backfill → integridade)
  → usuarios.count === 0 ? FirstRunAdminSetup (nome, login, senha, confirmação → Recovery Key exibida uma vez)
  → Login (login + senha; Enter envia; erro genérico; falhas contam; bloqueio temporário; inativo não entra)
  → must_change_password ? TrocarSenha : App principal
Bloqueio por inatividade (padrão 30 min; 0 desliga) → LockScreen (senha do mesmo usuário) · Trocar usuário · Sair
Recuperação: Login › "Esqueci a senha do administrador" → Recovery Key → nova senha → nova key gerada e exibida
```

Nenhuma tela de dados é montada antes da autenticação. Restore, reset ou alteração do próprio usuário encerram a sessão. Fechar o app encerra a sessão.

## 6. Tela Sistema › Usuários (ModeloBase1)

Lista: Nome, Login, Papel, Ativo, Último acesso. Ações: Novo usuário, Editar (nome/papel/ativo), Redefinir senha (temporária + `must_change_password`), Forçar troca. Nunca mostrar hash/salt. Não desativar/remover o último ADMIN ativo. OPERADOR e CONSULTA não abrem a tela.

## 7. Auditoria por usuário

`auditoria`: `usuario_id`, `usuario_nome_snapshot`, `resumo`, `campos_alterados[]`. `sessoesPesagem.operador_usuario_id`. Eventos de acesso resumidos (`entidade='usuarios'`, `acao` ∈ {LOGIN_SUCESSO, LOGOUT, BLOQUEIO, RESET_SENHA, ALTERACAO_USUARIO}). Registros antigos: `usuario_id = null`.

## 8. Configuração `auth-policy:<empresa>` (appSettings, versionada)

`{ versao, inactivity_lock_minutes: 30, failed_attempt_limit: 5, lock_minutes: 0.5 }` — alterável só por `settings.auth` (ADMIN).

## 9. Backup e restauração

`usuarios` entra no backup (hash/salt, nunca senha nem sessão). Restore com usuários exige `maintenance.restore` e encerra a sessão. Backup formato 2 restaurado em v7 nasce sem usuários → FirstRunAdminSetup.

## 10. Gates

- `auth:crypto:verify` — hash/verify, salt aleatório, iterações ≥ política, comparação constante, `password_version`, senha errada não autentica.
- `auth:bootstrap:verify` — banco vazio abre bootstrap; cria ADMIN; recovery key exibida uma vez e só hash gravado; backup com usuários não faz bootstrap; `admin/admin` impossível.
- `auth:permissions:verify` — matriz completa (4 papéis × ações); `authorize` lança `AUTH_FORBIDDEN`; serviços críticos recusam ator sem permissão; OPERADOR/CONSULTA não abrem Usuários.
- `auth:recovery:verify` — key válida redefine e gera nova; key antiga invalidada; key inválida recusada e conta falha.
- `audit:actor:verify` — eventos gravam `usuario_id`/`usuario_nome_snapshot`; nenhum segredo na auditoria; login events resumidos.
