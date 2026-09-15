# Diagnóstico do bloqueio de instalação — versão 1.1.15

Data do diagnóstico: 03/09/2026

## Resultado

O Setup e o aplicativo empacotado estão íntegros, mas o Windows impede a
execução porque a política App Control/Code Integrity ativa exige um nível de
assinatura que os executáveis atuais, sem Authenticode, não atingem.

## Evidências locais

- Log: `Microsoft-Windows-CodeIntegrity/Operational`
- Eventos: `3033` e `3077`
- Política: `VerifiedAndReputableDesktop`
- Policy ID exibido no evento: `27555.1000.240208`
- Policy GUID informado pelo bloqueio: `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`
- Requested Signing Level: `2`
- Validated Signing Level: `1`
- Status: `0xc0e90002`
- Arquivo bloqueado: `Pesagens Individuais.exe`

O evento `3077` é um bloqueio em modo obrigatório, não apenas auditoria.

## Integridade dos arquivos

### Setup

- Arquivo: `Pesagens Individuais Setup 1.1.15.exe`
- SHA-256 plano: `65E8D9120ED5EEF932D54DAEF1E711297E3A90E642A886D57F1CF372C5D5601C`
- Teste estrutural do arquivo NS- Zip: aprovado, 73 itens íntegros
- Authenticode: `NotSigned`

### Aplicativo interno

- Arquivo: `release/win-unpacked/Pesagens Individuais.exe`
- SHA-256 plano: `DCDDFB29BB8A9A51F82E40E88217FFF798CE127BD9144F87F3E0A5035163D5E8`
- SHA-256 Authenticode informado pelo evento 3077:
  `C171AA9E77397F924C3F9896381F6CF34E605616472475DDAAB07A87B71DDC0E`
- Authenticode: `NotSigned`

## Formas suportadas de liberação

1. Assinar o aplicativo e o Setup com certificado de assinatura de código
   aceito pela política ativa. O projeto possui o comando `npm run dist:signed`
   preparado para esse fluxo.
2. Solicitar ao administrador uma política suplementar App Control que confie
   no certificado/publicador da aplicação.
3. Como medida temporária e de maior manutenção, o administrador pode criar uma
   regra por hash para os binários acima. Essa regra precisa ser atualizada
   sempre que a versão mudar.
4. Distribuir o aplicativo por um mecanismo configurado como Managed Installer,
   caso a política da organização permita esse modelo.

Não é recomendado desativar App Control, Integridade de Memória, Defender ou
outras proteções apenas para instalar o aplicativo.

## Material necessário para a versão assinada

- Certificado de assinatura de código em `.pfx`/`.p12`, ou certificado acessível
  pelo repositório do Windows/serviço de assinatura.
- Senha ou credencial do certificado fornecida de forma segura no ambiente de
  build, nunca gravada no repositório.
- Confirmação de que o emissor/publicador é permitido pela política
  `VerifiedAndReputableDesktop` ou por uma política suplementar.
