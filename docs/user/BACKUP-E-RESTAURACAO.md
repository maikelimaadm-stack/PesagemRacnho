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
- um manifesto com a versão do programa, a versão do banco (9), o formato do backup (3) e a contagem de registros por tabela;
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

1. Abra **Sistema › Backup e Restauração**.
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

Cada backup de segurança é **gravado e conferido** antes da operação: o programa lê o arquivo de volta e confere
o SHA-256, o conteúdo, as contagens e os anexos. Se a conferência falhar, a operação é **cancelada sem alterar
nada**. Isso vale para arquivo truncado, disco cheio, falha de leitura ou anexo sumido. A tela mostra o motivo e
a tentativa fica no histórico.

Eles ficam na pasta de dados do programa, subpasta `backups`. O botão **Abrir pasta data** abre essa pasta. A
retenção nunca apaga um backup de segurança.

## Exportar pesagens não é backup

O quadro **Exportação de pesagens (não é backup)** gera um arquivo CSV ou JSON **só com as pesagens**, para
planilha ou outro sistema. Esse arquivo não traz animais, cadastros, usuários nem configurações e **não serve
para restaurar**. Se ele for escolhido na restauração, o programa avisa que se trata de uma exportação de
pesagens e não restaura nada.

## Restaurar

1. Abra **Sistema › Backup e Restauração** (perfil ADMIN) e use **Restaurar backup** (passo a passo abaixo).
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
coerente não grava nada.

Durante a execução, o botão mostra o andamento ("Reconciliando… 1.250 de 12.000"). **Cancelar** para a execução no
fim do bloco atual: o que já foi feito fica gravado e coerente, e rodar de novo termina o restante. Numa medição no
Electron, 12 mil animais levaram cerca de 1 min 40 s na primeira vez e cerca de 15 s numa base já coerente. O
tempo varia com o computador.

## Dois níveis de limpeza

A **Manutenção avançada** (aba **Dados (limpeza e reset)**, longe do backup) tem duas limpezas diferentes (somente ADMIN):

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

## Anexos de documentos

Quando houver documentos com arquivo anexado, o backup completo vira um **pacote** com duas partes, lado a lado
na pasta `backups`:

- o arquivo **`backup-completo-….json`**;
- a pasta **`backup-completo-….anexos`**, com os arquivos dos documentos.

O backup só é **verificado** quando todos os anexos estão na pasta dele e conferem pelo SHA-256. Se faltar
algum, a tela diz que o backup **não está completo**.

Para guardar ou restaurar o backup em outro lugar, copie **o arquivo e a pasta juntos**.


## Página Backup e Restauração

Em **Sistema › Backup e Restauração** fica tudo o que protege os dados. Destrutivo, só a restauração guiada.

- **Situação da proteção.** A página mostra:
  - **Verificado em**: quando o último backup foi conferido. É o histórico;
  - **Disponível agora**: se esse arquivo ainda está na pasta, com o mesmo nome e tamanho;
  - **Íntegro agora**: se o arquivo, relido agora, ainda confere (SHA-256 e anexos). "Protegido" só aparece com
    um backup íntegro agora. Arquivo apagado, renomeado, truncado ou alterado deixa de contar, e o backup periódico
    roda na próxima oportunidade. Pasta inacessível aparece como **Pasta inacessível**;
  - **Cópia externa válida**: se a cópia no pendrive ou disco existe agora e confere com o backup;
  - a conferência relê os **3 backups verificados mais novos**. Se nenhum deles conferir e houver outros mais
    antigos, a página avisa que eles não foram relidos. Use **Verificar** neles;
  - se a **cópia em outro disco** está em dia;
  - quando roda o **backup periódico**.
- **Criar backup agora.** É o mesmo botão de sempre: grava o backup e o confere lendo de volta.
- **Backups neste computador.** É a lista dos backups, com busca, páginas e o botão **Verificar** em cada
  arquivo.

### Backup periódico

O aplicativo faz o backup sozinho, **só com o aplicativo aberto**. O padrão é uma vez por dia: logo depois de
abrir, se o último backup verificado já passou do intervalo.

- **Com o computador desligado, não há backup.**
- **Falha:** se o backup periódico falhar (disco cheio, por exemplo), o aplicativo espera um pouco e tenta de
  novo, até 3 vezes por dia. O último backup verificado continua valendo.
- **Configuração:** o intervalo e quantos backups periódicos guardar ficam em **Agendamento e retenção**.

### Cópia em outro disco ou pendrive

Backup só no mesmo computador não protege contra perda ou defeito da máquina.

1. Em **Escolher destino**, escolha um pendrive, outro disco ou outra pasta. Não pode ser a pasta de dados do
   aplicativo.
