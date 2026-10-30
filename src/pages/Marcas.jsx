import CadastroAuxiliarPage from '@/components/cadastros/CadastroAuxiliarPage';
import { MARCAS } from '@/modules/catalog/domain/registryDefinitions';
import { brandService } from '@/modules/catalog/application/index';

// Menu CADASTROS › Marcas a Fogo (ADR-018/ADR-020; F07 renomeia só o rótulo): definição e serviço do módulo de catálogo.
const tabs = [{ id: 'marcas', definition: MARCAS, persistence: brandService, newLabel: 'Nova marca' }];

export default function Marcas() {
  return <CadastroAuxiliarPage title="Marcas a Fogo" description={MARCAS.descricao} tabs={tabs} />;
}
