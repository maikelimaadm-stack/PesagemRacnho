// Mantido por compatibilidade com os scripts npm `packaged:ui-build:verify` e
// `diagnostic:packaged:ui-build:verify`. O contrato passou a viver em
// verify-packaged-build.mjs (ADR-037/ADR-039), que é um superconjunto estrito
// das verificações antigas: versões sincronizadas, marcadores visuais em
// dist/assets e no app.asar, manifesto conferido e Setup não anterior aos
// bundles — mais os identificadores de build, os cinco eixos de versão e
// `signed`/`builtAt` do manifesto.
import { PackagedBuildError, verifyPackagedBuild } from './verify-packaged-build.mjs';

try {
  const summary = verifyPackagedBuild();
  console.log('OK verify-packaged-ui-build (delegado a verify-packaged-build)');
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  if (!(error instanceof PackagedBuildError)) throw error;
  console.error('FAIL:', error.message);
  process.exit(1);
}
