import CadastroAuxiliarPage from '@/components/cadastros/CadastroAuxiliarPage';
import { PROPRIEDADES } from '@/modules/catalog/domain/registryDefinitions';
import { propertyService } from '@/modules/catalog/application/index';

// Menu CADASTROS › Propriedades (ADR-029): próprias e de terceiros, com parceiro dono.
const tabs = [{ id: 'propriedades', definition: PROPRIEDADES, persistence: propertyService, newLabel: 'Nova propriedade' }];

export default function Propriedades() {
  return <CadastroAuxiliarPage title="Propriedades" description={PROPRIEDADES.descricao} tabs={tabs} />;
}
