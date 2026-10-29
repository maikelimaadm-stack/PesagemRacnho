import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SelecionarAnimalDialog from './SelecionarAnimalDialog';

const ANIMAIS = [
  { animal_id: 'a1', marca: 'MK', sexo: 'Macho', raca: 'Nelore', era: '24' },
  { animal_id: 'a2', marca: 'JS', sexo: 'Fêmea', raca: 'Angus', era: '12' },
];

function abrir(props = {}) {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <SelecionarAnimalDialog open numero="1234" animais={ANIMAIS} onSelect={onSelect} onOpenChange={onOpenChange} {...props} />,
  );
  return { onSelect, onOpenChange };
}

describe('SelecionarAnimalDialog', () => {
  it('pergunta qual é o animal e lista uma opção por marca', () => {
    abrir();
    expect(screen.getByRole('dialog', { name: 'Qual é o animal 1234?' })).toBeTruthy();
    const opcoes = screen.getAllByRole('option');
    expect(opcoes).toHaveLength(2);
    expect(opcoes[0].textContent).toContain('MK');
    expect(opcoes[1].textContent).toContain('Fêmea · Angus · 12');
  });

  it('clique escolhe o animal e fecha', async () => {
    const { onSelect, onOpenChange } = abrir();
    await userEvent.click(screen.getByRole('option', { name: 'Opção 2: Marca JS' }));
    expect(onSelect).toHaveBeenCalledWith(ANIMAIS[1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('tecla numérica escolhe pela posição (atalho do curral)', async () => {
    const { onSelect } = abrir();
    await userEvent.keyboard('2');
    expect(onSelect).toHaveBeenCalledWith(ANIMAIS[1]);
  });

  it('tecla fora da lista ou com Ctrl não escolhe nada', async () => {
    const { onSelect } = abrir();
    await userEvent.keyboard('5');
    await userEvent.keyboard('{Control>}1{/Control}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('fechado, as teclas não escolhem', async () => {
    const { onSelect } = abrir({ open: false });
    await userEvent.keyboard('1');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
