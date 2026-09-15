// Versionamento em quatro eixos + marcadores de build (ADR-047; complementa ADR-037/039).
// Contrato: docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md (revisão 2).
//
// Eixos (nunca se confundem):
// - APP_VERSION            → package.json (Vite injeta __APP_VERSION__; fallback em lib/appVersion.js).
// - DB_SCHEMA_VERSION      → esquema Dexie vigente (storage/indexedDb/schema.js, DB_VERSION).
// - BACKUP_FORMAT_VERSION  → único lugar onde o formato do backup JSON é declarado.
// - RELEASE_MANIFEST_VERSION → formato do release-manifest.json (scripts/generate-release-manifest.mjs).
//
// Marcadores de build (não são versões): UI_BUILD_ID/UI_MODEL/UI_VERSION (dono: agente de UI,
// definidos em components/modelobase1/uiBuildInfo.js e apenas reexportados aqui), DATA_BUILD_ID,
// UI_CONTRACT_VERSION, DATA_CONTRACT_VERSION e BUILD_INFO (gitCommit/buildTimestamp via __BUILD_INFO__).
//
// Marco 1.1.18: baseline + contrato de versão, SEM esquema novo (Dexie 6, backup formato 2).
import { APP_VERSION } from '../lib/appVersion.js';
import { DB_VERSION } from '../storage/indexedDb/schema.js';
import { UI_BUILD_ID, UI_MODEL, UI_VERSION } from '../components/modelobase1/uiBuildInfo.js';

export const DB_SCHEMA_VERSION = DB_VERSION;
export const BACKUP_FORMAT_VERSION = 2;
export const RELEASE_MANIFEST_VERSION = 2;
export const UI_CONTRACT_VERSION = 'ModeloBase1-R34';
export const DATA_CONTRACT_VERSION = 1;
export const DATA_BUILD_ID = `schema-v${DB_VERSION}`;

// Vite injeta __BUILD_INFO__ = { gitCommit, buildTimestamp } (vite.config.js).
// Em Node (gates, scripts) a constante não existe e os campos ficam nulos.
export const BUILD_INFO = typeof __BUILD_INFO__ !== 'undefined' && __BUILD_INFO__
  ? {
      gitCommit: __BUILD_INFO__.gitCommit ?? null,
      buildTimestamp: __BUILD_INFO__.buildTimestamp ?? null,
    }
  : { gitCommit: null, buildTimestamp: null };

export { APP_VERSION, UI_BUILD_ID, UI_MODEL, UI_VERSION };

/** Resumo único para Manutenção (Status/Versões), diagnóstico, manifesto de release e backup. */
export function describeVersions() {
  return {
    app: APP_VERSION,
    dbSchema: DB_SCHEMA_VERSION,
    backupFormat: BACKUP_FORMAT_VERSION,
    releaseManifest: RELEASE_MANIFEST_VERSION,
    uiContract: UI_CONTRACT_VERSION,
    dataContract: DATA_CONTRACT_VERSION,
    uiBuildId: UI_BUILD_ID,
    dataBuildId: DATA_BUILD_ID,
    uiModel: UI_MODEL,
    uiVersion: UI_VERSION,
    gitCommit: BUILD_INFO.gitCommit,
    buildTimestamp: BUILD_INFO.buildTimestamp,
  };
}
