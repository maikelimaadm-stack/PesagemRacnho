import CadastroAuxiliarPage from '@/components/cadastros/CadastroAuxiliarPage';
import { PARCEIROS } from '@/modules/catalog/domain/registryDefinitions';
import { partnerService } from '@/modules/catalog/application/index';

// Menu CADASTROS › Parceiros (ADR-024): aba única; o filtro por papel fica na
// pílula "Papéis" da faixa (um papel por vez) e no painel lateral.
const tabs = [{ id: 'parceiros', definition: PARCEIROS, persistence: partnerService, newLabel: 'Novo parceiro' }];

export default function Parceiros() {
  return <CadastroAuxiliarPage title="Parceiros" description={PARCEIROS.descricao} tabs={tabs} />;
}
