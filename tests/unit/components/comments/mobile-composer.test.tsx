/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MobileCommentComposer, type MobileComposerHandle } from '@/app/components/comments/components/MobileCommentComposer';
import { keyboardInsetOf } from '@/app/components/comments/hooks/useKeyboardInset';
import { txFor } from '../../i18n/mock-language';

vi.mock('@/lib/i18n/language-context', () => ({ useOptionalTx: () => txFor('pl') }));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({ useAuthModal: () => ({ open: vi.fn() }) }));

const t = { cancel: 'Anuluj', reply: 'Odpowiedz', comment: 'Skomentuj', addReply: 'Dodaj odpowiedź', addComment: 'Dodaj komentarz', signInToComment: 'Zaloguj się' };

function renderComposer(over: Partial<React.ComponentProps<typeof MobileCommentComposer>> = {}) {
  const ref = React.createRef<MobileComposerHandle>();
  const props = {
    userProfile: { name: 'Viewer' },
    userAvatarUrl: null,
    replyTo: null,
    replyingToAuthor: null,
    newComment: '',
    setNewComment: vi.fn(),
    setReplyTo: vi.fn(),
    isInputFocused: false,
    setIsInputFocused: vi.fn(),
    canComment: true,
    isPending: false,
    handleSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    t,
    language: 'pl' as const,
    ...over,
  };
  render(<MobileCommentComposer ref={ref} {...props} />);
  return { ref, props };
}

afterEach(cleanup);

describe('keyboard inset', () => {
  it('is the part of the layout viewport the visual viewport no longer covers', () => {
    expect(keyboardInsetOf(800, 500, 0)).toBe(300);
    expect(keyboardInsetOf(800, 500, 40)).toBe(260);
    expect(keyboardInsetOf(800, 800, 0)).toBe(0);
    expect(keyboardInsetOf(500, 800, 0)).toBe(0);
  });
});

describe('phone comment composer', () => {
  it('shows one calm line in the list and puts the cursor in the field on tap', () => {
    renderComposer();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj komentarz' }));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('opens from "Reply" through the handle and shows who is being answered', () => {
    const { ref } = renderComposer({ replyTo: 'c1', replyingToAuthor: 'Ala', replyingToSnippet: 'Świetny film' });
    ref.current?.open();
    expect(screen.getByText('Ala')).toBeInTheDocument();
    expect(screen.getByText(/Świetny film/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Odpowiedz' })).toBeDisabled();
  });

  it('keeps the field at 16 px (smaller text makes iOS zoom the page) and enables send for a draft', () => {
    const { ref } = renderComposer({ newComment: 'Cześć' });
    act(() => ref.current?.open());
    expect(screen.getByRole('textbox').className).toContain('text-[16px]');
    expect(screen.getByRole('button', { name: 'Skomentuj' })).toBeEnabled();
  });

  it('closing with an empty draft drops the reply target; a typed draft keeps it', () => {
    const empty = renderComposer({ replyTo: 'c1', replyingToAuthor: 'Ala' });
    empty.ref.current?.open();
    empty.ref.current?.close();
    expect(empty.props.setReplyTo).toHaveBeenCalledWith(null);
    cleanup();
    const typed = renderComposer({ replyTo: 'c1', replyingToAuthor: 'Ala', newComment: 'Treść' });
    typed.ref.current?.open();
    typed.ref.current?.close();
    expect(typed.props.setReplyTo).not.toHaveBeenCalled();
  });

  it('has a "more emoji" panel that inserts the tapped emoji and closes with the bar', () => {
    const { ref, props } = renderComposer();
    act(() => ref.current?.open());
    expect(screen.queryByRole('group', { name: 'Wybierz emoji' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Więcej emoji' }));
    const panel = screen.getByRole('group', { name: 'Wybierz emoji' });
    fireEvent.click(panel.querySelector('button')!);
    expect(props.setNewComment).toHaveBeenCalledTimes(1);
    act(() => ref.current?.close());
    expect(screen.queryByRole('group', { name: 'Wybierz emoji' })).toBeNull();
  });

  it('falls back to the regular message when the viewer cannot comment', () => {
    renderComposer({ canComment: false });
    expect(screen.getByRole('button', { name: 'Zaloguj się' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('phone comment composer: accessibility (A03, A08)', () => {
  const dialog = () => document.querySelector('form[role="dialog"]') as HTMLFormElement;

  it('keeps the closed bar out of Tab order and the accessibility tree (inert + hidden)', () => {
    renderComposer();
    expect(dialog().hasAttribute('inert')).toBe(true);
    expect(dialog().style.visibility).toBe('hidden');
    expect(dialog().getAttribute('aria-modal')).toBe('false');
  });

  it('lifts the guards synchronously on open so the field can take focus inside the tap', () => {
    renderComposer();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj komentarz' }));
    expect(dialog().hasAttribute('inert')).toBe(false);
    expect(dialog().style.visibility).toBe('visible');
    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('closes with the explicit close button and returns focus to the line that opened it', () => {
    renderComposer();
    const trigger = screen.getByRole('button', { name: 'Dodaj komentarz' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij komentarz' }));
    expect(dialog().hasAttribute('inert')).toBe(true);
    expect(trigger).toHaveFocus();
  });

  it('closes on Escape and gives focus back to the opener', () => {
    renderComposer();
    const trigger = screen.getByRole('button', { name: 'Dodaj komentarz' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });

  it('traps Tab inside the open bar in both directions', () => {
    const { ref } = renderComposer({ newComment: 'Cześć' });
    act(() => ref.current?.open());
    const send = screen.getByRole('button', { name: 'Skomentuj' });
    send.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Zamknij komentarz' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(send).toHaveFocus();
  });
});

