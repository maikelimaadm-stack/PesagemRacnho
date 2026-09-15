# Backup e restauração

## O que é protegido

O armazenamento operacional é o **IndexedDB local, administrado pelo Dexie**. O
backup completo é um arquivo JSON portátil que contém **todas** as tabelas do
sistema: pesagens, animais, identificadores, movimentos, sessões, apartações,
lotes, embarques, histórico, importações, **cadastros** (marcas, raças,
categorias, parceiros, propriedades, causas de morte, faixas de identificadores)
e **usuários** (com o código derivado da senha, nunca a senha).

O arquivo traz um manifesto com a versão do programa, a versão do banco, o
formato do backup, o contrato de dados, o identificador de build da interface e
a contagem de registros por tabela, além de um SHA-256 do conteúdo. Na
gravação, o aplicativo usa um arquivo temporário, sincroniza a escrita, renomeia
de forma atômica, relê o arquivo final e confere tamanho e hash antes de
registrar o backup como concluído.

## Formato 3 (versão 1.2.0)

A versão 1.2.0 grava backups no **formato 3**. Em relação ao formato 2 (até a
1.1.17), o formato 3:

- inclui as tabelas novas (cadastros e usuários);
- registra `formatVersion: 3`, a versão do banco (7), o contrato de dados e o
  identificador de build;
- continua com o mesmo mecanismo de SHA-256 e contagens.

Backups antigos (formato 2, banco versão 6) **continuam restauráveis**: veja
"Restaurar um backup de versão antiga" abaixo.

## Quem pode

| Ação | Perfis |
|---|---|
| Criar backup completo, exportar CSV/JSON | ADMIN e GESTOR |
| Restaurar backup | somente ADMIN |
| Limpar dados operacionais, Reset completo | somente ADMIN |
| Continuar uma migração interrompida | somente ADMIN |

## Como criar um backup completo

1. Abra **Backup e Manutenção**.
2. Clique em **Criar backup completo**.
3. Aguarde a confirmação com nome, tamanho e SHA-256.
4. Confira o arquivo no catálogo de backups exibido na mesma tela.

Faça um backup regularmente e sempre antes de uma importação, restauração,
limpeza ou **atualização do programa**. Guarde uma cópia fora do computador.
Não edite manualmente o JSON.

## Backups automáticos

O programa cria backups sozinho, no mesmo formato, antes de qualquer operação
que altere o banco inteiro:

- **pré-migração**: na primeira abertura de uma versão que muda o banco
  (arquivo `pre-migration-v7-<data>.json`); se ele não puder ser gravado e
  conferido, a migração não começa;
- **pré-restauração** e **pré-limpeza**: antes de restaurar ou limpar.

Todos aparecem no catálogo da tela, com tipo, data, tamanho e SHA-256. Eles
ficam na pasta de dados do aplicativo, subpasta `backups` (botão
**Abrir pasta data**).

## Como restaurar

1. Abra **Backup e Manutenção** (perfil ADMIN).
2. Em **Restauração**, selecione um backup `.json`.
3. Confira a análise (dry-run): manifesto, versão do programa e do banco,
   formato, integridade, contagens por tabela, tabelas que serão ignoradas e
   tabelas novas.
4. Somente se a análise estiver aprovada, clique em **Restaurar backup**.

Antes de alterar o banco, o aplicativo grava e valida um pré-backup físico. A
restauração ocorre em transação: uma falha aborta a operação e não deve deixar
uma base parcial. A restauração é **integral**: tudo o que existe hoje é
substituído pelo conteúdo do backup.

Depois do commit, execute **Verificar integridade** e reabra o aplicativo para
confirmar as contagens.

### Usuários no backup

- Se o backup **tem usuários** (formato 3), eles **substituem** os usuários
  atuais. Ao terminar, a sessão é encerrada e o programa pede login de novo,
  com os usuários do backup.
- Se o backup **não tem usuários** (formato 2, das versões 1.1.x), a tabela de
  usuários fica vazia e o programa volta para a **Configuração Inicial**, para
  criar o administrador de novo. Isso é esperado.

### Restaurar um backup de versão antiga

Um backup criado pela 1.1.x (banco versão 6, formato 2) pode ser restaurado na
1.2.0. A análise avisa "backup de esquema anterior: será convertido". Ao
restaurar, o programa:

1. grava os dados do backup;
2. executa a mesma **conversão** da atualização (monta os cadastros a partir
   dos textos, preenche os vínculos dos animais, converte situações e limpa
   dados redundantes) — o andamento aparece na tela;
3. só então registra a restauração como concluída.

A tabela `lotes` (sem uso, retirada na 1.2.0) é ignorada; a análise lista isso.
Um backup criado por uma versão **mais nova** do banco é recusado: atualize o
programa antes.

## Arquivo recusado

O aplicativo bloqueia arquivos truncados, JSON inválido, hash divergente,
contagem divergente, banco mais novo que o do programa ou sem as tabelas
obrigatórias. Backups legados sem hash podem ser analisados com aviso, mas
devem ser convertidos por uma restauração controlada e um novo backup.

## Dois níveis de limpeza

A tela de Backup e Manutenção tem duas limpezas diferentes (somente ADMIN):

| | Limpar dados operacionais | Reset completo |
|---|---|---|
| Apaga | pesagens, animais, identificadores, movimentos, sessões, apartações, lotes, embarques, importações | **tudo** |
| Preserva | usuários, configurações, cadastros (marcas, raças, categorias, parceiros, propriedades, causas, faixas) e o catálogo de backups | nada |
| Exige | backup físico validado antes | backup físico validado, a **senha do usuário atual** e a digitação de uma confirmação por extenso |
| Depois | continua logado; cadastros prontos para uso | volta para a **Configuração Inicial** |

Use "Limpar dados operacionais" para recomeçar o rebanho sem perder o
trabalho de cadastro. Use "Reset completo" só para entregar o computador
"zerado".

## Cuidados

- Não apague a pasta de dados do aplicativo.
- Não use a base operacional para testes destrutivos.
- Não confunda exportação CSV com backup completo: CSV é para intercâmbio e não
  contém toda a estrutura necessária à restauração.
- No navegador de desenvolvimento, a gravação física pode estar indisponível; o
  backup oficial deve ser criado pelo aplicativo desktop, que possui a ponte
  segura de arquivos. Sem essa ponte, a migração também é bloqueada.
