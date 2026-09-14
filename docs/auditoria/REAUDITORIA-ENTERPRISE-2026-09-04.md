# Reauditoria enterprise — Pesagens Individuais 1.1.16

**Data:** 04/09/2026  
**Escopo:** código ativo, domínio de pesagens, IndexedDB/Dexie, importação,
backup/restauração, sanidade, consistência visual contratual, desempenho,
Electron e empacotamento Windows.  
**Decisão sobre dados:** nenhuma migração ou regravação em massa foi executada,
por decisão expressa do responsável. Todos os ensaios mutáveis usaram bancos e
perfis isolados de teste.

## 1. Parecer executivo

O código da versão 1.1.16 está **aprovado no gate técnico automatizado**. A suíte
integral, o build de produção, o smoke do Electron e o smoke do executável
empacotado passaram; as dependências de produção não apresentaram vulnerabilidades
conhecidas no `npm audit` executado nesta data.

A versão ainda **não deve ser classificada como release enterprise oficial**.
Restam controles externos que o código não pode fabricar: certificado
Authenticode confiável, validação sob WDAC/App Control, instalação em máquina
limpa, aceite visual humano e repositório de versionamento. O pacote gerado em
`release-unsigned/` é diagnóstico local e está corretamente identificado como não
assinado.

## 2. Resultado por domínio

| Domínio | Resultado | Evidência principal |
|---|---|---|
| Build e qualidade estática | Aprovado | ESLint e Vite, 2.140 módulos transformados |
| Runtime e arquitetura | Aprovado | React/Electron; renderer isolado; sandbox ativo; sem runtime legado |
| Armazenamento | Aprovado | Dexie, esquema v5, 18 stores, primeira execução automática |
| Identidade animal | Aprovado | identidade canônica por número + marca e identificadores persistentes |
| Histórico e cronologia | Aprovado | cadastro único, datas válidas, saída definitiva e recálculo retroativo |
| Ganho/GMD | Aprovado | registro anterior correto, data futura ignorada e ganho zero preservado |
| Lotes e situação atual | Aprovado | projeções reconstruídas depois de criar, editar, cancelar e importar |
| Sanidade | Aprovado | protocolos, itens e aplicações vinculadas à pesagem com soft-delete |
| Importação | Aprovado | CSV/JSON atômico, canônico, idempotente por SHA-256 e rollback integral |
| Backup/restauração | Aprovado em contrato | manifesto, contagens, SHA-256 e evidência física obrigatória |
| Cálculos comerciais | Aprovado | rendimento configurável, carcaça, arrobas e valor estimado |
| Formatação brasileira | Aprovado | inteiro `1.000`, decimal `1.000,00`, data `DD/MM/AAAA`, unidade no rótulo |
| Desempenho | Aprovado no ensaio | 36.000 lançamentos, 12.000 animais e 5.000 buscas indexadas |
| UI por contrato | Aprovado | hover, campos, checkbox, filtros, diálogos, tipografia, dark mode e scroll |
| UI por inspeção visual atual | Pendente externo | navegador local indisponível para a automação deste ambiente |
| Dependências de produção | Aprovado | `npm audit --omit=dev`: 0 vulnerabilidades |
| Pacote diagnóstico | Aprovado | versão/bundle/manifesto conferidos; executável iniciou em perfil isolado |
| Instalador oficial | Bloqueado corretamente | preflight recusou build sem credencial Authenticode |

## 3. Correções consolidadas

### 3.1 Domínio e dados

- O cadastro cria e mantém um Animal canônico; manejos e saídas apontam para a
  mesma identidade, inclusive quando há números iguais em marcas diferentes.
- Alterar uma pesagem retroativa recompõe a série posterior de peso, ganho, dias
  e GMD sem sobrescrever o fato histórico do evento.
- A saída final torna a projeção do animal inativa; cancelar a saída recompõe a
  situação a partir do histórico restante.
- O histórico de lotes fecha e abre intervalos cronológicos, em vez de depender
  somente do último campo gravado na tela.
- Sanidades e seus medicamentos/procedimentos são cadastros persistentes; a
  aplicação escolhida fica vinculada ao animal e à pesagem.
- Venda e abate usam rendimento de carcaça configurável e deixam claro o que é
  peso vivo, peso de carcaça, arrobas e valor.

### 3.2 Importação e recuperação

- CSV aceita BOM, aspas, separadores dentro do conteúdo, campos multilinha,
  datas civis e números brasileiros.
- CSV e JSON entram pelo serviço de domínio, dentro de uma transação única que
  inclui pesagens, animais, identificadores, sessões, movimentos, lotes,
  sanidade, auditoria e registro da importação.
