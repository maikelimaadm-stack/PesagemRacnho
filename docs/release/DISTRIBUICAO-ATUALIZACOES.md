# Distribuição de instaladores e aviso de nova versão

Este fluxo complementa o build local no Windows: o **instalador** continua sendo
gerado no **GitHub Actions (Windows)**, publicado no **Supabase Storage** e o
app **instalado** consulta um JSON público para avisar quando há versão mais nova.

O uso diário do sistema **continua offline**. Só a verificação de versão (opcional)
precisa de internet por alguns segundos.

## Visão geral

```text
Merge / tag no GitHub
  → workflow release-windows (runner Windows)
  → npm run dist:unsigned (ou dist com assinatura)
  → publish-release-supabase.mjs
  → bucket Supabase: win/{versão}/Setup.exe + win/latest.json

App instalado (Windows)
  → GET win/latest.json (URL fixa no build)
  → se appVersion > versão instalada → badge “Nova versão” na barra
  → botão abre o download HTTPS (Setup.exe)
```

## Supabase (uma vez)

1. Crie um projeto Supabase (ou use um existente).
2. Storage → **New bucket** → nome sugerido: `pesagens-releases`.
3. Marque o bucket como **Public** (somente leitura pública dos objetos publicados).
4. Anote:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** (Settings → API) → `SUPABASE_SERVICE_ROLE_KEY` (**somente CI**, nunca no app)

Arquivos esperados após a primeira publicação:

| Caminho no bucket | Conteúdo |
|-------------------|----------|
| `win/latest.json` | Metadados da última versão Windows (feed público) |
| `win/{versão}/Pesagens Individuais Setup {versão}.exe` | Instalador |

URL pública do feed (exemplo):

`https://SEU_PROJECT.supabase.co/storage/v1/object/public/pesagens-releases/win/latest.json`

## GitHub Actions (segredos)

No repositório GitHub → Settings → Secrets and variables → Actions:

| Segredo | Uso |
|---------|-----|
| `SUPABASE_URL` | Upload do instalador |
| `SUPABASE_SERVICE_ROLE_KEY` | Upload (service role) |
| `SUPABASE_RELEASE_BUCKET` | Opcional; padrão `pesagens-releases` |
| `RELEASE_FEED_URL` | URL pública do `win/latest.json` (injetada no build Vite) |
| `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` | Opcional; só para `npm run dist` assinado |

Dispare o workflow **Release Windows** manualmente (`workflow_dispatch`) ou por tag `v*`.

## Build do app com feed configurado

Na máquina ou no CI, antes de `npm run build` / `electron-builder`:

```powershell
$env:RELEASE_FEED_URL = "https://SEU_PROJECT.supabase.co/storage/v1/object/public/pesagens-releases/win/latest.json"
npm run dist:unsigned
```

Sem `RELEASE_FEED_URL`, o app **não** consulta atualizações (comportamento seguro para dev).

## Publicação manual (alternativa ao CI)

Após gerar `release-unsigned/` ou `release/` localmente no Windows:

```powershell
$env:SUPABASE_URL = "https://....supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "..."
$env:SUPABASE_RELEASE_BUCKET = "pesagens-releases"
npm run release:publish:supabase
```

## Contrato do `win/latest.json` (feedVersion 1)

Campos principais:

- `appVersion` — semver publicada (ex.: `1.5.5`)
- `installer.downloadUrl` — HTTPS público do Setup.exe
- `installer.sha256` / `sizeBytes` — conferência opcional antes de instalar
- `releaseNotesUrl` — opcional (link para notas)

O app compara `appVersion` com a versão instalada (`package.json` / `__APP_VERSION__`).

## Instalação pelo usuário final

1. Clicar em **Nova versão** / **Baixar instalador** (abre o navegador ou o link no sistema).
2. Executar o **Setup** por cima da instalação atual (dados locais preservados — ver `docs/user/INSTALACAO-WINDOWS.md`).
3. Não é atualização automática silenciosa: o operador controla quando instalar.

## Segurança

- O app só abre links **HTTPS** de download em hosts confiáveis (`*.supabase.co` com path público, ou hosts extras via `PESAGENS_TRUSTED_DOWNLOAD_HOSTS` no processo Electron).
- Prefira conferir SHA-256 do instalador com `release-manifest.json` da release quando possível.
