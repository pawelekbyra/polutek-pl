import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_CURRENCIES } from '@/lib/constants';

describe('SupportBox currency dropdown', () => {
  it('is wired to render every supported currency option, including GBP and CHF', () => {
    const source = readFileSync('app/components/playlist/SupportBox.tsx', 'utf8');

    expect(SUPPORTED_CURRENCIES).toEqual(['PLN', 'EUR', 'USD', 'GBP', 'CHF']);
    expect(source).toContain('availableCurrencies.map');
    expect(source).toContain('<option key={curr} value={curr}>{curr}</option>');
  });
});
