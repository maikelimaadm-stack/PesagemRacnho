import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtCurrency, fmtInt, fmtNum } from '@/components/common/formatNumber';
import { RESUMO_FIELDS } from './ConfigurarResumosDialog';

function scopeRows(item, pesagens, dataPesagem, apartacaoSelecionada) {
  const dia = (pesagens || []).filter((row) => row.data_pesagem === dataPesagem);
  if (item.scope === 'historico') return pesagens || [];
  if (item.scope === 'apartacao') return dia.filter((row) => row.apartacao_id === apartacaoSelecionada);
  if (item.scope === 'cadastro') return dia.filter((row) => row.tipo_manejo === 'Cadastro');
  if (item.scope === 'manejo') return dia.filter((row) => row.tipo_manejo === 'Manejo');
  if (item.scope === 'saida') return dia.filter((row) => row.tipo_manejo === 'Saída');
  if (item.scope === 'venda') return dia.filter((row) => row.tipo_manejo === 'Saída' && row.motivo_saida === 'Venda');
  if (item.scope === 'abate') return dia.filter((row) => row.tipo_manejo === 'Saída' && row.motivo_saida === 'Abate');
  return dia;
}
function sum(rows, field) { return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0); }
function calculate(item, rows) {
  if (item.operation === 'count') return rows.length;
  const values = rows.map((row) => Number(row[item.field])).filter(Number.isFinite);
  if (!values.length) return 0;
  if (item.operation === 'sum') return values.reduce((total, value) => total + value, 0);
  if (item.operation === 'average') return values.reduce((total, value) => total + value, 0) / values.length;
  if (item.operation === 'min') return Math.min(...values);
  if (item.operation === 'max') return Math.max(...values);
  if (item.operation === 'difference') return Math.max(...values) - Math.min(...values);
  if (item.operation === 'ratio') { const divisor = sum(rows, item.divisorField); return divisor ? sum(rows, item.field) / divisor : 0; }
  return 0;
}

export default function ResumoPersonalizado({ configuracoes = [], pesagens = [], dataPesagem, apartacaoSelecionada }) {
  const linhas = useMemo(() => configuracoes.map((item) => {
    const rows = scopeRows(item, pesagens, dataPesagem, apartacaoSelecionada);
    const kind = item.operation === 'count' ? 'integer' : RESUMO_FIELDS.find((field) => field.id === item.field)?.kind || 'number';
    const groupField = item.groupBy && item.groupBy !== 'none' ? item.groupBy : null;
    const groups = groupField ? Object.entries(rows.reduce((acc, row) => { const key = String(row[groupField] || 'Não informado'); (acc[key] ||= []).push(row); return acc; }, {})).map(([label, groupRows]) => ({ label, value: calculate(item, groupRows), records: groupRows.length })) : [];
    return { ...item, value: calculate(item, rows), kind, records: rows.length, groups };
  }), [configuracoes, pesagens, dataPesagem, apartacaoSelecionada]);
  const formatValue = (line) => line.kind === 'currency' ? fmtCurrency(line.value) : line.kind === 'integer' ? fmtInt(line.value) : fmtNum(line.value);
  return <div className="d17d-summary-column"><Card className="d17d-summary-panel sticky top-2"><CardHeader className="d17d-summary-panel__header py-2 px-3 border-b"><CardTitle className="text-xs font-semibold">Resumo Personalizado</CardTitle></CardHeader><CardContent className="p-2">
    {linhas.length ? <Table><TableHeader><TableRow><TableHead className="text-[10px]">Métrica</TableHead><TableHead className="text-[10px] text-right">Resultado</TableHead></TableRow></TableHeader><TableBody>{linhas.flatMap((line) => [<TableRow key={line.id}><TableCell><div className="d17d-rule-summary"><strong>{line.label}</strong><small>{fmtInt(line.records)} registro(s)</small></div></TableCell><TableCell className="text-right font-mono font-semibold">{formatValue(line)}</TableCell></TableRow>, ...line.groups.map((group) => <TableRow key={`${line.id}:${group.label}`} className="d17d-summary-group-row"><TableCell><div className="d17d-rule-summary"><strong>{group.label}</strong><small>{fmtInt(group.records)} registro(s)</small></div></TableCell><TableCell className="text-right font-mono">{formatValue({ ...line, value: group.value })}</TableCell></TableRow>)])}</TableBody></Table> : <div className="text-center py-6 text-slate-400 text-xs">Configure as métricas do seu resumo.</div>}
  </CardContent></Card></div>;
}
