/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { LanguageProvider, useLanguage } from '@/app/components/LanguageContext';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

const TestComponent = () => {
  const { language, isInitialized } = useLanguage();
  return (
    <div>
      <div data-testid="language">{language}</div>
      <div data-testid="initialized">{isInitialized.toString()}</div>
    </div>
  );
};

describe('LanguageProvider Hydration Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn();
    // Reset navigator language
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('pl-PL');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('initializes with "pl" and isInitialized=false before effects', () => {
    let capturedLanguage: string | undefined;
    let capturedIsInitialized: boolean | undefined;

    const Grabber = () => {
      const { language, isInitialized } = useLanguage();
      // Only capture the very first render values
      if (capturedLanguage === undefined) {
          capturedLanguage = language;
          capturedIsInitialized = isInitialized;
      }
      return null;
    };

    render(
      <LanguageProvider>
        <Grabber />
      </LanguageProvider>
    );

    expect(capturedLanguage).toBe('pl');
    expect(capturedIsInitialized).toBe(false);
  });

  it('updates to localStorage preference after effect', async () => {
    localStorage.setItem('app-language', 'en');

    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    // After effect, it should be 'en' and initialized
    expect(screen.getByTestId('language').textContent).toBe('en');
    expect(screen.getByTestId('initialized').textContent).toBe('true');

    // Should NOT have called the sync API
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('updates to navigator preference after effect if no localStorage', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');

    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('language').textContent).toBe('en');
    expect(screen.getByTestId('initialized').textContent).toBe('true');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stays "pl" if navigator is polish and no localStorage', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('pl-PL');

    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('language').textContent).toBe('pl');
    expect(screen.getByTestId('initialized').textContent).toBe('true');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
