# 11 — Autenticação local e controle de acesso (contrato de implementação)

**Programa 2.0 · 14/09/2026 · ADR-035, ADR-036.**

## 1. Princípios

- 100 % offline: nenhuma dependência de rede, servidor, OAuth ou provedor externo.
- Sem módulo nativo: hash com Web Crypto (`crypto.subtle`, disponível no renderer e no Node 24 dos gates).
- Senha nunca é persistida, logada, exportada em CSV nem incluída em diagnóstico textual.
- A UI esconde o que o perfil não pode; o **serviço** valida as ações críticas.

## 2. Módulo

```text
src/modules/auth/
  domain/passwordHasher.js      hashPassword(password, opts) → { algoritmo, salt, iteracoes, hash } ; verifyPassword(password, record) → boolean
  domain/accessPolicy.js        PROFILES, PERMISSIONS, can(profile, permission), assertCan(profile, permission)
  domain/loginLockout.js        registerFailure(loginNormalizado), isLocked(loginNormalizado) → {locked, until} ; 5 falhas → 30 s (memória)
  application/localAuthService.js
  application/authSession.js    sessão em memória + sessionStorage
  application/auditContext.js   getActor() → { actor_user_id, actor_user_name, actor_user_profile } | nulls
src/components/auth/
  AuthGate.jsx                  decide: carregando → ConfiguracaoInicial → Login → Bloqueado → app
  ConfiguracaoInicialScreen.jsx
  LoginScreen.jsx
  LockScreen.jsx
  RequirePermission.jsx         envolve rotas/ações; sem permissão → tela "Acesso não permitido"
  UserMenu.jsx                  topbar: usuário, perfil, versão, Bloquear, Trocar usuário, Sair
src/pages/Usuarios.jsx          somente ADMIN (users.manage)
```

### 2.1 `passwordHasher`

- PBKDF2 · SHA-256 · salt aleatório de 16 bytes por usuário · 310 000 iterações · 32 bytes derivados.
- Persistido: `senha_hash` (base64), `senha_salt` (base64), `senha_iteracoes`, `senha_algoritmo = 'PBKDF2-SHA256'`.
- Comparação em tempo constante (XOR sobre bytes).
- `hashPassword` aceita `iteracoes` opcional só para testes rápidos (nunca abaixo de 310 000 em produção; o serviço fixa o valor).

### 2.2 `accessPolicy`

Perfis: `ADMIN`, `GESTOR`, `OPERADOR`. Permissões (mapa estático):

| Permissão | ADMIN | GESTOR | OPERADOR |
|---|---|---|---|
| `launch.use` | ✔ | ✔ | ✔ |
| `weighing.read` | ✔ | ✔ | ✔ |
| `weighing.write` | ✔ | ✔ | ✔ |
| `weighing.edit` | ✔ | ✔ | ✔ (só o próprio dia; regra futura) |
| `animal.read` | ✔ | ✔ | ✔ |
| `animal.write` | ✔ | ✔ | ✔ (cadastro rápido) |
| `registry.read` | ✔ | ✔ | ✔ |
| `registry.write` | ✔ | ✔ | ✘ |
| `commercial.read` | ✔ | ✔ | ✘ |
| `commercial.write` | ✔ | ✔ | ✘ |
| `shipment.read` | ✔ | ✔ | ✘ |
| `shipment.write` | ✔ | ✔ | ✘ |
| `session.close` | ✔ | ✔ | ✘ |
| `session.reopen` | ✔ | ✔ | ✘ |
| `reports.read` | ✔ | ✔ | ✘ |
| `maintenance.backup` | ✔ | ✔ | ✘ |
| `maintenance.restore` | ✔ | ✘ | ✘ |
| `maintenance.clear` | ✔ | ✘ | ✘ |
| `maintenance.migrate` | ✔ | ✘ | ✘ |
| `users.manage` | ✔ | ✘ | ✘ |
| `settings.manage` | ✔ | ✘ | ✘ |

### 2.3 `localAuthService`