- Repetir o mesmo arquivo é bloqueado pelo SHA-256 mesmo quando todas as linhas
  já existiam; essa condição de borda foi descoberta e corrigida durante o gate.
- Um segundo cadastro, um evento antes do cadastro, um evento após a saída ou uma
  saída retroativa conflitante abortam o lote de importação inteiro.
- Limpeza, importação e restauração exigem evidência de backup físico com caminho,
  tamanho e SHA-256; restauração confere as contagens por store antes do commit.

### 3.3 Desempenho e interface

- Consultas usam índices por animal/data, data e lote; a tabela de lançamentos
  pagina 50 registros e as telas principais são carregadas sob demanda.
- No gate integral final, o índice de 12.000 animais foi construído em 191,4 ms e
  5.000 consultas indexadas concluíram em 0,8 ms no ambiente de teste. Esses números
  são evidência de regressão, não garantia absoluta para todo hardware.
- O contrato visual confirmou 13 diálogos operacionais padronizados e protege:
  botões primários sem hover branco, ícones neutros, células de seleção sem faixa
  esquerda, scroll estável à direita, campos/filtros equivalentes, tipografia de
  11 px, modo escuro e fechamento controlado dos diálogos.
- A unidade `kg` encontrada colada ao valor no novo resumo de carcaça foi movida
  para o rótulo durante a auditoria.

## 4. Evidências executadas

- `npm run test:full` — aprovado, saída final 0.
- `npm run lint` — aprovado depois dos ajustes de empacotamento.
- `npm audit --omit=dev` — 0 vulnerabilidades.
- `npm run dist:unsigned` — pacote diagnóstico gerado e validado.
- `diagnostic:packaged:source:verify` — versão 1.1.16, Dexie e preload mínimo.
- `diagnostic:packaged:ui-build:verify` — bundle, ModeloBase1, manifesto e idade
  do instalador conferidos.
- `verify-installed-app-e2e` — executável empacotado aberto por quatro segundos
  com `PESAGENS_USER_DATA_DIR` apontando para um perfil isolado; log confirmou
  `isPackaged true`, versão 1.1.16 e armazenamento Dexie.
- `release:signing:preflight` — reprovado como esperado por ausência de
  `WIN_CSC_LINK/CSC_LINK`; nenhuma release oficial insegura foi criada.

## 5. Artefato diagnóstico atual

- Arquivo: `release-unsigned/Pesagens Individuais Setup 1.1.16.exe`
- Tamanho: 91.658.580 bytes
- SHA-256: `5D3452D1BD72604FE7B0F446AD69EED5D5A4B60AE6E94DFE51E8F973EBE92674`
- Executável interno: 201.233.408 bytes
- SHA-256 do executável interno:
  `10395B6A3BB16EAEEB6AD555D98FDC4CDBFF0B04A1804D247DFCD0534597F1B8`
- Authenticode do Setup e do executável: `NotSigned`
- Ícone: padrão do Electron; não há ativo de marca `.ico` fornecido no projeto.

O artefato acima pode abrir em um ambiente permissivo, como demonstrado pelo
smoke, mas pode e deve ser bloqueado em um Windows que exija publicador confiável.
Renomear, compactar, alterar a versão ou desativar o Defender não resolve a
confiança criptográfica.

## 6. Pendências e risco residual

| Prioridade | Pendência | Condição de aceite |
|---|---|---|
| P0 | Certificado Authenticode ausente | Setup e app assinados, cadeia válida e carimbo de tempo |
| P0 | Homologação na política de destino | instalação sem desativar Defender/WDAC/App Control |
| P1 | Máquina limpa e upgrade | instalar, reabrir, atualizar, desinstalar e confirmar preservação |
| P1 | Aceite visual humano | claro/escuro, 100/125/150%, filtros, pop-ups e rolagem aprovados |
| P1 | Código fora de um repositório Git | criar repositório, commit/tag 1.1.16 e rastrear o artefato |
| P2 | Ícone oficial ausente | fornecer `.ico` multirresolução e validar atalhos/Setup |
| P2 | Backup/restauração real instalado | executar roteiro em perfil isolado e arquivar as evidências |

## 7. Conclusão

Não foram encontrados bloqueios técnicos adicionais nos contratos automatizados
da aplicação. O estado correto é: **código 1.1.16 aprovado tecnicamente, pacote
diagnóstico validado, publicação enterprise oficial bloqueada por controles
externos ainda não cumpridos**. A release só deve mudar para “aprovada para
distribuição” quando os itens P0 e P1 acima tiverem evidência real.
