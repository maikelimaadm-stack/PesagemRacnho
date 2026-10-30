import OperacoesView from '@/components/rebanho/OperacoesView';

// Menu REBANHO › Saídas (missão pesagens-integrada, Fase B — 17-MODELO-DADOS-V9.md).
export default function Saidas() {
  return <OperacoesView key="SAIDA" tipo="SAIDA" singular="saída" title="Saídas" description="Vendas, abates, transferências enviadas, mortes, doações e ajustes." />;
}