| Função | Regra |
|---|---|
| `countActiveUsers()` | `usuariosLocais` com `ativo` e sem `deleted_at` |
| `createInitialAdmin({nome, login, senha})` | só quando `count === 0`; perfil ADMIN; `deve_trocar_senha=false`; recusa senha < 6 caracteres e senhas triviais (`123`, `123456`, `admin`, igual ao login) |
| `authenticate(login, senha)` | normaliza login; se bloqueado por tentativas → erro `AUTH_LOCKED` com `until`; usuário inexistente/inativo/senha errada → registra falha e devolve o **mesmo** erro `AUTH_INVALID`; sucesso → zera falhas, grava `ultimo_login_at`, devolve `{ id, nome, login, perfil, deve_trocar_senha }` |
| `createUser(actor, dados)` | exige `users.manage`; login único normalizado; senha inicial; `deve_trocar_senha=true` |
| `updateUser(actor, id, dados)` | nome, perfil, login (único); nunca senha por aqui |
| `setActive(actor, id, ativo)` | exige `users.manage`; **recusa desativar o último ADMIN ativo** (`AUTH_LAST_ADMIN`); nunca apaga fisicamente |
| `resetPassword(actor, id, novaSenha)` | exige `users.manage`; `deve_trocar_senha=true` |
| `changeOwnPassword(userId, senhaAtual, novaSenha)` | verifica a atual; `deve_trocar_senha=false` |
| `listUsers(actor)` | exige `users.manage`; nunca devolve hash/salt |

Erros: `AUTH_INVALID`, `AUTH_LOCKED`, `AUTH_FORBIDDEN`, `AUTH_LAST_ADMIN`, `AUTH_LOGIN_EXISTS`, `AUTH_WEAK_PASSWORD`, `AUTH_SETUP_DONE`.

### 2.4 `authSession`

- Estado em memória: `{ userId, nome, perfil, loginAt, lastActivityAt }`; espelho em `sessionStorage['pesagens.auth.session']` para sobreviver a recarga da janela (não a fechamento do app).
- `touch()` em eventos de teclado/mouse (throttle 30 s); `bloqueio_inatividade_minutos` (configuração; padrão 60; 0 desliga) → estado `LOCKED` (tela de bloqueio pede a senha do mesmo usuário; "Trocar usuário" volta ao login).
- `logout()` limpa memória e `sessionStorage`.
- `auditContext.getActor()` lê a sessão; sem sessão devolve nulos (gates Node e migrações).

## 3. Fluxo de primeira execução

```text
DbBootstrap (banco pronto, migração concluída)
  └─ AuthGate: countActiveUsers() === 0 ?
        sim → ConfiguracaoInicialScreen (Nome do administrador, Login, Senha, Confirmar) → createInitialAdmin → LoginScreen
        não → LoginScreen → authenticate → (deve_trocar_senha ? TrocarSenha : app)
```

Nenhuma tela de dados é montada antes da autenticação; a `LoginScreen` mostra só nome do produto, campos e versão (`APP_VERSION`).

## 4. Integração com o restante

- `App.jsx`: `DbBootstrap` → `AuthGate` → `Router`. Rotas recebem `RequirePermission` conforme `Layout.jsx` (`permission` por item de menu).
- `Layout.jsx`/AppShell: itens de menu filtrados por `can(perfil, permission)`; `UserMenu` na topbar.
- Auditoria: `weighingDataAdapter` e os serviços de cadastro chamam `getActor()` ao gravar `auditoria` (`actor_user_id`, `actor_user_name`, `actor_user_profile`); registros antigos ficam nulos.
- Serviços críticos validam `assertCan(actor.perfil, …)`: restore, limpeza, migração manual, usuários, configurações, fechamento/reabertura, operações comerciais.

## 5. Backup e restauração

- `usuariosLocais` entra no backup completo (hash/salt, nunca senha).
- Restaurar um backup que contém usuários exige perfil ADMIN e substitui os usuários (o restore é integral por definição); após o restore, a sessão atual é encerrada e o login é exigido.
- Backups v2 (sem `usuariosLocais`) restaurados em v7: a store nasce vazia → o `AuthGate` volta para a Configuração Inicial. Isso é comportamento esperado e documentado.

## 6. Gates

- `auth:local:verify` (`scripts/verify-local-auth.mjs`): hash/verify; senha errada não autentica; bloqueio após 5 falhas por 30 s (relógio injetável); primeira execução cria ADMIN; senha trivial recusada; login duplicado recusado; último ADMIN não pode ser desativado; `listUsers` não expõe hash; troca/redefinição de senha.
- `auth:access:verify` (`scripts/verify-access-policy.mjs`): tabela de permissões; OPERADOR não tem `users.manage`; `assertCan` lança `AUTH_FORBIDDEN`; serviço de usuários recusa ator sem permissão; `AuthGate`/`Layout` referenciam `RequirePermission`/`can` (verificação textual).
