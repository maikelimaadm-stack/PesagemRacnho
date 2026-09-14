# NEXT-STEPS (após D.14)

## Estado
Runtime SSOT + ensureDatabaseReady robusto + wrapper em todos os handlers +
diagnóstico na UI + log local. Pacote **1.0.2** provado. Todos os gates verdes.

## Instrução para Maike (crítico)
1. Usar **somente** `Pesagens Individuais Setup 1.0.2.exe`
   (SHA256 `eea84a05896f437cc0862925044c9255b55aa4a94bddf43a17fcf1b69d8d0303`).
2. **Desinstalar** a versão anterior antes (ou instalar por cima) para não rodar
   build antigo.
3. Abrir → **Manutenção** → conferir na parte de Diagnóstico:
   - **Versão: 1.0.2** (se não for, é build antigo).
   - **Caminho do banco** e **Log** aparecendo.
4. Testar **backup do banco** e **backup completo** imediatamente após abrir.
5. **Se ainda falhar**: clicar **Copiar diagnóstico** e enviar +
   `%APPDATA%\pesagens-individuais\logs\app.log`.

## Importante (metodologia)
Se falhar de novo, **não** fazer novo fix às cegas. Analisar primeiro o app.log
e o diagnóstico copiado — eles dirão se é build antigo, permissão de pasta, ou
erro real do módulo nativo.

## Pendências
- Teste físico completo em máquina limpa com o 1.0.2 (assinar CLEAN-MACHINE-TEST-RECORD).
- Ícone customizado; code signing.

## Só depois do teste físico OK
Criar `docs/HANDOFF-CLAUDE-CODE.md`.
