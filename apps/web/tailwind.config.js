import preset from '@dreamward/design-system/tailwind-preset';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // include design-system component classes so their utilities are generated
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
};
