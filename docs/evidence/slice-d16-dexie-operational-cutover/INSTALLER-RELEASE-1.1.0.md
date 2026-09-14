# INSTALLER-RELEASE-1.1.0

- Versão: **1.1.0** (mudança de armazenamento SQLite → IndexedDB/Dexie).
- `npm run dist` → exit 0. Artefato: `release/Pesagens Individuais Setup 1.1.0.exe`.
- SHA256: `616a3059566a5f9a2f7f1a0e68967c891dd18991111eb54c74f634531ba04a49`
- Manifesto: `release/release-manifest.json` → version 1.1.0, aponta para
  `Setup 1.1.0.exe`, login/permissions/cloud = false.
- Artefatos 1.0.2 removidos de `release/`.
- better-sqlite3 ainda empacotado (legado) — `installer:sqlite:verify` PASS.

Validação pós-dist: `e2e:installed:verify` (estrito) PASS (Setup 1.1.0 presente +
app.asar/unpacked/native).
