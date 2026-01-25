import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => {
      ipcRenderer.send(channel, ...args)
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    },
    invoke: (channel: string, ...args: any[]) => {
      return ipcRenderer.invoke(channel, ...args)
    }
  },
  api: {
    createOverlay: () => ipcRenderer.invoke('create-overlay'),
    closeOverlay: () => ipcRenderer.invoke('close-overlay'),
    updateOverlayText: (text: string) => ipcRenderer.invoke('update-overlay-text', text),
    updateOverlaySettings: (settings: any) => ipcRenderer.invoke('update-overlay-settings', settings)
  }
})
