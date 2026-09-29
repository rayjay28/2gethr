// Regenerates public/icons/*.png (the Android/PWA icon ladder used for the
// TWA/Play Store build) from the current logo source files. Run this again
// any time togethr-icon-blue.png / togethr-icon-blue-maskable.png change,
// so the icon pack stays in sync with the logo instead of going stale (see
// the old icon-*.jpg ladder this replaced, which was generated once against
// a different, outdated logo and never regenerated).
//
// Usage: node scripts/convert-icons-to-png.js
//
// Requires the `sharp` package. If it isn't in node_modules, either
// `npm install sharp` or point NODE_PATH at wherever it's globally
// installed before running this.
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')
const iconsDir = path.join(projectRoot, 'public/icons')

const SRC = path.join(iconsDir, 'togethr-icon-blue.png')
const SRC_MASKABLE = path.join(iconsDir, 'togethr-icon-blue-maskable.png')

const SIZES = [48, 72, 96, 128, 144, 192, 256, 384, 512, 1024]
const MASKABLE_SIZES = [192, 512]

async function run() {
  for (const size of SIZES) {
    const out = path.join(iconsDir, `icon-${size}x${size}.png`)
    await sharp(SRC).resize(size, size).png().toFile(out)
    console.log('wrote', out)
  }

  for (const size of MASKABLE_SIZES) {
    const out = path.join(iconsDir, `icon-maskable-${size}x${size}.png`)
    await sharp(SRC_MASKABLE).resize(size, size).png().toFile(out)
    console.log('wrote', out)
  }

  // Play Console's listing icon must be a flat 512x512 PNG with no alpha channel.
  const playStoreOut = path.join(iconsDir, 'play-store-icon-512x512.png')
  await sharp(SRC).resize(512, 512).flatten({ background: '#3b4563' }).png().toFile(playStoreOut)
  console.log('wrote', playStoreOut)

  console.log('Done! Icon pack regenerated from the current logo.')
}

run().catch((error) => {
  console.error('Icon generation failed:', error.message)
  process.exit(1)
})
