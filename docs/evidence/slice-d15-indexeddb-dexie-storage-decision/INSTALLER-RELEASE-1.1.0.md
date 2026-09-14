# INSTALLER-RELEASE-1.1.0

## Status: NÃO GERADO nesta etapa (decisão honesta)
Não subi a versão para 1.1.0 nem gerei `Setup 1.1.0.exe` neste slice.

## Por quê
1.1.0 deve significar "migração para IndexedDB/Dexie". Mas o **cutover da UI**
ainda não foi feito — as telas continuam usando SQLite via IPC. Gerar um
"Setup 1.1.0" agora:
- rotularia como migração algo que ainda é o app SQLite (rótulo enganoso);
- criaria mais um build ambíguo no teste físico, ainda sujeito a
  "Banco SQLite não inicializado" — o oposto do objetivo.

## Quando gerar o 1.1.0
Após: (a) cutover dos dataAdapters/proxy para o storageAdapter Dexie;
(b) validação física de que o app instalado abre, cria o IndexedDB sozinho e faz
backup sem erro SQLite; (c) então bump para 1.1.0 + dist + checksum + manifest.

## Versão atual
Mantida em **1.0.2** (o instalador 1.0.2 com diagnóstico D.14 continua sendo o
build de referência para o teste físico atual).
