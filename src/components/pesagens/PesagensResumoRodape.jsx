import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtInt, fmtNum } from "@/components/common/formatNumber";

export default function PesagensResumoRodape({ estatisticas, tipoManejo, motivoSaida, documentoSelecionado, resumoDoc, resumoEmbarque, pesagensDia, exportarExcel, pagination }) {
  const [mostrarMediaMarcas, setMostrarMediaMarcas] = useState(false);

  const resumoMarcasDia = useMemo(() => {
    const mapa = pesagensDia.reduce((acc, item) => {
      const chave = String(item.marca || '').trim() || 'Sem marca';
      if (!acc[chave]) {
        acc[chave] = { quantidade: 0, pesoTotal: 0 };
      }
      acc[chave].quantidade += 1;
      acc[chave].pesoTotal += Number(item.peso || 0);
      return acc;
    }, {});

    return Object.entries(mapa)
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
      .map(([marcaNome, dados]) => ({
        marcaNome,
        quantidade: dados.quantidade,
        pesoMedio: dados.quantidade > 0 ? dados.pesoTotal / dados.quantidade : 0,
      }));
  }, [pesagensDia]);

  return (
    <div className="d17d-table-summary flex items-center justify-between bg-white rounded px-3 py-2 gap-3">
      <div className="space-y-1 min-w-0">
        <div className="d17d-table-summary__metrics flex items-center gap-6 text-xs flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Lançamentos do dia</span>
            <span className="font-bold">{fmtInt(estatisticas.total)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Total Machos</span>
            <span className="font-bold">{fmtInt(estatisticas.machos)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Total Fêmeas</span>
            <span className="font-bold">{fmtInt(estatisticas.femeas)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Peso médio dos lançamentos</span>
            <span className="font-bold">{fmtNum(estatisticas.pesoMedio)}</span>
          </div>
          {tipoManejo === 'Saída' && motivoSaida === 'Abate' &&
          <div className="flex items-center gap-1 ml-4">
              <span className="text-slate-500">{documentoSelecionado ? 'Doc Selecionado' : 'Embarque Selecionado'}</span>
              <span className="font-bold text-lg text-amber-500">{fmtInt(documentoSelecionado ? resumoDoc.total : resumoEmbarque.total)}</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-500">M</span>
              <span className="font-bold text-lg text-amber-500">{fmtInt(documentoSelecionado ? resumoDoc.machos : resumoEmbarque.machos)}</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-500">F</span>
              <span className="font-bold text-lg text-amber-500">{fmtInt(documentoSelecionado ? resumoDoc.femeas : resumoEmbarque.femeas)}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">Média</span>
              <span className="font-bold text-lg text-amber-500">{fmtNum(documentoSelecionado ? resumoDoc.pesoMedio : resumoEmbarque.pesoMedio)}</span>
            </div>
          }
        </div>
        <div className="space-y-1 d17d-table-summary__brands">
          <div className="flex items-center gap-1 flex-wrap">
            <span
              role="button"
              tabIndex={0}
              aria-pressed={mostrarMediaMarcas}
              title="Mostrar ou ocultar a média de peso por marca"
              onClick={() => setMostrarMediaMarcas((prev) => !prev)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setMostrarMediaMarcas((prev) => !prev); } }}
              className="d17d-table-summary__brand-label cursor-pointer text-[13px] text-slate-500 hover:text-slate-700 font-medium"
            >
              Marcas:
            </span>
            {resumoMarcasDia.map(({ marcaNome, quantidade }) =>
              <Badge key={marcaNome} variant="outline" className="d17d-table-summary__brand-chip text-[13px] px-1.5 py-0 border-slate-300 text-slate-700">
                {marcaNome}: {fmtInt(quantidade)}
              </Badge>
            )}
          </div>
          {mostrarMediaMarcas && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="d17d-table-summary__brand-label text-[13px] text-slate-500">Média por marca:</span>
              {resumoMarcasDia.map(({ marcaNome, pesoMedio }) =>
                <Badge key={`${marcaNome}-media`} variant="outline" className="d17d-table-summary__brand-chip text-[13px] px-1.5 py-0 border-slate-300 text-slate-700">
                  {marcaNome}: {fmtNum(pesoMedio)}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="d17d-table-summary__actions flex items-center gap-1 shrink-0">
        {pagination && (
          <>
            <span className="d17d-table-summary__page-info text-xs text-slate-500 whitespace-nowrap">Exibidos <strong>{fmtInt(pagination.listed)}</strong> · {fmtInt(pagination.currentPage)}/{fmtInt(pagination.totalPages)}</span>
            <Button type="button" variant="ghost" size="icon" className="d17d-icon-action h-7 w-7 rounded-full" disabled={pagination.currentPage <= 1} onClick={pagination.onPrevious} aria-label="Página anterior"><pagination.PreviousIcon className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="icon" className="d17d-icon-action h-7 w-7 rounded-full" disabled={pagination.currentPage >= pagination.totalPages} onClick={pagination.onNext} aria-label="Próxima página"><pagination.NextIcon className="h-4 w-4" /></Button>
          </>
        )}
        {exportarExcel ? (
          <Button size="sm" onClick={exportarExcel} className="d17d-export-action emp-toolbar-btn emp-toolbar-btn-save h-7 text-xs shrink-0">
            Exportar
          </Button>
        ) : null}
      </div>
    </div>);

}
