import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConferirPesoDialog from './ConferirPesoDialog';

const AVISOS = [{ code: 'faixa', message: 'Peso acima de 900 kg' }];

describe('ConferirPesoDialog', () => {
  it('mostra os avisos e só confirma com justificativa', async () => {
    const onConfirm = vi.fn();
    render(<ConferirPesoDialog open warnings={AVISOS} onCancel={() => {}} onConfirm={onConfirm} />);
    expect(screen.getByText('Peso acima de 900 kg')).toBeTruthy();
    const confirmar = screen.getByRole('button', { name: 'Confirmar e salvar' });
    expect(confirmar.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText('Justificativa para continuar'), '   ');
    expect(confirmar.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText('Justificativa para continuar'), ' conferido na balança ');
    await userEvent.click(confirmar);
    expect(onConfirm).toHaveBeenCalledWith('conferido na balança');
  });

  it('cada abertura começa sem justificativa', async () => {
    const props = { warnings: AVISOS, onCancel: () => {}, onConfirm: () => {} };
    const { rerender } = render(<ConferirPesoDialog open {...props} />);
    await userEvent.type(screen.getByLabelText('Justificativa para continuar'), 'antiga');
    rerender(<ConferirPesoDialog open={false} {...props} />);
    rerender(<ConferirPesoDialog open {...props} />);
    expect(screen.getByLabelText('Justificativa para continuar').value).toBe('');
  });

  it('Cancelar avisa a tela', async () => {
    const onCancel = vi.fn();
    render(<ConferirPesoDialog open warnings={AVISOS} onCancel={onCancel} onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
