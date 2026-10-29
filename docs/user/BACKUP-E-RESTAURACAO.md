# Backup e restauração

## O que é protegido

Os dados do programa ficam **no próprio computador**. O backup completo é um arquivo `.json` que guarda **tudo**:
- pesagens, animais, identificadores, movimentos, sessões, apartações, lotes e embarques;
- sanidade (programas, medicamentos e aplicações);
- histórico, importações e configurações;
- **cadastros**: marcas, raças, categorias, parceiros, propriedades, causas de morte e faixas de identificadores;
- **usuários**, com o código derivado da senha, nunca a senha.

O **cabeçalho dos relatórios** de cada propriedade (produtor, endereço, documentos, telefone e logo) fica no
cadastro da propriedade e vai junto no backup.

O arquivo traz:
- um manifesto com a versão do programa, a versão do banco (8), o formato do backup (3) e a contagem de registros por tabela;
- um código de conferência SHA-256 do conteúdo.

> **Atenção: o backup é um arquivo sensível.** Ele contém os valores comerciais e os usuários do sistema.
> Guarde a cópia num lugar protegido (seu pendrive ou seu disco) e não envie por e-mail ou mensagem sem proteção.

## Quem pode

| Ação | Perfis |
|---|---|
| Criar backup, verificar backup, exportar pesagens | ADMIN e GESTOR |
| Restaurar backup | somente ADMIN |
| Limpar dados operacionais, Reset completo | somente ADMIN |
| Reconciliar derivados, continuar uma migração interrompida | somente ADMIN |

## Criar um backup

1. Abra **Backup e Manutenção**.
2. Clique em **Criar backup agora**.
3. Aguarde a mensagem **"Backup criado e verificado."**

Esse botão faz duas coisas:
- **Grava** o arquivo completo.
- **Lê o arquivo de volta do disco e confere** o código SHA-256, o conteúdo e as contagens. Só então o
  backup conta como **verificado**.

Se a conferência falhar, a mensagem diz o motivo. Nesse caso, não confie nesse arquivo e tente de novo.

No alto do quadro aparece o **último backup verificado**, com data, tamanho e nome. Se aparecer "Nenhum backup
verificado ainda", o computador não tem uma cópia conferida.

### Lista de arquivos

A lista mostra os backups da pasta do programa, cada um com seu estado:
- **Verificado em …**: o arquivo foi lido de volta e está íntegro e restaurável.
- **Não verificado**: o arquivo existe, mas ainda não foi conferido. Use **Verificar**.
- **Falhou**: o arquivo está truncado, corrompido ou não é um backup. Não use.

Faça um backup sempre antes de uma importação, restauração, limpeza ou **atualização do programa**.

**Guarde uma cópia fora do computador.** O backup na pasta do programa não protege contra defeito do disco,
roubo ou perda do computador.

## Backups automáticos de segurança

O programa cria backups sozinho, no mesmo formato, antes de qualquer operação que mexe no banco inteiro:
- **pré-migração**: na primeira abertura de uma versão que muda o banco. Se ele não puder ser gravado e
  conferido, a migração não começa.
- **pré-importação**, **pré-restauração**, **pré-limpeza** e **pré-reconciliação**: antes dessas operações.

Eles ficam na pasta de dados do programa, subpasta `backups`. O botão **Abrir pasta data** abre essa pasta.

## Exportar pesagens não é backup

O quadro **Exportação de pesagens (não é backup)** gera um arquivo CSV ou JSON **só com as pesagens**, para
planilha ou outro sistema. Esse arquivo não traz animais, cadastros, usuários nem configurações e **não serve
para restaurar**. Se ele for escolhido na restauração, o programa avisa que se trata de uma exportação de
pesagens e não restaura nada.

## Restaurar

1. Abra **Backup e Manutenção** (perfil ADMIN).
2. Em **Restauração**, selecione um arquivo `backup-completo-….json`.
3. Confira a análise:
   - versão do programa e do banco;
   - formato e integridade;
   - contagens por tabela;
   - tabelas que serão ignoradas e tabelas novas.
4. Só se a análise estiver aprovada, clique em **Restaurar backup**.

Antes de mexer no banco, o programa grava e confere um backup da situação atual. A restauração é
**integral**: tudo o que existe hoje é substituído pelo conteúdo do backup. Uma falha no meio aborta a
operação sem deixar o banco pela metade.

Depois, use **Verificar integridade** e reabra o programa para conferir as contagens.

### Usuários no backup

- **Backup com usuários** (formato 3): os usuários do backup **substituem** os atuais. Ao terminar, a sessão é
  encerrada e o programa pede login de novo, com os usuários do backup.
- **Backup sem usuários** (formato 2, das versões 1.1.x): a tabela de usuários fica vazia e o programa volta para a
  **Configuração Inicial**, para criar o administrador de novo.

### Backup de versão antiga

Backups de versões anteriores (banco 6 ou 7) continuam restauráveis. A análise avisa "backup de esquema
anterior: será convertido". Ao restaurar, o programa:
1. grava os dados do backup;
2. executa a mesma **conversão** da atualização, mostrando o andamento na tela;
3. só então registra a restauração como concluída.

Um backup criado por uma versão **mais nova** do banco é recusado: atualize o programa antes.

## Arquivo recusado

O programa recusa:
- arquivo truncado ou que não é JSON válido;
- código SHA-256 diferente;
- contagem diferente;
- banco mais novo que o do programa;
- arquivo sem as tabelas obrigatórias;
- exportação de pesagens no lugar de backup.

## Reconciliar derivados

Em **Diagnóstico**, o ADMIN tem o botão **Reconciliar derivados**. Ele recalcula a partir das pesagens:
- as permanências em lote;
- os movimentos de entrada, saída e troca de lote;
- o GMD de todos os animais.

Use quando **Verificar integridade** acusar movimento de pesagem cancelada ou lote duplicado, comum em bases
vindas de versões antigas. Antes de começar, o programa cria e confere um backup. Rodar de novo num banco
coerente não muda nada.

## Dois níveis de limpeza

A tela de Backup e Manutenção tem duas limpezas diferentes (somente ADMIN):

| | Limpar dados operacionais | Reset completo |
|---|---|---|
| Apaga | pesagens, animais, identificadores, movimentos, sessões, apartações, lotes, embarques, importações, aplicações de sanidade | **tudo** |
| Preserva | usuários, configurações, cadastros (marcas, raças, categorias, parceiros, propriedades, causas, faixas, programas e medicamentos) e o catálogo de backups | nada |
| Exige | backup físico validado antes | backup físico validado, a **senha do usuário atual** e uma confirmação por extenso |
| Depois | continua logado; cadastros prontos para uso | volta para a **Configuração Inicial** |

Use **Limpar dados operacionais** para recomeçar o rebanho sem perder o trabalho de cadastro. Use **Reset
completo** só para entregar o computador "zerado".

## Cuidados

- Não apague a pasta de dados do programa.
- Não use a base de trabalho para testes.
- Não edite o arquivo de backup à mão: o código de conferência deixa de bater e o programa recusa o arquivo.
