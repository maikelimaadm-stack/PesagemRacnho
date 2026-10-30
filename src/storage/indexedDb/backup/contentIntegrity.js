// R3-02: conferência de CONTEÚDO depois de restaurar (e depois da compensação). Contagem igual não prova nada: uma
// pesagem com outro peso, um identificador trocado ou um documento alterado passam numa contagem.
//
// Contrato:
//   • para cada store do backup (o "esperado"), cada registro precisa existir no banco com o MESMO conteúdo
//     canônico — identidade por `id` (ou `key`); sem identidade, comparação por multiconjunto do conteúdo;
//   • canônico = JSON com chaves ordenadas recursivamente, sem `localId` (chave técnica autoincremental do Dexie);
//   • banco com registros a mais numa store comparada também é divergência, salvo as exceções abaixo;
//   • impressão digital por store: SHA-256 do canônico ordenado por identidade (registrada no resultado).
// Exceções explícitas (a própria restauração escreve nelas):
//   • backupHistory — não comparada (recebe o registro da restauração);
//   • appSettings — comparada, exceto as chaves técnicas `migration:*`, `derivados-saida-v1`, `backup-periodic-lock`
//     e `restauracao:critica`;
//   • restauração com MIGRAÇÃO (backup de esquema anterior): stores que não existiam no backup não são comparadas;
//     em `movimentosAnimais` os campos que a v9 preenche (natureza, operacao_id, updated_at — medido num backup v8) e
//     em `pesagens` os derivados que o passo E1G recalcula nas saídas de backups anteriores à 1.4.2
//     (legacy_payload.{data_anterior, peso_anterior, dias, ganho, gmd}, updated_at) não entram; `auditoria` pode ganhar registros da migração (os do backup continuam exigidos, inalterados).

const STORES_IGNORADAS = new Set(['backupHistory']);
const CHAVES_TECNICAS = [/^migration:/, /^derivados-saida-v1$/, /^backup-periodic-lock$/, /^restauracao:critica$/];
const TOLERANCIA_MIGRACAO = {
  movimentosAnimais: { campos: ['natureza', 'operacao_id', 'updated_at'] },
  pesagens: { campos: ['updated_at'], legacy: ['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd'] },
};
const ACRESCIMO_PERMITIDO_NA_MIGRACAO = new Set(['auditoria']);
const MAX_DIVERGENCIAS = 20;

function canonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor).filter((k) => valor[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonico(valor[k])}`).join(',')}}`;
  }
  return JSON.stringify(valor ?? null);
}

function preparar(store, row, { migracao }) {
  const { localId: _l, ...resto } = row || {};
  if (!migracao || !TOLERANCIA_MIGRACAO[store]) return resto;
  const t = TOLERANCIA_MIGRACAO[store];
  const copia = { ...resto };
  for (const campo of t.campos || []) delete copia[campo];
  if (t.legacy && copia.legacy_payload && typeof copia.legacy_payload === 'object') {
    const lp = { ...copia.legacy_payload };
    for (const campo of t.legacy) delete lp[campo];
    copia.legacy_payload = lp;
  }
  return copia;
}

const identidade = (row) => (row?.id != null ? `id:${row.id}` : row?.key != null ? `key:${row.key}` : null);

async function sha256Hex(texto) {
  const bytes = new TextEncoder().encode(texto);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Confere o conteúdo do banco contra os stores de um backup. `migracao` = o backup é de esquema anterior.
 * Devolve { ok, divergencias: [{ store, id, motivo }], impressoes: { store: { esperado, banco, registros } }, ms }.
 */
export async function conferirConteudoRestaurado(db, backupStores, { migracao = false } = {}) {
  const inicio = globalThis.performance ? globalThis.performance.now() : Date.now();
  const divergencias = [];
  const impressoes = {};
  const nomesBanco = new Set(db.tables.map((t) => t.name));
  for (const [store, linhasBackup] of Object.entries(backupStores || {})) {
    if (STORES_IGNORADAS.has(store) || !Array.isArray(linhasBackup) || !nomesBanco.has(store)) continue;
    const filtra = store === 'appSettings' ? (r) => !CHAVES_TECNICAS.some((re) => re.test(String(r?.key))) : () => true;
    const esperado = linhasBackup.filter(filtra).map((r) => preparar(store, r, { migracao }));
    const banco = (await db.table(store).toArray()).filter(filtra).map((r) => preparar(store, r, { migracao }));
    const porId = new Map();
    const semId = new Map();
    for (const r of banco) {
      const id = identidade(r);
      const c = canonico(r);
      if (id) porId.set(id, c);
      else semId.set(c, (semId.get(c) || 0) + 1);
    }
    let encontrados = 0;
    for (const r of esperado) {
      if (divergencias.length >= MAX_DIVERGENCIAS) break;
      const id = identidade(r);
      const c = canonico(r);
      if (id) {
        if (!porId.has(id)) divergencias.push({ store, id, motivo: 'registro do backup ausente no banco' });
        else if (porId.get(id) !== c) divergencias.push({ store, id, motivo: 'conteúdo diferente do backup' });
        else encontrados += 1;
      } else if ((semId.get(c) || 0) > 0) {
        semId.set(c, semId.get(c) - 1);
        encontrados += 1;
      } else {
        divergencias.push({ store, id: null, motivo: 'registro do backup ausente no banco' });
      }
    }
    const acrescimoOk = migracao && ACRESCIMO_PERMITIDO_NA_MIGRACAO.has(store);
    if (!acrescimoOk && banco.length > esperado.length && divergencias.length < MAX_DIVERGENCIAS) {
      divergencias.push({ store, id: null, motivo: `${banco.length - esperado.length} registro(s) a mais no banco` });
    }
    const ordena = (lista) => lista.map(canonico).sort().join('\n');
    impressoes[store] = { registros: esperado.length, esperado: await sha256Hex(ordena(esperado)), banco: await sha256Hex(ordena(banco)), conferidos: encontrados };
  }
  const fim = globalThis.performance ? globalThis.performance.now() : Date.now();
  return { ok: divergencias.length === 0, divergencias, impressoes, ms: Math.round(fim - inicio) };
}
