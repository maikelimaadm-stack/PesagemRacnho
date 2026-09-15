# Modelo de ameaças da autenticação local — Pesagens Individuais

**Escrito em 1.1.18 (14/09/2026) para o login local previsto em 1.2.0.** Base normativa: ADR-041 a
ADR-046 e o contrato `docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md` (revisão 2). Este documento
diz, sem rodeios, o que o login local protege e o que ele **não** protege, para que ninguém compre
uma garantia que o produto não dá.

> Estado em 1.1.18: **não existe login**. O app abre direto na tela principal, não há usuários,
> papéis nem auditoria por usuário. Tudo abaixo descreve o desenho decidido para 1.2.0.

## 1. O que o app é

- Aplicativo desktop Electron, 100 % offline, um computador por instalação.
- Dados em IndexedDB (Dexie) dentro do perfil do usuário do Windows (`userData`), em texto claro.
- Backups em JSON legível, gravados onde o usuário escolher.
- Não há servidor, conta online, sincronização, e-mail, SMS ou provedor de identidade.

Consequência direta: **a fronteira de segurança real é a conta do Windows e o disco.** Quem entra
no perfil do sistema operacional que roda o app tem, na prática, acesso a todos os dados.

## 2. Objetivo do login local (o que ele entrega)

| Objetivo | Como |
|---|---|
| Saber **quem** fez cada operação | auditoria com `usuario_id` e `usuario_nome_snapshot`; eventos de acesso resumidos |
| Impedir uso **acidental ou não autorizado dentro do app** | papéis fixos ADMIN, GESTOR, OPERADOR e CONSULTA; `authorize(action)` no serviço antes de gravar; a UI apenas esconde |
| Proteger operações destrutivas | restore total, limpeza, reset, migração e gestão de usuários só para ADMIN |
| Evitar sessão esquecida no curral | bloqueio automático por inatividade (padrão 30 min), Bloquear, Trocar usuário, Sair |
| Não guardar senha em lugar nenhum | apenas hash PBKDF2-HMAC-SHA-256 com salt aleatório por usuário (Web Crypto, sem módulo nativo) |
| Recuperar o ADMIN sem backdoor | Recovery Key aleatória exibida uma única vez no bootstrap; o banco guarda só o verificador (hash + salt) |

É um controle de **uso responsável e rastreabilidade** entre pessoas que compartilham o mesmo
computador de trabalho. Não é um cofre.

## 3. Ameaças cobertas

| Ameaça | Cobertura |
|---|---|
| Operador lança, edita ou apaga algo que não deveria | papéis + `authorize` no serviço; auditoria registra o autor |
| Alguém usa a sessão aberta de outra pessoa | bloqueio por inatividade; Bloquear/Trocar usuário; sessão só em memória (sessionStorage apenas para recarga técnica do renderer; nunca sobrevive ao fechamento) |
| Tentativa de adivinhar senha pela tela de login | contagem de falhas persistida, bloqueio temporário (`failed_login_count`, `locked_until`), erro genérico sem dizer se o login existe |
| Leitura **casual** do banco ou de um backup por alguém curioso | a senha não está lá; só hash + salt; PBKDF2 com custo calibrado torna a recuperação por força bruta lenta para senhas razoáveis |
| Senha trivial | mínimo de 6 caracteres e lista de senhas triviais recusadas; `admin/admin` impossível; senha temporária obriga troca |
| Segredo vazando por log, CSV, diagnóstico ou auditoria | regra de código e gates: senha, hash, salt, recovery key e tokens nunca são gravados nesses canais |
| Perda do único ADMIN | Recovery Key; regra de não desativar o último ADMIN ativo |
| Restore trazendo usuários de outra instalação | restore exige `maintenance.restore` e encerra a sessão; backup sem usuários cai no bootstrap |

## 4. Ameaças NÃO cobertas (ler com atenção)

