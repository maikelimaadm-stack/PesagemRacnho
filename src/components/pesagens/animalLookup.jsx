import { fmtNum } from "@/components/common/formatNumber";

export const normalizarTexto = (valor) => String(valor || '').trim().toUpperCase();

const montarOpcaoMarca = (marca, registrosMesmoNumero) => {
  const historicoMarca = registrosMesmoNumero.filter((p) => normalizarTexto(p.marca) === marca);
  const cadastroOriginal = historicoMarca.find((p) => p.tipo_manejo === 'Cadastro');
  const ultimo = historicoMarca[0];
  return { marca, dados: cadastroOriginal || ultimo, ultimo };
};

export const criarMensagemAnimal = ({ numero, dadosCadastro, ultimo, tipoManejo, editingId, formatarData }) => {
  if (tipoManejo === 'Cadastro' && !editingId) {
    return { tipo: 'alerta', mensagem: `⚠️ Animal ${numero} / Marca ${dadosCadastro?.marca || '-'} já cadastrado em ${formatarData(ultimo?.data_pesagem)} com peso ${fmtNum(ultimo?.peso)}. Use "Manejo" para nova pesagem.` };
  }

  const statusAtual = ultimo?.status_animal || 'Ativo';
  return {
    tipo: statusAtual === 'Inativo' ? 'erro' : 'info',
    mensagem: statusAtual === 'Inativo'
      ? `❌ Animal ${numero} / Marca ${dadosCadastro?.marca || '-'} está INATIVO (já teve saída registrada)`
      : `✓ ${dadosCadastro?.sexo || '-'} | ${dadosCadastro?.raca || '-'} | Era: ${dadosCadastro?.era || '-'} | Marca: ${dadosCadastro?.marca || '-'} | Última: ${formatarData(ultimo?.data_pesagem)} | Peso: ${fmtNum(ultimo?.peso)}`
  };
};

export const avaliarIdentificacaoAnimal = ({ valor, marca, pesagens, pesagensDia, editingId, tipoManejo, formatarData }) => {
  const numero = String(valor || '').trim();
  if (!numero || numero.toUpperCase() === 'SN') return null;

  const numeroNorm = normalizarTexto(numero);
  const marcaNorm = normalizarTexto(marca);
  const registrosMesmoNumero = pesagens
    .filter((p) => normalizarTexto(p.numero_animal) === numeroNorm)
    .sort((a, b) => new Date(b.data_pesagem) - new Date(a.data_pesagem));
  const marcasMesmoNumero = [...new Set(registrosMesmoNumero.map((p) => normalizarTexto(p.marca)).filter(Boolean))];
  const marcaAtualExisteNoNumero = marcaNorm && marcasMesmoNumero.includes(marcaNorm);
  const temUmaMarca = marcasMesmoNumero.length === 1;
  const precisaEscolherMarca = registrosMesmoNumero.length > 0 && marcasMesmoNumero.length > 1 && !marcaAtualExisteNoNumero;
  const historicoAnimal = temUmaMarca
    ? registrosMesmoNumero.filter((p) => normalizarTexto(p.marca) === marcasMesmoNumero[0])
    : marcaAtualExisteNoNumero
      ? registrosMesmoNumero.filter((p) => normalizarTexto(p.marca) === marcaNorm)
      : registrosMesmoNumero.length > 0 && marcasMesmoNumero.length === 0
        ? registrosMesmoNumero
        : [];
  const marcaComparacao = historicoAnimal[0]?.marca || marca || '';
  const pesadoHoje = pesagensDia.find((p) => normalizarTexto(p.numero_animal) === numeroNorm && normalizarTexto(p.marca) === normalizarTexto(marcaComparacao) && p.id !== editingId);

  if (pesadoHoje) return { aviso: { tipo: 'erro', mensagem: `⚠️ Animal ${numero}${marcaComparacao ? ` / Marca ${marcaComparacao}` : ''} já foi pesado hoje! Peso: ${fmtNum(pesadoHoje.peso)}` } };

  if (precisaEscolherMarca) {
    return { aviso: { tipo: 'alerta', mensagem: `ℹ️ O número ${numero} existe em mais de uma marca. Selecione a marca correta:`, opcoes: marcasMesmoNumero.map((m) => montarOpcaoMarca(m, registrosMesmoNumero)) } };
  }

  if (historicoAnimal.length > 0) {
    const cadastroOriginal = historicoAnimal.find((p) => p.tipo_manejo === 'Cadastro');
    const ultimo = historicoAnimal[0];
    const dadosCadastro = cadastroOriginal || ultimo;
    return { dadosCadastro, aviso: criarMensagemAnimal({ numero, dadosCadastro, ultimo, tipoManejo, editingId, formatarData }) };
  }

  if (tipoManejo === 'Manejo' || tipoManejo === 'Saída') {
    return { aviso: { tipo: registrosMesmoNumero.length > 0 ? 'alerta' : 'erro', mensagem: registrosMesmoNumero.length > 0 ? `ℹ️ O número ${numero} existe, mas em outra marca. Informe a marca correta.` : `❌ Brinco ${numero} NÃO CADASTRADO! Use "Cadastro" para cadastrar primeiro.` } };
  }

  return null;
};
