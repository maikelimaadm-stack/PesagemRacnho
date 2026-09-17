import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateBR, fmtInt, fmtNum } from "@/components/common/formatNumber";
import { sum } from "@/modules/reporting/domain/aggregateEngine";

export default function ResumoLotes({ apartacaoSelecionada, apartacoes, lotesApartacaoAtual, pesagens, pesagensDia, dataPesagem }) {
  const [modoVisualizacao, setModoVisualizacao] = useState('dia');

  const resumoLotes = useMemo(() => {
    if (!apartacaoSelecionada || !lotesApartacaoAtual || lotesApartacaoAtual.length === 0) return [];
    let todasPesagensApartacao;
    if (modoVisualizacao === 'dia') {
      todasPesagensApartacao = (pesagensDia || []).filter((p) => p.apartacao_id === apartacaoSelecionada);
    } else {
      todasPesagensApartacao = (pesagens || []).filter((p) => p.apartacao_id === apartacaoSelecionada);
    }
    return lotesApartacaoAtual.map((lote) => {
    const animaisLote = todasPesagensApartacao.filter((p) => p.lote_id === lote.id);
    const qtd = animaisLote.length;
    const pesoTotal = animaisLote.reduce((s, p) => s + (p.peso || 0), 0);
    const pesoMedio = qtd > 0 ? pesoTotal / qtd : 0;
    // Arrobas só as registradas no fato (1 @ = 15 kg de carcaça, com rendimento válido); sem nenhuma → null ("—").
    const arrobasTotal = sum(animaisLote, "quantidade_arrobas").value;
    return { ...lote, quantidade_atual: qtd, peso_total: pesoTotal, peso_medio: pesoMedio, arrobas_total: arrobasTotal };
    }).sort((a, b) => (a.nome_lote || '').localeCompare(b.nome_lote || ''));
  }, [apartacaoSelecionada, lotesApartacaoAtual, pesagens, pesagensDia, modoVisualizacao]);

  return (
    <div className="d17d-summary-column">
      <Card className="d17d-summary-panel sticky top-2">
        <CardHeader className="d17d-summary-panel__header py-2 px-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="d17d-summary-panel__title text-xs font-semibold">Distribuição de Lotes</CardTitle>
          {apartacaoSelecionada && resumoLotes.length > 0 &&
            <div className="d17d-summary-panel__modes flex gap-1" role="group" aria-label="Período do resumo">
              <Button variant={modoVisualizacao === 'dia' ? 'default' : 'outline'} size="sm" className="d17d-summary-panel__mode h-6 text-[10px] px-2" data-active={modoVisualizacao === 'dia' ? 'true' : 'false'} aria-pressed={modoVisualizacao === 'dia'} onClick={() => setModoVisualizacao('dia')}>Dia</Button>
              <Button variant={modoVisualizacao === 'total' ? 'default' : 'outline'} size="sm" className="d17d-summary-panel__mode h-6 text-[10px] px-2" data-active={modoVisualizacao === 'total' ? 'true' : 'false'} aria-pressed={modoVisualizacao === 'total'} onClick={() => setModoVisualizacao('total')}>Total</Button>
            </div>
          }
        </CardHeader>
        <CardContent className="p-2">
          {apartacaoSelecionada && resumoLotes.length > 0 ? (
            <>
              <div className="d17d-summary-panel__context text-center mb-2 py-2 rounded">
                <span className="font-bold">
                  {apartacoes?.find((a) => a.id === apartacaoSelecionada)?.nome_apartacao || 'Apartação'}
                </span>
                <div className="text-[10px]">
                  {modoVisualizacao === 'dia' ? `Pesagens do dia (${fmtDateBR(dataPesagem)})` : 'Todas as pesagens'}
                </div>
              </div>
              <Table>
              <TableHeader><TableRow><TableHead className="text-[10px]">Lote</TableHead><TableHead className="text-[10px] text-right">Qtd.</TableHead><TableHead className="text-[10px] text-right">Peso Médio</TableHead><TableHead className="text-[10px] text-right">@ carcaça est.</TableHead></TableRow></TableHeader>
                <TableBody>
                  {resumoLotes.map((lote) => {
                    const cheio = lote.fechado || lote.quantidade_atual >= (lote.quantidade_maxima || 999999);
                    return (
                      <TableRow key={lote.id} className={cheio ? "bg-red-50" : ""}>
                        <TableCell className={`text-xs font-medium ${cheio ? "text-red-700" : ""}`}>{lote.nome_lote} {cheio && "[FECHADO]"}</TableCell>
                        <TableCell className={`text-xs text-right ${cheio ? "text-red-700 font-bold" : ""}`}>{fmtInt(lote.quantidade_atual)}/{fmtInt(lote.quantidade_maxima || 0)}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtNum(lote.peso_medio)}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtNum(lote.arrobas_total)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="d17d-summary-panel__totals mt-2 pt-2 border-t text-xs text-center text-slate-500">
                Qtd. lançada: {fmtInt(resumoLotes.reduce((s, l) => s + (l.quantidade_atual || 0), 0))} | Arrobas estimadas de carcaça: {fmtNum(sum(resumoLotes, "arrobas_total").value)}
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs">
              {apartacaoSelecionada ? 'Nenhum lote cadastrado nesta apartação' : 'Selecione uma apartação para ver os lotes'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
