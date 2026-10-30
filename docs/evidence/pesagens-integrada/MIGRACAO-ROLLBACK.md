# Migração 8 → 9 e como voltar

## O que a migração faz

A versão 1.6.0 abre o banco da 1.5.x (versão 8) e o atualiza para a versão **9**.

1. **Antes de mudar qualquer coisa,** grava o **backup pré-migração** (`backups/pre-migration-v9-AAAAMMDD-HHMMSS.json`)
   e o confere.
2. **Cria as tabelas novas, vazias:** operações, itens, dentição, livro de identificadores, posologias,
   calendário, metas e documentos.
3. **Acrescenta índices.** Nenhum registro existente é reescrito pelo esquema.
4. **Roda o passo de dados v9**, que é resumível e idempotente:
   - classifica cada movimento como entrada, saída ou interno;
   - cria **operações legadas** a partir dos Cadastros (por dia) e das Saídas (por dia e motivo), com um item
     por pesagem. Nenhum parceiro, preço ou documento é inventado: elas ficam "Sem documento".

Se o computador desligar no meio, a migração continua de onde parou na próxima abertura. Repetir a migração não
duplica operações. O andamento aparece em **Manutenção avançada › Sistema › Migração**.

## Como voltar para a 1.5.x

> **Revisado na auditoria corretiva R1 (R04).** A versão anterior deste roteiro dizia que a 1.5.x "recusa o banco 9"
> e mandava restaurar o backup pré-migração ali mesmo. Isso foi **testado com o código real da 1.5.6 e está errado**
> (`npm run rollback:v8:verify`):
>
> - a 1.5.x **abre o banco v9 sem nenhum aviso** (a biblioteca do banco aceita a versão mais nova) e passa a gravar
>   nele;
> - restaurar o backup pré-migração nesse mesmo perfil devolve as tabelas da versão 8, mas **deixa as tabelas novas
>   da 1.6.0** (operações, documentos e outras) com os dados da 1.6.0. O resultado é um banco misto.

Não existe downgrade do banco. A volta usa sempre um **perfil separado e vazio**, e o perfil da 1.6.0 fica guardado
como está.

**Nunca apague, renomeie nem abra com a 1.5.x a pasta de dados da 1.6.0** (`%APPDATA%\Pesagens Individuais`).

### Antes de começar

1. Na 1.6.0, abra **Sistema › Backup e Restauração** e clique em **Criar backup agora**. Esse backup é da versão 9: a
   1.5.x não o restaura, mas ele guarda tudo o que foi feito na 1.6.0, caso você volte para ela depois.
2. Localize o backup pré-migração: `%APPDATA%\Pesagens Individuais\data\backups\pre-migration-v9-AAAAMMDD-HHMMSS.json`.
   Copie esse arquivo para uma pasta fácil de achar, por exemplo `Documentos\volta-1.5`. Copie também a pasta
   `….anexos` do mesmo nome, se existir.
3. **Anote ou exporte o que foi lançado na 1.6.0** depois da migração (Relação de Pesagens › Exportar). Isso **não**
   está no backup pré-migração e **não volta** para a 1.5.x: pesagens, operações, documentos, posologias e metas
   criados na 1.6.0 se perdem nessa volta.

### Passo a passo

1. Desinstale a 1.6.0. O desinstalador **não apaga** a pasta de dados (`deleteAppDataOnUninstall: false`).
2. Instale a 1.5.x. No fim do instalador, **desmarque "Executar"** e **não use o atalho padrão**: ele abriria o
   perfil da 1.6.0.
3. Abra a 1.5.x num **perfil novo**, pelo PowerShell. Confira o caminho do programa em *Propriedades* do atalho:

   ```powershell
   $env:PESAGENS_USER_DATA_DIR = "$env:USERPROFILE\PesagensVolta15"
   & "$env:LOCALAPPDATA\Programs\pesagens-individuais\Pesagens Individuais.exe"
   ```

   `PESAGENS_USER_DATA_DIR` é a mesma variável que os testes automáticos usam para isolar o perfil. Com ela, a 1.5.x
   usa só a pasta indicada, que começa vazia.
4. No perfil novo, crie o administrador inicial e abra **Backup e Manutenção › Restaurar backup**. Escolha o arquivo
   `pre-migration-v9-…json` copiado no passo 2 de "Antes de começar".
5. Confira as contagens e faça login com um usuário do backup.
6. Use sempre esse mesmo comando (ou um atalho com ele) para abrir a 1.5.x.

**Para voltar à 1.6.0 depois:** instale a 1.6.0 e abra pelo atalho normal. O perfil original da 1.6.0 continua
intacto e abre com tudo o que tinha. O que foi lançado na 1.5.x no perfil de volta vai para a 1.6.0 assim: faça
backup na 1.5.x e restaure-o na 1.6.0.

### O que foi executado aqui e o que falta

O teste `npm run rollback:v8:verify` usa o código real da 1.5.6 (commit `9392274`) sobre bancos sintéticos. Ele
confere:

- a 1.5.6 cria e usa o banco v8;
- a 1.6.0 migra para v9, com o backup pré-migração do banco v8;
- a 1.5.6 no **mesmo** perfil abre o v9 e, ao restaurar ali, deixa o banco misto;
- a 1.5.6 num perfil **separado** recusa o backup comum da 1.6.0 e restaura o pré-migração com as contagens de antes,
  com integridade OK. A pesagem lançada na 1.6.0 não volta.

**BLOQUEADO PARA HOMOLOGAÇÃO WINDOWS:** os passos de instalação e desinstalação e a abertura com
`PESAGENS_USER_DATA_DIR` no Windows real não foram executados neste ambiente (Linux, sem instalador da 1.5.x
assinado). Siga o passo a passo acima numa máquina de teste antes de usar com dados reais.

## Conferências feitas pelos testes automáticos

| Teste | O que confere |
|---|---|
| `migration:v9:verify` | upgrade 8 → 9 com backup; dados intactos; natureza; operações legadas; idempotência; backup da v8 restaurado no app v9 |
| `migration:v8:verify` e `migration:v7:verify` | a cadeia 7 → 8 → 9 inteira |
| `documents:backup:verify` e `backup:center:verify` | restauração em base limpa, com anexos e backup protegido |
| `rollback:v8:verify` (fora do `test:quick`: precisa do checkout da 1.5.x) | volta para a 1.5.6 real: mesmo perfil (banco misto, medido) × perfil separado (restaura com as contagens de antes) |
