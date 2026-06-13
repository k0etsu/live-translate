import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as http from 'http'
import { registerHandlers } from './ipc/handlers'
import { getConfig, setConfig } from './config/store'
import { pythonManager } from './python/manager'

const isDev = process.env.NODE_ENV === 'development'

// __dirname = dist/electron/ — two levels up is the project root
const appRoot = path.join(__dirname, '../..')

function preloadPath(): string {
  return path.join(__dirname, 'preload.js')
}

function isDevServerUp(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173/', (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => { req.destroy(); resolve(false) })
  })
}

let mainWindow:    BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null

function getMainWindow()    { return mainWindow }
function getOverlayWindow() { return overlayWindow }

async function createMainWindow(): Promise<void> {
  const cfg = getConfig()
  const hasSavedPos = cfg.mainWindowX >= 0 && cfg.mainWindowY >= 0

  mainWindow = new BrowserWindow({
    width:     cfg.mainWindowWidth,
    height:    cfg.mainWindowHeight,
    ...(hasSavedPos ? { x: cfg.mainWindowX, y: cfg.mainWindowY } : {}),
    minWidth:  620,
    minHeight: 580,
    title: 'Live Translate',
    frame: false,
    webPreferences: {
      preload: preloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  const devUp = isDev && await isDevServerUp()
  const url   = devUp
    ? 'http://localhost:5173'
    : `file://${path.join(appRoot, 'dist/index.html')}`

  mainWindow.loadURL(url)
  if (isDev) mainWindow.webContents.openDevTools()

  mainWindow.on('resized', () => {
    const [w, h] = mainWindow!.getSize()
    setConfig({ mainWindowWidth: w, mainWindowHeight: h })
  })

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow!.getPosition()
    setConfig({ mainWindowX: x, mainWindowY: y })
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    overlayWindow?.close()
    overlayWindow = null
  })
}

function createOverlayWindow(): void {
  if (overlayWindow) { overlayWindow.show(); return }

  const cfg = getConfig()
  overlayWindow = new BrowserWindow({
    width:       cfg.overlayWidth,
    height:      cfg.overlayHeight,
    x:           cfg.overlayX,
    y:           cfg.overlayY,
    frame:       false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   true,
    webPreferences: {
      preload: preloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  const overlayUrl = isDev
    ? 'http://localhost:5173/overlay/overlay.html'
    : `file://${path.join(appRoot, 'dist/overlay/overlay.html')}`

  overlayWindow.loadURL(overlayUrl)
  overlayWindow.setIgnoreMouseEvents(false)

  // Save position on first show (captures OS-placed initial position)
  overlayWindow.once('show', () => {
    const [x, y] = overlayWindow!.getPosition()
    setConfig({ overlayX: x, overlayY: y })
  })

  overlayWindow.on('moved', () => {
    const [x, y] = overlayWindow!.getPosition()
    setConfig({ overlayX: x, overlayY: y })
  })

  overlayWindow.on('resized', () => {
    const [w, h] = overlayWindow!.getSize()
    setConfig({ overlayWidth: w, overlayHeight: h })
  })

  overlayWindow.on('closed', () => { overlayWindow = null })
}

function closeOverlayWindow(): void {
  overlayWindow?.close()
  overlayWindow = null
}

app.on('ready', () => {
  pythonManager.init()
  registerHandlers(getMainWindow, getOverlayWindow, createOverlayWindow, closeOverlayWindow, appRoot)
  createMainWindow()

})

app.on('will-quit', () => {
  pythonManager.kill()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})
