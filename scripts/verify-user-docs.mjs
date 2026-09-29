// Gate `docs:user:verify` (docs 13 §4 item 6). Além de existir e não estar vazio,
// cada documento precisa cobrir os pontos que a release exige (login, perfis,
// cadastros, backup formato 3, migração) e citar a versão do package.json onde
// a versão importa (instalação, máquina limpa, notas, CHANGELOG). A comparação
// de conteúdo é por substring, sem diferenciar maiúsculas de minúsculas.
//
// Uso: node scripts/verify-user-docs.mjs
//      node scripts/verify-user-docs.mjs --self-test   (fixtures positivas e negativas)
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Documento de migração exigido por versão (14-MIGRACOES.md §7). Versões sem
// mudança de esquema (1.1.x, 1.5.0) não exigem o documento.
export const MIGRATION_DOC_BY_VERSION = {
  '1.2.0': 'MIGRATION-1.1.17-TO-1.2.0.md',
  '1.3.0': 'MIGRATION-1.2.0-TO-1.3.0.md',
  '1.4.0': 'MIGRATION-1.3.0-TO-1.4.0.md',
  '2.0.0': 'MIGRATION-1.5.0-TO-2.0.0.md',
};

/** Documentos obrigatórios e os trechos que cada um precisa conter. */
export function requiredDocs(version) {
  const setupName = `Pesagens Individuais Setup ${version}.exe`;
  const docs = [
    { doc: 'docs/user/GUIA-RAPIDO.md', contains: ['login', 'Usuários', 'Cadastros', 'Backup e Manutenção'] },
    { doc: 'docs/user/LOGIN.md', contains: ['Configuração Inicial', 'Bloquear', 'Trocar senha', '30 segundos', 'ADMIN'] },
    // E1D (resposta 4 ao REPORT da E1C): os QUATRO perfis da matriz (permissionService.ROLES). O Fechamento
    // do dia é de curral mas exige session.close: OPERADOR e CONSULTA não o abrem, e o texto tem de dizer.
    { doc: 'docs/user/USUARIOS.md', contains: ['ADMIN', 'GESTOR', 'OPERADOR', 'CONSULTA', 'último ADMIN', 'sem o Fechamento do dia'] },
    {
      doc: 'docs/user/CADASTROS.md',
      contains: ['Marcas', 'Raças', 'Categorias', 'Parceiros', 'Propriedades', 'Causas de Morte', 'Inativar', 'padrão'],
    },
    {
      doc: 'docs/user/BACKUP-E-RESTAURACAO.md',
      contains: ['formato 3', 'usuários', 'conversão', 'Limpar dados operacionais', 'Reset completo', 'pré-migração'],
    },
    { doc: 'docs/user/EXPORTAR-DADOS.md', contains: [] },
    { doc: 'docs/user/INSTALACAO-WINDOWS.md', contains: [setupName, 'backup', 'migração automática', 'pré-migração'] },
    { doc: 'docs/user/TESTE-MAQUINA-LIMPA.md', contains: [version, 'login', 'Configuração Inicial', 'Cadastros'] },
    { doc: `docs/release/${version}/RELEASE-NOTES.md`, contains: [version] },
    { doc: `docs/release/${version}/RELEASE-CHECKLIST.md`, contains: ['packaged:build:verify', 'docs:user:verify'] },
    { doc: 'CHANGELOG.md', contains: [`## [${version}]`] },
  ];
  const migrationDoc = MIGRATION_DOC_BY_VERSION[version];
  if (migrationDoc) {
    docs.push({
      doc: `docs/release/${version}/${migrationDoc}`,
      contains: ['Pré-requisitos', 'Backup', 'Rollback', 'B1', 'B12', 'Relatório', 'Tempo'],
    });
  }
  return docs;
}

/** Verifica os documentos; devolve { version, results, failed } sem lançar. */
export function verifyUserDocs({ root = PROJECT_ROOT } = {}) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const results = requiredDocs(version).map(({ doc, contains }) => {
    const full = join(root, doc);
    const exists = existsSync(full);
    const nonEmpty = exists && statSync(full).size > 0;
    const text = nonEmpty ? readFileSync(full, 'utf8').toLocaleLowerCase('pt-BR') : '';
    const missing = nonEmpty ? contains.filter((snippet) => !text.includes(snippet.toLocaleLowerCase('pt-BR'))) : contains;
    return { doc, exists, nonEmpty, missing, ok: exists && nonEmpty && missing.length === 0 };
  });
  return { version, results, failed: results.some((r) => !r.ok) };
}

function describe(result) {
  if (!result.exists) return 'ausente';
  if (!result.nonEmpty) return 'vazio';
  if (result.missing.length > 0) return `sem: ${result.missing.map((m) => JSON.stringify(m)).join(', ')}`;
  return '';
}

