import CadastroAuxiliarPage from '@/components/cadastros/CadastroAuxiliarPage';

const categories = [
  { value: 'Doença', label: 'Doença' }, { value: 'Acidente', label: 'Acidente' },
  { value: 'Predação', label: 'Predação' }, { value: 'Parto', label: 'Parto' },
  { value: 'Desconhecida', label: 'Desconhecida' }, { value: 'Outra', label: 'Outra' },
];
const tabs = [{
  id: 'causas', bucket: 'causasMorte', label: 'Causas de morte', singular: 'causa de morte', newLabel: 'Nova causa de morte',
  description: 'Padronize as causas utilizadas nas baixas por mortalidade.',
  fields: [
    { id: 'nome', label: 'Causa da morte', required: true, placeholder: 'Ex: Acidente no curral', wide: true },
    { id: 'categoria', label: 'Categoria', type: 'select', options: categories, defaultValue: 'Outra' },
    { id: 'descricao', label: 'Descrição/Orientação', wide: true },
    { id: 'exigeObservacao', label: 'Exigir observação', type: 'boolean', widthType: 'SIM_NAO', defaultValue: false },
    { id: 'ativo', label: 'Situação', type: 'boolean', widthType: 'SIM_NAO', defaultValue: true },
  ],
  columns: [
    { id: 'nome', label: 'Causa da morte' }, { id: 'categoria', label: 'Categoria' },
    { id: 'descricao', label: 'Descrição/Orientação' },
    { id: 'exigeObservacao', label: 'Exigir observação', render: (value) => value ? 'Sim' : 'Não' },
    { id: 'ativo', label: 'Situação' },
  ],
}];

export default function CausasMorte() {
  return <CadastroAuxiliarPage title="Causas de Morte" description="Catálogo padronizado para as saídas por mortalidade." group="mortalidade" tabs={tabs} />;
}
