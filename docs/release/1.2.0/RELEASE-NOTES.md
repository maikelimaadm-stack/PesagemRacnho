# Pesagens Individuais 1.2.0

Primeira release do Programa Pesagens Individuais 2.0 (Fase 1). Base: 1.1.17.

| Eixo | Valor |
|---|---|
| Aplicativo | 1.2.0 |
| Banco (esquema Dexie) | 7 (antes: 6) |
| Formato de backup | 3 (antes: 2) |
| Contrato de dados | 2 (antes: 1) |
| Contrato de UI | ModeloBase1-2.0 |
| Build de dados | `schema-v7` |
| Build de UI | conforme `uiBuildId` em `release-manifest.json` |
| Instalador | `Pesagens Individuais Setup 1.2.0.exe` (SHA-256 e tamanho no manifesto) |

## Principais novidades

- **Login local com usuários e perfis.** Primeira execução cria o administrador
  (Configuração Inicial). Perfis fixos ADMIN, GESTOR e OPERADOR; bloqueio da
  tela por inatividade; bloqueio temporário após 5 tentativas erradas; troca de
  senha obrigatória na primeira entrada. Tudo offline, sem senha padrão.
  (`docs/user/LOGIN.md`, `docs/user/USUARIOS.md`)
- **Cadastros próprios**: Marcas, Raças, Categorias, Parceiros, Propriedades e
  Causas de Morte deixam de ser texto livre ou configuração e viram cadastros
  com nome único, item padrão, inativação e contagem de uso.
  (`docs/user/CADASTROS.md`)
- **Identidade do animal por marca cadastrada**: o mesmo número continua
  podendo existir em marcas diferentes; agora o vínculo é pelo cadastro, e uma
  grafia errada não cria mais um "animal novo".
- **Migração automática e segura** na primeira abertura: backup pré-migração
  gravado e conferido antes de qualquer alteração; migração resumível (fechar
  e reabrir continua do ponto em que parou); bloqueio de escrita em caso de
  falha; relatório da migração. (`MIGRATION-1.1.17-TO-1.2.0.md`)
- **Backup formato 3**, com cadastros e usuários. Backups da 1.1.x continuam
  restauráveis e são convertidos automaticamente.
- **Limpeza em dois níveis**: "Limpar dados operacionais" preserva usuários,
  configurações e cadastros; "Reset completo" apaga tudo e exige backup
  validado, senha e confirmação por extenso.
- **Versionamento em cinco eixos** visível em Backup e Manutenção › Status e no
  diagnóstico copiado (aplicativo, banco, backup, contrato de UI, contrato de
  dados, builds).
- **Auditoria por usuário**: todo lançamento, alteração, backup, restauração e
  limpeza registra quem fez.
- **Menu reorganizado**: Operação · Cadastros · Sistema, filtrado pelo perfil.

## Removido

- Tela **Configurações de Sanidade** e o grupo de sanidade da configuração
  (ADR-022). Dados existentes, se houver, são exportados para
  `docs/evidence/program-2.0/` antes da remoção.
- Tabela `lotes` (sem uso; `loteApartacoes` é a tabela de lotes).
- Diálogo legado "Gerenciar saídas" e os perfis de venda/abate
  (`perfis-saida`). Os compradores foram convertidos em parceiros.
- Configurações `cadastros-auxiliares:*` (convertidas nas tabelas de cadastro).

## Atualização a partir da 1.1.17

1. Criar e guardar um backup completo na 1.1.17.
2. Instalar a 1.2.0 por cima e abrir: a migração roda sozinha.
3. Criar o administrador na Configuração Inicial e conferir o Status.

Roteiro completo, relatório esperado e rollback em `MIGRATION-1.1.17-TO-1.2.0.md`.

## Compatibilidade

- Banco migrado para a versão 7 **não abre** na 1.1.x. Para voltar, use o
  backup criado antes da atualização (ver rollback).
- Backups formato 2 (1.1.x) são restauráveis na 1.2.0 (conversão automática).
- Backups formato 3 não são aceitos pela 1.1.x.

## Limitações conhecidas

- Não há recuperação automática de senha: outro ADMIN redefine; se o único
  ADMIN esquecer a senha, não há como entrar. Recomenda-se dois ADMIN.
- Os grupos **Rebanho** (Animais, Apartações e Lotes, Identificadores) e
  **Comercial** (Operações, Embarques) chegam nas versões 1.3.0 e 1.4.0.
- Balança e bastão RFID continuam sem driver homologado: a interface informa
  que os equipamentos não estão configurados.
- Assinatura Authenticode pendente: o pacote em `release-unsigned/` é
  diagnóstico local (`signed: false` no manifesto) e não substitui uma release
  oficial assinada.

## Verificação da release

| Verificação | Resultado |
|---|---|
| `npm run test:quick` | a preencher pelo coordenador |
| `npm run migration:v7:verify` | a preencher |
| `npm run auth:local:verify` / `auth:access:verify` | a preencher |
| `npm run storage:backup:verify` / `storage:import-restore:verify` | a preencher |
| `npm run docs:user:verify` | a preencher |
| `npm run packaged:build:verify` | a preencher |
| Teste em máquina limpa (`docs/user/TESTE-MAQUINA-LIMPA.md`) | MANUAL PENDENTE |

Evidências em `docs/evidence/program-2.0/phase-01/`.
