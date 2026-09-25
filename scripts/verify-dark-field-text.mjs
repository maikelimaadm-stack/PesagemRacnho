// Gate ui:dark-field-text:verify (1.4.0 / E1C item 12) — no tema escuro, o texto digitado nas fichas
// (inputs, textareas e o valor dos seletores) segue a COR do campo. A regra comum dos campos do tema claro
// (mg-layout.css, "Formulário: edição/novo") força -webkit-text-fill-color: var(--text-1) (#111827) com
// !important; sem a correção, no escuro ela vencia o `color` claro e o valor ficava escuro sobre fundo escuro
// em todas as fichas (medido: color rgb(230,237,243), fill rgb(17,24,39), fundo rgb(33,38,45)).
// Prova estrutural (fonte do CSS) + especificidade calculada: a regra do escuro vence as do claro.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/styles/modelobase1/mg-layout.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Regras "seletor { corpo }" de primeiro nível (mg-layout.css não aninha as regras dos campos).
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selectors: match[1].split(/,(?![^(]*\))/).map((item) => item.trim()).filter(Boolean), body: match[2] }));

// Especificidade [ids, classes/atributos/pseudo-classes, tipos] com :is/:not/:where do CSS Seletores 4.
function specificity(selector) {
  let text = selector;
  let total = [0, 0, 0];
  const add = (value) => { total = total.map((item, index) => item + value[index]); };
  const max = (list) => list.map(specificity).reduce((best, value) => (compare(value, best) > 0 ? value : best), [0, 0, 0]);
  // Argumentos de :is()/:not() contam pela maior especificidade; :where() conta zero.
  for (;;) {
    const match = /:(is|not|where)\(/.exec(text);
    if (!match) break;
    let depth = 1;
    let end = match.index + match[0].length;
    for (; end < text.length && depth; end += 1) { if (text[end] === '(') depth += 1; else if (text[end] === ')') depth -= 1; }
    const inner = text.slice(match.index + match[0].length, end - 1);
    if (match[1] !== 'where') add(max(inner.split(/,(?![^(]*\))/).map((item) => item.trim())));
    text = `${text.slice(0, match.index)} ${text.slice(end)}`;
  }
  add([(text.match(/#[\w-]+/g) || []).length, (text.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length, (text.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length]);
  return total;
}
function compare(left, right) {
  for (let index = 0; index < 3; index += 1) if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}

const fillOf = (body) => /-webkit-text-fill-color\s*:\s*([^;!]+)(!important)?/.exec(body);
const darkRules = rules.filter((rule) => rule.selectors.some((selector) => /html:is\(\.dark, \.tema-escuro, \.escuro\)/.test(selector)) && fillOf(rule.body));
const fix = darkRules.find((rule) => /currentColor/i.test(fillOf(rule.body)[1]) && fillOf(rule.body)[2]);
assert.ok(fix, 'existe a regra do tema escuro: -webkit-text-fill-color: currentColor !important');
const fixSelector = fix.selectors.join(', ');
for (const target of ['input', 'textarea', '.cmd-display', '.mg-lookup-display', '.mg-dp-field', '.mg-tp-field', '.emp-form-field-control', '.erp-select-trigger', '.erp-select-trigger *']) {
  assert.ok(fixSelector.includes(target), `regra do escuro cobre ${target}`);
}
for (const form of ['.mg-prototype-form--edit', '.mg-prototype-form--readonly']) assert.ok(fixSelector.includes(form), `regra do escuro vale em ${form}`);
assert.ok(fixSelector.includes('.mg-empresas-scope'), 'regra do escuro no escopo comum das fichas (.mg-empresas-scope)');

// Toda regra do CLARO que força o preenchimento com !important nos campos das fichas perde para a do escuro.
const darkSpecificity = fix.selectors.map(specificity).reduce((best, value) => (compare(value, best) < 0 ? value : best));
const lightForced = rules.filter((rule) => rule !== fix && !rule.selectors.some((selector) => /\.dark|tema-escuro|\.escuro/.test(selector)) && fillOf(rule.body)?.[2]
  && rule.selectors.some((selector) => /mg-prototype-form--(edit|readonly)/.test(selector)));
assert.ok(lightForced.length >= 2, `há regras do tema claro que forçam o preenchimento nos campos (achadas: ${lightForced.length})`);
for (const rule of lightForced) {
  for (const selector of rule.selectors.filter((item) => /mg-prototype-form--(edit|readonly)/.test(item))) {
    assert.ok(compare(darkSpecificity, specificity(selector)) > 0, `a regra do escuro (${darkSpecificity}) vence "${selector.slice(0, 90)}…" (${specificity(selector)})`);
  }
}
// O tema claro continua como era: a regra comum dos campos ainda pinta com var(--text-1).
assert.ok(lightForced.some((rule) => /var\(--text-1\)/.test(fillOf(rule.body)[1])), 'tema claro: campos com var(--text-1)');

// NEGATIVO: o cálculo de especificidade distingue os casos (sem o :not(#…) a regra do escuro perderia).
assert.ok(compare(specificity('html:is(.dark) body .mg-empresas-scope :is(.mg-prototype-form--edit) :is(input)'), specificity('.mg-empresas-scope .mg-prototype-form--edit .mg-prototype-field:not(.mg-field-locked) > input:not([disabled]):not([readonly])')) < 0, 'NEGATIVO: sem o :not(#…) a regra do escuro perde');
assert.deepEqual(specificity('#a .b c'), [1, 1, 1]);
assert.deepEqual(specificity(':where(.a) .b'), [0, 1, 0]);

console.log(JSON.stringify({ gate: 'ui:dark-field-text:verify', ok: true, darkSpecificity, lightRules: lightForced.length }, null, 2));
