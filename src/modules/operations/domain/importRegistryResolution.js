// Resolução de marca/raça das linhas de importação contra os cadastros mestres
// (IMPORT-TARGET-MODEL §2.2 passo 3; S-01.5 "Lançamento seleciona cadastros").
// Regra pura, sem banco: quem carrega os cadastros e devolve `texto → id` é o
// resolvedor único (catalog/application/catalogResolver.resolveMany). Aqui só
// se decide o destino de cada linha:
//   - marca/raça cadastrada → linha elegível com `marca_id`/`raca_id`;
//   - texto vazio → elegível sem id (o adapter aplica a marca padrão da empresa);
//   - texto NÃO cadastrado → rejeitada (erro por linha) — a linha só segue
//     quando o responsável marcou explicitamente "criar estes cadastros ao
//     importar" (`criarDesconhecidos`), e mesmo assim o id fica nulo até os
//     cadastros existirem. Nenhuma criação silenciosa.
import { normalizeName } from '../../catalog/domain/normalize.js';

export const IMPORT_REGISTRY_GROUPS = Object.freeze({
  marcas: Object.freeze({ campo: 'marca', idField: 'marca_id', rotulo: 'Marca' }),
  racas: Object.freeze({ campo: 'raca', idField: 'raca_id', rotulo: 'Raça' }),
});

const cleanText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

/** Textos distintos (não vazios, por nome normalizado) de marca e raça das linhas — entrada do resolveMany. */
export function collectRegistryTexts(rows = []) {
  const result = { marcas: [], racas: [] };
  const vistos = { marcas: new Set(), racas: new Set() };
  for (const row of rows) {
    for (const [grupo, def] of Object.entries(IMPORT_REGISTRY_GROUPS)) {
      const texto = cleanText(row?.[def.campo]);
      const chave = normalizeName(texto);
      if (!chave || vistos[grupo].has(chave)) continue;
      vistos[grupo].add(chave);
      result[grupo].push(texto);
    }
  }
  return result;
}

// `resolved[grupo]` = { textoOriginal: id } (saída de resolveMany); indexa por nome normalizado.
function indexResolved(resolved, grupo) {
  const index = new Map();
  for (const [texto, id] of Object.entries(resolved?.[grupo] || {})) {
    const chave = normalizeName(texto);
    if (chave && id) index.set(chave, id);
  }
  return index;
}

/**
 * splitImportRowsByRegistry(rows, resolved, { criarDesconhecidos }) →
 * {
 *   elegiveis:    linhas com `marca_id`/`raca_id` (null quando texto vazio ou pendente de criação),
 *   rejeitadas:   [{ linha, erro, row }] — texto não cadastrado sem opção de criar,
 *   desconhecidos: { marcas: [texto], racas: [texto] } — únicos por nome normalizado, na ordem de entrada,
 *   pendentes:    quantas linhas dependem de cadastros ainda não existentes.
 * }
 * `row.linha` (número da linha do arquivo) é usado na mensagem quando existe.
 */
export function splitImportRowsByRegistry(rows = [], resolved = {}, { criarDesconhecidos = false } = {}) {
  const indices = Object.fromEntries(Object.keys(IMPORT_REGISTRY_GROUPS).map((grupo) => [grupo, indexResolved(resolved, grupo)]));
  const desconhecidos = { marcas: [], racas: [] };
  const vistos = { marcas: new Set(), racas: new Set() };
  const elegiveis = [];
  const rejeitadas = [];
  let pendentes = 0;

  rows.forEach((row, index) => {
    const ids = {};
    const faltantes = [];
    for (const [grupo, def] of Object.entries(IMPORT_REGISTRY_GROUPS)) {
      const texto = cleanText(row?.[def.campo]);
      const chave = normalizeName(texto);
      if (!chave) {
        ids[def.idField] = null;
        continue;
      }
      const id = indices[grupo].get(chave) ?? null;
      ids[def.idField] = id;
      if (!id) {
        faltantes.push(`${def.rotulo} "${texto}"`);
        if (!vistos[grupo].has(chave)) {
          vistos[grupo].add(chave);
          desconhecidos[grupo].push(texto);
        }
      }
    }
    if (faltantes.length) {
      pendentes += 1;
      if (!criarDesconhecidos) {
        const linha = Number.isFinite(Number(row?.linha)) ? Number(row.linha) : index + 1;
        const animal = row?.numero_animal ? `Animal ${row.numero_animal}: ` : '';
        rejeitadas.push({ linha, erro: `${animal}${faltantes.join(' e ')} não cadastrada. Cadastre antes de importar ou marque "Criar estes cadastros ao importar".`, row });
        return;
      }
    }
    elegiveis.push({ ...row, ...ids });
  });

  return { elegiveis, rejeitadas, desconhecidos, pendentes };
}

/** Quantidade total de textos desconhecidos (marcas + raças). */
export function countUnknownRegistries(desconhecidos = {}) {
  return Object.values(desconhecidos).reduce((total, lista) => total + (Array.isArray(lista) ? lista.length : 0), 0);
}
