import CadastroAuxiliarPage from '@/components/cadastros/CadastroAuxiliarPage';
import { MARCAS } from '@/modules/catalog/domain/registryDefinitions';
import { brandService } from '@/modules/catalog/application/index';

// Menu CADASTROS › Marcas (ADR-018/ADR-020): definição e serviço do módulo de catálogo.
const tabs = [{ id: 'marcas', definition: MARCAS, persistence: brandService, newLabel: 'Nova marca' }];

export default function Marcas() {
  return <CadastroAuxiliarPage title="Marcas" description={MARCAS.descricao} tabs={tabs} />;
}
