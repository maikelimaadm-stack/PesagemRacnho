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

// Serialização nativa (rápida) com as chaves de cada objeto em ordem; propriedades `undefined` somem como no JSON.
const ordenaChaves = (_k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.keys(v).sort().reduce((acc, k) => { acc[k] = v[k]; return acc; }, Object.create(null))
  : v);
function canonico(valor) {
  return JSON.stringify(valor ?? null, ordenaChaves) ?? 'null';
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

const agora = () => (globalThis.performance ? globalThis.performance.now() : Date.now());
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
  const inicio = agora();
  const divergencias = [];
  const impressoes = {};
  const nomesBanco = new Set(db.tables.map((t) => t.name));
  for (const [store, linhasBackup] of Object.entries(backupStores || {})) {
    if (STORES_IGNORADAS.has(store) || !Array.isArray(linhasBackup) || !nomesBanco.has(store)) continue;
    const inicioStore = agora();
    const filtra = store === 'appSettings' ? (r) => !CHAVES_TECNICAS.some((re) => re.test(String(r?.key))) : () => true;
    // Cada registro é preparado e serializado UMA vez; comparação e impressão digital usam a mesma forma canônica.
    const serializa = (r) => { const p = preparar(store, r, { migracao }); return { id: identidade(p), c: canonico(p) }; };
    const esperado = linhasBackup.filter(filtra).map(serializa);
    const t1 = agora();
    const lidos = await db.table(store).toArray();
    const t2 = agora();
    const banco = lidos.filter(filtra).map(serializa);
    const t3 = agora();
    const porId = new Map();
    const semId = new Map();
    for (const { id, c } of banco) {
      if (id) porId.set(id, c);
      else semId.set(c, (semId.get(c) || 0) + 1);
    }
    let encontrados = 0;
    for (const { id, c } of esperado) {
      if (divergencias.length >= MAX_DIVERGENCIAS) break;
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
    porId.clear();
    semId.clear();
    const acrescimoOk = migracao && ACRESCIMO_PERMITIDO_NA_MIGRACAO.has(store);
    if (!acrescimoOk && banco.length > esperado.length && divergencias.length < MAX_DIVERGENCIAS) {
      divergencias.push({ store, id: null, motivo: `${banco.length - esperado.length} registro(s) a mais no banco` });
    }
    // Impressão: canônicos ordenados pela identidade (curta) — ou pelo próprio canônico, sem identidade. Se a store
    // conferiu inteira (mesmos registros, mesmo conteúdo), banco e backup são o mesmo multiconjunto: uma conta só.
    const chave = (x) => x.id ?? `~${x.c}`;
    const impressao = (lista) => sha256Hex(lista.slice().sort((a, b) => (chave(a) < chave(b) ? -1 : chave(a) > chave(b) ? 1 : 0)).map((x) => x.c).join('\n'));
    const t4 = agora();
    const hashEsperado = await impressao(esperado);
    const identicos = encontrados === esperado.length && banco.length === esperado.length;
    impressoes[store] = { registros: esperado.length, esperado: hashEsperado, banco: identicos ? hashEsperado : await impressao(banco), conferidos: encontrados, ms: Math.round(agora() - inicioStore),
      etapas: { serializaBackup: Math.round(t1 - inicioStore), leitura: Math.round(t2 - t1), serializaBanco: Math.round(t3 - t2), compara: Math.round(t4 - t3), impressao: Math.round(agora() - t4) } };
  }
  return { ok: divergencias.length === 0, divergencias, impressoes, ms: Math.round(agora() - inicio) };
}
