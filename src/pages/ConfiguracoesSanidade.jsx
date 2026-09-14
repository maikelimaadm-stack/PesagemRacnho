import CadastroAuxiliarPage from '@/components/cadastros/CadastroAuxiliarPage';

const tabs = [
  {
    id: 'programas', bucket: 'programasSanidade', label: 'Programas sanitários', singular: 'programa sanitário',
    description: 'Configure protocolos e rotinas sanitárias reutilizáveis.',
    fields: [
      { id: 'nome', label: 'Nome do programa', required: true, placeholder: 'Ex: Vacinação anual', wide: true },
      { id: 'tipo', label: 'Tipo', type: 'select', defaultValue: 'Vacinação', options: [{ value: 'Vacinação', label: 'Vacinação' }, { value: 'Vermifugação', label: 'Vermifugação' }, { value: 'Tratamento', label: 'Tratamento' }, { value: 'Preventivo', label: 'Preventivo' }, { value: 'Outro', label: 'Outro' }] },
      { id: 'intervaloDias', label: 'Intervalo (dias)', type: 'number', widthType: 'NUMERO' },
      { id: 'orientacao', label: 'Orientação', wide: true },
      { id: 'ativo', label: 'Situação', type: 'boolean', widthType: 'SIM_NAO', defaultValue: true },
    ],
    columns: [{ id: 'nome', label: 'Programa sanitário' }, { id: 'tipo', label: 'Tipo' }, { id: 'intervaloDias', label: 'Intervalo (dias)' }, { id: 'orientacao', label: 'Orientação' }, { id: 'ativo', label: 'Situação' }],
  },
  {
    id: 'medicamentos', bucket: 'medicamentos', label: 'Medicamentos', singular: 'medicamento',
    description: 'Cadastre medicamentos, vacinas e insumos sanitários.',
    fields: [
      { id: 'nome', label: 'Medicamento/Produto', required: true, placeholder: 'Nome comercial', wide: true },
      { id: 'principioAtivo', label: 'Princípio ativo', wide: true },
      { id: 'fabricante', label: 'Fabricante' },
      { id: 'unidade', label: 'Unidade', type: 'select', compact: true, widthType: 'TEXTO_CURTO', defaultValue: 'mL', options: [{ value: 'mL', label: 'mL' }, { value: 'mg', label: 'mg' }, { value: 'g', label: 'g' }, { value: 'dose', label: 'Dose' }, { value: 'unidade', label: 'Unidade' }] },
      { id: 'dosePadrao', label: 'Dose padrão', type: 'number', widthType: 'NUMERO' },
      { id: 'carenciaDias', label: 'Carência (dias)', type: 'number', widthType: 'NUMERO' },
      { id: 'viaAplicacao', label: 'Via de aplicação', type: 'select', defaultValue: 'Subcutânea', options: [{ value: 'Subcutânea', label: 'Subcutânea' }, { value: 'Intramuscular', label: 'Intramuscular' }, { value: 'Oral', label: 'Oral' }, { value: 'Tópica', label: 'Tópica' }, { value: 'Outra', label: 'Outra' }] },
      { id: 'ativo', label: 'Situação', type: 'boolean', widthType: 'SIM_NAO', defaultValue: true },
    ],
    columns: [{ id: 'nome', label: 'Medicamento/Produto' }, { id: 'principioAtivo', label: 'Princípio ativo' }, { id: 'dosePadrao', label: 'Dose padrão' }, { id: 'unidade', label: 'Unidade' }, { id: 'carenciaDias', label: 'Carência (dias)' }, { id: 'ativo', label: 'Situação' }],
  },
];

export default function ConfiguracoesSanidade() {
  return <CadastroAuxiliarPage title="Configurações de Sanidade" description="Programas sanitários e medicamentos disponíveis para uso operacional." group="sanidade" tabs={tabs} />;
}
