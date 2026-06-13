import { contextBridge, ipcRenderer } from 'electron'
import type { Config, OverlayStyle, Preset } from '../shared/types'

contextBridge.exposeInMainWorld('electron', {
  // ── Config ─────────────────────────────────────────────────────────────────
  getConfig: (): Promise<Config> =>
    ipcRenderer.invoke('config:get'),

  setConfig: (partial: Partial<Config>): void =>
    ipcRenderer.send('config:set', partial),

  // ── Overlay ────────────────────────────────────────────────────────────────
  showOverlay: (): void =>
    ipcRenderer.send('overlay:show'),

  hideOverlay: (): void =>
    ipcRenderer.send('overlay:hide'),

  setOverlayStyle: (style: OverlayStyle): void =>
    ipcRenderer.send('overlay:style', style),

  // ── Python backend ────────────────────────────────────────────────────────
  checkPython: (): Promise<{ found: boolean; version?: string; missingPackages?: string[] }> =>
    ipcRenderer.invoke('python:check'),

  startPython: (config: Partial<Config>, deviceName: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('python:start', config, deviceName),

  stopPython: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('python:stop'),

  updatePythonSettings: (config: Partial<Config>): void =>
    ipcRenderer.send('python:settings', config),

  listPythonDevices: (config: Partial<Config>): Promise<Array<{ name: string; is_loopback: boolean }>> =>
    ipcRenderer.invoke('python:list-devices', config),

  installPythonPackages: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('python:install'),

  installCudaPyTorch: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('python:install-cuda'),

  onPythonMessage: (cb: (msg: any) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, msg: any) => cb(msg)
    ipcRenderer.on('python:message', handler)
    return () => ipcRenderer.removeListener('python:message', handler)
  },

  onInstallLog: (cb: (line: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, line: string) => cb(line)
    ipcRenderer.on('python:install-log', handler)
    return () => ipcRenderer.removeListener('python:install-log', handler)
  },

  // ── Presets ───────────────────────────────────────────────────────────────
  listPresets: (): Promise<Preset[]> =>
    ipcRenderer.invoke('preset:list'),

  savePreset: (name: string, config: Partial<Config>): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('preset:save', name, config),

  loadPreset: (name: string): Promise<Preset | null> =>
    ipcRenderer.invoke('preset:load', name),

  deletePreset: (name: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('preset:delete', name),

  // ── Overlay-side subscriptions ────────────────────────────────────────────
  onOverlayUpdate: (cb: (payload: { transcript: string; translation: string }) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: { transcript: string; translation: string }) => cb(p)
    ipcRenderer.on('overlay:update', handler)
    return () => ipcRenderer.removeListener('overlay:update', handler)
  },

  onOverlayStyle: (cb: (style: OverlayStyle) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, s: OverlayStyle) => cb(s)
    ipcRenderer.on('overlay:style', handler)
    return () => ipcRenderer.removeListener('overlay:style', handler)
  },

  // ── App ───────────────────────────────────────────────────────────────────
  restartApp: (): void =>
    ipcRenderer.send('app:restart'),

  // ── Window controls ───────────────────────────────────────────────────────
  minimizeWindow: (): void => ipcRenderer.send('window:minimize'),
  maximizeWindow: (): void => ipcRenderer.send('window:maximize'),
  closeWindow:    (): void => ipcRenderer.send('window:close'),
})
