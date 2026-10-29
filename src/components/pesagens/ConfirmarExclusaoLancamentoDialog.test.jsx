import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfirmarExclusaoLancamentoDialog from './ConfirmarExclusaoLancamentoDialog';

const PESAGEM = { id: 'p1', numero_animal: '1234', marca: 'MK' };

describe('ConfirmarExclusaoLancamentoDialog', () => {
  it('sem pesagem, não abre', () => {
    render(<ConfirmarExclusaoLancamentoDialog pesagem={null} onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('explica que só este lançamento sai e confirma', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmarExclusaoLancamentoDialog pesagem={PESAGEM} onCancel={() => {}} onConfirm={onConfirm} />);
    expect(screen.getByText(/Somente este lançamento de 1234 \/ Marca MK será excluído/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('cadastro original com histórico: explica e não deixa excluir', () => {
    render(<ConfirmarExclusaoLancamentoDialog pesagem={PESAGEM} bloqueado onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText(/possui histórico e não pode ser excluído/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excluir' }).disabled).toBe(true);
  });
});
