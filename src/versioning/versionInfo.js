// Versionamento em cinco eixos + identificadores de build (ADR-037).
// Contrato: docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md
//
// - APP_VERSION deriva de package.json (Vite injeta __APP_VERSION__; fallback em lib/appVersion.js).
// - DB_SCHEMA_VERSION deriva do esquema Dexie vigente.
// - BACKUP_FORMAT_VERSION é o único lugar onde o formato do backup é declarado.
// - UI_BUILD_ID continua sendo definido em components/modelobase1/uiBuildInfo.js
//   (dono: agente de UI) e é apenas reexportado aqui.
import { APP_VERSION } from '../lib/appVersion.js';
import { DB_VERSION } from '../storage/indexedDb/schema.js';
import { UI_BUILD_ID, UI_MODEL, UI_VERSION } from '../components/modelobase1/uiBuildInfo.js';

export const DB_SCHEMA_VERSION = DB_VERSION;
export const BACKUP_FORMAT_VERSION = 3;
export const UI_CONTRACT_VERSION = 'ModeloBase1-2.0';
export const DATA_CONTRACT_VERSION = 2;
export const DATA_BUILD_ID = `schema-v${DB_VERSION}`;

export { APP_VERSION, UI_BUILD_ID, UI_MODEL, UI_VERSION };

/** Resumo para Manutenção, diagnóstico, manifesto de release e backup. */
export function describeVersions() {
  return {
    app: APP_VERSION,
    dbSchema: DB_SCHEMA_VERSION,
    backupFormat: BACKUP_FORMAT_VERSION,
    uiContract: UI_CONTRACT_VERSION,
    dataContract: DATA_CONTRACT_VERSION,
    uiBuildId: UI_BUILD_ID,
    dataBuildId: DATA_BUILD_ID,
    uiModel: UI_MODEL,
    uiVersion: UI_VERSION,
  };
}
