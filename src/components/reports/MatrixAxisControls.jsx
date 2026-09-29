import React from "react";
import { nextMatrixAxes } from "@/modules/reporting/domain/matrixLayout";
import { BarSelect } from "./ReportFilterBar";

// Sintético (Matriz), E1D: "Linhas (Eixo Y)" e "Colunas (Eixo X)" como no MAKGESTAO, no encaixe typeControls
// da barra — só aparece no tipo com layout "matrix". Opções = definition.matrixAxes (Lote, Apartação, Sexo,
// Raça, Mês). Escolher num lado o eixo que está no outro TROCA os dois de lugar (nextMatrixAxes): a matriz
// nunca fica com o mesmo eixo nos dois lados (o serviço recusa) e a tela nunca trava. Só seleção — as contas
// são do motor (domain/matrixLayout). O visual final é da E1E.

/**
 * @param {{ axes: { id: string, label: string }[], matrix: { eixoY: string, eixoX: string } | null,
 *   onChange: (matrix: { eixoY: string, eixoX: string }) => void }} props
 */
export default function MatrixAxisControls({ axes, matrix, onChange }) {
  const options = (axes ?? []).map((axis) => ({ value: axis.id, label: axis.label }));
  const change = (edge) => (value) => {
    const next = nextMatrixAxes(matrix, edge, value);
    if (next.eixoY !== matrix?.eixoY || next.eixoX !== matrix?.eixoX) onChange(next);
  };
  return (
    <>
      <BarSelect
        id="eixo-y"
        label="Linhas (Eixo Y)"
        value={matrix?.eixoY ?? ""}
        options={options}
        onChange={change("eixoY")}
        title="Linhas da matriz (escolher o eixo das Colunas troca os dois de lugar)"
      />
      <BarSelect
        id="eixo-x"
        label="Colunas (Eixo X)"
        value={matrix?.eixoX ?? ""}
        options={options}
        onChange={change("eixoX")}
        title="Colunas da matriz (escolher o eixo das Linhas troca os dois de lugar)"
      />
    </>
  );
}
