// The panel uses plain CSS with design tokens (docs/design/admin-panel/DESIGN-SYSTEM.md), not Tailwind.
// This file exists so Next.js does not pick up the root postcss.config.mjs (Tailwind) for the panel.
const config = { plugins: {} };

export default config;
