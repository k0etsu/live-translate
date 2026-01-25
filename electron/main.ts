const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const http = require('http')

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development'

// In production, __dirname is dist/electron, so we need to go up 2 levels to project root
// In development, __dirname is electron/, so we need to go up 1 level to project root
const appRoot = path.join(__dirname, isDev ? '..' : '../..')
const preloadPath = isDev 
  ? path.join(appRoot, 'dist/electron/preload.js')
  : path.join(__dirname, 'preload.js')

let mainWindow: any = null
let overlayWindow: any = null

// Check if dev server is running
function isDevServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173/', (res: any) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    icon: path.join(appRoot, 'public/icon.svg')
  })

  // Determine URL: try dev server if available, otherwise use built files
  let indexUrl: string
  if (isDev) {
    indexUrl = 'http://localhost:5173'
  } else {
    indexUrl = `file://${path.join(appRoot, 'dist/index.html')}`
  }

  mainWindow.loadURL(indexUrl)
  
  // Open DevTools in development mode and show errors if loading fails
  if (isDev) {
    mainWindow.webContents.openDevTools()
    // Log any failed resource loads
    mainWindow.webContents.on('did-fail-load', (event: any, errorCode: number, errorDescription: string, validatedURL: string) => {
      console.error(`Failed to load ${validatedURL}: ${errorCode} ${errorDescription}`)
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 400,
    height: 100,
    x: 100,
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  const overlayUrl = isDev
    ? 'http://localhost:5173/overlay.html'
    : `file://${path.join(appRoot, 'dist/overlay.html')}`

  overlayWindow.loadURL(overlayUrl)
  overlayWindow.setIgnoreMouseEvents(false)
  overlayWindow.setFocusable(false)

  if (isDev) {
    overlayWindow.webContents.openDevTools()
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

// IPC Handlers
ipcMain.handle('create-overlay', () => {
  if (!overlayWindow) {
    createOverlayWindow()
  }
})

ipcMain.handle('close-overlay', () => {
  if (overlayWindow) {
    overlayWindow.close()
    overlayWindow = null
  }
})

ipcMain.handle('update-overlay-text', (event: any, text: string) => {
  if (overlayWindow) {
    overlayWindow.webContents.send('text-updated', text)
  }
})

ipcMain.handle('update-overlay-settings', (event: any, settings: any) => {
  if (overlayWindow) {
    overlayWindow.webContents.send('settings-updated', settings)
  }
})

app.on('ready', () => {
  createMainWindow()
  
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    }
  ])
  
  Menu.setApplicationMenu(menu)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow()
  }
})

module.exports = { mainWindow, overlayWindow }
