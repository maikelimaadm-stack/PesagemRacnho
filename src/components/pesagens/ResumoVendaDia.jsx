import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCurrency, fmtDateBR, fmtInt, fmtNum } from "@/components/common/formatNumber";
import { calculateCarcassTrade } from "@/modules/weighing/domain/commercialCalculations";

export default function ResumoVendaDia({ pesagens = [], dataPesagem }) {
  const vendasDia = useMemo(() => {
    return (pesagens || []).filter((p) => p.data_pesagem === dataPesagem && p.tipo_manejo === 'Saída' && p.motivo_saida === 'Venda');
  }, [pesagens, dataPesagem]);

  const stats = useMemo(() => {
    const total = vendasDia.length;
    const pesoTotal = vendasDia.reduce((s, p) => s + (Number(p.peso) || 0), 0);
    const pesoMedio = total ? pesoTotal / total : 0;

    // média da arroba informada
    const arrobasInformadas = vendasDia
      .map((v) => Number(v.valor_arroba))
      .filter((n) => !isNaN(n) && n > 0);
    const mediaArroba = arrobasInformadas.length
      ? arrobasInformadas.reduce((s, n) => s + n, 0) / arrobasInformadas.length
      : 0;

    // valor total: usar valor_venda_total se existir; senão, calcular por peso/30 * valor_arroba
    const valorTotal = vendasDia.reduce((s, v) => {
      const direto = Number(v.valor_venda_total);
      if (!isNaN(direto) && direto > 0) return s + direto;
      const calc = calculateCarcassTrade({ weight: v.peso, yieldPercent: v.rendimento_carcaca, pricePerArroba: v.valor_arroba }).estimatedValue;
      return s + (Number.isFinite(calc) ? calc : 0);
    }, 0);

    const comerciais = vendasDia.map((v) => calculateCarcassTrade({ weight: v.peso, yieldPercent: v.rendimento_carcaca, pricePerArroba: v.valor_arroba }));
    const arrobasTotal = comerciais.reduce((sum, item) => sum + (item.arrobas || 0), 0);
    const carcaçaTotal = comerciais.reduce((sum, item) => sum + (item.carcassWeightKg || 0), 0);
    const rendimentoMedio = total ? comerciais.reduce((sum, item) => sum + item.yieldPercent, 0) / total : 0;
    const mediaArrobasPeso = total ? arrobasTotal / total : 0;

    return { total, pesoTotal, pesoMedio, mediaArroba, mediaArrobasPeso, arrobasTotal, carcaçaTotal, rendimentoMedio, valorTotal };
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
