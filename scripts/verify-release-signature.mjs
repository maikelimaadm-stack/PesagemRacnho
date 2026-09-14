import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const productName = pkg.build?.productName || pkg.productName;
const installerPath = join(root, 'release', `${productName} Setup ${pkg.version}.exe`);
const applicationPath = join(root, 'release', 'win-unpacked', `${productName}.exe`);
const targets = [applicationPath, installerPath];

for (const target of targets) {
  if (!existsSync(target)) {
    console.error(`FAIL release: artefato esperado não encontrado: ${target}`);
    process.exit(1);
  }
}

const escapedTargets = targets
  .map((target) => `'${target.replaceAll("'", "''")}'`)
  .join(',');
const command = [
  `$files = @(${escapedTargets})`,
  '$result = foreach ($file in $files) {',
  '  $signature = Get-AuthenticodeSignature -LiteralPath $file',
  '  [PSCustomObject]@{',
  '    Path = $file',
  '    Status = [string]$signature.Status',
  '    StatusMessage = [string]$signature.StatusMessage',
  '    Subject = [string]$signature.SignerCertificate.Subject',
  '    Issuer = [string]$signature.SignerCertificate.Issuer',
  '    Thumbprint = [string]$signature.SignerCertificate.Thumbprint',
  '    NotAfter = if ($signature.SignerCertificate) { $signature.SignerCertificate.NotAfter.ToUniversalTime().ToString("o") } else { "" }',
  '    Timestamped = [bool]$signature.TimeStamperCertificate',
  '  }',
  '}',
  '$result | ConvertTo-Json -Compress',
].join('\n');

const powershell = spawnSync(
  'powershell.exe',
  ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
  { encoding: 'utf8', windowsHide: true },
);

if (powershell.status !== 0) {
  console.error('FAIL release: não foi possível validar as assinaturas Authenticode.');
  console.error((powershell.stderr || powershell.stdout || '').trim());
  process.exit(1);
}

let signatures;
try {
  const parsed = JSON.parse(powershell.stdout.trim());
  signatures = Array.isArray(parsed) ? parsed : [parsed];
} catch {
  console.error('FAIL release: resposta inválida ao validar Authenticode.');
  console.error(powershell.stdout.trim());
  process.exit(1);
}

const failures = [];
for (const signature of signatures) {
  if (signature.Status !== 'Valid') {
    failures.push(`${signature.Path}: assinatura ${signature.Status || 'ausente'} (${signature.StatusMessage || 'sem detalhes'})`);
  }
  if (!signature.Subject || !signature.Issuer || !signature.Thumbprint) {
    failures.push(`${signature.Path}: certificado do publicador ausente ou incompleto`);
  }
  if (signature.Subject && signature.Subject === signature.Issuer) {
    failures.push(`${signature.Path}: certificado autoassinado não é aceito para a release oficial`);
  }
  if (signature.NotAfter && new Date(signature.NotAfter) <= new Date()) {
    failures.push(`${signature.Path}: certificado expirado em ${signature.NotAfter}`);
  }
  if (!signature.Timestamped) {
    failures.push(`${signature.Path}: assinatura sem carimbo de tempo`);
  }
}

if (failures.length > 0) {
  console.error('FAIL release: a assinatura digital não atende ao contrato de distribuição.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('OK release: executável e instalador possuem assinatura Authenticode válida.');
for (const signature of signatures) {
  console.log(JSON.stringify({
    file: signature.Path,
    subject: signature.Subject,
    issuer: signature.Issuer,
    thumbprint: signature.Thumbprint,
    notAfter: signature.NotAfter,
    timestamped: signature.Timestamped,
  }));
}
