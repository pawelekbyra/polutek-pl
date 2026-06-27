import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 192,
  height: 192,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: '9999px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
          }}
        >
          <img
            src="/favicon.ico"
            alt="POLUTEK.PL"
            width="160"
            height="160"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '9999px',
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