// ---------------------------------------------------------------------------
// Self-test com fixtures (não lê os documentos reais).
// ---------------------------------------------------------------------------
function buildDocsFixture(version, mutate = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'verify-user-docs-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version }));
  const files = Object.fromEntries(requiredDocs(version).map(({ doc, contains }) => [doc, `# ${doc}\n\n${contains.join('\n')}\n`]));
  mutate(files);
  for (const [doc, content] of Object.entries(files)) {
    if (content === null) continue;
    const full = join(root, doc);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  return root;
}

function runSelfTest() {
  const version = '1.2.0'; // versão com documento de migração obrigatório
  const cases = [];
  const withFixture = (label, mutate, expectation) => {
    const root = buildDocsFixture(version, mutate);
    try {
      const outcome = verifyUserDocs({ root });
      expectation(outcome);
      cases.push(label);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };
  const expectFailureOn = (doc, snippet) => (outcome) => {
    assert.equal(outcome.failed, true, `esperava falha em ${doc}`);
    const result = outcome.results.find((r) => r.doc === doc);
    assert.ok(result && !result.ok, `resultado de ${doc} deveria estar reprovado`);
    if (snippet) assert.ok(result.missing.includes(snippet), `${doc} deveria acusar o trecho ${JSON.stringify(snippet)}`);
    assert.ok(outcome.results.filter((r) => !r.ok).length === 1, 'apenas o documento mutado deve reprovar');
  };

  withFixture('fixture completa passa', () => {}, (outcome) => {
    assert.equal(outcome.failed, false, JSON.stringify(outcome.results.filter((r) => !r.ok)));
    assert.ok(outcome.results.some((r) => r.doc.endsWith('MIGRATION-1.1.17-TO-1.2.0.md')), 'migração exigida para 1.2.0');
  });
  withFixture('documento ausente reprova', (files) => { files['docs/user/LOGIN.md'] = null; }, expectFailureOn('docs/user/LOGIN.md'));
  withFixture('documento vazio reprova', (files) => { files['docs/user/CADASTROS.md'] = ''; }, expectFailureOn('docs/user/CADASTROS.md'));
  withFixture('instalação sem o nome do Setup reprova',
    (files) => { files['docs/user/INSTALACAO-WINDOWS.md'] = files['docs/user/INSTALACAO-WINDOWS.md'].replace(`Setup ${version}.exe`, 'Setup 0.0.0.exe'); },
    expectFailureOn('docs/user/INSTALACAO-WINDOWS.md', `Pesagens Individuais Setup ${version}.exe`));
  withFixture('CHANGELOG sem o bloco da versão reprova',
    (files) => { files['CHANGELOG.md'] = '# Changelog\n\n## [Não lançado]\n'; },
    expectFailureOn('CHANGELOG.md', `## [${version}]`));
  withFixture('USUARIOS sem a regra do último ADMIN reprova',
    (files) => { files['docs/user/USUARIOS.md'] = 'ADMIN\nGESTOR\nOPERADOR\nCONSULTA\nsem o Fechamento do dia\n'; },
    expectFailureOn('docs/user/USUARIOS.md', 'último ADMIN'));
  withFixture('USUARIOS só com três perfis (sem CONSULTA) reprova',
    (files) => { files['docs/user/USUARIOS.md'] = 'ADMIN\nGESTOR\nOPERADOR\núltimo ADMIN\nsem o Fechamento do dia\n'; },
    expectFailureOn('docs/user/USUARIOS.md', 'CONSULTA'));
  withFixture('USUARIOS que dá o Fechamento do dia a OPERADOR e CONSULTA reprova',
    (files) => { files['docs/user/USUARIOS.md'] = 'ADMIN\nGESTOR\nOPERADOR\nCONSULTA\núltimo ADMIN\nOPERADOR e CONSULTA: os de curral, sem valores e sem Comercial\n'; },
    expectFailureOn('docs/user/USUARIOS.md', 'sem o Fechamento do dia'));
  withFixture('migração sem rollback reprova',
    (files) => {
      const doc = `docs/release/${version}/MIGRATION-1.1.17-TO-1.2.0.md`;
      files[doc] = files[doc].replace('Rollback', 'Desfazer');
    },
    expectFailureOn(`docs/release/${version}/MIGRATION-1.1.17-TO-1.2.0.md`, 'Rollback'));
  withFixture('notas de release de outra versão reprovam',
    (files) => { files[`docs/release/${version}/RELEASE-NOTES.md`] = '# Notas 9.9.9\n'; },
    expectFailureOn(`docs/release/${version}/RELEASE-NOTES.md`, version));
  withFixture('backup sem formato 3 reprova',
    (files) => { files['docs/user/BACKUP-E-RESTAURACAO.md'] = files['docs/user/BACKUP-E-RESTAURACAO.md'].replace('formato 3', 'formato 2'); },
    expectFailureOn('docs/user/BACKUP-E-RESTAURACAO.md', 'formato 3'));

  // Versão sem documento de migração obrigatório não o exige.
  const rootSemMigracao = buildDocsFixture('1.5.0');
  try {
    const outcome = verifyUserDocs({ root: rootSemMigracao });
    assert.equal(outcome.failed, false);
    assert.ok(!outcome.results.some((r) => /MIGRATION-/.test(r.doc)), '1.5.0 não exige documento de migração');
    cases.push('versão sem migração não exige MIGRATION-*.md');
  } finally {
    rmSync(rootSemMigracao, { recursive: true, force: true });
  }

  console.log('OK verify-user-docs (self-test)');
  console.log(JSON.stringify({ casos: cases, total: cases.length }, null, 2));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
  } else {
    const { version, results, failed } = verifyUserDocs();
    for (const result of results) {
      const detail = describe(result);
      console.log(`${result.ok ? 'OK  ' : 'FAIL'} ${result.doc}${detail ? ` (${detail})` : ''}`);
    }
    if (failed) {
      console.error(`FAIL: documentação de usuário/release incompleta para a versão ${version}`);
      process.exit(1);
    }
    console.log('OK verify-user-docs');
    console.log(JSON.stringify({ version, documentos: results.length }, null, 2));
  }
}
