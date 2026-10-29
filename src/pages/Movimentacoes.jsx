import OperacoesView from '@/components/rebanho/OperacoesView';

// Menu REBANHO › Movimentações (missão pesagens-integrada, Fase B — 17-MODELO-DADOS-V9.md).
export default function Movimentacoes() {
  return <OperacoesView key="MOVIMENTACAO" tipo="MOVIMENTACAO" singular="movimentação" title="Movimentações" description="Mudança de lote ou de propriedade, sem exigir pesagem." />;
}
