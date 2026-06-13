import { spawn, ChildProcess, execFile } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { getVenvPath, getVenvPython, getVenvVersion } from './uvManager'

export interface PythonStatus {
  found: boolean
  version?: string
  missingPackages?: string[]
}

export interface PythonMessage {
  type: string
  [key: string]: any
}

function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10000 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout.trim())
    })
  })
}

export async function detectPython(): Promise<PythonStatus> {
  const venvPath   = getVenvPath()
  const venvPython = getVenvPython(venvPath)

  if (!fs.existsSync(venvPython)) {
    return { found: false }
  }

  const version = await getVenvVersion(venvPath)
  if (!version) return { found: false }

  const packages = ['torch', 'transformers', 'soundcard', 'numpy', 'scipy']
  const missingPackages: string[] = []
  for (const pkg of packages) {
    try {
      await runCommand(venvPython, ['-c', `import ${pkg}`])
    } catch {
      missingPackages.push(pkg)
    }
  }

  return { found: true, version, missingPackages }
}

export class PythonManager {
  private proc: ChildProcess | null = null
  private lineBuffer = ''
  private onMessage: ((msg: PythonMessage) => void) | null = null
  private pyExe = 'python'
  private pyPrefix: string[] = []

  async init(): Promise<void> {
    const venvPath   = getVenvPath()
    const venvPython = getVenvPython(venvPath)
    if (fs.existsSync(venvPython)) {
      this.pyExe    = venvPython
      this.pyPrefix = []
    }
    // else: keep 'python' as dev fallback when venv isn't set up yet
  }

  spawn(appRoot: string, onMessage: (msg: PythonMessage) => void): void {
    // If already running, just swap the message handler — don't restart.
    if (this.proc) {
      this.onMessage = onMessage
      return
    }

    this.onMessage = onMessage
    const scriptPath = path.join(appRoot, 'python', 'backend.py')

    this.proc = spawn(this.pyExe, [...this.pyPrefix, scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: appRoot,
    })

    this.lineBuffer = ''

    this.proc.stdout!.on('data', (chunk: Buffer) => {
      this.lineBuffer += chunk.toString('utf8')
      let newline: number
      while ((newline = this.lineBuffer.indexOf('\n')) !== -1) {
        const line = this.lineBuffer.slice(0, newline).trim()
        this.lineBuffer = this.lineBuffer.slice(newline + 1)
        if (!line) continue
        try {
          const msg = JSON.parse(line) as PythonMessage
          this.onMessage?.(msg)
        } catch {
          console.error('[python] bad JSON:', line.slice(0, 120))
        }
      }
    })

    this.proc.stderr!.on('data', (chunk: Buffer) => {
      console.error('[python]', chunk.toString('utf8').trimEnd())
    })

    this.proc.on('error', (err) => {
      console.error('[python] spawn error:', err.message)
      onMessage({ type: 'error', message: `Python spawn failed: ${err.message}` })
    })

    this.proc.on('exit', (code) => {
      console.log('[python] exited with code', code)
      this.proc = null
    })
  }

  send(msg: object): void {
    if (!this.proc || !this.proc.stdin) return
    try {
      this.proc.stdin.write(JSON.stringify(msg) + '\n')
    } catch (err) {
      console.error('[python] send error:', (err as Error).message)
    }
  }

  isRunning(): boolean {
    return this.proc !== null && !this.proc.killed
  }

  kill(): void {
    if (!this.proc) return
    try {
      this.send({ type: 'quit' })
      setTimeout(() => {
        if (this.proc && !this.proc.killed) {
          this.proc.kill()
        }
        this.proc = null
      }, 2000)
    } catch {
      this.proc?.kill()
      this.proc = null
    }
  }
}

export const pythonManager = new PythonManager()
