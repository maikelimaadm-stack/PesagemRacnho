# Status de screenshots

## Resultado

Nenhum screenshot foi gerado. A limitação não bloqueou a auditoria, conforme solicitado.

## Tentativa no Pesagens

O servidor Vite do Pesagens pôde ser iniciado somente após autorização de execução fora do sandbox; a primeira tentativa encontrou bloqueio de criação de processo. Ao conectar o navegador integrado conforme o procedimento oficial, a inicialização do kernel falhou com:

`EPERM: operation not permitted, lstat 'C:\Users\maike\AppData'`

Sem uma sessão navegável, não foi possível inspecionar/renderizar a rota e produzir uma imagem confiável. O servidor temporário foi encerrado; nenhum arquivo de produto foi alterado para contornar a restrição.

## PROJETOMG

A cópia do PROJETOMG não contém `node_modules` nem `.env.local`; possui apenas o exemplo de ambiente. Rodá-lo exigiria instalação/configuração, ambas fora do escopo e expressamente proibidas. Mesmo que fosse iniciado, a rota também atravessa autenticação e shell/providers do projeto.

## Consequência

O contrato visual deste slice é derivado de código e CSS ativos, não de comparação pixel a pixel. A D.17B deve começar corrigindo a infraestrutura de captura ou fornecendo uma execução/screenshot de referência antes de declarar igualdade visual.

## Matriz recomendada para a próxima captura

- Referência e Pesagens: 1366×768 e 1440×900.
- Tablet: 1024×768 e 768×1024.
- Mobile: 390×844.
- Estados: listagem carregada, vazia, loading, filtro aberto, formulário em leitura/edição, dialog aberto e menu de coluna aberto.
