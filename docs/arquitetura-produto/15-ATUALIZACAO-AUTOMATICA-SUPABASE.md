# 15 — Atualização automática do desktop com Supabase

**Status:** arquitetura definida; implementação e publicação remota ainda não ativadas.  
**Decisão relacionada:** ADR-050.  
**Separação obrigatória:** atualização do binário não é sincronização dos dados do rebanho.

## 1. Objetivo

Quando o computador estiver online, o aplicativo deve:

1. consultar o canal de versão sem bloquear o trabalho offline;
2. informar quando houver versão mais nova;
3. baixar a atualização em segundo plano com progresso e retomada;
4. validar versão, hashes, manifesto e assinatura;
5. nunca interromper um lançamento ou fechamento em andamento;
6. instalar somente após confirmação para reiniciar ou ao encerramento;
7. preservar o IndexedDB/Dexie e executar o preflight de migração existente no próximo início.

Usuários que já têm uma versão sem atualizador precisam instalar manualmente **uma última versão
bootstrap**. Depois dela, o próprio aplicativo pode receber as releases seguintes.

## 2. Arquitetura

```text
Máquina/CI de release
  lint + testes + build
  assinatura Authenticode
  electron-builder → Setup + blockmap + latest.yml
  gates do app.asar + manifesto + assinatura do manifesto
             |
             | upload autenticado; service_role só aqui
             v
Supabase Storage — bucket desktop-releases
  windows/stable/latest.yml              ← ponteiro publicado por último
  windows/stable/Pesagens Individuais Setup X.Y.Z.exe
  windows/stable/Pesagens Individuais Setup X.Y.Z.exe.blockmap
  windows/stable/release-manifest-X.Y.Z.json
  windows/stable/release-manifest-X.Y.Z.sig
  windows/stable/RELEASE-NOTES-X.Y.Z.md
             |
             | HTTPS público somente para leitura
             v
Electron instalado
  electron-updater no processo main
  preload expõe apenas status/check/download/install
  renderer mostra estado e confirmação
  banco permanece em app.getPath(userData)
```

O Supabase hospeda os arquivos. Ele não assina o executável, não substitui Authenticode e não recebe
a chave administrativa no aplicativo do cliente.

## 3. Estrutura do Supabase

### 3.1 Bucket

- nome recomendado: `desktop-releases`;
- leitura pública dos objetos de release;
- nenhuma política de `INSERT`, `UPDATE` ou `DELETE` para `anon`/`authenticated`;
- escrita somente pelo processo de release com segredo administrativo armazenado no CI ou em
  variável local fora do repositório;
- sem dados do cliente nesse bucket.

URL-base esperada:

```text
https://<project-ref>.supabase.co/storage/v1/object/public/desktop-releases/windows/stable
```

O canal beta, se ativado, usa outro prefixo:

```text
windows/beta
```

### 3.2 Cache e imutabilidade

- Setup, blockmap, notas e manifesto têm nomes versionados e nunca são sobrescritos;
- `latest.yml` é o único ponteiro mutável e deve usar cache curto/revalidação;
- uma release nunca reaproveita o mesmo SemVer com bytes diferentes;
- artefatos antigos ficam disponíveis para suporte, mas o cliente não faz downgrade automático.

## 4. Runtime Electron

Módulo planejado: `electron/update/updateService.cjs`.

Responsabilidades:

- usar `electron-updater` somente quando `app.isPackaged`;
- aceitar apenas URL HTTPS do host Supabase configurado;
- `autoDownload = false` até assinatura e homologação concluídas;
- depois da ativação, baixar automaticamente e manter `autoInstallOnAppQuit = true`;
- checar 45 segundos após `ready`, depois a cada 6 horas;
- usar `net.isOnline()` como atalho, tratando o resultado real da requisição como fonte de verdade;
- impedir checagens concorrentes;
- limitar mensagens enviadas ao renderer a dados não sensíveis;
- registrar no log local versão atual, versão disponível, progresso, conclusão e erro resumido.

Estados do contrato IPC:

```text
disabled | idle | checking | unavailable | available |
downloading | downloaded | installing | error
```

API mínima no preload:

```text
updates.getStatus()
updates.check()
updates.download()
updates.install()
updates.onStatus(listener) → unsubscribe
```

O renderer nunca recebe caminho arbitrário, token de upload, `service_role` ou controle sobre a URL
do feed.

## 5. Experiência do usuário

- sem internet: nenhuma janela, erro ou atraso na abertura;
- sem versão nova: indicador discreto "Atualizado" somente na tela Sobre/Manutenção;
- versão disponível: selo não modal na barra e ação "Ver atualização";
- download: percentual, bytes e velocidade; continuar usando o sistema;
- pronto: "Versão X pronta — Reiniciar e atualizar" e "Mais tarde";
- nunca reiniciar durante lançamento, importação, restauração, migração ou fechamento do dia;
- atualização pendente pode instalar ao encerrar quando não houver operação crítica;
- erros de rede ficam no diagnóstico e oferecem "Tentar novamente".

