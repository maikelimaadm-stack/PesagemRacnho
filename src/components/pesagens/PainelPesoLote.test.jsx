import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PainelPesoLote, { descreverLoteDestino } from "./PainelPesoLote";

const lotes = [{ id: "l1", nome_lote: "LEVES" }, { id: "l2", nome_lote: "PESADOS" }];

describe("descreverLoteDestino", () => {
  it("segue a ordem do formulário: sem apartação, sem lote, manual, sem peso, atalho, automático, não encontrado", () => {
    expect(descreverLoteDestino({ apartacaoSelecionada: "", temPeso: true })).toEqual({ texto: "Sem apartação", tipo: "sem-apartacao" });
    expect(descreverLoteDestino({ apartacaoSelecionada: "a", loteTransferencia: "NENHUM", temPeso: true }).tipo).toBe("sem-lote");
    expect(descreverLoteDestino({ apartacaoSelecionada: "a", loteTransferencia: "l2", lotesApartacaoAtual: lotes, temPeso: false })).toEqual({ texto: "PESADOS", tipo: "manual" });
    expect(descreverLoteDestino({ apartacaoSelecionada: "a", loteTransferencia: "", temPeso: false })).toEqual({ texto: "—", tipo: "sem-peso" });
    expect(descreverLoteDestino({ apartacaoSelecionada: "a", temPeso: true, lotesAtalho: [{ tecla: "F11", nome_lote: "LEVES" }, { tecla: "F12", nome_lote: "PESADOS" }] }).texto).toBe("F11 LEVES · F12 PESADOS");
    expect(descreverLoteDestino({ apartacaoSelecionada: "a", temPeso: true, loteAutomatico: lotes[0] })).toEqual({ texto: "LEVES", tipo: "auto" });
    expect(descreverLoteDestino({ apartacaoSelecionada: "a", temPeso: true, loteAutomatico: null }).tipo).toBe("nao-encontrado");
  });
});

describe("PainelPesoLote", () => {
  it("mostra o peso e o lote; sem peso mostra traço; estado da balança no rótulo", () => {
    const props = { pesagemAuto: true, estagio: "stable", tamanho: "grande", onTamanhoChange: () => {}, onFechar: () => {}, lote: { texto: "PESADOS", tipo: "auto" } };
    const { rerender } = render(<PainelPesoLote {...props} peso="328" />);
    expect(screen.getByLabelText("Peso no quadro").textContent).toBe("328");
    expect(screen.getByLabelText("Lote destino no quadro").textContent).toBe("PESADOS");
    expect(screen.getByText("Estável")).toBeTruthy();
    rerender(<PainelPesoLote {...props} peso="" estagio="waiting" />);
    expect(screen.getByLabelText("Peso no quadro").textContent).toBe("—");
    expect(screen.getByText(/aguardando o próximo animal/)).toBeTruthy();
    rerender(<PainelPesoLote {...props} peso="250" pesagemAuto={false} tamanho="pequeno" />);
    expect(screen.getByText("Peso digitado")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aumentar quadro de peso" })).toBeTruthy();
  });
});
