#!/usr/bin/env node
/**
 * Downloads the uv binary for the current platform into electron/resources/bin/
 * Run via `npm run postinstall`, or manually: node scripts/download-uv.js
 */
const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')
const os     = require('os')
const { execSync } = require('child_process')

const UV_VERSION = '0.7.12'

const TARGETS = {
  'win32-x64':    { file: 'uv-x86_64-pc-windows-msvc.zip',     bin: 'uv.exe', isZip: true  },
  'darwin-x64':   { file: 'uv-x86_64-apple-darwin.tar.gz',     bin: 'uv',     isZip: false },
  'darwin-arm64': { file: 'uv-aarch64-apple-darwin.tar.gz',    bin: 'uv',     isZip: false },
  'linux-x64':    { file: 'uv-x86_64-unknown-linux-gnu.tar.gz', bin: 'uv',    isZip: false },
  'linux-arm64':  { file: 'uv-aarch64-unknown-linux-gnu.tar.gz',bin: 'uv',    isZip: false },
}

const key    = `${process.platform}-${process.arch}`
const target = TARGETS[key]
if (!target) {
  console.warn(`[download-uv] Unsupported platform: ${key} — skipping`)
  process.exit(0)
}

const BIN_DIR  = path.join(__dirname, '..', 'electron', 'resources', 'bin')
const BIN_PATH = path.join(BIN_DIR, target.bin)

if (fs.existsSync(BIN_PATH)) {
  console.log('[download-uv] uv already present, skipping')
  process.exit(0)
}

fs.mkdirSync(BIN_DIR, { recursive: true })

const ARCHIVE = path.join(os.tmpdir(), `uv-download-${Date.now()}-${target.file}`)
const BASE    = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/`

function get(url, dest) {
  return new Promise((resolve, reject) => {
    const file  = fs.createWriteStream(dest)
    const proto = url.startsWith('https') ? https : http
    proto.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.destroy()
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        return get(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.destroy()
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', reject)
    }).on('error', reject)
  })
}

async function main() {
  console.log(`[download-uv] Downloading uv ${UV_VERSION} for ${key}…`)
  await get(BASE + target.file, ARCHIVE)
  console.log('[download-uv] Extracting…')

  if (target.isZip) {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${ARCHIVE}' -DestinationPath '${BIN_DIR}' -Force"`,
      { stdio: 'inherit' },
    )
  } else {
    // Extract only the uv binary (uvx not needed)
    execSync(`tar -xzf "${ARCHIVE}" -C "${BIN_DIR}" "${target.bin}"`, { stdio: 'inherit' })
    fs.chmodSync(BIN_PATH, 0o755)
  }

  fs.unlinkSync(ARCHIVE)
  console.log(`[download-uv] uv installed → ${BIN_PATH}`)
}

main().catch(err => {
  // Non-fatal: warn but don't break npm install
  console.warn('[download-uv] Failed to download uv:', err.message)
  console.warn('[download-uv] You can retry with: node scripts/download-uv.js')
  process.exit(0)
})
