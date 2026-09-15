import CadastroAuxiliarPage from '@/components/cadastros/CadastroAuxiliarPage';
import { CATEGORIAS_ANIMAL } from '@/modules/catalog/domain/registryDefinitions';
import { categoryService } from '@/modules/catalog/application/index';

// Menu CADASTROS › Categorias (ADR-028): sexo aplicável e faixa etária para sugestão.
const tabs = [{ id: 'categoriasAnimal', definition: CATEGORIAS_ANIMAL, persistence: categoryService, newLabel: 'Nova categoria' }];

export default function Categorias() {
  return <CadastroAuxiliarPage title="Categorias" description={CATEGORIAS_ANIMAL.descricao} tabs={tabs} />;
}
