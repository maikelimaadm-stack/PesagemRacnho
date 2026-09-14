# Backup e restauração

## O que é protegido

O armazenamento operacional é o **IndexedDB local, administrado pelo Dexie**. O
backup completo é um arquivo JSON portátil que contém todas as stores do sistema,
manifesto, versão do aplicativo, versão do esquema e contagem de registros.

O arquivo também possui um SHA-256 do conteúdo. Na gravação, o aplicativo usa um
arquivo temporário, sincroniza a escrita, renomeia de forma atômica, relê o arquivo
final e confere tamanho e hash antes de registrar o backup como concluído.

## Como criar um backup completo

1. Abra **Manutenção**.
2. Clique em **Criar backup completo**.
3. Aguarde a confirmação com nome, tamanho e SHA-256.
4. Confira o arquivo no catálogo de backups exibido na mesma tela.

Faça um backup regularmente e sempre antes de uma importação ou restauração. Não
edite manualmente o JSON.

## Como restaurar

1. Abra **Manutenção**.
2. Em **Restauração**, selecione um backup `.json`.
3. Confira o dry-run: manifesto, versão, integridade e contagens.
4. Somente se a análise estiver aprovada, clique em **Restaurar backup**.

Antes de alterar o banco, o aplicativo grava e valida um pré-backup físico. A
restauração ocorre em transação: uma falha aborta a operação e não deve deixar uma
base parcial. Depois do commit, execute **Verificar integridade** e reabra o
aplicativo para confirmar as contagens.

## Arquivo recusado

O aplicativo bloqueia arquivos truncados, JSON inválido, hash divergente ou sem as
stores obrigatórias. Backups legados sem hash podem ser analisados com aviso, mas
devem ser convertidos por uma restauração controlada e um novo backup.

## Cuidados

- Não apague a pasta de dados do aplicativo.
- Não use a base operacional para testes destrutivos.
- Não confunda exportação CSV com backup completo: CSV é para intercâmbio e não
  contém toda a estrutura necessária à restauração.
- No navegador de desenvolvimento, a gravação física pode estar indisponível; o
  backup oficial deve ser criado pelo aplicativo desktop, que possui a ponte segura
  de arquivos.
