import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const certificateReference = String(
  process.env.WIN_CSC_LINK || process.env.CSC_LINK || '',
).trim();
const certificatePassword = String(
  process.env.WIN_CSC_KEY_PASSWORD || process.env.CSC_KEY_PASSWORD || '',
);

const fail = (details = []) => {
  console.error('FAIL release: assinatura digital confiável não configurada.');
  for (const detail of details) console.error(`- ${detail}`);
  console.error('');
  console.error('Configure as variáveis somente na sessão de build:');
  console.error('  $env:WIN_CSC_LINK = "C:\\caminho\\certificado-codesigning.pfx"');
  console.error('  $env:WIN_CSC_KEY_PASSWORD = "<senha-do-certificado>"');
  console.error('  npm run dist');
  console.error('');
  console.error('O certificado precisa ser de assinatura de código e emitido por uma CA confiável.');
  console.error('Para build local sem distribuição, use explicitamente: npm run dist:unsigned');
  process.exit(1);
};

if (!certificateReference) {
  fail(['WIN_CSC_LINK/CSC_LINK não foi informado.']);
}

if (!certificatePassword) {
  fail(['WIN_CSC_KEY_PASSWORD/CSC_KEY_PASSWORD não foi informado.']);
}

const isRemote = /^(https?:|data:)/i.test(certificateReference);
const isBase64 = !isRemote && certificateReference.length > 512 && !/[\\/]/.test(certificateReference);

if (!isRemote && !isBase64) {
  const certificatePath = isAbsolute(certificateReference)
    ? certificateReference
    : resolve(process.cwd(), certificateReference.replace(/^file:\/\//i, ''));

  if (!existsSync(certificatePath)) {
    fail([`arquivo de certificado não encontrado: ${certificatePath}`]);
  }
}

console.log('OK release: credenciais de assinatura digital fornecidas.');
console.log('A validade, a cadeia de confiança e a assinatura dos artefatos serão verificadas após o build.');
