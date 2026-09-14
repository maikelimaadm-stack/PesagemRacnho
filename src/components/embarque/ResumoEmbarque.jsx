import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtInt, fmtNum } from "@/components/common/formatNumber";

export default function ResumoEmbarque({ embarques, documentos, embarqueSelecionado, pesagens }) {
  const docs = useMemo(() => documentos.filter(d => d.embarque_id === embarqueSelecionado), [documentos, embarqueSelecionado]);
  const allPesagens = useMemo(() => pesagens || [], [pesagens]);

  const linhas = useMemo(() => {
    return docs.map(d => {
      const embarcadosDoc = allPesagens.filter(p => p.documento_embarque_id === d.id);
      const machos = embarcadosDoc.filter(p => p.sexo === 'M').length;
      const femeas = embarcadosDoc.filter(p => p.sexo === 'F').length;
      const pesoTotal = embarcadosDoc.reduce((s, p) => s + (p.peso || 0), 0);
      const pesoMedio = embarcadosDoc.length ? pesoTotal / embarcadosDoc.length : 0;
      return {
        id: d.id,
        gta: d.numero_gta || '-',
        nfe: d.numero_nfe || '-',
        prevM: d.qtd_prev_machos || 0,
        prevF: d.qtd_prev_femeas || 0,
        embM: machos, // mantido para o rodapé
        embF: femeas, // mantido para o rodapé
        pesoTotal,
        pesoMedio
      };
    });
  }, [docs, allPesagens]);

  const totais = useMemo(() => {
    return linhas.reduce((acc, l) => ({
      prevM: acc.prevM + l.prevM,
      prevF: acc.prevF + l.prevF,
      embM: acc.embM + l.embM,
      embF: acc.embF + l.embF
    }), { prevM: 0, prevF: 0, embM: 0, embF: 0 });
  }, [linhas]);

  return (
    <div className="d17d-summary-column">
      <Card className="d17d-summary-panel sticky top-2">
        <CardHeader className="d17d-summary-panel__header py-2 px-3 border-b">
          <CardTitle className="text-xs font-semibold">Documentação / Embarque</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {docs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">Selecione um embarque para ver os documentos</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">GTA</TableHead>
                    <TableHead className="text-[10px]">NF-e</TableHead>
                    <TableHead className="text-[10px] text-center">Prev M/F</TableHead>
                    <TableHead className="text-[10px] text-right">Peso Total</TableHead>
                    <TableHead className="text-[10px] text-right">Peso Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map(l => (
                    <TableRow key={l.id} className="hover:bg-gray-50">
                      <TableCell className="text-xs py-1">{l.gta}</TableCell>
                      <TableCell className="text-xs py-1">{l.nfe}</TableCell>
                      <TableCell className="text-xs py-1 text-center">{fmtInt(l.prevM)}/{fmtInt(l.prevF)}</TableCell>
                      <TableCell className="text-xs py-1 text-right font-mono">{fmtNum(l.pesoTotal)}</TableCell>
                      <TableCell className="text-xs py-1 text-right font-mono">{fmtNum(l.pesoMedio)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-2 pt-2 border-t text-xs text-center text-slate-600">
                Previsto: {fmtInt(totais.prevM)}/{fmtInt(totais.prevF)} • Embarcado: {fmtInt(totais.embM)}/{fmtInt(totais.embF)} • Falta: {fmtInt(Math.max(0, totais.prevM - totais.embM))}/{fmtInt(Math.max(0, totais.prevF - totais.embF))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
