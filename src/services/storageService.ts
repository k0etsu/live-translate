import { AppSettings } from '@/types/index'

const STORAGE_KEY = 'live-translate-settings'
const DEFAULT_SETTINGS: AppSettings = {
  translationDirection: 'ja-to-en',
  recognitionEngine: 'webSpeech',
  translationEngine: 'google',
  selectedAudioDevice: undefined,
  overlayOpacity: 0.9,
  overlayBackgroundColor: '#1a1a1a',
  overlayBorderColor: '#ffffff',
  overlayBorderWidth: 2,
  overlayFontSize: 16,
  overlayFontColor: '#FFFFFF',
  overlayFontFamily: 'system-ui, -apple-system, sans-serif',
  overlayTextAlign: 'left',
  overlayPadding: 16,
  overlayEnableBlur: false,
  overlayShowTimestamp: true,
  theme: 'dark',
  apiKeys: {}
}

export class StorageService {
  static getSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS
    } catch (error) {
      console.error('Error reading settings:', error)
      return DEFAULT_SETTINGS
    }
  }

  static saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }

  static getApiKeys(): AppSettings['apiKeys'] {
    const settings = this.getSettings()
    return settings.apiKeys
  }

  static saveApiKeys(apiKeys: AppSettings['apiKeys']): void {
    const settings = this.getSettings()
    settings.apiKeys = apiKeys
    this.saveSettings(settings)
  }

  static setProviderPreference(recognitionEngine: 'webSpeech' | 'whisper', translationEngine: 'google' | 'deepl' | 'openai'): void {
    const settings = this.getSettings()
    settings.recognitionEngine = recognitionEngine
    settings.translationEngine = translationEngine
    this.saveSettings(settings)
  }

  static getProviderPreference() {
    const settings = this.getSettings()
    return {
      recognitionEngine: settings.recognitionEngine,
      translationEngine: settings.translationEngine
    }
  }

  static clearSettings(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
}
