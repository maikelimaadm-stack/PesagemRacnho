import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import MakDateControl from './MakDateControl';

function Campo({ inicial = '2026-10-15', onChange = () => {}, ...props }) {
  const [valor, setValor] = useState(inicial);
  return (
    <MakDateControl
      value={valor}
      onChange={(e) => { setValor(e.target.value); onChange(e.target.value); }}
      ariaLabel="Data da pesagem"
      {...props}
    />
  );
}

const calendario = () => screen.getByRole('dialog', { name: 'Calendário: Data da pesagem' });

describe('MakDateControl', () => {
  it('mostra a data no formato brasileiro e não aceita digitação', () => {
    render(<Campo />);
    const campo = screen.getByLabelText('Data da pesagem');
    expect(campo.value).toBe('15/10/2026');
    expect(campo.readOnly).toBe(true);
  });

  it('escolher um dia no calendário emite a data ISO e fecha', async () => {
    const onChange = vi.fn();
    render(<Campo onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Data da pesagem'));
    await userEvent.click(within(calendario()).getByRole('button', { name: 'Mês anterior' }));
    expect(calendario().textContent).toContain('Setembro de 2026');
    const dia = within(calendario()).getAllByRole('gridcell').find((cell) => cell.textContent === '1' && !cell.className.includes('is-outside'));
    await userEvent.click(dia);
    expect(onChange).toHaveBeenLastCalledWith('2026-09-01');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Data da pesagem').value).toBe('01/09/2026');
  });

  it('Esc fecha o calendário sem mudar a data', async () => {
    const onChange = vi.fn();
    render(<Campo onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Data da pesagem'));
    expect(calendario()).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('desabilitado não abre o calendário', async () => {
    render(<Campo disabled />);
    await userEvent.click(screen.getByLabelText('Data da pesagem'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