1. **Quem tem acesso total ao perfil do Windows ou ao disco.** Pode ler o IndexedDB, copiar ou
   editar os dados, apagar a store de usuários, trocar o hash do ADMIN ou substituir o próprio
   aplicativo. O login não impede nada disso. **Não há criptografia total do banco.**
2. **Administrador local da máquina, malware, acesso físico sem BitLocker.** Idem.
3. **Backup JSON em pen drive, e-mail ou pasta compartilhada.** O backup contém todos os dados
   em texto claro (mais hash + salt dos usuários). Quem tem o arquivo tem os dados. Proteger o
   arquivo é responsabilidade de quem o guarda (pasta com permissão, disco cifrado).
4. **Força bruta offline contra um hash copiado, com senha fraca.** PBKDF2 encarece, não
   impede. Uma senha de 6 caracteres previsível pode ser recuperada por quem tem o hash e
   tempo. A política mínima é deliberadamente simples para o curral; senhas melhores ficam a
   critério do ADMIN.
5. **Captura de tela, keylogger, câmera sobre o teclado, alguém olhando a Recovery Key.**
6. **Recovery Key perdida e ADMIN esquecido.** Sem servidor não existe "esqueci minha senha" por
   e-mail. O caminho é restaurar um backup com usuários válidos ou reiniciar o bootstrap por
   procedimento de manutenção documentado (com perda dos usuários, nunca dos dados operacionais).
7. **Adulteração da auditoria.** Quem edita o IndexedDB pode editar a auditoria. A auditoria é
   evidência operacional, não prova forense.
8. **Múltiplas máquinas.** Usuários são locais a cada instalação; não há identidade central,
   sincronização de papéis nem revogação remota.

## 5. Decisões de desenho e por quê

| Decisão | Motivo |
|---|---|
| Sem criptografia do banco | o app precisa abrir sem senha de disco, funcionar com o Dexie padrão e permitir backup/restore/integridade simples; a fronteira real já é o perfil do SO; cifrar exigiria chave em algum lugar do mesmo perfil, o que não muda a ameaça 1 |
| PBKDF2-HMAC-SHA-256 via Web Crypto | disponível no renderer e no Node dos gates, sem módulo nativo (o instalador N-API já deu problema com antivírus); parâmetros centralizados e versionados (`password_version`) permitem recalibrar com rehash no próximo login |
| Salt de 16 bytes aleatório por usuário | dois usuários com a mesma senha têm hashes diferentes; tabelas prontas não servem |
| Sessão em memória, sem `localStorage` | fechar o app encerra a sessão; nada de token persistente para roubar |
| Recovery Key só como verificador | a key nunca fica no banco; se vazar o banco, a key não vaza |
| Bloqueio temporário curto (segundos) e persistido | desestimula tentativa manual sem trancar o curral por horas; reiniciar o app não zera o contador |
| Papéis fixos, sem permissões por usuário | matriz pequena, testável por gate, sem tela de permissões para errar |
| Senha mínima de 6 caracteres | pessoas do curral com luvas e pressa; regras artificiais geram senhas em papel colado no monitor |

## 6. Fora do escopo (não prometido)

- Autenticação online, OIDC, Active Directory, SSO, MFA, biometria, cartão.
- Criptografia do banco ou de backups; assinatura digital de backups.
- Auditoria imutável, WORM ou carimbo de tempo externo.
- Gestão centralizada de usuários entre máquinas.
- Proteção contra administrador local, malware ou acesso físico.

Qualquer um desses itens exige nova ADR, não um "ajuste".

## 7. Obrigações de implementação (checagem em 1.2.0)

- Gates `auth:crypto:verify`, `auth:bootstrap:verify`, `auth:permissions:verify`,
  `auth:recovery:verify` e `audit:actor:verify` (documento 11 §10).
- Nenhuma tela de dados montada antes da autenticação; nenhum `if (role === …)` espalhado.
- Copiar diagnóstico mostra o papel do usuário, nunca hash, salt ou key.
- Documentação do usuário explica, em uma frase, que o login organiza o uso e a auditoria e que
  a proteção dos dados depende da conta do Windows e do disco.
