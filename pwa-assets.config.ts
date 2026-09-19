import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

/**
 * Generates the app icons from the logo: `npm run icons` (writes into `public/`). The logo's own background is
 * the brand blue, so the maskable and Apple icons pad the shield with that same blue. The source is only 320px
 * (Q-006), so the 512px icons are enlarged; regenerate when a better logo arrives.
 */
const LOGO_BLUE = 'rgb(28, 100, 202)'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: LOGO_BLUE } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: LOGO_BLUE } },
  },
  images: ['public/brand/logo.jpg'],
})
