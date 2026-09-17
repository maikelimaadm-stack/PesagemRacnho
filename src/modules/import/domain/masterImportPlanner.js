// Planejador puro da importação de cadastros mestres (tipo MESTRES): cada célula preenchida
// de Marca, Raça, Causa da morte ou Categoria vira um item do plano (uma linha do arquivo
// pode gerar mais de um item). Duplicado por nome normalizado → JÁ EXISTE (inclusive
// repetição dentro do próprio arquivo). A validação é a do próprio cadastro
// (registryDefinitions.validar), a mesma que o serviço aplicará ao criar.
import { normalizeName } from '../../catalog/domain/normalize.js';
import { getRegistryDefinition } from '../../catalog/domain/registryDefinitions.js';
import { ROW_STATUS } from './importConstants.js';
import { summarizePlan } from './importPlanner.js';
import { cleanImportText, parseImportDecimal, parseSexo } from './importValues.js';

export const MASTER_IMPORT_STORES = Object.freeze([
  Object.freeze({ field: 'marca', store: 'marcas', rotulo: 'Marca' }),
  Object.freeze({ field: 'raca', store: 'racas', rotulo: 'Raça' }),
  Object.freeze({ field: 'causa_morte', store: 'causasMorte', rotulo: 'Causa da morte' }),
  Object.freeze({ field: 'categoria', store: 'categoriasAnimal', rotulo: 'Categoria' }),
]);

const rawText = (value) => (value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim());

/**
 * buildMasterImportPlan({ file, headerByField, rules, fileErrors, existing }) → ImportPlan
 * existing = { marcas: [rows], racas: [...], causasMorte: [...], categoriasAnimal: [...] } (da empresa).
 */
export function buildMasterImportPlan({ file, headerByField, rules, fileErrors = [], existing = {} }) {
  const existingNames = Object.fromEntries(MASTER_IMPORT_STORES.map(({ store }) => [
    store,
    new Set((existing[store] || []).filter((row) => row && !row.deleted_at).map((row) => row.nome_normalizado || normalizeName(row.nome))),
  ]));
  const seen = new Map();
  const ignoredLines = new Set(rules.ignoredLines);
  const planRows = [];
  for (const fileRow of file.rows) {
    const get = (fieldId) => {
      const header = headerByField.get(fieldId);
      return header === undefined ? null : rawText(fileRow.values[header]);
    };
    for (const { field, store, rotulo } of MASTER_IMPORT_STORES) {
      const nome = cleanImportText(get(field));
      if (!nome) continue;
      const key = normalizeName(nome);
      const row = {
        line: fileRow.line,
        status: null,
        eventType: null,
        identity: { key: `${store}:${key}`, animalId: null, isNew: false, label: `${rotulo}: ${nome}`, via: null },
        data: null,
        peso: null,
        categoria: { id: null, nome: null, origem: null },
        messages: [],
        sheetDerived: { peso_anterior: null, data_anterior: null, dias: null, ganho: null, gmd: null },
        derived: { data_anterior: null, peso_anterior: null, dias: null, ganho: null, gmd: null },
        matchedEventId: null,
        matchedImportacaoId: null,
        payload: null,
        master: { store, rotulo, nome, dados: { nome, empresa_id: rules.empresaId } },
      };
      planRows.push(row);
      if (ignoredLines.has(fileRow.line)) {
        row.status = ROW_STATUS.IGNORADA;
        row.messages.push('Linha ignorada por escolha do usuário.');
        continue;
      }
      if (existingNames[store].has(key)) {
        row.status = ROW_STATUS.JA_EXISTE;
        row.messages.push(`${rotulo} "${nome}" já cadastrada.`);
        continue;
      }
      const seenLine = seen.get(`${store}|${key}`);
      if (seenLine !== undefined) {
        row.status = ROW_STATUS.JA_EXISTE;
        row.messages.push(`${rotulo} "${nome}" já listada na linha ${seenLine}.`);
        continue;
      }
      seen.set(`${store}|${key}`, fileRow.line);
      if (store === 'categoriasAnimal') {
        const errors = [];
        const sexo = parseSexo(get('sexo'));
        if (sexo.error) errors.push(sexo.error);
        const numbers = {};
        for (const [fieldId, label] of [['peso_min_kg', 'Peso mínimo'], ['peso_max_kg', 'Peso máximo'], ['era', 'Era'], ['ordem', 'Ordem']]) {
          const parsed = parseImportDecimal(get(fieldId), rules.effectiveDecimal);
          if (parsed.error) errors.push(`${label}: ${parsed.error}`);
          numbers[fieldId] = parsed.value;
        }
        Object.assign(row.master.dados, { sexo_aplicavel: sexo.value, ...numbers });
        row.messages.push(...errors);
      }
      const invalid = getRegistryDefinition(store).validar(row.master.dados);
      row.messages = [...row.messages, ...invalid].map((message) => `${rotulo} "${nome}": ${message}`);
      row.status = row.messages.length ? ROW_STATUS.ERRO : ROW_STATUS.NOVO;
      if (row.status === ROW_STATUS.NOVO) row.messages.push(`${rotulo} "${nome}" será criada.`);
    }
  }
  const work = { missingMasters: new Map(), counters: { categoriasAutomaticasResolvidas: 0, categoriasNaoResolvidas: 0, seriesAfetadas: 0, eventosRecalculados: 0 } };
  const plan = summarizePlan({ type: 'MESTRES', rules, fileErrors, planRows, animals: [], work });
  plan.summary.linhasLidas = file.rows.length;
  return plan;
}
