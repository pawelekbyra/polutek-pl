/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ donationProps: null as Record<string, unknown> | null }));

vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: 'pl' }) }));
vi.mock('@/app/components/channel/DonationBox', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.donationProps = props;
    return <div data-testid="donation-box" />;
  },
}));

import SupportModal from '@/app/components/channel/SupportModal';

describe('SupportModal', () => {
  afterEach(() => cleanup());

  it('shows step 1 of 2 with the tip gate in its modal variant, and closes', () => {
    const onClose = vi.fn();
    render(<SupportModal videoTitle="Film" onClose={onClose} />);

    expect(screen.getByTestId('support-modal')).toBeInTheDocument();
    expect(screen.getByText('Krok 1 z 2')).toBeInTheDocument();
    expect(mocks.donationProps).toMatchObject({ variant: 'modal', videoTitle: 'Film' });

    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalled();
  });
});
