import { ImageResponse } from 'next/og';
import {
  APP_ICON_BACKGROUND,
  APP_ICON_INK,
} from '@/lib/icons/app-icon';

export const runtime = 'edge';
export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          background: APP_ICON_BACKGROUND,
        }}
      >
        <svg
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          style={{ position: 'absolute', inset: 0 }}
        >
          <path
            d="M 108 164 C 107 125, 136 94, 176 94 L 350 94 C 391 94, 421 125, 421 166 L 421 250 C 421 291, 391 322, 350 322 L 270 322 L 270 379 C 270 397, 249 407, 235 395 L 94 279 C 82 269, 82 250, 94 240 L 133 207 C 119 198, 108 183, 108 164 Z"
            transform={`scale(${size.width / 512})`}
            fill="#2563eb"
            stroke={APP_ICON_INK}
            strokeWidth={size.width === 512 ? 15 : 5.625}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 173 166 L 347 166 C 361 166, 371 176, 371 190 L 371 231 C 371 245, 361 255, 347 255 L 236 255"
            transform={`scale(${size.width / 512})`}
            fill="none"
            stroke={APP_ICON_INK}
            strokeWidth={size.width === 512 ? 12 : 4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.78"
          />
          <path
            d="M 242 222 L 199 258 L 242 294"
            transform={`scale(${size.width / 512})`}
            fill="none"
            stroke={APP_ICON_INK}
            strokeWidth={size.width === 512 ? 12 : 4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.78"
          />
          <path
            d="M 123 174 C 149 158, 209 153, 278 155 C 338 157, 386 154, 407 169"
            transform={`scale(${size.width / 512})`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={size.width === 512 ? 8 : 3}
            strokeLinecap="round"
            opacity="0.2"
          />
        </svg>
      </div>
    ),
    {
      ...size
    },
  );
}
