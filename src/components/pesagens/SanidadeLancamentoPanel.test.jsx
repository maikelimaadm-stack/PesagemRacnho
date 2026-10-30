import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { newSanityDraft } from '@/modules/weighing/domain/launchContext';

// Regra de dose SINTÉTICA (teste): 1 ml a cada 50 kg.
const getDoseSuggestion = vi.fn();
vi.mock('@/modules/sanity/application/sanityService', async (original) => ({
  ...(await original()),
  getDoseSuggestion: (...args) => getDoseSuggestion(...args),
  saveMedicamento: vi.fn(),
}));
const { default: SanidadeLancamentoPanel } = await import('./SanidadeLancamentoPanel');

const MED = { id: 'm1', nome: 'PRODUTO SINTETICO', unidade_padrao: 'ml', via_aplicacao: 'SC' };
const aprovada = (kg) => ({ ok: kg > 0, dose: kg / 50, unidade: 'ml', via: 'SC', regra: '1 ml a cada 50 kg', avisos: [], bloqueios: kg > 0 ? [] : ['Sem peso do animal: sem dose sugerida.'], situacao: 'APROVADA', situacaoLabel: 'Aprovada', posologia: { id: 'p1' } });

let ultimo = [];
function Painel({ pesoBase, animalChave = '101|MK', podeCadastrar = true }) {
  const [aplicacoes, setAplicacoes] = useState([{ ...newSanityDraft(), medicamento_id: 'm1', unidade: 'ml', via_aplicacao: 'SC' }]);
  ultimo = aplicacoes;
  return (
    <MemoryRouter>
      <SanidadeLancamentoPanel aplicacoes={aplicacoes} onAplicacoesChange={setAplicacoes} medicamentos={[MED]} programas={[]} catalogoCarregado
        pesoBase={pesoBase} dataAplicacao="2026-05-01" animalChave={animalChave} podeCadastrar={podeCadastrar} />
    </MemoryRouter>
  );
}

describe('SanidadeLancamentoPanel — dose pela posologia no Lançamento', () => {
  beforeEach(() => {
    getDoseSuggestion.mockReset();
    getDoseSuggestion.mockImplementation(async ({ peso }) => aprovada(peso?.kg || 0));
  });

  it('balança instável ou desconectada: não sugere dose', async () => {
    render(<Painel pesoBase={{ kg: 300, origem: 'BALANCA', estavel: false }} />);
    expect(await screen.findByText(/aguardando peso estável da balança/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Usar dose sugerida/ })).toBeNull();
  });

  it('sugestão vira dose aplicada só por ação do operador; peso diferente desfaz e pede nova confirmação', async () => {
    const { rerender } = render(<Painel pesoBase={{ kg: 300, origem: 'BALANCA', estavel: true }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Usar dose sugerida na aplicação 1' }));
    expect(screen.getByLabelText('Dose da aplicação 1').value).toBe('6');
    await userEvent.clear(screen.getByLabelText('Dose da aplicação 1'));
    await userEvent.type(screen.getByLabelText('Dose da aplicação 1'), '5,5');
    await userEvent.click(screen.getByLabelText('Confirmo a dose aplicada na aplicação 1'));
    expect(ultimo[0]).toMatchObject({ dose: '5,5', dose_sugerida: '6', posologia_id: 'p1', peso_base_kg: '300', dose_confirmada: 'true' });
    // Peso novo (outra leitura): a sugestão e a confirmação usadas saem.
    rerender(<Painel pesoBase={{ kg: 310, origem: 'BALANCA', estavel: true }} />);
    await waitFor(() => expect(ultimo[0].posologia_id).toBeUndefined());
    expect(ultimo[0].dose).toBe('');
    expect(await screen.findByRole('button', { name: 'Usar dose sugerida na aplicação 1' })).toBeTruthy();
  });

  it('editar a dose depois de confirmar desfaz a confirmação; trocar de animal desfaz a sugestão', async () => {
    const { rerender } = render(<Painel pesoBase={{ kg: 300, origem: 'MANUAL', estavel: true }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Usar dose sugerida na aplicação 1' }));
    await userEvent.click(screen.getByLabelText('Confirmo a dose aplicada na aplicação 1'));
    await userEvent.type(screen.getByLabelText('Dose da aplicação 1'), '0');
    expect(ultimo[0].dose_confirmada).toBe('');
    rerender(<Painel pesoBase={{ kg: 300, origem: 'MANUAL', estavel: true }} animalChave="102|MK" />);
    await waitFor(() => expect(ultimo[0].posologia_id).toBeUndefined());
  });

  it('regra em rascunho: explica e não oferece dose', async () => {
    getDoseSuggestion.mockResolvedValue({ ok: false, dose: null, avisos: [], bloqueios: ['A posologia deste produto ainda é rascunho (não aprovada): sem dose sugerida.'], situacao: 'RASCUNHO', situacaoLabel: 'Rascunho', posologia: null });
    render(<Painel pesoBase={{ kg: 300, origem: 'MANUAL', estavel: true }} />);
    expect(await screen.findByText(/Posologia: Rascunho\./)).toBeTruthy();
    expect(screen.getByText(/ainda é rascunho/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Usar dose sugerida/ })).toBeNull();
  });

  it('perfil sem registry.write: consulta, sem cadastrar', async () => {
    render(<Painel pesoBase={{ kg: 300, origem: 'MANUAL', estavel: true }} podeCadastrar={false} />);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Novo medicamento' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Consultar medicamento da aplicação 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Consultar posologia da aplicação 1' })).toBeTruthy();
  });
});
