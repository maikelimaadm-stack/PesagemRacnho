import React from "react";

// Destaque do termo pesquisado (porte de
// PROJETOMG-main/src/framework/mak/layout/mgSearchHighlight.jsx).

export const normalizeSearchQuery = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSearchHighlightRegex = (query) => {
  const term = normalizeSearchQuery(query);
  if (!term) return null;
  const parts = term.split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (parts.length === 0) return null;
  return new RegExp(parts.join("\\s+"), "gi");
};

/** Destaca trechos que contêm o termo (sem distinguir caixa nem acentos). */
export function renderSearchHighlight(text, query) {
  const source = text == null || text === "—" ? "" : String(text);
  const regex = buildSearchHighlightRegex(query);
  if (!regex || !source) return source || "—";

  // Compara sobre a forma normalizada para casar acentos, mas exibe o original.
  const normalized = source.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (normalized.length !== source.length) {
    return normalized.toLowerCase().includes(normalizeSearchQuery(query)) ? <mark className="mg-search-dropdown__mark">{source}</mark> : source;
  }

  const nodes = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of normalized.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(source.slice(lastIndex, start));
    nodes.push(<mark key={`m-${key++}`} className="mg-search-dropdown__mark">{source.slice(start, start + match[0].length)}</mark>);
    lastIndex = start + match[0].length;
  }
  if (lastIndex < source.length) nodes.push(source.slice(lastIndex));
  return nodes.length > 0 ? nodes : source;
}
