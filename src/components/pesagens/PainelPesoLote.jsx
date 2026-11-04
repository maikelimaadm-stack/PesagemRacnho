import React from "react";
import { Minimize2, Maximize2, X } from "lucide-react";
import "@/styles/launch-visual.css";

// Quadro opcional ao lado da Distribuição de Lotes: o peso do campo Peso e o lote destino em letra grande,
// para ler de longe no curral. Só mostra — quem decide o peso salvo continua sendo o campo / o portão da balança.
export const PAINEL_PESO_LOTE_STORAGE_KEY = "lancamento-pesagens:painel-peso-lote";

export function lerPreferenciaPainel() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PAINEL_PESO_LOTE_STORAGE_KEY) || "null");
    return { visivel: raw?.visivel === true, tamanho: raw?.tamanho === "pequeno" ? "pequeno" : "grande" };
  } catch {
    return { visivel: false, tamanho: "grande" };
  }
}

export function gravarPreferenciaPainel(pref) {
  try {
    window.localStorage.setItem(PAINEL_PESO_LOTE_STORAGE_KEY, JSON.stringify(pref));
  } catch {
    /* sem armazenamento: vale só nesta abertura */
  }
}

const ESTAGIOS = {
  stable: { classe: "is-stable", texto: "Estável" },
  settling: { classe: "is-settling", texto: "Estabilizando…" },
  waiting: { classe: "is-waiting", texto: "Peso já usado — aguardando o próximo animal" },
  idle: { classe: "is-idle", texto: "Balança vazia" },
};

/**
 * Situação do lote destino, na mesma ordem de decisão do formulário.
 * @returns {{ texto: string, tipo: 'manual'|'auto'|'atalho'|'sem-lote'|'nao-encontrado'|'sem-peso'|'sem-apartacao' }}
 */
export function descreverLoteDestino({ apartacaoSelecionada, loteTransferencia, lotesApartacaoAtual = [], loteAutomatico, lotesAtalho = [], temPeso }) {
  if (!apartacaoSelecionada) return { texto: "Sem apartação", tipo: "sem-apartacao" };
  if (loteTransferencia === "NENHUM") return { texto: "Sem lote", tipo: "sem-lote" };
  if (loteTransferencia) {
    const lote = lotesApartacaoAtual.find((item) => item.id === loteTransferencia);
    return { texto: lote?.nome_lote || "Lote escolhido", tipo: "manual" };
  }
  if (!temPeso) return { texto: "—", tipo: "sem-peso" };
  if (lotesAtalho.length > 1) return { texto: lotesAtalho.map((item) => `${item.tecla} ${item.nome_lote}`).join(" · "), tipo: "atalho" };
  if (loteAutomatico?.nome_lote) return { texto: loteAutomatico.nome_lote, tipo: "auto" };
  return { texto: "Não encontrado", tipo: "nao-encontrado" };
}

export default function PainelPesoLote({ peso, pesagemAuto, estagio, lote, tamanho, onTamanhoChange, onFechar }) {
  const estagioInfo = pesagemAuto ? (ESTAGIOS[estagio] || ESTAGIOS.idle) : { classe: "is-manual", texto: "Peso digitado" };
  const grande = tamanho !== "pequeno";
  return (
    <section
      className={`d17d-weight-board ${grande ? "is-large" : "is-small"} ${estagioInfo.classe}`}
      aria-label="Peso e lote destino"
      data-estagio={pesagemAuto ? estagio : "manual"}
    >
      <div className="d17d-weight-board__bar">
        <span className="d17d-weight-board__status">{estagioInfo.texto}</span>
        <div className="d17d-weight-board__actions">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onTamanhoChange(grande ? "pequeno" : "grande")}
            aria-label={grande ? "Diminuir quadro de peso" : "Aumentar quadro de peso"}
            title={grande ? "Pequeno" : "Grande"}
          >
            {grande ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </button>
          <button type="button" tabIndex={-1} onClick={onFechar} aria-label="Ocultar quadro de peso" title="Ocultar">
            <X aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="d17d-weight-board__weight" aria-live="polite">
        <output aria-label="Peso no quadro">{peso ? peso : "—"}</output>
        <span>kg</span>
      </div>
      <div className={`d17d-weight-board__lot is-${lote.tipo}`}>
        <span className="d17d-weight-board__lot-label">Lote destino</span>
        <strong aria-label="Lote destino no quadro">{lote.texto}</strong>
      </div>
    </section>
  );
}
