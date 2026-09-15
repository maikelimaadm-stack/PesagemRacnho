import CadastroAuxiliarPage from '@/components/cadastros/CadastroAuxiliarPage';
import { CAUSAS_MORTE } from '@/modules/catalog/domain/registryDefinitions';
import { deathCauseService } from '@/modules/catalog/application/index';

// Menu CADASTROS › Causas de Morte (ADR-018; MORTALITY-MODEL §2.1): store causasMorte.
const tabs = [{ id: 'causasMorte', definition: CAUSAS_MORTE, persistence: deathCauseService, newLabel: 'Nova causa de morte' }];

export default function CausasMorte() {
  return <CadastroAuxiliarPage title="Causas de Morte" description={CAUSAS_MORTE.descricao} tabs={tabs} />;
}
