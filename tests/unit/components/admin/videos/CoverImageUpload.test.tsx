/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoverImageUpload } from '@/app/admin/videos/components/CoverImageUpload';
import React from 'react';

// Mock react-easy-crop
vi.mock('react-easy-crop', () => ({
  default: () => <div data-testid="mock-cropper">Mock Cropper</div>,
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

describe('CoverImageUpload', () => {
  it('renders upload button initially when no url provided', () => {
    render(<CoverImageUpload onUploadSuccess={() => {}} />);
    expect(screen.getByText(/Wybierz lub upuść obraz/)).toBeDefined();
  });

  it('renders preview when initialUrl is provided', () => {
    render(<CoverImageUpload initialUrl="https://example.com/image.jpg" onUploadSuccess={() => {}} />);
    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toContain('example.com');
  });

  it('switches to cropping mode when file is selected', async () => {
    const readAsDataURLSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function(this: FileReader) {
      Object.defineProperty(this, 'result', { value: 'data:image/png;base64,dummy' });
      if (this.onload) {
        this.onload({ target: this } as any);
      }
    });

    render(<CoverImageUpload onUploadSuccess={() => {}} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy content'], 'test.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.queryByTestId('mock-cropper')).toBeDefined();
    });

    expect(screen.getByText(/Zoom/)).toBeDefined();
    expect(screen.getByText(/Zastosuj i prześlij/)).toBeDefined();

    readAsDataURLSpy.mockRestore();
  });
});
