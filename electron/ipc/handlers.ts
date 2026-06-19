import { ipcMain, BrowserWindow, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { CHANNELS } from './channels'
import { getConfig, setConfig } from '../config/store'
import type { Config, OverlayStyle, Preset } from '../../shared/types'
import { pythonManager, detectPython } from '../python/manager'
import { getUvPath, getVenvPath, setupVenv, installCudaIntoVenv } from '../python/uvManager'

let pendingDevicesResolve: ((devices: any[]) => void) | null = null

export function registerHandlers(
  getMainWindow: () => BrowserWindow | null,
  getOverlayWindow: () => BrowserWindow | null,
  createOverlay: () => void,
  closeOverlay: () => void,
  appRoot: string,
): void {
  // ── Config ─────────────────────────────────────────────────────────────────
  ipcMain.handle(CHANNELS.CONFIG_GET, () => getConfig())

  ipcMain.on(CHANNELS.CONFIG_SET, (_e, partial: Partial<Config>) => {
    setConfig(partial)
  })

  // ── Overlay ────────────────────────────────────────────────────────────────
  ipcMain.on(CHANNELS.OVERLAY_SHOW, () => {
    const existing = getOverlayWindow()
    if (existing) {
      existing.show()
    } else {
      createOverlay()
      const overlay = getOverlayWindow()
      if (overlay) {
        overlay.webContents.once('did-finish-load', () => {
          if (overlay.isDestroyed()) return
          const cfg = getConfig()
          overlay.webContents.send(CHANNELS.OVERLAY_STYLE, {
            fontSize:   cfg.overlayFontSize   ?? 20,
            fontWeight: cfg.overlayFontWeight ?? 'bold',
            fontColor:  cfg.overlayFontColor  ?? '#ff8080',
            textShadow: cfg.overlayTextShadow ?? true,
            textAlign:  cfg.overlayTextAlign  ?? 'left',
            vertAlign:  cfg.overlayVertAlign  ?? 'bottom',
            opacity:    cfg.overlayOpacity    ?? 0,
            bgColor:    cfg.overlayBgColor    ?? '#282828',
            width:      cfg.overlayWidth      ?? 1000,
            height:     cfg.overlayHeight     ?? 140,
          })
        })
      }
    }
  })

  ipcMain.on(CHANNELS.OVERLAY_HIDE, () => {
    getOverlayWindow()?.hide()
  })

  ipcMain.on(CHANNELS.OVERLAY_UPDATE, (_e, payload: { transcript: string; translation: string }) => {
    const overlay = getOverlayWindow()
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send(CHANNELS.OVERLAY_UPDATE, payload)
    }
  })

  ipcMain.on(CHANNELS.OVERLAY_STYLE, (_e, style: OverlayStyle) => {
    const overlay = getOverlayWindow()
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send(CHANNELS.OVERLAY_STYLE, style)
      overlay.setSize(style.width, style.height)
    }
  })

  // ── Python backend ─────────────────────────────────────────────────────────
  ipcMain.handle(CHANNELS.PYTHON_CHECK, async () => detectPython())

  ipcMain.handle(CHANNELS.PYTHON_START, async (_e, config: Partial<Config>, deviceName: string) => {
    const win = getMainWindow()
    pythonManager.spawn(appRoot, (msg) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(CHANNELS.PYTHON_MESSAGE, msg)
      }
      if (msg.type === 'result') {
        const overlay = getOverlayWindow()
        if (overlay && !overlay.isDestroyed()) {
          overlay.webContents.send(CHANNELS.OVERLAY_UPDATE, {
            transcript:  msg.transcript ?? '',
            translation: msg.translation ?? '',
          })
        }
      }
      if (msg.type === 'devices' && pendingDevicesResolve) {
        pendingDevicesResolve(msg.devices ?? [])
        pendingDevicesResolve = null
      }
    })
    pythonManager.send({ type: 'start', device_name: deviceName ?? '', settings: buildPySettings(config) })
    return { ok: true }
  })

  ipcMain.handle(CHANNELS.PYTHON_STOP, async () => {
    pythonManager.send({ type: 'stop' })
    return { ok: true }
  })

  ipcMain.on(CHANNELS.PYTHON_SETTINGS, (_e, config: Partial<Config>) => {
    pythonManager.send({ type: 'settings', settings: buildPySettings(config) })
  })

  ipcMain.handle(CHANNELS.PYTHON_LIST_DEVICES, async (_e, _config: Partial<Config>) => {
    if (!pythonManager.isRunning()) {
      const win = getMainWindow()
      pythonManager.spawn(appRoot, (msg) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send(CHANNELS.PYTHON_MESSAGE, msg)
        }
        if (msg.type === 'devices' && pendingDevicesResolve) {
          pendingDevicesResolve(msg.devices ?? [])
          pendingDevicesResolve = null
        }
        // Resolve immediately on error (e.g. soundcard not installed)
        if (msg.type === 'error' && pendingDevicesResolve) {
          pendingDevicesResolve([])
          pendingDevicesResolve = null
        }
      })
    }
    return new Promise<any[]>((resolve) => {
      pendingDevicesResolve = resolve
      setTimeout(() => {
        if (pendingDevicesResolve) { pendingDevicesResolve([]); pendingDevicesResolve = null }
      }, 10000)
      pythonManager.send({ type: 'list_devices' })
    })
  })

  ipcMain.handle(CHANNELS.PYTHON_INSTALL, async () => {
    const win     = getMainWindow()
    const uvPath  = getUvPath(appRoot)
    const venvPath = getVenvPath()
    const reqPath = path.join(appRoot, 'python', 'requirements.txt')

    const send = (line: string) => {
      if (win && !win.isDestroyed()) win.webContents.send(CHANNELS.PYTHON_INSTALL_LOG, line)
    }

    const result = await setupVenv(uvPath, venvPath, reqPath, send)
    if (result.ok) {
      // Re-init manager so it picks up the new venv Python
      await pythonManager.init()
    }
    return result
  })

  ipcMain.handle(CHANNELS.PYTHON_INSTALL_CUDA, async () => {
    const win      = getMainWindow()
    const uvPath   = getUvPath(appRoot)
    const venvPath = getVenvPath()

    const send = (line: string) => {
      if (win && !win.isDestroyed()) win.webContents.send(CHANNELS.PYTHON_INSTALL_LOG, line)
    }

    return installCudaIntoVenv(uvPath, venvPath, send)
  })

  // ── Presets ────────────────────────────────────────────────────────────────
  function presetsDir(): string {
    return path.join(app.getPath('userData'), 'presets')
  }

  function bundledPresetsDir(): string {
    return path.join(appRoot, 'python', 'presets')
  }

  ipcMain.handle(CHANNELS.PRESET_LIST, (): Preset[] => {
    const presets: Preset[] = []
    const seen = new Set<string>()

    // User presets take priority
    const userDir = presetsDir()
    if (fs.existsSync(userDir)) {
      for (const file of fs.readdirSync(userDir).filter(f => f.endsWith('.json'))) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(userDir, file), 'utf8'))
          const name = data.name ?? path.basename(file, '.json')
          presets.push({ ...data, name })
          seen.add(name)
        } catch { /* skip malformed */ }
      }
    }

    // Bundled defaults (read-only, skipped if user has same name)
    const bundledDir = bundledPresetsDir()
    if (fs.existsSync(bundledDir)) {
      for (const file of fs.readdirSync(bundledDir).filter(f => f.endsWith('.json'))) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(bundledDir, file), 'utf8'))
          const name = data.name ?? path.basename(file, '.json')
          if (!seen.has(name)) {
            presets.push({ ...data, name, _bundled: true } as any)
          }
        } catch { /* skip */ }
      }
    }

    return presets
  })

  ipcMain.handle(CHANNELS.PRESET_SAVE, (_e, name: string, config: Partial<Config>) => {
    const dir = presetsDir()
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `${name.replace(/[^a-z0-9_-]/gi, '_')}.json`)
    fs.writeFileSync(file, JSON.stringify({ name, ...config }, null, 2), 'utf8')
    return { ok: true }
  })

  ipcMain.handle(CHANNELS.PRESET_LOAD, (_e, name: string): Preset | null => {
    const userFile = path.join(presetsDir(), `${name.replace(/[^a-z0-9_-]/gi, '_')}.json`)
    if (fs.existsSync(userFile)) {
      return JSON.parse(fs.readFileSync(userFile, 'utf8'))
    }
    // Search bundled
    const bundledDir = bundledPresetsDir()
    if (fs.existsSync(bundledDir)) {
      for (const file of fs.readdirSync(bundledDir).filter(f => f.endsWith('.json'))) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(bundledDir, file), 'utf8'))
          if ((data.name ?? path.basename(file, '.json')) === name) return data
        } catch { /* skip */ }
      }
    }
    return null
  })

  ipcMain.handle(CHANNELS.PRESET_DELETE, (_e, name: string) => {
    const file = path.join(presetsDir(), `${name.replace(/[^a-z0-9_-]/gi, '_')}.json`)
    if (fs.existsSync(file)) fs.unlinkSync(file)
    return { ok: true }
  })

  // ── App ────────────────────────────────────────────────────────────────────
  ipcMain.on(CHANNELS.RESTART_APP, () => {
    app.relaunch()
    app.exit()
  })

  ipcMain.on(CHANNELS.APP_SET_ICON, (_e, theme: string) => {
    const win = getMainWindow()
    if (!win) return
    const iconExt  = process.platform === 'win32' ? 'ico' : process.platform === 'darwin' ? 'icns' : 'png'
    const themed   = path.join(appRoot, 'public', 'icons', theme, `icon.${iconExt}`)
    const fallback = path.join(appRoot, 'public', `icon.${iconExt}`)
    win.setIcon(fs.existsSync(themed) ? themed : fallback)
  })

  ipcMain.on(CHANNELS.WINDOW_MINIMIZE, () => getMainWindow()?.minimize())
  ipcMain.on(CHANNELS.WINDOW_MAXIMIZE, () => {
    const win = getMainWindow()
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on(CHANNELS.WINDOW_CLOSE, () => getMainWindow()?.close())
}

function buildPySettings(config: Partial<Config>): object {
  return {
    model:                config.model                   ?? 'kotoba-tech/kotoba-whisper-bilingual-v1.0',
    task:                 config.task                    ?? 'translate',
    temperature:          config.temperature             ?? 0.08,
    max_new_tokens:       config.maxNewTokens            ?? 224,
    no_repeat_ngram_size: config.noRepeatNgramSize       ?? 3,
    vad_threshold:        config.vadThreshold            ?? 0.12,
    volume_threshold:     config.volumeThreshold         ?? 0.006,
    use_vad_filter:       config.useVadFilter            ?? true,
    use_dynamic_chunking: config.useDynamicChunking      ?? true,
    dynamic_max_chunk_duration: config.dynamicMaxChunkSec      ?? 6.0,
    dynamic_silence_timeout:    config.dynamicSilenceTimeoutSec ?? 0.7,
    dynamic_min_speech_duration: config.dynamicMinSpeechSec    ?? 0.3,
  }
}
