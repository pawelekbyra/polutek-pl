/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { TipSelect } from '@/app/components/support/TipSelect';

const options = [
  { value: 'card', title: 'Karta' },
  { value: 'blik', title: 'BLIK' },
  { value: 'p24', title: 'Przelewy24' },
];

function setup(value = 'card') {
  const onChange = vi.fn();
  render(<TipSelect label="Metoda płatności" value={value} options={options} onChange={onChange} />);
  const combo = screen.getByRole('combobox', { name: 'Metoda płatności' });
  return { combo, onChange };
}

afterEach(cleanup);

describe('TipSelect combobox pattern (A04)', () => {
  it('points aria-activedescendant at the highlighted option while open, and at nothing while closed', () => {
    const { combo } = setup();
    expect(combo).not.toHaveAttribute('aria-activedescendant');
    expect(combo).not.toHaveAttribute('aria-controls');
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(combo).toHaveAttribute('aria-expanded', 'true');
    expect(combo).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    expect(combo.getAttribute('aria-activedescendant')).toBe(options[0].id);
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(combo.getAttribute('aria-activedescendant')).toBe(options[1].id);
    expect(options[1].id).not.toBe('');
  });

  it('supports Home, End and wrapping, and Enter chooses the active option', () => {
    const { combo, onChange } = setup();
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'End' });
    expect(combo.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[2].id);
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(combo.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);
    fireEvent.keyDown(combo, { key: 'End' });
    fireEvent.keyDown(combo, { key: 'Home' });
    expect(combo.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('blik');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('jumps to an option by its first letter', () => {
    const { combo } = setup();
    fireEvent.keyDown(combo, { key: 'p' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(combo.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[2].id);
  });

  it('closes on Tab without choosing anything', () => {
    const { combo, onChange } = setup();
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
