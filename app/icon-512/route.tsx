import { ImageResponse } from 'next/og';
import {
  APP_ICON_BACKGROUND,
  APP_ICON_INK,
  APP_ICON_BLUE,
  enterGlyphFilledPath,
  roundedSquarePath,
} from '@/lib/icons/app-icon';

export const runtime = 'edge';
export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export async function GET() {
  const borderPath = roundedSquarePath(size.width, 80, 7, 16);
  const innerPath = roundedSquarePath(size.width, 83, 57, 21);
  const enter = enterGlyphFilledPath(size.width);

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
          <path d={borderPath} fill="none" stroke={APP_ICON_INK} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
          <path d={innerPath} fill="none" stroke={APP_ICON_INK} strokeWidth={4} opacity={0.3} />
          <path d={enter.path} fill={APP_ICON_BLUE} stroke={APP_ICON_INK} strokeWidth={enter.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
