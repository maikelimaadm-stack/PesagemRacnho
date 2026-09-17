import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCurrency, fmtDateBR, fmtInt, fmtNum } from "@/components/common/formatNumber";
import { calculateCarcassTrade } from "@/modules/weighing/domain/commercialCalculations";
import { avg, sum, toFiniteNumber, weightedAvg } from "@/modules/reporting/domain/aggregateEngine";

export default function ResumoVendaDia({ pesagens = [], dataPesagem }) {
  const vendasDia = useMemo(() => {
    return (pesagens || []).filter((p) => p.data_pesagem === dataPesagem && p.tipo_manejo === 'Saída' && p.motivo_saida === 'Venda');
  }, [pesagens, dataPesagem]);

  // Contas pelo motor canônico: ausente ≠ 0; preço médio da @ ponderado pelas arrobas;
  // carcaça/arrobas só com rendimento válido (1 @ = 15 kg de carcaça, sem 50 % implícito).
  const stats = useMemo(() => {
    const comerciais = vendasDia.map((v) => {
      const calc = calculateCarcassTrade({ weight: v.peso, yieldPercent: v.rendimento_carcaca, pricePerArroba: v.valor_arroba });
      const informado = toFiniteNumber(v.valor_venda_total);
      return { ...calc, valor: informado != null && informado > 0 ? informado : calc.estimatedValue, valor_arroba: toFiniteNumber(v.valor_arroba) };
    });
    const total = vendasDia.length;
    const arrobasTotal = sum(comerciais, 'arrobas').value;
    return {
      total,
      pesoTotal: sum(vendasDia, 'peso').value,
      pesoMedio: avg(vendasDia, 'peso').value,
      mediaArroba: weightedAvg(comerciais, { value: 'valor_arroba', weight: 'arrobas' }).value,
      mediaArrobasPeso: avg(comerciais, 'arrobas').value,
      arrobasTotal,
      carcaçaTotal: sum(comerciais, 'carcassWeightKg').value,
      rendimentoMedio: weightedAvg(comerciais, { value: 'yieldPercent', weight: 'liveWeightKg' }).value,
      valorTotal: sum(comerciais, 'valor').value,
    };
  }, [vendasDia]);

  return (
    <div className="d17d-summary-column">
      <Card className="d17d-summary-panel sticky top-2">
        <CardHeader className="d17d-summary-panel__header py-2 px-3 border-b">
          <CardTitle className="text-xs font-semibold">
            Resumo de Vendas
            <span className="text-[10px] text-slate-600 ml-2">({fmtDateBR(dataPesagem)})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {stats.total > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Métrica</TableHead>
                  <TableHead className="text-[10px] text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="hover:bg-gray-50">
                  <TableCell className="text-xs">Animais vendidos</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmtInt(stats.total)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-gray-50">
                  <TableCell className="text-xs">Peso total (kg)</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmtNum(stats.pesoTotal)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-gray-50">
                  <TableCell className="text-xs">Peso médio (kg)</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmtNum(stats.pesoMedio)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-gray-50">
                  <TableCell className="text-xs">Peso estimado de carcaça (kg)</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmtNum(stats.carcaçaTotal)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-gray-50">
                  <TableCell className="text-xs">Rendimento médio de carcaça (%)</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmtNum(stats.rendimentoMedio)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-gray-50">
                  <TableCell className="text-xs">Arrobas de carcaça estimadas</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmtNum(stats.arrobasTotal)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-gray-50">
                  <TableCell className="text-xs">Média de arrobas de carcaça</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmtNum(stats.mediaArrobasPeso)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-gray-50">
                  <TableCell className="text-xs">Preço médio por arroba de carcaça</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmtCurrency(stats.mediaArroba)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-gray-50">
                  <TableCell className="text-xs">Valor total (R$)</TableCell>
                  <TableCell className="text-xs text-right font-mono">{fmtCurrency(stats.valorTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs">
              Nenhuma venda registrada neste dia
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
