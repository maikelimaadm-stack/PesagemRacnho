import CadastroAuxiliarPage from '@/components/cadastros/CadastroAuxiliarPage';
import { RACAS } from '@/modules/catalog/domain/registryDefinitions';
import { breedService } from '@/modules/catalog/application/index';

// Menu CADASTROS › Raças (ADR-018/ADR-021).
const tabs = [{ id: 'racas', definition: RACAS, persistence: breedService, newLabel: 'Nova raça' }];

export default function Racas() {
  return <CadastroAuxiliarPage title="Raças" description={RACAS.descricao} tabs={tabs} />;
}
