import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: [
          'var(--font-outfit)',
          'sans-serif'
        ],
        sans: [
          'var(--font-jakarta)',
          'sans-serif'
        ],
        heading: [
          'var(--font-outfit)',
          'sans-serif'
        ],
        brand: [
          'var(--font-space-grotesk)',
          'sans-serif'
        ],
        handwriting: [
          'var(--font-gluten)',
          'cursive'
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
        glow: 'glow 2s ease-in-out infinite alternate',
        shimmer: 'shimmer 2s infinite'
      },
      keyframes: {
        glow: {
          '0%': {
            boxShadow: '0 0 5px rgba(59, 130, 246, 0.2)'
          },
          '100%': {
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)'
          }
        },
        shimmer: {
          '100%': {
            transform: 'translateX(100%)'
          }
        }
      },
      boxShadow: {
        'brutalist-sm': '2px 2px 0px 0px #1a1a1a',
        brutalist: '4px 4px 0px 0px #1a1a1a',
        'brutalist-lg': '8px 8px 0px 0px #1a1a1a'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
} satisfies Config

export default config
