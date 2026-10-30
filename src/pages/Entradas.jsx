import OperacoesView from '@/components/rebanho/OperacoesView';

// Menu REBANHO › Entradas (missão pesagens-integrada, Fase B — 17-MODELO-DADOS-V9.md).
export default function Entradas() {
  return <OperacoesView key="ENTRADA" tipo="ENTRADA" singular="entrada" title="Entradas" description="Compras, transferências recebidas, nascimentos e ajustes — com ou sem pesagem." />;
}
