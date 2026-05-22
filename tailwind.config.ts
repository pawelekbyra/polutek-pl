import type { Config } from "tailwindcss"

const config = {
  content: [
    './app/**/*.{ts,tsx}',
    'node_modules/flowbite-react/lib/esm/**/*.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-outfit)', 'sans-serif'],
        sans: ['var(--font-jakarta)', 'sans-serif'],
        heading: ['var(--font-outfit)', 'sans-serif'],
        brand: ['var(--font-space-grotesk)', 'sans-serif'],
        handwriting: ['var(--font-gluten)', 'cursive'],
      },
      colors: {
        cream: '#FDFBF7',
        charcoal: '#1a1a1a',
        primary: {
          DEFAULT: '#3b82f6',
          dark: '#1d4ed8',
        },
        secondary: {
          DEFAULT: '#8b5cf6',
          dark: '#6d28d9',
        },
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        }
      },
      boxShadow: {
        'brutalist-sm': '2px 2px 0px 0px #1a1a1a',
        'brutalist': '4px 4px 0px 0px #1a1a1a',
        'brutalist-lg': '8px 8px 0px 0px #1a1a1a',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    require("flowbite/plugin"),
  ],
} satisfies Config

export default config
