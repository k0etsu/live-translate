import { execFile, spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'

function uvBinName(): string {
  return process.platform === 'win32' ? 'uv.exe' : 'uv'
}

/** Path to the bundled uv binary (dev vs prod) */
export function getUvPath(appRoot: string): string {
  if (process.env.NODE_ENV === 'development') {
    return path.join(appRoot, 'electron', 'resources', 'bin', uvBinName())
  }
  return path.join(process.resourcesPath, 'bin', uvBinName())
}

/** Venv lives in userData so it survives app updates */
export function getVenvPath(): string {
  return path.join(app.getPath('userData'), 'venv')
}

/** Python executable inside the venv */
export function getVenvPython(venvPath: string): string {
  return process.platform === 'win32'
    ? path.join(venvPath, 'Scripts', 'python.exe')
    : path.join(venvPath, 'bin', 'python')
}

/** Sentinel written after a successful package install */
function sentinelPath(venvPath: string): string {
  return path.join(venvPath, '.installed')
}

/** True when venv has Python and packages are installed */
export function isVenvReady(venvPath: string): boolean {
  return fs.existsSync(getVenvPython(venvPath))
    && fs.existsSync(sentinelPath(venvPath))
}

/** Version string from the venv Python, or undefined on failure */
export function getVenvVersion(venvPath: string): Promise<string | undefined> {
  return new Promise(resolve => {
    execFile(getVenvPython(venvPath), ['--version'], { timeout: 8000 }, (err, stdout) => {
      resolve(err ? undefined : stdout.trim().replace('Python ', ''))
    })
  })
}

function runUv(
  uvPath: string,
  args: string[],
  onLog?: (line: string) => void,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise(resolve => {
    const proc = spawn(uvPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const handle = (chunk: Buffer) =>
      chunk.toString().split('\n').filter(Boolean).forEach(l => onLog?.(l.trimEnd()))
    proc.stdout.on('data', handle)
    proc.stderr.on('data', handle)
    proc.on('close', code => resolve({ ok: code === 0 }))
    proc.on('error', err  => resolve({ ok: false, error: err.message }))
  })
}

/**
 * Create venv (downloading Python 3.11 if needed) then install requirements.
 * Skips venv creation if the Python binary already exists (avoids Windows lock errors).
 * Writes sentinel file on success.
 */
export async function setupVenv(
  uvPath: string,
  venvPath: string,
  reqPath: string,
  onLog: (line: string) => void,
): Promise<{ ok: boolean; error?: string }> {
  const venvPython = getVenvPython(venvPath)

  if (!fs.existsSync(venvPython)) {
    onLog('Creating Python 3.11 environment…')
    const create = await runUv(uvPath, ['venv', venvPath, '--python', '3.11', '--seed'], onLog)
    if (!create.ok) return create
  } else {
    onLog(`Using existing environment at: ${venvPath}`)
  }

  onLog('Installing packages…')
  const install = await runUv(
    uvPath,
    ['pip', 'install', '-r', reqPath, '--python', venvPython],
    onLog,
  )
  if (install.ok) {
    fs.writeFileSync(sentinelPath(venvPath), new Date().toISOString(), 'utf8')
  }
  return install
}

/** Install/replace CPU torch with CUDA-enabled wheels in an existing venv */
export async function installCudaIntoVenv(
  uvPath: string,
  venvPath: string,
  onLog: (line: string) => void,
): Promise<{ ok: boolean; error?: string }> {
  // --reinstall forces replacement of the already-installed CPU torch.
  // --index-url must be passed on the CLI; uv does not honour it inside requirements files.
  return runUv(
    uvPath,
    [
      'pip', 'install',
      'torch', 'torchaudio',
      '--index-url', 'https://download.pytorch.org/whl/cu128',
      '--python', getVenvPython(venvPath),
      '--reinstall',
    ],
    onLog,
  )
}
