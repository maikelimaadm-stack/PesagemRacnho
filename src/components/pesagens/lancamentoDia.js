// Contas da tela de Lançamento sobre a lista de pesagens já carregada: a grade
// do dia (ordem, filtros de coluna, nº do registro), os resumos por documento /
// embarque e a escolha automática de lote. Funções puras, sem React, para a tela
// só montar o que mostrar (e para os testes de test:unit).
import { isMakColumnFilterActive, matchesMakColumnFilter } from "@/components/mak/MakColumnMenu";

const NUMBER_COLUMN_IDS = new Set(["numero_registro", "peso", "peso_anterior", "valor_pago_cabeca", "valor_venda_total", "valor_arroba", "quantidade_arrobas", "doc_qtd", "dias", "ganho", "gmd"]);
const DATE_COLUMN_IDS = new Set(["data_pesagem", "data_anterior"]);

export const getColumnFilterType = (id) => DATE_COLUMN_IDS.has(id) ? "date" : NUMBER_COLUMN_IDS.has(id) ? "number" : "text";

const TEXT_SORT_COLUMNS = new Set(["numero_animal", "sexo", "raca", "marca", "nome_apartacao", "nome_lote"]);
const criadoEm = (entry) => new Date(entry.created_date || 0);

function sortValue(entry, column) {
  if (TEXT_SORT_COLUMNS.has(column)) return entry[column] || "";
  if (column === "peso") return entry.peso || 0;
  if (column === "numero_registro") return entry._numero_registro;
  return criadoEm(entry);
}

/**
 * Grade do dia: pesagens da data, numeradas pela ordem de lançamento
 * (_numero_registro), ordenadas pela coluna escolhida e filtradas pelos
 * filtros de coluna ativos.
 */
export function buildDayEntries(entries, { date, sortColumn = "created_date", sortDirection = "asc", columnFilters = {} } = {}) {
  let rows = entries
    .filter((entry) => entry.data_pesagem === date)
    .sort((a, b) => criadoEm(a) - criadoEm(b))
    .map((entry, index) => ({ ...entry, _numero_registro: index + 1 }));

  rows.sort((a, b) => {
    const valA = sortValue(a, sortColumn);
    const valB = sortValue(b, sortColumn);
    if (typeof valA === "string") {
      return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortDirection === "asc" ? valA - valB : valB - valA;
  });

  const activeFilters = Object.entries(columnFilters).filter(([, value]) => isMakColumnFilterActive(value));
  if (activeFilters.length) {
    rows = rows.filter((row) => activeFilters.every(([field, value]) => {
      const target = field === "numero_registro" ? row._numero_registro : row[field];
      return matchesMakColumnFilter(target, value, getColumnFilterType(field));
    }));
  }
  return rows;
}

/** Último lançamento da data (mais recente por created_date), sem filtros de coluna. */
export function latestEntryOfDay(entries, date) {
  return entries
    .filter((entry) => entry.data_pesagem === date)
    .sort((a, b) => criadoEm(b) - criadoEm(a))[0] || null;
}

/** Totais de uma lista: cabeças, machos, fêmeas, peso total e médio. */
export function summarizeEntries(entries) {
  const total = entries.length;
  const machos = entries.filter((entry) => entry.sexo === "M").length;
  const femeas = entries.filter((entry) => entry.sexo === "F").length;
  const pesoTotal = entries.reduce((sum, entry) => sum + (entry.peso || 0), 0);
  const pesoMedio = total > 0 ? pesoTotal / total : 0;
  return { total, machos, femeas, pesoTotal, pesoMedio };
}

/** Quantas pesagens de cada documento de embarque há na lista. */
export function countByShipmentDocument(entries) {
  const counts = {};
  entries.forEach((entry) => {
    const id = entry.documento_embarque_id;
    if (id) counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}

/** Linhas Doc/GTA/NF-e/previstos/peso dos documentos de um embarque (Abate). */
export function summarizeShipmentDocuments(documents, entries) {
  return documents.map((doc) => {
    const ofDoc = entries.filter((entry) => entry.documento_embarque_id === doc.id);
    const pesoTotal = ofDoc.reduce((sum, entry) => sum + (entry.peso || 0), 0);
    return {
      id: doc.id,
      gta: doc.numero_gta || "-",
      nfe: doc.numero_nfe || "-",
      prevM: doc.qtd_prev_machos || 0,
      prevF: doc.qtd_prev_femeas || 0,
      pesoTotal,
      pesoMedio: ofDoc.length ? pesoTotal / ofDoc.length : 0,
    };
  });
}

/** Lote fechado, ou já com a quantidade máxima de animais lançados nele. */
export function isLotFull(lote, entries) {
  if (!lote) return false;
  if (lote.fechado) return true;
  const animaisNoLote = entries.filter((entry) => entry.lote_id === lote.id).length;
  return animaisNoLote >= (lote.quantidade_maxima || 999999);
}

/** Lotes da apartação cuja faixa de peso aceita o peso e que ainda têm vaga. */
export function lotCandidates(lots, entries, weight) {
  if (!Number.isFinite(weight)) return [];
  return lots.filter((lote) =>
    weight >= lote.peso_minimo && weight <= lote.peso_maximo && !lote.fechado && !isLotFull(lote, entries)
  );
}

/**
 * Lote automático: o primeiro candidato. Com o atalho de lote ligado e mais de um
 * candidato (empate de faixa), não escolhe sozinho: o usuário usa F11/F12/…
 */
export function automaticLot(lots, entries, weight, { shortcutEnabled = false } = {}) {
  const candidates = lotCandidates(lots, entries, weight);
  if (!candidates.length) return null;
  if (shortcutEnabled && candidates.length > 1) return null;
  return candidates[0];
}
