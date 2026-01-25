export interface AppSettings {
  translationDirection: 'ja-to-en' | 'en-to-ja'
  recognitionEngine: 'webSpeech' | 'whisper'
  translationEngine: 'google' | 'deepl' | 'openai'
  selectedAudioDevice?: string
  overlayOpacity: number
  overlayBackgroundColor: string
  overlayBorderColor: string
  overlayBorderWidth: number
  overlayFontSize: number
  overlayFontColor: string
  overlayFontFamily: string
  overlayTextAlign: 'left' | 'center' | 'right'
  overlayPadding: number
  overlayEnableBlur: boolean
  overlayShowTimestamp: boolean
  theme: 'light' | 'dark'
  apiKeys: {
    openaiKey?: string
    deeplKey?: string
    googleAppsScriptUrl?: string
  }
}

export interface TranslationResult {
  original: string
  translated: string
  sourceLanguage: string
  targetLanguage: string
  timestamp: number
}

export interface SpeechRecognitionEvent {
  transcript: string
  isFinal: boolean
  confidence: number
  interim?: string
}

export interface StreamingTranscription {
  interim: string
  final: string
  isFinal: boolean
  confidence: number
  language: 'ja' | 'en'
  timestamp: number
}

export interface StreamingTranslation {
  original: string
  partial: string
  final?: string
  isFinal: boolean
  sourceLanguage: 'ja' | 'en'
  targetLanguage: 'ja' | 'en'
  timestamp: number
  confidence?: number
}