## 6. Pipeline de publicação

Ordem transacional do ponto de vista do cliente:

1. aumentar SemVer e atualizar changelog/notas/checklist;
2. executar todos os gates;
3. gerar instalador NSIS **assinado**;
4. gerar `latest.yml`, blockmap, manifesto e assinatura destacada do manifesto;
5. conferir assinatura Authenticode, SHA-256 interno e SHA-512 do feed;
6. enviar Setup grande por TUS retomável;
7. enviar blockmap, manifesto, assinatura e notas;
8. conferir cada objeto remotamente;
9. enviar/substituir `latest.yml` **por último**;
10. testar a atualização de N-1 para N em máquina limpa e em instalação com dados;
11. somente então marcar a release como estável.

O instalador atual tem aproximadamente 92 MB; por isso o publicador deve usar o endpoint TUS direto
do Storage, com retomada e progresso, em vez do upload simples em memória.

## 7. Segurança e segredos

Antes de ativar download automático em produção:

- certificado Authenticode confiável e `publisherName` configurado;
- URL HTTPS fixa e allowlist do host;
- `latest.yml` coerente com o Setup e blockmap;
- manifesto assinado por chave de release separada;
- chave pública de verificação embutida no aplicativo;
- chave privada e `service_role` somente no cofre do CI/máquina de release;
- rotação e revogação documentadas;
- bloqueio de downgrade e de versão incompatível com o esquema local;
- log sem token, URL assinada ou dados do cliente.

O bucket público permite leitura do instalador; isso é intencional. Público não significa permissão
de upload, listagem administrativa ou alteração de objetos.

## 8. Banco local e rollback

- instalar binário novo não apaga `app.getPath(userData)`;
- antes de abrir um esquema Dexie novo, permanece obrigatório o backup pré-migração validado;
- uma atualização que só muda UI/código não altera o esquema;
- falha antes de `latest.yml` ser publicado é invisível para clientes;
- falha após download e antes de instalação mantém a versão atual executável;
- depois de migração de esquema, rollback automático do executável é proibido;
- correção preferencial é uma nova versão adiante; retorno manual exige backup compatível e
  procedimento de suporte.

## 9. Atualização do aplicativo versus sincronização online

| Tema | Serviço | Dados | Autenticação |
|---|---|---|---|
| Atualização do desktop | Supabase Storage + electron-updater | Setup, blockmap, manifesto e notas | escrita só no pipeline; leitura pública |
| Login online futuro | Supabase Auth ou OIDC | identidade e sessão online | usuário/dispositivo |
| Sincronização futura | Supabase Postgres/API | eventos e cadastros do domínio | RLS por empresa e dispositivo |

O atualizador pode ser entregue antes da sincronização. A sincronização exige fila, idempotência,
conflitos, multiempresa, revogação e critérios próprios do documento 06.

## 10. Configuração necessária para implementar

Dados públicos:

- `SUPABASE_PROJECT_REF`;
- URL pública do projeto;
- bucket/canal (`desktop-releases/windows/stable`);
- domínio final, se houver CDN própria.

Segredos — **não enviar em mensagem nem commitar**:

- `SUPABASE_SERVICE_ROLE_KEY` ou credenciais S3 de Storage;
- certificado `.pfx`/token do provedor de assinatura;
- senha do certificado;
- chave privada de assinatura do manifesto.

Esses valores entram apenas como secrets no CI ou variáveis temporárias da máquina de release.

## 11. Gates de aceite

1. app offline inicia e funciona sem atraso ou alerta;
2. feed sem versão nova retorna `unavailable`;
3. N-1 detecta N nos canais stable e beta corretos;
4. download interrompido retoma sem corromper arquivo;
5. SHA/assinatura inválida bloqueia instalação;
6. URL fora da allowlist é recusada;
7. nenhuma credencial existe no bundle, `app.asar`, preload ou logs;
8. atualização não reinicia com operação crítica aberta;
9. N-1 → N preserva contagens e banco local;
10. migração de esquema cria e valida backup antes da abertura;
11. Windows mostra editor confiável e assinatura válida;
12. publicação parcial sem `latest.yml` não aparece aos clientes;
13. downgrade é recusado;
14. diagnóstico informa versão atual, disponível e estado sem expor segredos.

## 12. Fontes primárias

- Electron Builder, Auto Update: https://www.electron.build/docs/features/auto-update/
- Supabase Storage, servir downloads: https://supabase.com/docs/guides/storage/serving/downloads
- Supabase Storage, uploads retomáveis: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- Supabase Storage, fundamentos de CDN: https://supabase.com/docs/guides/storage/cdn/fundamentals