2. Use **Copiar para o destino externo**. O aplicativo copia o backup e a pasta `.anexos` para
   `pesagens-backups` no destino e **confere cada arquivo lendo de volta**.

Se o pendrive estiver desconectado, a página mostra **"backup local OK, cópia pendente"**. A opção **Copiar para
o destino externo depois de cada backup** faz a cópia sozinha. Nada é enviado para a internet.

### Retenção

Só os backups **periódicos** são removidos: ficam os mais recentes, 14 por padrão. Nunca são removidos por
regra:

- os backups **manuais**;
- os de **segurança**: antes de migrar, restaurar, importar, limpar ou fazer o reset;
- o **último backup verificado**.

### Backup protegido por senha

Gera um arquivo `.pbk` **cifrado** (AES-GCM 256) com o banco e os anexos.

- A senha precisa de pelo menos 10 caracteres e **não é guardada em lugar nenhum**: sem ela, o arquivo não abre.
- Senha errada ou arquivo alterado: a restauração é recusada e nada muda.
- O código SHA-256 confere se o arquivo está íntegro, mas não esconde o conteúdo. Só o backup protegido
  esconde.

### Restaurar backup (passo a passo, somente ADMIN)

1. **Selecionar:** escolha o `.json` (com a pasta `.anexos` ao lado) ou o `.pbk`. Para o `.pbk`, informe a senha.
2. **Inspecionar e comparar:** veja a data, a versão, os usuários e os anexos do backup, e as quantidades de
   hoje lado a lado com as do backup. Nada é gravado nesta etapa.
3. **Confirmar:** digite **RESTAURAR**. Antes de mexer em qualquer dado, o aplicativo:
   - confere os anexos do arquivo **exato** que foi inspecionado. Se o arquivo foi trocado ou alterado depois da
     inspeção, a restauração é recusada;
   - grava e verifica um backup da situação de hoje;
   - prepara os anexos numa pasta à parte.

   Se faltar ou não conferir algum anexo, nada é alterado. Num `.pbk`, um anexo adulterado também faz recusar.
   Só depois disso o banco é trocado. Se algo falhar depois da troca, o banco volta sozinho à situação de antes,
   pelo backup de segurança, e a tela diz **"Restauração NÃO concluída — o banco voltou ao estado anterior"**. Isso
   vale para a migração do backup antigo, a gravação dos anexos, o recálculo do GMD e a conferência final.

   Se nem a volta automática funcionar, a tela diz **"Restauração NÃO concluída — base possivelmente
   inconsistente"** e as gravações ficam bloqueadas. Veja **Estado crítico** logo abaixo.

   A conferência final compara o **conteúdo** de cada registro com o backup: peso, identificação, documento,
   movimento. Ter a mesma quantidade não basta. Com muitos dados ela leva alguns segundos. Num teste com 36 mil
   pesagens, no aplicativo desktop, levou cerca de 8 segundos.
#### Estado crítico (gravações bloqueadas)

Quando a restauração e a volta automática falham, a página mostra uma faixa vermelha **"Estado CRÍTICO"** com
o nome do backup de segurança a restaurar. Um aviso no topo de todas as telas repete a orientação.

- O bloqueio **continua depois de fechar e abrir o aplicativo**. Ele fica anotado num arquivo da pasta de dados,
  fora do banco, e uma cópia fica no próprio banco. Reiniciar o computador também não o libera.
- Enquanto isso, ainda dá para entrar no sistema (login) e consultar os dados. Gravar não dá: a tela explica
  o motivo.
- **Para sair do estado crítico:** em **Backup e Restauração**, restaure o backup de segurança indicado, pelo nome
  e pelo SHA-256. Também serve outro backup íntegro e conferido. Só uma restauração **conferida** (conteúdo e
  anexos) libera as gravações.
- **Não** use o reset nem a limpeza de dados para sair do estado crítico. Eles apagam dados e não resolvem a
  causa.
- Se a tela avisar que o marcador **não pôde ser gravado** (por exemplo, disco cheio), **não feche o aplicativo**:
  restaure já o backup indicado.

4. **Resultado:** a página confere tudo de novo e diz **Recuperação completa** ou **Recuperação INCOMPLETA**, com o
   que não voltou. Ela mostra as contagens, os anexos e a integridade do banco.

Exceções existem só depois de uma recusa, e só para o ADMIN:
- restaurar um pacote ao qual **faltam** anexos. Anexo corrompido nunca é aceito. A recuperação sai incompleta;
- restaurar quando anexos **já sumiram** deste computador. O backup de segurança fica **PARCIAL**: ele vai para o
  histórico e para a lista, mas **não conta como proteção**. Ele não aparece como "Protegido" e não adia o backup
  periódico. Importar, limpar e fazer o reset nunca aceitam backup parcial.

Se o backup trouxe usuários, a sessão é encerrada e você entra de novo com um usuário do backup.
