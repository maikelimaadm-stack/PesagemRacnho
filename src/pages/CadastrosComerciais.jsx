import CadastroAuxiliarPage from '@/components/cadastros/CadastroAuxiliarPage';

const common = [
  { id: 'nome', label: 'Nome/Razão social', required: true, placeholder: 'Informe o nome completo', wide: true },
  { id: 'documento', label: 'CPF/CNPJ', placeholder: 'Somente números ou documento formatado' },
  { id: 'telefone', label: 'Telefone', compact: true },
  { id: 'email', label: 'E-mail', wide: true },
  { id: 'cidade', label: 'Cidade' },
  { id: 'ativo', label: 'Situação', type: 'boolean', widthType: 'SIM_NAO', defaultValue: true },
];

const tabs = [
  {
    id: 'compradores', bucket: 'compradores', label: 'Compradores', singular: 'comprador',
    description: 'Cadastre compradores para reutilizar nos lançamentos de venda.',
    fields: [...common, { id: 'observacoes', label: 'Observações', wide: true }],
    columns: [{ id: 'nome', label: 'Nome/Razão social' }, { id: 'documento', label: 'CPF/CNPJ' }, { id: 'telefone', label: 'Telefone' }, { id: 'cidade', label: 'Cidade' }, { id: 'ativo', label: 'Situação' }],
  },
  {
    id: 'vendedores', bucket: 'vendedores', label: 'Vendedores', singular: 'vendedor',
    description: 'Cadastre vendedores e propriedades de origem para as compras de animais.',
    fields: [...common, { id: 'propriedade', label: 'Propriedade/Fazenda', wide: true }, { id: 'observacoes', label: 'Observações', wide: true }],
    columns: [{ id: 'nome', label: 'Nome/Razão social' }, { id: 'documento', label: 'CPF/CNPJ' }, { id: 'propriedade', label: 'Propriedade/Fazenda' }, { id: 'telefone', label: 'Telefone' }, { id: 'ativo', label: 'Situação' }],
  },
  {
    id: 'frigorificos', bucket: 'frigorificos', label: 'Frigoríficos', singular: 'frigorífico',
    description: 'Cadastre os destinos de abate e seus dados de contato.',
    fields: [...common, { id: 'sif', label: 'Registro SIF/SIM/SIE' }, { id: 'observacoes', label: 'Observações', wide: true }],
    columns: [{ id: 'nome', label: 'Frigorífico' }, { id: 'documento', label: 'CNPJ' }, { id: 'sif', label: 'SIF/SIM/SIE' }, { id: 'cidade', label: 'Cidade' }, { id: 'ativo', label: 'Situação' }],
  },
];

export default function CadastrosComerciais() {
  return <CadastroAuxiliarPage title="Cadastros Comerciais" description="Compradores, vendedores e frigoríficos utilizados nas movimentações." group="comerciais" tabs={tabs} />;
}
