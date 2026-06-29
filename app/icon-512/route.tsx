import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f1e4',
          color: '#171717',
          fontSize: 132,
          fontWeight: 900,
          letterSpacing: '-0.08em',
        }}
      >
        PL
      </div>
    ),
    size,
  );
}
