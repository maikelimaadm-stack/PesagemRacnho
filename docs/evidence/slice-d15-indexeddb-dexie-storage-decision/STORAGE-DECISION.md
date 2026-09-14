# STORAGE-DECISION

Decisão de arquitetura de armazenamento para o app **Pesagens Individuais**
(desktop, offline, local, simples, gratuito, sem login/cloud/servidor).

## Contexto
Após D.11–D.14, o teste físico da Maike ainda apresenta "Banco SQLite não
inicializado". Os testes automatizados passam; a máquina real falha. A mensagem
exata vem do caminho antigo `getConnection` — forte indício de que o app
instalado que falha **não é o build corrigido** (identidade/instalação de build).
Independentemente disso, o stack SQLite nativo traz uma classe inteira de
fragilidades de distribuição.

## Opção A — SQLite nativo (better-sqlite3) — ATUAL
Vantagens:
- SQL real, transações ACID, migrations versionadas, integridade forte.
- Já implementado e coberto por testes.
Desvantagens / riscos:
- **Módulo nativo** (`better_sqlite3.node`): precisa de rebuild por ABI do
  Electron e de `app.asar.unpacked`.
- **Antivírus/SmartScreen**: instalador não assinado já foi quarentenado; o
  `.node` nativo aumenta a suspeita.
- **Conexão no main process**: exige bootstrap correto antes dos IPCs; qualquer
  divergência de runtime gera "Banco SQLite não inicializado".
- **Runtime entre teste e máquina real não confiável** — o problema físico
  persiste apesar de 4 slices de correção.
- Backup = cópia binária do arquivo + WAL checkpoint (mais partes móveis).
Por que falhou no teste físico: provavelmente build antigo instalado + a
fragilidade do bootstrap/módulo nativo no runtime empacotado.

## Opção B — SQLite WASM / sql.js
Vantagens:
- SQL real sem módulo nativo (roda em WebAssembly no renderer).
Desvantagens:
- **Persistência é manual**: o banco vive em memória; é preciso serializar o
  arquivo inteiro e gravar em disco a cada mudança (ou em intervalos) — risco de
  corrupção/perda e custo de I/O do arquivo inteiro.
- Complexidade de salvar/carregar o database file; ainda precisa de IPC/FS.
- Bundle grande do WASM. Ganha pouco em relação ao Dexie para um app simples.

## Opção C — IndexedDB / Dexie.js — PREFERIDA
Vantagens:
- **IndexedDB é embutido no Chromium/Electron** — zero módulo nativo, zero
  `app.asar.unpacked` para o banco, zero rebuild por ABI.
- **Sem conexão no main process** — o banco vive no renderer; não existe o estado
  "não inicializado" do SQLite. First-run é automático (Dexie cria o DB ao abrir).
- **Menos superfície de antivírus** (sem `.node`).
- Persistência gerenciada pelo navegador (durável, transacional por store).
- Backup natural = exportar todos os stores para **JSON** (já é o formato de
  export/import do app). Restore = importar JSON em transação Dexie.
Desvantagens:
- Não é SQL (sem JOIN/SQL). Para este app, consultas são simples (por data,
  animal, lote) — resolvíveis com índices Dexie.
- "Integridade" passa a ser **lógica** (contagens/consistência), não
  `PRAGMA integrity_check`.
- Limites de cota do IndexedDB (amplos para dados de pesagens; texto/CSV/JSON).
- Dados ficam no diretório de perfil do Electron (userData), não em um arquivo
  `.db` avulso — o backup JSON cobre portabilidade.

## Conclusão
Para um app **simples, offline, local**, cujo maior problema tem sido
**instalar e inicializar** um banco nativo de forma confiável, **Dexie/IndexedDB
é a melhor opção prática**: elimina o módulo nativo, o unpacked, a conexão no
main e a própria mensagem "Banco SQLite não inicializado". As consultas do app
cabem bem no modelo de índices do Dexie, e backup/export/import já são JSON.

Recomendação: **adotar Dexie/IndexedDB como armazenamento operacional**, com
migração feita pela camada de *dataAdapters* do renderer (ponto de troca único),
e aposentar o SQLite nativo do fluxo operacional.

## Ressalva honesta (não mascarar)
- Esta decisão **não pode ser validada fisicamente por mim** neste ambiente
  (não consigo instalar/abrir o app empacotado). A aposta arquitetural é sólida
  (remove a classe de falhas), mas a confirmação final é o teste físico da Maike.
- Se a causa real da falha for "build antigo instalado", o diagnóstico D.14
  (versão visível + app.log) continua sendo a forma de confirmar — vale coletar
  isso também. Dexie remove a fragilidade, mas não substitui a confirmação de que
  o usuário está rodando o build novo.
