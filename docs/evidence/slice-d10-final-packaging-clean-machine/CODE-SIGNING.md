# CODE-SIGNING

## Estado atual
O instalador e o executável **não são assinados digitalmente**.
`package.json` → `build.win.signAndEditExecutable: false` e nenhum certificado
configurado.

## Efeito prático
Ao instalar em um Windows limpo, o **SmartScreen** pode exibir o aviso
"O Windows protegeu o computador" / "Editor desconhecido". O usuário precisa
clicar em **Mais informações → Executar assim mesmo**. Isto é normal para apps
sem assinatura e não indica que o app está corrompido.

## Por que está assim
Assinatura de código exige um **certificado pago** (OV ou EV) de uma
autoridade certificadora. Decisão do projeto: manter simples e gratuito neste
estágio. Risco aceito e documentado.

## Como assinar no futuro (quando houver certificado)
1. Obter um certificado de code signing (`.pfx`) de uma CA (ex.: DigiCert,
   Sectigo). EV reduz mais o atrito com SmartScreen.
2. Configurar via variáveis de ambiente antes do `npm run dist` (electron-builder):
   - `CSC_LINK` = caminho do `.pfx` (ou base64)
   - `CSC_KEY_PASSWORD` = senha do certificado
   NÃO commitar o certificado nem a senha no repositório.
3. Opcionalmente definir em `build.win`:
   - `signAndEditExecutable: true`
   - `signingHashAlgorithms: ["sha256"]`
   - servidor de timestamp (ex.: `rfc3161TimeStampServer`).
4. Rebuildar e verificar a assinatura no `.exe` (propriedades → Assinaturas
   digitais).

## Enquanto não houver assinatura
- Orientar o usuário final sobre o aviso do SmartScreen no
  `docs/user/INSTALACAO-WINDOWS.md`.
- Distribuir o `.exe` por canal confiável (link direto do desenvolvedor) para
  reduzir suspeita.
