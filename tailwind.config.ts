import type { Config } from "tailwindcss"

// Geist has no Chinese glyphs: Chinese text falls back to the visitor's own system font (nothing is
// downloaded, the CSP only allows self-hosted fonts). `<html lang="zh-CN">` makes the browser pick
// the Simplified glyph forms; the names below cover macOS/iOS, Windows, Android and Linux.
const CJK_SYSTEM_FONTS = [
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Noto Sans CJK SC"',
  '"Noto Sans SC"',
  '"Source Han Sans SC"',
  '"WenQuanYi Micro Hei"',
]

const config = {
  darkMode: "class",
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: [
          'var(--font-geist-sans)',
          ...CJK_SYSTEM_FONTS,
          'sans-serif'
        ],
        sans: [
          'var(--font-geist-sans)',
          ...CJK_SYSTEM_FONTS,
          'sans-serif'
        ],
        heading: [
          'var(--font-geist-sans)',
          ...CJK_SYSTEM_FONTS,
          'sans-serif'
        ],
        brand: [
          'var(--font-geist-sans)',
          ...CJK_SYSTEM_FONTS,
          'sans-serif'
        ],
        mono: [
          'var(--font-geist-mono)',
          'monospace'
        ]
      },
      colors: {
        cream: '#FDFBF7',
        charcoal: '#1a1a1a',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          dark: '#1d4ed8',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          dark: '#6d28d9',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        'accent-soft': 'hsl(var(--accent-soft))',
        'accent-ring': 'hsl(var(--accent-ring))',
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      animation: {
        shimmer: 'shimmer 2s infinite'
      },
      keyframes: {
        shimmer: {
          '100%': {
            transform: 'translateX(100%)'
          }
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
} satisfies Config

export default config
