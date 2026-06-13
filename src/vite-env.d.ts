export {}

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => void
        on: (channel: string, func: (...args: any[]) => void) => void
        invoke: (channel: string, ...args: any[]) => Promise<any>
      }
      api: {
        createOverlay: () => Promise<void>
        closeOverlay: () => Promise<void>
        updateOverlayText: (text: string) => Promise<void>
        updateOverlaySettings: (settings: any) => Promise<void>
      }
    }
    AudioContext: typeof AudioContext
    webkitAudioContext: typeof AudioContext
    webkitSpeechRecognition: any
  }
}
