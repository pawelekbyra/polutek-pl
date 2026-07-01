import { ImageResponse } from 'next/og';
import {
  APP_ICON_BACKGROUND,
  APP_ICON_INK,
  loadPatrickHandFont,
  roundedSquarePath,
} from '@/lib/icons/app-icon';

export const runtime = 'edge';
export const size = {
  width: 192,
  height: 192,
};
export const contentType = 'image/png';

export default async function Icon() {
  const fontData = await loadPatrickHandFont();
  const borderPath = roundedSquarePath(size.width, 30, 7, 6);
  const innerPath = roundedSquarePath(size.width, 31, 57, 8);

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
          <path d={borderPath} fill="none" stroke={APP_ICON_INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <path d={innerPath} fill="none" stroke={APP_ICON_INK} strokeWidth={1.5} opacity={0.3} />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontFamily: 'Patrick Hand', fontSize: 104, color: APP_ICON_INK, lineHeight: 1 }}>
            P
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Patrick Hand', data: fontData, style: 'normal', weight: 400 }],
    },
  );
}
