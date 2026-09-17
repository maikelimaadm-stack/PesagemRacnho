# 1.2.0-rc1 — candidato (não é release final)

| Campo | Valor |
|---|---|
| Tag | `v1.2.0-rc1` → commit `3b27958` (árvore limpa; manifesto sem `-dirty`) |
| Instalador | `release-unsigned/Pesagens Individuais Setup 1.2.0.exe` |
| Tamanho | 92.036.329 bytes |
| SHA-256 do Setup | `fd44a5eeb2bdad30de763c1398b0435b7f5f533b7d3fecad25b4004b7c8dc0c6` |
| SHA-256 do `app.asar` | `4c2424264a6264a5dbf6cdcd5905ac6c11523c91b6a581a39cef19fc6b9afd5f` (69.782.223 bytes) |
| Manifesto | `release-unsigned/release-manifest.json` — appVersion 1.2.0, dbSchemaVersion 7, backupFormatVersion 3, dataBuildId `schema-v7`, uiContract `ModeloBase1-2.0` |
| Assinatura | `signed: false` (sem Authenticode) — `distribution: unsigned-diagnostic` |
| Gates | `test:quick` verde (33); `dist:unsigned` verde: checksum, manifesto, `packaged:source`, `packaged:build`, `installed-app-e2e` (validação de artefatos) |
| Build gerado em | 2026-09-17T00:57Z (16/09/2026 21:57 local) |

O instalador de 15/09 (`cc024d8-dirty`) foi **substituído** e não deve ser usado.

## O que entra no RC em relação ao instalador anterior

Correções R0 do programa reporting (ver `CHANGELOG.md` [1.2.0] › Fixed e
`docs/evidence/reporting-program/R0-foundation-fixes/`).

## Status

**Candidato.** Promover para `v1.2.0` somente após o teste físico abaixo em Windows real.
O ambiente do agente não executa o Setup (antivírus/quarentena e `spawn` bloqueado).

## Roteiro físico mínimo

1. Instalar o Setup acima; conferir o SHA-256 antes (`certutil -hashfile "Pesagens Individuais Setup 1.2.0.exe" SHA256`).
2. Primeira execução: criar o administrador; guardar a chave de recuperação.
3. Manutenção › Versões: 1.2.0 · esquema 7 · backup 3 · build `3b27958`.
4. Criar usuários GESTOR, OPERADOR e CONSULTA.
5. Lançar Cadastro (macho, 320 kg, categoria Automático) com faixas de categoria configuradas; lançar Manejo; lançar Saída por Morte sem peso → Ficha mantém categoria e peso atual.
6. Login GESTOR: Manutenção não mostra Restaurar, Limpar e Reset; backup continua disponível.
7. Login CONSULTA: Relação sem Lançar/Editar/Excluir/Importar; colunas de valor ausentes no configurador.
8. Login OPERADOR: Lançamento de Saída/Venda sem campos de valor.
9. Configurações: sem rendimento padrão, a estimativa pede o rendimento; com 52,5 %, arrobas = peso × 0,525 ÷ 15.
10. Backup completo; fechar e reabrir; dados preservados.
