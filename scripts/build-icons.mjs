/**
 * Convert theme SVGs to platform icon formats.
 * Outputs to public/icons/{theme}/icon.{png,ico,icns}
 * Also updates public/icon.{png,ico,icns} with the default theme's icon.
 *
 * Run: node scripts/build-icons.mjs
 * Requires: npm install -D @resvg/resvg-js png2icons
 *
 * Uses @resvg/resvg-js (Rust-based) instead of sharp/librsvg because
 * librsvg mishandles dominant-baseline="central" causing text to render
 * at the wrong vertical position compared to what browsers show.
 */

import { Resvg } from '@resvg/resvg-js'
import png2icons from 'png2icons'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const THEMES = [
  { name: 'mechanic-teal',   svg: 'live_translation_fullsize_1_cyber_teal.svg' },
  { name: 'nature-green',    svg: 'live_translation_fullsize_2_nature_green.svg' },
  { name: 'pirate-crimson',  svg: 'live_translation_fullsize_3_crimson.svg' },
  { name: 'executive-pink',  svg: 'live_translation_fullsize_4_rose_pink.svg' },
  { name: 'nurse-green',     svg: 'live_translation_fullsize_5_nimi_green.svg' },
]

// The theme whose icons will also be written to public/icon.* as the default app icon.
const DEFAULT_THEME = 'mechanic-teal'

function systemFontDir() {
  switch (process.platform) {
    case 'win32':  return 'C:\\Windows\\Fonts'
    case 'darwin': return '/System/Library/Fonts'
    default:       return '/usr/share/fonts'
  }
}

function svgToPng(svgText, size) {
  const resvg = new Resvg(svgText, {
    fitTo: { mode: 'width', value: size },
    font: {
      fontDirs: [systemFontDir()],
      loadSystemFonts: true,
      defaultFontFamily: 'Georgia',
    },
  })
  return resvg.render().asPng()
}

function buildTheme(theme) {
  const svgPath = path.join(root, 'public', theme.svg)
  const outDir  = path.join(root, 'public', 'icons', theme.name)
  fs.mkdirSync(outDir, { recursive: true })

  console.log(`Building ${theme.name}...`)

  // SVGs use width="100%" — resvg needs explicit pixel dimensions.
  // The graphic content sits inside a 500×500 area with 90px padding on each side
  // in a 680×680 canvas. Crop the viewBox to the content area so the icon fills
  // the full icon slot instead of appearing smaller with whitespace around it.
  const svgText = fs.readFileSync(svgPath, 'utf8')
  const fixedSvg = svgText
    .replace(/viewBox="0 0 \d+ \d+"/, 'viewBox="90 90 500 500"')
    .replace(/width="[^"]*"/, 'width="500" height="500"')

  // Render at 1024 for ICO/ICNS source, 256 for the runtime PNG
  const png1024 = svgToPng(fixedSvg, 1024)
  const png256  = svgToPng(fixedSvg, 256)

  fs.writeFileSync(path.join(outDir, 'icon.png'), png256)

  const ico  = png2icons.createICO(png1024, png2icons.HERMITE, 0, true)
  const icns = png2icons.createICNS(png1024, png2icons.HERMITE, 0)
  if (ico)  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico)
  if (icns) fs.writeFileSync(path.join(outDir, 'icon.icns'), icns)

  console.log(`  → public/icons/${theme.name}/icon.{png,ico,icns}`)
  return { png256, ico, icns }
}

for (const theme of THEMES) {
  const result = buildTheme(theme)

  if (theme.name === DEFAULT_THEME) {
    console.log(`Updating default app icon (${DEFAULT_THEME})...`)
    fs.writeFileSync(path.join(root, 'public', 'icon.png'), result.png256)
    if (result.ico)  fs.writeFileSync(path.join(root, 'public', 'icon.ico'),  result.ico)
    if (result.icns) fs.writeFileSync(path.join(root, 'public', 'icon.icns'), result.icns)
    console.log('  → public/icon.{png,ico,icns}')
  }
}

console.log('Done.')
